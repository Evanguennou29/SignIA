import { FEATURE_SIZE, SCHEMA } from "./features";

export const WINDOW_SIZE = 32;
export const MODEL_FRAMES = 8;
export const MODEL_FRAME_STEP = 4;
export type SignExample = { label: string; frames: number[][] };
export type PersonalClass = {
  label: string;
  template: number[][];
  threshold: number;
};
export type PersonalModel = {
  version: 1;
  schema: typeof SCHEMA;
  classes: PersonalClass[];
};

const databaseName = "signia-personal-signs";
const storeName = "examples";
let memory: SignExample[] = [];

function openDatabase(): Promise<IDBDatabase | null> {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(storeName, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readExamples(): Promise<SignExample[]> {
  const db = await openDatabase();
  if (!db) return memory;
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).getAll();
    request.onsuccess = () => {
      const rows = request.result as Array<SignExample & { key: string }>;
      resolve(rows.map(({ label, frames }) => ({ label, frames })));
      db.close();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function addExample(example: SignExample): Promise<void> {
  if (
    !example.label.trim() ||
    example.frames.length !== WINDOW_SIZE ||
    example.frames.some((frame) => frame.length !== FEATURE_SIZE)
  )
    throw Error("Séquence de calibrage invalide");
  const examples = await readExamples();
  const count = examples.filter((item) => item.label === example.label).length;
  const db = await openDatabase();
  if (!db) {
    memory = [...examples, example];
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(storeName, "readwrite")
      .objectStore(storeName)
      .put({ ...example, key: `${example.label}:${count}` });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.transaction!.oncomplete = () => db.close();
  });
}

export async function clearExamples(): Promise<void> {
  memory = [];
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).clear();
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

function frameDistance(a: number[], b: number[]): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < FEATURE_SIZE; i += 3) {
    if (a[i + 2] > 0 && b[i + 2] > 0) {
      const dx = a[i] - b[i];
      const dy = a[i + 1] - b[i + 1];
      sum += dx * dx + dy * dy;
      count++;
    }
  }
  return count ? Math.sqrt(sum / count) : 1;
}

export function temporalDistance(a: number[][], b: number[][]): number {
  const sample = (frames: number[][]) => frames.length === WINDOW_SIZE
    ? Array.from({ length: MODEL_FRAMES }, (_, i) => frames[1 + i * MODEL_FRAME_STEP])
    : frames.length === MODEL_FRAMES ? frames : null;
  const left = sample(a), right = sample(b);
  if (!left || !right) return Infinity;
  const previous = new Float64Array(MODEL_FRAMES + 1).fill(Infinity);
  const current = new Float64Array(MODEL_FRAMES + 1).fill(Infinity);
  previous[0] = 0;
  for (let i = 1; i <= MODEL_FRAMES; i++) {
    current.fill(Infinity);
    for (let j = Math.max(1, i - 2); j <= Math.min(MODEL_FRAMES, i + 2); j++) {
      current[j] = frameDistance(left[i - 1], right[j - 1]) + Math.min(
        current[j - 1],
        previous[j],
        previous[j - 1],
      );
    }
    previous.set(current);
  }
  return previous[MODEL_FRAMES] / MODEL_FRAMES;
}

export function fitPersonalModel(examples: SignExample[]): PersonalModel {
  const groups = new Map<string, SignExample[]>();
  examples.forEach((example) => {
    const group = groups.get(example.label) ?? [];
    group.push(example);
    groups.set(example.label, group);
  });
  const classes: PersonalClass[] = [];
  for (const [label, group] of groups) {
    if (group.length < 3) continue;
    const template = Array.from({ length: MODEL_FRAMES }, (_, frame) =>
      Array.from({ length: FEATURE_SIZE }, (_, feature) =>
        group.reduce((sum, item) => sum + item.frames[1 + frame * MODEL_FRAME_STEP][feature], 0) /
        group.length,
      ),
    );
    const leaveOneOut = group.map((heldOut, index) => {
      const peers = group.filter((_, i) => i !== index);
      const peerTemplate = Array.from({ length: MODEL_FRAMES }, (_, frame) =>
        Array.from({ length: FEATURE_SIZE }, (_, feature) =>
          peers.reduce((sum, item) => sum + item.frames[1 + frame * MODEL_FRAME_STEP][feature], 0) /
          peers.length,
        ),
      );
      return temporalDistance(heldOut.frames, peerTemplate);
    });
    const sorted = [...leaveOneOut].sort((x, y) => x - y);
    const threshold = Math.max(0.08, sorted[Math.floor(sorted.length * 0.8)] * 1.8);
    classes.push({ label, template, threshold });
  }
  return { version: 1, schema: SCHEMA, classes };
}

export type PretrainedManifest = {
  version: 1;
  language: "LSF";
  schema: typeof SCHEMA;
  source: string;
  frames: number;
  inputWindow: number;
  inputFps: number;
  sampleStep: number;
  quantization: number;
  classes: Array<{ label: string; threshold: number }>;
  sha256: string;
  binary: string;
};

export function decodePretrainedModel(
  manifest: PretrainedManifest,
  bytes: ArrayBuffer,
): PersonalModel {
  if (manifest.version !== 1 || manifest.language !== "LSF" || manifest.schema !== SCHEMA ||
      manifest.frames !== MODEL_FRAMES || manifest.inputWindow !== WINDOW_SIZE ||
      manifest.inputFps !== 15 || manifest.sampleStep !== MODEL_FRAME_STEP ||
      manifest.quantization !== 1000 || !manifest.classes.length ||
      !/^\/[\w/-]+\.bin$/.test(manifest.binary) || !/^[a-f0-9]{64}$/.test(manifest.sha256))
    throw Error("Manifeste de modèle incompatible");
  const expected = manifest.classes.length * MODEL_FRAMES * FEATURE_SIZE * 2;
  if (bytes.byteLength !== expected) throw Error("Taille de modèle incorrecte");
  const input = new DataView(bytes);
  const classes: PersonalClass[] = manifest.classes.map(({ label, threshold }, index) => {
    if (!label.trim() || !Number.isFinite(threshold) || threshold <= 0 || threshold > 0.85)
      throw Error("Classe de modèle invalide");
    const template = Array.from({ length: MODEL_FRAMES }, (_, frame) =>
      Array.from({ length: FEATURE_SIZE }, (_, feature) => {
        const offset = ((index * MODEL_FRAMES + frame) * FEATURE_SIZE + feature) * 2;
        return input.getInt16(offset, true) / manifest.quantization;
      }),
    );
    return { label, threshold, template };
  });
  return { version: 1, schema: SCHEMA, classes };
}

export function recognizeWindow(
  frames: number[][],
  model: PersonalModel,
): { label: string; confidence: number; distance: number } | null {
  let best: PersonalClass | undefined;
  let bestDistance = Infinity;
  let nextDistance = Infinity;
  for (const candidate of model.classes) {
    const distance = temporalDistance(frames, candidate.template);
    if (distance < bestDistance) {
      nextDistance = bestDistance;
      bestDistance = distance;
      best = candidate;
    } else if (distance < nextDistance) nextDistance = distance;
  }
  // Single-reference classes vary considerably between the corpus signer and
  // a live user. Widen the clip-derived threshold, while retaining an explicit
  // distance ceiling so arbitrary motion is still rejected.
  const acceptanceLimit = Math.min(1.2, best?.threshold ? best.threshold * 1.45 : 0);
  if (!best || bestDistance > acceptanceLimit) return null;
  const separation = nextDistance === Infinity ? 1 : Math.max(0, Math.min(1, (nextDistance - bestDistance) / (nextDistance + 1e-6)));
  if (model.classes.length > 1 && separation < 0.025) return null;
  const closeness = Math.max(0, Math.min(1, 1 - bestDistance / acceptanceLimit));
  const confidence = 0.58 + 0.40 * closeness * separation;
  return { label: best.label, confidence, distance: bestDistance };
}

/** Turns only confirmed labels into a readable draft; it never adds words. */
export function suggestPhrase(tokens: string[]): string {
  const words = tokens.map((word) => word.trim()).filter(Boolean);
  if (!words.length) return "";
  const normalized = words.map((word) => word.toLocaleLowerCase("fr-FR").replace(/[.!?,;:]+$/, ""));
  const exact = normalized.join(" ");
  const patterns: Record<string, string> = {
    "moi aimer toi": "Je t’aime.",
    "je aimer toi": "Je t’aime.",
    "moi vouloir manger": "Je veux manger.",
    "je vouloir manger": "Je veux manger.",
    "moi avoir faim": "J’ai faim.",
    "je avoir faim": "J’ai faim.",
  };
  if (patterns[exact]) return patterns[exact];
  const draft = words.join(" ").replace(/\s+/g, " ");
  return draft.charAt(0).toLocaleUpperCase("fr-FR") + draft.slice(1).replace(/[.!?]*$/, ".");
}
