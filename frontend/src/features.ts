export const FACE_INDICES = [1, 4, 33, 133, 362, 263, 61, 291, 13, 14, 70, 300];
export const FEATURE_SIZE = 261;
export const SCHEMA = "signia-xy-mask-v1";
export class CausalWindow {
  frames: Float32Array[] = [];
  private previous: Float32Array | null = null;
  private previousTime = -1;
  private next = 0;
  reset() {
    this.frames = [];
    this.previous = null;
    this.previousTime = -1;
    this.next = 0;
  }
  push(features: Float32Array, timestamp: number) {
    if (
      !features.some((v) => v !== 0) ||
      !Number.isFinite(timestamp) ||
      timestamp <= this.previousTime
    ) {
      this.reset();
      return this.frames;
    }
    if (this.previousTime >= 0 && timestamp - this.previousTime > 200)
      this.reset();
    if (!this.previous) {
      this.next = timestamp;
      this.previous = features;
    }
    while (this.next <= timestamp + 1e-6) {
      this.frames.push(
        this.next >= timestamp - 1e-6 ? features : this.previous,
      );
      if (this.frames.length > 32) this.frames.shift();
      this.next += 1000 / 15;
    }
    this.previous = features;
    this.previousTime = timestamp;
    return this.frames;
  }
}
export type Point = { x: number; y: number; z?: number; visibility?: number };
export type Landmarks = {
  left: Point[];
  right: Point[];
  pose: Point[];
  face: Point[];
};
export function normalize(frame: Landmarks): Float32Array {
  const a = frame.pose[11],
    b = frame.pose[12];
  // Pas de position inventée : sans torse fiable, la fenêtre est invalidée.
  if (!a || !b || (a.visibility ?? 1) < 0.5 || (b.visibility ?? 1) < 0.5)
    return new Float32Array(FEATURE_SIZE);
  const width = Math.hypot(a.x - b.x, a.y - b.y);
  if (width < 0.02) return new Float32Array(FEATURE_SIZE);
  const cx = (a.x + b.x) / 2,
    cy = (a.y + b.y) / 2;
  const points = [
    ...Array.from({ length: 21 }, (_, i) => frame.left[i]),
    ...Array.from({ length: 21 }, (_, i) => frame.right[i]),
    ...Array.from({ length: 33 }, (_, i) => frame.pose[i]),
    ...FACE_INDICES.map((i) => frame.face[i]),
  ];
  const out = new Float32Array(FEATURE_SIZE);
  points.forEach((p, i) => {
    if (
      p &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      (p.visibility ?? 1) >= 0.5
    ) {
      out[i * 3] = (p.x - cx) / width;
      out[i * 3 + 1] = (p.y - cy) / width;
      out[i * 3 + 2] = 1;
    }
  });
  return out;
}
export class TemporalGate {
  private candidate = -1;
  private since = 0;
  private last = -1;
  private restSince: number | null = null;
  constructor(
    public holdMs = 500,
    public releaseMs = 450,
    public threshold = 0.85,
  ) {}
  reset() {
    this.candidate = -1;
    this.since = 0;
    this.last = -1;
    this.restSince = null;
  }
  update(index: number, confidence: number, timestamp: number) {
    if (index <= 1 || confidence < this.threshold) {
      this.candidate = -1;
      if (this.restSince === null) this.restSince = timestamp;
      if (timestamp - this.restSince >= this.releaseMs) this.last = -1;
      return false;
    }
    this.restSince = null;
    if (index !== this.candidate) {
      this.candidate = index;
      this.since = timestamp;
      return false;
    }
    if (timestamp - this.since >= this.holdMs && index !== this.last) {
      this.last = index;
      return true;
    }
    return false;
  }
}
export type ModelManifest = {
  status: "ready";
  language: "LSF";
  schema: string;
  model: string;
  sha256: string;
  classes: string[];
  window: number;
  fps: number;
  threshold: number;
  holdMs: number;
  releaseMs: number;
  license: string;
  dataset: string;
  version: string;
  evaluation: {
    signerIndependent: boolean;
    testSigners: number;
    macroF1: number;
    report: string;
  };
};
export function validateManifest(value: unknown): ModelManifest | null {
  if (!value || typeof value !== "object") return null;
  const m = value as ModelManifest;
  if (m.status !== "ready") return null;
  if (
    m.language !== "LSF" ||
    m.schema !== SCHEMA ||
    !/^\/models\/[a-zA-Z0-9_-]+\.onnx$/.test(m.model) ||
    !/^[a-f0-9]{64}$/.test(m.sha256) ||
    !Array.isArray(m.classes) ||
    m.classes.length < 3 ||
    m.classes[0] !== "__rest__" ||
    m.classes[1] !== "__unknown__" ||
    m.classes.some((c) => typeof c !== "string" || !c.trim()) ||
    new Set(m.classes).size !== m.classes.length ||
    m.window !== 32 ||
    m.fps !== 15 ||
    !(m.threshold >= 0.5 && m.threshold <= 1) ||
    !(m.holdMs >= 200 && m.holdMs <= 3000) ||
    !(m.releaseMs >= 200 && m.releaseMs <= 3000) ||
    !m.license ||
    !m.dataset ||
    !m.version ||
    !m.evaluation?.signerIndependent ||
    m.evaluation.testSigners < 1 ||
    !Number.isFinite(m.evaluation.macroF1) ||
    m.evaluation.macroF1 < 0 ||
    m.evaluation.macroF1 > 1 ||
    !m.evaluation.report
  )
    throw Error("Manifest LSF incomplet ou incompatible");
  return m;
}
