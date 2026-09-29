import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("accueil caméra sobre, références chargées à la demande et texte éditable/exportable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Reconnaissance de signes LSF par caméra")).toBeVisible();
  await expect(page.getByRole("button", { name: "Activer la caméra" }).first()).toBeVisible();
  await expect(page.getByText("CAMÉRA INACTIVE")).toBeVisible();
  await expect(page.getByText(/Activez la caméra pour charger/)).toBeVisible();
  await expect(page.getByRole("button", { name: /vocabulaire/i })).toBeVisible();
  await page.getByRole("button", { name: /vocabulaire/i }).click();
  await expect(page.getByText(/sélectionnez-le dans l’outil d’entraînement/)).toBeVisible();
  await page.getByLabel("TEXTE · MODIFIABLE").fill("Texte saisi manuellement.");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter .txt" }).click();
  expect((await download).suggestedFilename()).toBe("signia-texte.txt");
  await page.getByRole("button", { name: "Copier" }).click();
  await expect(page.getByText("Texte copié.")).toBeVisible();
  await page.getByRole("button", { name: "Effacer" }).click();
  await expect(page.locator("textarea")).toHaveValue("");
});

test("aucun démarrage automatique, caméra synthétique et libération à l’arrêt", async ({ page }) => {
  await page.goto("/");
  expect(await page.locator("video").evaluate(v => (v as HTMLVideoElement).srcObject)).toBeNull();
  await page.getByRole("button", { name: "Activer la caméra" }).first().click();
  await expect(page.getByText("Aucune main détectée", { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText(/images\/s traitées/)).toBeVisible();
  await page.locator("video").evaluate(v => { (window as any).testStream = (v as HTMLVideoElement).srcObject; });
  await page.getByRole("button", { name: "Arrêter la caméra" }).click();
  expect(await page.evaluate(() => (window as any).testStream.getTracks().every((t: MediaStreamTrack) => t.readyState === "ended"))).toBe(true);
  await expect(page.getByText("CAMÉRA INACTIVE")).toBeVisible();
  await expect(page.locator("textarea")).toHaveValue("");
});

for (const [name, message] of [
  ["NotAllowedError", "L’accès à la caméra a été refusé"],
  ["NotFoundError", "Aucune caméra n’a été trouvée"],
  ["NotReadableError", "La caméra est occupée"],
]) {
  test("erreur caméra " + name, async ({ page }) => {
    await page.addInitScript(n => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("test", n); }; }, name);
    await page.goto("/");
    await page.getByRole("button", { name: "Activer la caméra" }).first().click();
    await expect(page.getByRole("alert")).toContainText(message);
    await expect(page.getByText("Caméra inactive", { exact: true })).toBeVisible();
  });
}

test("échec des modèles de suivi sans résultat inventé", async ({ page }) => {
  await page.route("**/models/*.task", route => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Activer la caméra" }).first().click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 60000 });
  expect(await page.locator("video").evaluate(v => (v as HTMLVideoElement).srcObject)).toBeNull();
  await expect(page.locator("textarea")).toHaveValue("");
});

test("aide, tailles mobiles, focus clavier et réduction des mouvements", async ({ page }) => {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Aide" }).click();
  await expect(page.getByText("Conseils de cadrage").last()).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeFocused();
});

test("contrôles automatisés WCAG 2.2 AA", async ({ page }) => {
  await page.goto("/");
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
});
