import { describe, it, expect } from "vitest";
import {
  CausalWindow,
  normalize,
  TemporalGate,
  validateManifest,
  FEATURE_SIZE,
  type Landmarks,
} from "./features";
const frame: Landmarks = {
  left: [{ x: 0.4, y: 0.6 }],
  right: [],
  pose: Array.from({ length: 33 }, (_, i) => ({
    x: i === 11 ? 0.4 : i === 12 ? 0.6 : 0.5,
    y: 0.5,
    visibility: 1,
  })),
  face: [],
};
describe("Contrat des repères", () => {
  it("centre sur les épaules, normalise et conserve les masques manquants", () => {
    const out = normalize(frame);
    expect(out.length).toBe(FEATURE_SIZE);
    expect(Array.from(out.slice(0, 3))).toEqual([-0.5, 0.5, 1]);
    expect(Array.from(out.slice(63, 66))).toEqual([0, 0, 0]);
  });
  it("refuse de fabriquer des repères sans buste fiable", () => {
    expect(normalize({ ...frame, pose: [] })).toEqual(
      new Float32Array(FEATURE_SIZE),
    );
  });
  it("résiste aux valeurs non finies", () => {
    expect(
      normalize({ ...frame, left: [{ x: NaN, y: 1 }] }).slice(0, 3),
    ).toEqual(new Float32Array(3));
  });
});
describe("Stabilisation des signes", () => {
  it("valide après maintien, déduplique et réarme après repos", () => {
    const gate = new TemporalGate(500, 450, 0.85);
    expect(gate.update(2, 0.95, 0)).toBe(false);
    expect(gate.update(2, 0.95, 500)).toBe(true);
    expect(gate.update(2, 0.95, 900)).toBe(false);
    gate.update(0, 1, 1000);
    gate.update(0, 1, 1500);
    expect(gate.update(2, 0.95, 1600)).toBe(false);
    expect(gate.update(2, 0.95, 2100)).toBe(true);
  });
  it("ne valide ni inconnu ni prédiction faible ni pic isolé", () => {
    const gate = new TemporalGate();
    expect(gate.update(1, 1, 0)).toBe(false);
    gate.update(2, 0.9, 100);
    gate.update(2, 0.5, 700);
    expect(gate.update(2, 0.99, 800)).toBe(false);
  });
});
describe("Fenêtre causale", () => {
  it("ne prend jamais une image future pour un échantillon passé", () => {
    const window = new CausalWindow(),
      a = new Float32Array([1]),
      b = new Float32Array([2]);
    window.push(a, 0);
    window.push(b, 100);
    expect(window.frames.map((x) => x[0])).toEqual([1, 1]);
    window.push(b, 200);
    expect(window.frames.map((x) => x[0])).toEqual([1, 1, 2, 2]);
  });
  it("borne la mémoire et casse une fenêtre après lacune", () => {
    const window = new CausalWindow();
    for (let i = 0; i < 90; i++)
      window.push(new Float32Array([1]), (i * 1000) / 15);
    expect(window.frames.length).toBe(32);
    window.push(new Float32Array([1]), 9000);
    expect(window.frames.length).toBe(1);
    window.push(new Float32Array([0]), 9100);
    expect(window.frames).toEqual([]);
  });
});
describe("Activation LSF", () => {
  it("garde un modèle absent ou candidat inactif", () => {
    expect(validateManifest({ status: "unavailable" })).toBeNull();
    expect(validateManifest({ status: "candidate" })).toBeNull();
  });
  it("rejette une autre langue et un manifest incomplet", () => {
    expect(() =>
      validateManifest({ status: "ready", language: "ASL" }),
    ).toThrow();
    expect(() =>
      validateManifest({ status: "ready", language: "LSF" }),
    ).toThrow();
  });
});
