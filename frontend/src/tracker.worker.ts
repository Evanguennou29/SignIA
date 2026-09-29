import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  FaceLandmarker,
} from "@mediapipe/tasks-vision";
import {
  normalize,
  CausalWindow,
  TemporalGate,
  validateManifest,
  FEATURE_SIZE,
  type Landmarks,
  type ModelManifest,
} from "./features";
let hands: HandLandmarker, pose: PoseLandmarker, face: FaceLandmarker;
let manifest: ModelManifest | null = null;
let session: import("onnxruntime-web").InferenceSession | null = null;
let ort: typeof import("onnxruntime-web") | null = null;
let gate = new TemporalGate();
const windowBuffer = new CausalWindow();
let lastTime = -1;
const workerGlobal = self as typeof self & {
  import?: (url: string) => Promise<void>;
  ModuleFactory?: unknown;
};
workerGlobal.import = async (url: string) => {
  const module = await import(/* @vite-ignore */ url.replace(/\.js$/, ".mjs"));
  workerGlobal.ModuleFactory = module.default;
};
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      const files = await FilesetResolver.forVisionTasks(data.origin + "/wasm");
      hands = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: data.origin + "/models/hand_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      });
      pose = await PoseLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: data.origin + "/models/pose_landmarker_lite.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      face = await FaceLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: data.origin + "/models/face_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
      });
      let modelError = "";
      try {
        const response = await fetch(data.origin + "/models/recognition.json");
        if (!response.ok) throw Error("Manifest indisponible");
        manifest = validateManifest(await response.json());
        if (manifest) {
          const response = await fetch(data.origin + manifest.model);
          if (!response.ok) throw Error("Poids indisponibles");
          const bytes = await response.arrayBuffer();
          const digest = Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          )
            .map((v) => v.toString(16).padStart(2, "0"))
            .join("");
          if (digest !== manifest.sha256)
            throw Error("Empreinte des poids incorrecte");
          ort = await import("onnxruntime-web/wasm");
          ort.env.wasm.wasmPaths = data.origin + "/ort/";
          ort.env.wasm.numThreads = 1;
          session = await ort.InferenceSession.create(bytes, {
            executionProviders: ["wasm"],
          });
          gate = new TemporalGate(
            manifest.holdMs,
            manifest.releaseMs,
            manifest.threshold,
          );
        }
      } catch {
        manifest = null;
        session = null;
        modelError = "Le modèle LSF installé n’a pas pu être validé ou chargé.";
      }
      self.postMessage({ type: "ready", manifest, modelError });
    }
    if (data.type === "frame") {
      const start = performance.now(),
        t = data.timestamp;
      const image = data.image as ImageBitmap;
      let h, p, f;
      try {
        h = hands.detectForVideo(image, t);
        p = pose.detectForVideo(image, t);
        f = face.detectForVideo(image, t);
      } finally {
        image.close();
      }
      const landmarks: Landmarks = {
        left: [],
        right: [],
        pose: p.landmarks[0] ?? [],
        face: f.faceLandmarks[0] ?? [],
      };
      h.landmarks.forEach((points, i) => {
        if (h.handedness[i]?.[0]?.categoryName === "Left")
          landmarks.left = points;
        else landmarks.right = points;
      });
      let provisional = "",
        validated = "",
        confidence = 0;
      const features = normalize(landmarks);
      if (lastTime >= 0 && t - lastTime > 200) {
        windowBuffer.reset();
        gate.reset();
      }
      lastTime = t;
      if (session && manifest && ort) {
        if (!features.some((v) => v !== 0)) {
          windowBuffer.reset();
          gate.reset();
        } else {
          const buffer = windowBuffer.push(features, t);
          if (buffer.length === manifest.window) {
            const packed = new Float32Array(manifest.window * FEATURE_SIZE);
            buffer.forEach((x, i) => packed.set(x, i * FEATURE_SIZE));
            const output = await session.run({
              landmarks: new ort.Tensor("float32", packed, [
                1,
                manifest.window,
                FEATURE_SIZE,
              ]),
            });
            const logits = Array.from(output.logits.data as Float32Array);
            if (
              logits.length !== manifest.classes.length ||
              logits.some((v) => !Number.isFinite(v))
            )
              throw Error("Sortie du modèle incompatible");
            const max = Math.max(...logits);
            const exp = logits.map((v) => Math.exp(v - max));
            const total = exp.reduce((a, b) => a + b, 0);
            const index = logits.indexOf(max);
            confidence = exp[index] / total;
            if (index > 1 && confidence >= manifest.threshold)
              provisional = manifest.classes[index];
            if (gate.update(index, confidence, t))
              validated = manifest.classes[index];
          }
        }
      }
      self.postMessage({
        type: "result",
        landmarks,
        hands: h.landmarks.length,
        pose: !!p.landmarks.length,
        face: !!f.faceLandmarks.length,
        processingMs: performance.now() - start,
        provisional,
        validated,
        confidence,
        recognition: !!session,
      });
    }
  } catch (error) {
    console.error(
      "SignIA: erreur du moteur local",
      error instanceof Error ? error.message : "erreur inconnue",
    );
    self.postMessage({
      type: "error",
      message:
        "Le traitement local a échoué. Réessayez ou utilisez un navigateur récent.",
    });
  }
};
