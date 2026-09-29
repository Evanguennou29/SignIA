import { readFile, writeFile, readdir } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const lock = JSON.parse(
  await readFile(new URL("package-lock.json", root), "utf8"),
);
const notices = [
  "Sign’IA — notices des dépendances distribuées",
  "Les licences de données et modèles LSF éventuels sont distinctes. Voir docs/DATA.md.",
  "Adaptations MediaPipe : wrappers ESM et correction de portée custom_dbg dans le chargeur généré.",
];
for (const [folder, metadata] of Object.entries(lock.packages)) {
  if (!folder || metadata.dev) continue;
  const directory = new URL(folder + "/", root);
  const pkg = JSON.parse(
    await readFile(new URL("package.json", directory), "utf8"),
  );
  notices.push(
    "\n--- " +
      pkg.name +
      " " +
      pkg.version +
      " ---\nLicence déclarée : " +
      pkg.license,
  );
  const files = (await readdir(directory)).filter((n) =>
    /^licen[cs]e|^copying|^notice/i.test(n),
  );
  for (const file of files) {
    try {
      notices.push(
        file + "\n" + (await readFile(new URL(file, directory), "utf8")),
      );
    } catch {
      /* Dossier de licences, informations amont dans DATA.md. */
    }
  }
  if (!files.length)
    notices.push(
      "Source : " +
        (typeof pkg.repository === "object"
          ? pkg.repository.url
          : (pkg.repository ?? pkg.homepage ?? "voir package-lock.json")),
    );
}
await writeFile(
  new URL("frontend/public/third-party-licenses.txt", root),
  notices.join("\n") + "\n",
);
console.log("Notices des dépendances distribuées générées.");
