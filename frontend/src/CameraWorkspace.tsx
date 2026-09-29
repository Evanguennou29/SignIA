import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  CameraOff,
  Copy,
  Download,
  Trash2,
  ShieldCheck,
  Scan,
  Hand,
  Check,
  Clock,
} from "lucide-react";
import { useCamera } from "./useCamera";
import { FACE_INDICES, type Landmarks } from "./features";
const HAND_EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];
const POSE_EDGES = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
];
export default function CameraWorkspace() {
  const [text, setText] = useState(""),
    [notice, setNotice] = useState(""),
    [edited, setEdited] = useState(false),
    [mirror, setMirror] = useState(true),
    [points, setPoints] = useState(true),
    [online, setOnline] = useState(navigator.onLine);
  const canvas = useRef<HTMLCanvasElement>(null),
    lastPoints = useRef<Landmarks>({ left: [], right: [], pose: [], face: [] }),
    showPoints = useRef(points);
  showPoints.current = points;
  const draw = useCallback((landmarks: Landmarks) => {
    lastPoints.current = landmarks;
    const c = canvas.current,
      ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!showPoints.current) return;
    const group = (ps: Landmarks["pose"], edges: number[][], color: string) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      for (const [a, b] of edges) {
        if (
          !ps[a] ||
          !ps[b] ||
          (ps[a].visibility ?? 1) < 0.5 ||
          (ps[b].visibility ?? 1) < 0.5
        )
          continue;
        ctx.beginPath();
        ctx.moveTo(ps[a].x * c.width, ps[a].y * c.height);
        ctx.lineTo(ps[b].x * c.width, ps[b].y * c.height);
        ctx.stroke();
      }
      ps.forEach((p) => {
        if ((p.visibility ?? 1) < 0.5) return;
        ctx.beginPath();
        ctx.arc(p.x * c.width, p.y * c.height, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    };
    group(landmarks.left, HAND_EDGES, "#d9f36a");
    group(landmarks.right, HAND_EDGES, "#dcd6f7");
    group(landmarks.pose, POSE_EDGES, "#fff");
    group(
      FACE_INDICES.map((i) => landmarks.face[i]).filter(Boolean),
      [],
      "#d9f36a",
    );
  }, []);
  useEffect(() => draw(lastPoints.current), [points, draw]);
  const camera = useCamera((word) => {
    setText((t) => (t ? t + " · " : "") + word);
    setNotice("Signe validé : " + word);
  }, draw);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Texte copié.");
    } catch {
      setNotice(
        "Copie impossible. Sélectionnez le texte et utilisez le raccourci de copie.",
      );
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "signia-texte.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Export du texte lancé.");
  };
  const live = useRef({ state: camera.state, recognition: !!camera.manifest });
  live.current = { state: camera.state, recognition: !!camera.manifest };
  useEffect(() => {
    type Context = {
      registerTool: (
        tool: unknown,
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "read_signia_status",
            title: "Lire l’état de Sign’IA",
            description:
              "Lire l’état de la caméra et la disponibilité de la reconnaissance. Aucun texte ni repère corporel n’est retourné.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            execute(input: unknown) {
              if (
                !input ||
                typeof input !== "object" ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw Error("Aucun paramètre attendu");
              return { ...live.current };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* API expérimentale facultative. */
    }
    return () => lifecycle.abort();
  }, []);
  return (
    <div className="workspace">
      {!online && <div role="status" className="alert">Service indisponible : connexion requise pour charger les modèles de suivi.</div>}
      <div className="camera-grid">
        <section className="camera-panel" aria-label="Capture caméra">
          <div className="panel-header">
            <span>
              <span className={camera.active ? "status-dot active" : "status-dot"} /> Caméra
            </span>
            <span className="small-status" role="status">
              {camera.state}
            </span>
          </div>
          <div className="viewfinder">
            <video
              ref={camera.video}
              onLoadedMetadata={(e) => {
                if (canvas.current) {
                  canvas.current.width = e.currentTarget.videoWidth;
                  canvas.current.height = e.currentTarget.videoHeight;
                  draw(lastPoints.current);
                }
              }}
              muted
              playsInline
              style={{ transform: mirror ? "scaleX(-1)" : undefined }}
              aria-label="Flux de votre caméra"
            />
            <canvas
              ref={canvas}
              width={960}
              height={720}
              style={{ transform: mirror ? "scaleX(-1)" : undefined }}
              aria-hidden="true"
            />
            {!camera.active && (
              <div className="camera-empty">
                <span className="camera-icon">
                  <Camera size={31} />
                </span>
                <h2>Caméra inactive</h2>
                <span>Activez la caméra avec le bouton sous l’aperçu.</span>
              </div>
            )}
            {camera.state === "Chargement" && (
              <div className="loading-camera">
                <span className="spinner" />
                <p>Chargement du suivi local…</p>
                <p className="tiny">
                  Cela peut prendre quelques instants au premier lancement.
                </p>
              </div>
            )}
            <div className="frame-corners" aria-hidden="true" />
            {camera.active && camera.state !== "Chargement" && (
              <div className="tracking-label">
                <Scan size={15} />
                {camera.stats.hands} main{camera.stats.hands > 1 ? "s" : ""} ·
                buste {camera.stats.pose ? "détecté" : "absent"} · visage{" "}
                {camera.stats.face ? "détecté" : "absent"}
              </div>
            )}
          </div>
          {camera.error && (
            <div role="alert" className="alert">
              {camera.error}
            </div>
          )}
          <div className="camera-controls">
            <div className="camera-buttons">
              {camera.active ? (
                <button className="button stop" onClick={camera.stop}>
                  <CameraOff size={16} /> Arrêter la caméra
                </button>
              ) : (
                <button
                  className="button primary"
                  onClick={() => void camera.start()}
                >
                  <Camera size={16} /> Activer la caméra
                </button>
              )}
              <label className="camera-select">
                <span className="sr-only">Sélection de caméra</span>
                <select
                  value={camera.selected}
                  onChange={(e) => camera.setSelected(e.target.value)}
                  disabled={camera.active}
                >
                  <option value="">Caméra par défaut</option>
                  {camera.devices.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || "Caméra " + (i + 1)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="toggles">
              <label>
                <input
                  type="checkbox"
                  checked={mirror}
                  onChange={(e) => setMirror(e.target.checked)}
                />{" "}
                Miroir visuel
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={points}
                  onChange={(e) => setPoints(e.target.checked)}
                />{" "}
                Afficher les repères
              </label>
            </div>
          </div>
          <details className="capture-tip"><summary><Hand size={17} /> Conseils de cadrage</summary><p>Placez-vous face à la caméra, avec le visage, le buste et les deux mains visibles. Évitez le contre-jour et les mains hors cadre. Le miroir ne change que l’aperçu.</p></details>
        </section>
        <section className="text-panel" aria-label="Résultats et édition">
          <div className="panel-header">
            <span>Résultat textuel</span>
            <span className="badge">
              {camera.manifest
                ? "SIGNES ISOLÉS"
                : "MODÈLE INDISPONIBLE"}
            </span>
          </div>
          <div className="model-note">
            <span className="note-icon">
              <Clock size={19} />
            </span>
            <div>
              <strong>
                {camera.manifest
                  ? "Reconnaissance de signes isolés"
                  : "Modèle indisponible"}
              </strong>
              <p>
                {camera.manifest
                  ? "Vocabulaire défini. Les mots reconnus ne constituent pas une traduction grammaticale."
                  : "Le suivi repère votre mouvement. Aucun signe LSF ne sera reconnu tant qu’un modèle entraîné, autorisé et évalué n’est pas installé."}
              </p>
            </div>
          </div>
          {camera.modelError && (
            <p className="alert" role="alert">
              {camera.modelError}
            </p>
          )}
          <div className="provisional">
            <span>ÉTAT DE DÉTECTION</span>
            <p>{camera.provisional || (camera.active ? "Aucune main détectée" : "En attente de la caméra")}</p>
          </div>
          <label className="text-label" htmlFor="transcript">
            {edited
              ? "TEXTE MODIFIÉ"
              : "TEXTE · MODIFIABLE"}
          </label>
          <textarea
            id="transcript"
            value={text}
            maxLength={20000}
            onChange={(e) => {
              setText(e.target.value);
              setEdited(true);
            }}
            placeholder="Le résultat apparaîtra lorsqu’un modèle LSF sera disponible. Vous pouvez saisir ou corriger le texte."
          />
          <div className="text-tools">
            <button onClick={() => void copy()} disabled={!text}>
              <Copy size={16} /> Copier
            </button>
            <button onClick={download} disabled={!text}>
              <Download size={16} /> Exporter .txt
            </button>
            <button
              onClick={() => {
                setText("");
                setEdited(false);
                setNotice("Texte effacé.");
              }}
              disabled={!text}
            >
              <Trash2 size={16} /> Effacer
            </button>
          </div>
        </section>
      </div>
      <div className="session-bottom">
        <span>
          <ShieldCheck size={15} /> Aucune vidéo ni aucun repère enregistré.
        </span>
        <span>
          {camera.active && camera.stats.fps
            ? `${camera.stats.fps} images/s traitées · ${camera.stats.ms} ms pour la dernière mesure`
            : "Les performances s’affichent pendant le suivi."}
        </span>
      </div>
      <p className="toast" role="status" aria-live="polite">
        {notice && (
          <>
            <Check size={16} />
            {notice}
          </>
        )}
      </p>
    </div>
  );
}
