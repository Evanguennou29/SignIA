import { describe, expect, it } from "vitest";
import { decodePretrainedModel, fitPersonalModel, recognizeWindow, suggestPhrase, temporalDistance, WINDOW_SIZE, MODEL_FRAMES, type SignExample } from "./personalModel";
import { FEATURE_SIZE, SCHEMA } from "./features";

function sequence(offset = 0): number[][] {
  return Array.from({ length: WINDOW_SIZE }, (_, frame) => {
    const values = Array(FEATURE_SIZE).fill(0);
    values[0] = offset + frame / WINDOW_SIZE;
    values[1] = 0.25;
    values[2] = 1;
    return values;
  });
}

describe("modèle personnel de signes", () => {
  it("compare les fenêtres temporelles de longueur fixe", () => {
    expect(temporalDistance(sequence(), sequence())).toBe(0);
    expect(temporalDistance(sequence(), sequence(2))).toBeGreaterThan(1);
  });

  it("n’active que les classes apprises et rejette un mouvement éloigné", () => {
    const examples: SignExample[] = [0, 0.01, -0.01].map((offset) => ({ label: "bonjour", frames: sequence(offset) }));
    const model = fitPersonalModel(examples);
    expect(model.classes.map((item) => item.label)).toEqual(["bonjour"]);
    expect(recognizeWindow(sequence(), model)?.label).toBe("bonjour");
    expect(recognizeWindow(sequence(3), model)).toBeNull();
    expect(fitPersonalModel(examples.slice(0, 2)).classes).toHaveLength(0);
  });

  it("accepte une variation modérée mais conserve le rejet des mouvements éloignés", () => {
    const model = { version: 1 as const, schema: SCHEMA as typeof SCHEMA, classes: [{ label: "bonjour", template: sequence(), threshold: 0.12 }] };
    const slightlyDifferent = sequence(0.11);
    expect(recognizeWindow(slightlyDifferent, model)?.label).toBe("bonjour");
    expect(recognizeWindow(sequence(3), model)).toBeNull();
  });

  it("propose une phrase uniquement avec les libellés confirmés", () => {
    expect(suggestPhrase(["bonjour", "moi", "aider"])).toBe("Bonjour moi aider.");
    expect(suggestPhrase(["moi", "vouloir", "manger"])).toBe("Je veux manger.");
    expect(suggestPhrase([" ", ""])).toBe("");
  });

  it("charge un modèle local quantifié et reconnaît son exemple", () => {
    const source = sequence();
    const binary = new ArrayBuffer(MODEL_FRAMES * FEATURE_SIZE * 2);
    const view = new DataView(binary);
    for (let frame = 0; frame < MODEL_FRAMES; frame++)
      for (let feature = 0; feature < FEATURE_SIZE; feature++)
        view.setInt16((frame * FEATURE_SIZE + feature) * 2,
          Math.round(source[1 + frame * 4][feature] * 1000), true);
    const manifest = {
      version: 1 as const, language: "LSF" as const, schema: SCHEMA as typeof SCHEMA,
      source: "parlr/lsf-data local videos", frames: MODEL_FRAMES,
      inputWindow: WINDOW_SIZE, inputFps: 15, sampleStep: 4,
      quantization: 1000, classes: [{ label: "bonjour", threshold: 0.12 }],
      sha256: "a".repeat(64), binary: "/models/model.bin",
    };
    const model = decodePretrainedModel(manifest, binary);
    expect(model.classes).toHaveLength(1);
    expect(recognizeWindow(source, model)?.label).toBe("bonjour");
    expect(() => decodePretrainedModel(manifest, new ArrayBuffer(4))).toThrow();
  });
});
