import { useState, useRef, useEffect, useCallback } from "react";
import type { Landmarks, ModelManifest } from "./features";
export type CameraState =
  | "Caméra inactive"
  | "Chargement"
  | "Prêt"
  | "Aucune main détectée"
  | "Signe non reconnu";
export function cameraError(error: unknown) {
  const name = (error as { name?: string })?.name;
  return name === "NotAllowedError"
    ? "L’accès à la caméra a été refusé. Autorisez-le dans les paramètres de votre navigateur, puis réessayez."
    : name === "NotFoundError"
      ? "Aucune caméra n’a été trouvée. Branchez une caméra ou essayez un autre appareil."
      : name === "NotReadableError"
        ? "La caméra est occupée ou inaccessible. Fermez les autres applications qui l’utilisent."
        : name === "OverconstrainedError"
          ? "Cette caméra n’est plus disponible. Sélectionnez une autre caméra."
          : "La caméra n’a pas pu démarrer. Vérifiez que vous utilisez HTTPS et un navigateur récent.";
}
export function useCamera(
  onWord: (word: string) => void,
  onLandmarks: (points: Landmarks) => void,
) {
  const video = useRef<HTMLVideoElement>(null);
  const runtime = useRef<{
    worker: Worker | null;
    stream: MediaStream | null;
    generation: number;
    raf: number;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ worker: null, stream: null, generation: 0, raf: 0, timer: null });
  const wordRef = useRef(onWord),
    pointsRef = useRef(onLandmarks);
  wordRef.current = onWord;
  pointsRef.current = onLandmarks;
  const [state, setState] = useState<CameraState>("Caméra inactive"),
    [error, setError] = useState(""),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [selected, setSelected] = useState(""),
    [active, setActive] = useState(false),
    [stats, setStats] = useState({
      hands: 0,
      pose: false,
      face: false,
      ms: 0,
      fps: 0,
    }),
    [provisional, setProvisional] = useState(""),
    [manifest, setManifest] = useState<ModelManifest | null>(null),
    [modelError, setModelError] = useState("");
  const clear = useCallback(() => {
    const r = runtime.current;
    r.generation++;
    cancelAnimationFrame(r.raf);
    if (r.timer) clearTimeout(r.timer);
    r.timer = null;
    r.stream?.getTracks().forEach((t) => t.stop());
    r.stream = null;
    r.worker?.terminate();
    r.worker = null;
    if (video.current) video.current.srcObject = null;
  }, []);
  const stop = useCallback(() => {
    clear();
    setActive(false);
    setState("Caméra inactive");
    setProvisional("");
    setStats({ hands: 0, pose: false, face: false, ms: 0, fps: 0 });
    pointsRef.current({ left: [], right: [], pose: [], face: [] });
  }, [clear]);
  const list = useCallback(async () => {
    try {
      setDevices(
        (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "videoinput",
        ),
      );
    } catch {
      /* Les noms restent facultatifs. */
    }
  }, []);
  useEffect(() => {
    const media = navigator.mediaDevices;
    if (media) void list();
    media?.addEventListener("devicechange", list);
    const hide = () => {
      if (document.hidden) stop();
    };
    const leave = () => stop();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => {
      clear();
      media?.removeEventListener("devicechange", list);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
    };
  }, [clear, list, stop]);
  const start = async () => {
    clear();
    setError("");
    setModelError("");
    setManifest(null);
    setProvisional("");
    setState("Chargement");
    setActive(true);
    const r = runtime.current;
    const generation = r.generation;
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setError(
        "La caméra nécessite une adresse HTTPS et un navigateur compatible.",
      );
      setActive(false);
      setState("Caméra inactive");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 960 },
          height: { ideal: 720 },
          ...(selected
            ? { deviceId: { exact: selected } }
            : { facingMode: "user" }),
        },
        audio: false,
      });
      if (generation !== r.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      r.stream = stream;
      stream.getVideoTracks().forEach((t) =>
        t.addEventListener("ended", () => {
          if (generation === r.generation) {
            stop();
            setError(
              "La connexion à la caméra a été interrompue. Rebranchez-la puis réessayez.",
            );
          }
        }),
      );
      if (!video.current) throw Error("Vidéo absente");
      video.current.srcObject = stream;
      await video.current.play();
      if (generation !== r.generation) return;
      void list();
      const worker = new Worker(
        new URL("./tracker.worker.ts", import.meta.url),
        { type: "module" },
      );
      r.worker = worker;
      let busy = false,
        lastSent = -1000,
        previousVideo = -1;
      let lastReport = performance.now(),
        frames = 0;
      const fail = (message: string) => {
        if (generation !== r.generation) return;
        stop();
        setError(message);
      };
      r.timer = setTimeout(
        () =>
          fail(
            "Le chargement des modèles de suivi a expiré. Vérifiez la connexion, puis réessayez.",
          ),
        45000,
      );
      worker.onerror = () =>
        fail(
          "Modèles de suivi indisponibles. Vérifiez la connexion et réessayez.",
        );
      const loop = async (now: number) => {
        if (generation !== r.generation) return;
        r.raf = requestAnimationFrame(loop);
        if (
          busy ||
          now - lastSent < 1000 / 15 ||
          !video.current ||
          video.current.readyState < 2 ||
          video.current.currentTime === previousVideo
        )
          return;
        busy = true;
        lastSent = now;
        previousVideo = video.current.currentTime;
        try {
          const image = await createImageBitmap(video.current);
          if (generation !== r.generation) {
            image.close();
            return;
          }
          worker.postMessage({ type: "frame", timestamp: now, image }, [image]);
          r.timer = setTimeout(
            () => fail("Le suivi ne répond plus. Redémarrez la caméra."),
            15000,
          );
        } catch {
          busy = false;
          fail(
            "Le navigateur n’a pas pu traiter cette image. Essayez un navigateur récent.",
          );
        }
      };
      worker.onmessage = ({ data }) => {
        if (generation !== r.generation) return;
        if (data.type === "ready") {
          if (r.timer) clearTimeout(r.timer);
          setManifest(data.manifest);
          setModelError(data.modelError);
          setState("Prêt");
          r.raf = requestAnimationFrame(loop);
        }
        if (data.type === "error") fail(data.message);
        if (data.type === "result") {
          if (r.timer) clearTimeout(r.timer);
          busy = false;
          frames++;
          const now = performance.now();
          setState(
            data.hands
              ? data.recognition && !data.provisional
                ? "Signe non reconnu"
                : "Prêt"
              : "Aucune main détectée",
          );
          setProvisional(data.provisional);
          pointsRef.current(data.landmarks);
          if (data.validated) wordRef.current(data.validated);
          if (now - lastReport >= 700) {
            setStats({
              hands: data.hands,
              pose: data.pose,
              face: data.face,
              ms: Math.round(data.processingMs),
              fps: Math.round((frames * 1000) / (now - lastReport)),
            });
            frames = 0;
            lastReport = now;
          }
        }
      };
      worker.postMessage({ type: "init", origin: location.origin });
    } catch (e) {
      if (generation !== r.generation) return;
      stop();
      setError(cameraError(e));
    }
  };
  return {
    video,
    state,
    error,
    devices,
    selected,
    setSelected,
    active,
    stats,
    provisional,
    manifest,
    modelError,
    start,
    stop,
  };
}
