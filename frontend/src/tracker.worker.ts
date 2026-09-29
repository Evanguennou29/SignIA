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
  type Landmarks,
} from "./features";
import { decodePretrainedModel, recognizeWindow, WINDOW_SIZE, type PersonalModel, type PretrainedManifest } from "./personalModel";
let hands: HandLandmarker, pose: PoseLandmarker, face: FaceLandmarker;
let gate = new TemporalGate(350, 350, 0.56);
const windowBuffer = new CausalWindow();
let lastTime = -1;
let lastMatchTime = -Infinity;
let lastProvisional = "";
let personalModel: PersonalModel | null = null;
let userModel: PersonalModel | null = null;
let pretrainedModel: PersonalModel | null = null;

function mergeModels() {
  const userLabels = new Set(userModel?.classes.map((item) => item.label) ?? []);
  const classes = [
    ...(pretrainedModel?.classes.filter((item) => !userLabels.has(item.label)) ?? []),
    ...(userModel?.classes ?? []),
  ];
  personalModel = classes.length ? { version: 1, schema: "signia-xy-mask-v1", classes } : null;
}
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
      userModel = data.personalModel?.classes?.length ? data.personalModel : null;
      mergeModels();
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
        const response = await fetch(data.origin + "/models/single-example.json");
        if (!response.ok) throw Error("Manifeste du modèle indisponible");
        const modelManifest = await response.json() as PretrainedManifest;
        if (modelManifest.source !== "parlr/lsf-data local videos")
          throw Error("Provenance du modèle incorrecte");
        const binaryResponse = await fetch(data.origin + modelManifest.binary);
        if (!binaryResponse.ok) throw Error("Poids du modèle indisponibles");
        const bytes = await binaryResponse.arrayBuffer();
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
          .map((value) => value.toString(16).padStart(2, "0")).join("");
        if (digest !== modelManifest.sha256) throw Error("Empreinte du modèle incorrecte");
        pretrainedModel = decodePretrainedModel(modelManifest, bytes);
      } catch {
        pretrainedModel = null;
        if (!modelError) modelError = "Le modèle du dictionnaire n’a pas pu être chargé.";
      }
      mergeModels();
      self.postMessage({ type: "ready", manifest: null, modelError, personalModelReady: !!personalModel,
        pretrainedReady: !!pretrainedModel, classCount: personalModel?.classes.length ?? 0,
        personalClassCount: userModel?.classes.length ?? 0 });
    }
    if (data.type === "model") {
      userModel = data.personalModel?.classes?.length ? data.personalModel : null;
      mergeModels();
      windowBuffer.reset();
      lastMatchTime = -Infinity;
      lastProvisional = "";
      gate = new TemporalGate(350, 350, 0.56);
      gate.reset();
      self.postMessage({ type: "model", personalModelReady: !!personalModel,
        pretrainedReady: !!pretrainedModel, classCount: personalModel?.classes.length ?? 0,
        personalClassCount: userModel?.classes.length ?? 0 });
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
        lastProvisional = "";
        lastMatchTime = -Infinity;
      }
      lastTime = t;
      if (personalModel) {
        if (!h.landmarks.length || !features.some((v) => v !== 0)) {
          windowBuffer.reset();
          gate.reset();
          lastProvisional = "";
          lastMatchTime = -Infinity;
        } else {
          const buffer = windowBuffer.push(features, t);
          const windowSize = WINDOW_SIZE;
          if (buffer.length === windowSize) {
            if (t - lastMatchTime >= 200) {
              lastMatchTime = t;
              const match = recognizeWindow(buffer.map((frame) => Array.from(frame)), personalModel);
              const index = match ? personalModel.classes.findIndex((item) => item.label === match.label) + 2 : 1;
              if (match) {
                confidence = match.confidence;
                provisional = match.label;
              }
              lastProvisional = provisional;
              if (gate.update(index, confidence, t)) validated = match?.label ?? "";
            } else {
              provisional = lastProvisional;
            }
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
        features: Array.from(features),
        recognition: !!personalModel,
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
