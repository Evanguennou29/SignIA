import { mkdir, readFile, writeFile, cp, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const directory = new URL("../frontend/public/", import.meta.url);
const assets = [
  [
    "hand_landmarker.task",
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  ],
  [
    "pose_landmarker_lite.task",
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  ],
  [
    "face_landmarker.task",
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  ],
];
await mkdir(new URL("models/", directory), { recursive: true });
let lock;
try {
  lock = JSON.parse(
    await readFile(new URL("../assets-lock.json", import.meta.url), "utf8"),
  );
} catch {
  lock = {};
}
for (const [name, url] of assets) {
  const dest = new URL("models/" + name, directory);
  let data;
  try {
    data = await readFile(dest);
  } catch {
    const response = await fetch(url);
    if (!response.ok)
      throw Error("Échec du modèle " + name + ": " + response.status);
    data = Buffer.from(await response.arrayBuffer());
  }
  const sha256 = createHash("sha256").update(data).digest("hex");
  if (lock[name] && lock[name].sha256 !== sha256)
    throw Error("Empreinte inattendue : " + name);
  await writeFile(dest, data);
  lock[name] = { url, sha256, bytes: data.length };
  console.log(name + ": " + data.length + " octets, SHA-256 vérifié");
}
await writeFile(
  new URL("../assets-lock.json", import.meta.url),
  JSON.stringify(lock, null, 2) + "\n",
);
await cp(
  new URL("../node_modules/@mediapipe/tasks-vision/wasm/", import.meta.url),
  new URL("wasm/", directory),
  { recursive: true },
);
// MediaPipe 0.10.32 attend self.import dans les workers ES modules.
// Adapter le chargeur fourni sans eval, sans modifier le paquet installé.
for (const name of await readdir(new URL("wasm/", directory))) {
  if (name.endsWith(".js")) {
    const code = await readFile(new URL("wasm/" + name, directory), "utf8");
    // Le fallback debug amont dépend du hoisting non strict d’une fonction de bloc.
    // Un module ES est strict : utiliser une déclaration var dans ce fallback.
    const adapted = code.replace(
      "function custom_dbg(text){console.warn.apply(console,arguments)}",
      "var custom_dbg=function(text){console.warn.apply(console,arguments)};",
    );
    await writeFile(
      new URL("wasm/" + name.replace(/\.js$/, ".mjs"), directory),
      adapted + "\nexport default ModuleFactory;\n",
    );
  }
}
await mkdir(new URL("ort/", directory), { recursive: true });
for (const name of await readdir(
  new URL("../node_modules/onnxruntime-web/dist/", import.meta.url),
)) {
  if (/^ort-wasm-simd-threaded\.(wasm|mjs)$/.test(name))
    await cp(
      new URL("../node_modules/onnxruntime-web/dist/" + name, import.meta.url),
      new URL("ort/" + name, directory),
    );
}
