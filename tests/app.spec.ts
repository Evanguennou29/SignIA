import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("aucun démarrage automatique, édition, export et historique volontaire", async ({
  page,
}) => {
  await page.goto("/#/camera");
  await expect(
    page.getByText("Caméra inactive", { exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator("video")
      .evaluate((v) => (v as HTMLVideoElement).srcObject),
  ).toBeNull();
  await page
    .getByLabel("TEXTE VALIDÉ · MODIFIABLE", { exact: true })
    .fill("Texte corrigé par une personne.");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter .txt" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("signia-texte.txt");
  await page.getByLabel("Activer l’historique sur cet appareil").check();
  await page
    .getByRole("button", { name: "Enregistrer ce texte", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vos textes enregistrés" }),
  ).toBeVisible();
  await expect(page.locator("textarea")).toHaveValue("");
  await page.getByRole("button", { name: "Restaurer dans l’éditeur" }).click();
  await expect(page.locator("textarea")).toHaveValue(
    "Texte corrigé par une personne.",
  );
  await page.getByLabel("Activer l’historique sur cet appareil").uncheck();
  expect(
    await page.evaluate(() => localStorage.getItem("signia-history")),
  ).toBeNull();
});
test("vrai moteur MediaPipe sur caméra synthétique, arrêt et nettoyage à la navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error")
      console.log("Erreur navigateur du test synthétique : " + m.text());
  });
  await page.goto("/#/camera");
  await page
    .getByRole("button", { name: "Démarrer la caméra", exact: true })
    .click();
  await expect(
    page.getByText("Aucune main détectée", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.getByText(/images\/s traitées/)).toBeVisible();
  await expect(page.locator("textarea")).toHaveValue("");
  await page.locator("video").evaluate((v) => {
    (window as any).testStream = (v as HTMLVideoElement).srcObject;
  });
  await page.getByRole("button", { name: "Arrêter la caméra" }).click();
  expect(
    await page.evaluate(() =>
      (window as any).testStream
        .getTracks()
        .every((t: MediaStreamTrack) => t.readyState === "ended"),
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Démarrer la caméra", exact: true })
    .click();
  await expect(
    page.getByText("Aucune main détectée", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page.locator("video").evaluate((v) => {
    (window as any).testStream = (v as HTMLVideoElement).srcObject;
  });
  await page
    .getByRole("link", { name: "Le projet & ses limites", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ce que Sign’IA fait aujourd’hui." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as any).testStream
        .getTracks()
        .every((t: MediaStreamTrack) => t.readyState === "ended"),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
for (const [name, message] of [
  ["NotAllowedError", "L’accès à la caméra a été refusé"],
  ["NotFoundError", "Aucune caméra n’a été trouvée"],
  ["NotReadableError", "La caméra est occupée"],
]) {
  test("erreur caméra : " + name, async ({ page }) => {
    await page.addInitScript((n) => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("test", n);
      };
    }, name);
    await page.goto("/#/camera");
    await page
      .getByRole("button", { name: "Démarrer la caméra", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(message);
    await expect(
      page.getByText("Caméra inactive", { exact: true }),
    ).toBeVisible();
  });
}
test("échec des modèles arrête la caméra, sans résultat inventé", async ({
  page,
}) => {
  await page.route("**/models/*.task", (route) => route.abort());
  await page.goto("/#/camera");
  await page
    .getByRole("button", { name: "Démarrer la caméra", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 60000 });
  expect(
    await page
      .locator("video")
      .evaluate((v) => (v as HTMLVideoElement).srcObject),
  ).toBeNull();
  await expect(page.locator("textarea")).toHaveValue("");
});
test("démonstration indépendante et périmètre honnête", async ({ page }) => {
  await page.goto("/#/demo");
  await expect(
    page.getByText("DÉMONSTRATION · ILLUSTRATION DU PARCOURS"),
  ).toBeVisible();
  await page.getByRole("button", { name: /04 Le texte/ }).click();
  await expect(
    page.getByText("Texte illustratif. Aucun signe reconnu."),
  ).toBeVisible();
  expect(await page.locator("video").count()).toBe(0);
  await page.goto("/#/aide");
  await expect(page.getByText(/Vocabulaire LSF reconnu : aucun/)).toBeVisible();
});
test("responsive, focus, réduction des mouvements et absence de débordement", async ({
  page,
}) => {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const hash of [
      "#/",
      "#/camera",
      "#/demo",
      "#/aide",
      "#/confidentialite",
    ]) {
      await page.goto("/" + hash);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();
  // 200 % : le viewport CSS est réduit de moitié à résolution écran équivalente.
  await page.setViewportSize({ width: 720, height: 480 });
  await page.goto("/#/camera");
  await expect(
    page.getByRole("button", { name: "Démarrer la caméra", exact: true }),
  ).toBeVisible();
});
test("contrôles automatisés WCAG 2.2 AA sur les cinq écrans", async ({
  page,
}) => {
  for (const hash of [
    "#/",
    "#/camera",
    "#/demo",
    "#/aide",
    "#/confidentialite",
  ]) {
    await page.goto("/" + hash);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});
