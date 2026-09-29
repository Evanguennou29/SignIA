import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  CameraOff,
  Copy,
  Download,
  Trash2,
  ShieldCheck,
  ArrowUpRight,
  Scan,
  Hand,
  Check,
  Clock,
} from "lucide-react";
import { useCamera } from "./useCamera";
import { FACE_INDICES, type Landmarks } from "./features";
const HAND_EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];
const POSE_EDGES = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
];
type Entry = { text: string; date: string };
export default function CameraWorkspace() {
  const [text, setText] = useState(""),
    [notice, setNotice] = useState(""),
    [edited, setEdited] = useState(false),
    [mirror, setMirror] = useState(true),
    [points, setPoints] = useState(true),
    [remember, setRemember] = useState(false),
    [history, setHistory] = useState<Entry[]>([]),
    [online, setOnline] = useState(navigator.onLine);
  const canvas = useRef<HTMLCanvasElement>(null),
    lastPoints = useRef<Landmarks>({ left: [], right: [], pose: [], face: [] }),
    showPoints = useRef(points);
  showPoints.current = points;
  const draw = useCallback((landmarks: Landmarks) => {
    lastPoints.current = landmarks;
    const c = canvas.current,
      ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!showPoints.current) return;
    const group = (ps: Landmarks["pose"], edges: number[][], color: string) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      for (const [a, b] of edges) {
        if (
          !ps[a] ||
          !ps[b] ||
          (ps[a].visibility ?? 1) < 0.5 ||
          (ps[b].visibility ?? 1) < 0.5
        )
          continue;
        ctx.beginPath();
        ctx.moveTo(ps[a].x * c.width, ps[a].y * c.height);
        ctx.lineTo(ps[b].x * c.width, ps[b].y * c.height);
        ctx.stroke();
      }
      ps.forEach((p) => {
        if ((p.visibility ?? 1) < 0.5) return;
        ctx.beginPath();
        ctx.arc(p.x * c.width, p.y * c.height, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    };
    group(landmarks.left, HAND_EDGES, "#d9f36a");
    group(landmarks.right, HAND_EDGES, "#dcd6f7");
    group(landmarks.pose, POSE_EDGES, "#fff");
    group(
      FACE_INDICES.map((i) => landmarks.face[i]).filter(Boolean),
      [],
      "#d9f36a",
    );
  }, []);
  useEffect(() => draw(lastPoints.current), [points, draw]);
  const camera = useCamera((word) => {
    setText((t) => (t ? t + " · " : "") + word);
    setNotice("Signe validé : " + word);
  }, draw);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    try {
      if (localStorage.getItem("signia-history-enabled") === "true") {
        setRemember(true);
        const entries = JSON.parse(
          localStorage.getItem("signia-history") ?? "[]",
        );
        if (Array.isArray(entries))
          setHistory(
            entries
              .filter(
                (e) =>
                  typeof e?.text === "string" && typeof e?.date === "string",
              )
              .slice(0, 10),
          );
      }
    } catch {
      setNotice("Le stockage local est indisponible.");
    }
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const toggleHistory = (enabled: boolean) => {
    try {
      if (enabled) localStorage.setItem("signia-history-enabled", "true");
      else {
        localStorage.removeItem("signia-history-enabled");
        localStorage.removeItem("signia-history");
        setHistory([]);
      }
      setRemember(enabled);
    } catch {
      setNotice("Impossible d’activer le stockage dans ce navigateur.");
    }
  };
  const save = () => {
    try {
      const entries = [
        { text, date: new Date().toISOString() },
        ...history,
      ].slice(0, 10);
      localStorage.setItem("signia-history", JSON.stringify(entries));
      setHistory(entries);
      setNotice("Texte enregistré sur cet appareil.");
    } catch {
      setNotice("Le texte n’a pas pu être enregistré.");
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Texte copié.");
    } catch {
      setNotice(
        "Copie impossible. Sélectionnez le texte et utilisez le raccourci de copie.",
      );
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "signia-texte.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Export du texte lancé.");
  };
  const live = useRef({ state: camera.state, recognition: !!camera.manifest });
  live.current = { state: camera.state, recognition: !!camera.manifest };
  useEffect(() => {
    type Context = {
      registerTool: (
        tool: unknown,
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "read_signia_status",
            title: "Lire l’état de Sign’IA",
            description:
              "Lire l’état de la caméra et la disponibilité de la reconnaissance. Aucun texte ni repère corporel n’est retourné.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            execute(input: unknown) {
              if (
                !input ||
                typeof input !== "object" ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw Error("Aucun paramètre attendu");
              return { ...live.current };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* API expérimentale facultative. */
    }
    return () => lifecycle.abort();
  }, []);
  return (
    <div className="workspace">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">VOTRE ESPACE, VOTRE RYTHME</span>
          <h1>
            Place au <em>mouvement.</em>
          </h1>
          <p>
            Explorez le suivi en direct. Chaque image reste sur votre appareil.
          </p>
        </div>
        <span className="privacy-badge">
          <ShieldCheck size={17} /> Traitement local
        </span>
      </div>
      {!online && (
        <div role="status" className="alert">
          Vous êtes hors connexion. Le suivi déjà chargé peut continuer ; un
          redémarrage peut nécessiter une connexion.
        </div>
      )}
      <div className="camera-grid">
        <section className="camera-panel" aria-label="Capture caméra">
          <div className="panel-header">
            <span>
              <span className="status-dot" /> Votre caméra
            </span>
            <span className="small-status" role="status">
              {camera.state}
            </span>
          </div>
          <div className="viewfinder">
            <video
              ref={camera.video}
              onLoadedMetadata={(e) => {
                if (canvas.current) {
                  canvas.current.width = e.currentTarget.videoWidth;
                  canvas.current.height = e.currentTarget.videoHeight;
                  draw(lastPoints.current);
                }
              }}
              muted
              playsInline
              style={{ transform: mirror ? "scaleX(-1)" : undefined }}
              aria-label="Flux de votre caméra"
            />
            <canvas
              ref={canvas}
              width={960}
              height={720}
              style={{ transform: mirror ? "scaleX(-1)" : undefined }}
              aria-hidden="true"
            />
            {!camera.active && (
              <div className="camera-empty">
                <span className="camera-icon">
                  <Camera size={31} />
                </span>
                <h2>Un espace pour vos gestes.</h2>
                <p>
                  Placez les mains, le buste et le visage
                  <br />
                  dans le cadre, puis ouvrez la caméra.
                </p>
                <button
                  className="button lime"
                  onClick={() => void camera.start()}
                >
                  <Camera size={17} /> Démarrer la caméra
                </button>
                <span>La caméra démarre uniquement à votre demande.</span>
              </div>
            )}
            {camera.state === "Chargement" && (
              <div className="loading-camera">
                <span className="spinner" />
                <p>Chargement du suivi local…</p>
                <p className="tiny">
                  Cela peut prendre quelques instants au premier lancement.
                </p>
              </div>
            )}
            <div className="frame-corners" aria-hidden="true" />
            {camera.active && camera.state !== "Chargement" && (
              <div className="tracking-label">
                <Scan size={15} />
                {camera.stats.hands} main{camera.stats.hands > 1 ? "s" : ""} ·
                buste {camera.stats.pose ? "détecté" : "absent"} · visage{" "}
                {camera.stats.face ? "détecté" : "absent"}
              </div>
            )}
          </div>
          {camera.error && (
            <div role="alert" className="alert">
              {camera.error}
            </div>
          )}
          <div className="camera-controls">
            <div className="camera-buttons">
              {camera.active ? (
                <button className="button stop" onClick={camera.stop}>
                  <CameraOff size={16} /> Arrêter la caméra
                </button>
              ) : (
                <button
                  className="button primary"
                  onClick={() => void camera.start()}
                >
                  <Camera size={16} /> Ouvrir la caméra
                </button>
              )}
              <label className="camera-select">
                <span className="sr-only">Sélection de caméra</span>
                <select
                  value={camera.selected}
                  onChange={(e) => camera.setSelected(e.target.value)}
                  disabled={camera.active}
                >
                  <option value="">Caméra par défaut</option>
                  {camera.devices.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || "Caméra " + (i + 1)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="toggles">
              <label>
                <input
                  type="checkbox"
                  checked={mirror}
                  onChange={(e) => setMirror(e.target.checked)}
                />{" "}
                Miroir visuel
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={points}
                  onChange={(e) => setPoints(e.target.checked)}
                />{" "}
                Afficher les repères
              </label>
            </div>
          </div>
          <div className="capture-tip">
            <Hand size={17} />
            <p>
              Lumière face à vous, fond dégagé, mains entièrement visibles. Le
              miroir modifie seulement l’aperçu.
            </p>
          </div>
        </section>
        <section className="text-panel" aria-label="Résultats et édition">
          <div className="panel-header">
            <span>Les mots, à leur rythme.</span>
            <span className="badge">
              {camera.manifest
                ? "SIGNES ISOLÉS"
                : "RECONNAISSANCE EN PRÉPARATION"}
            </span>
          </div>
          <div className="model-note">
            <span className="note-icon">
              <Clock size={19} />
            </span>
            <div>
              <strong>
                {camera.manifest
                  ? "Reconnaissance de signes isolés"
                  : "Modèle indisponible"}
              </strong>
              <p>
                {camera.manifest
                  ? "Vocabulaire défini. Les mots reconnus ne constituent pas une traduction grammaticale."
                  : "Le suivi repère votre mouvement. Aucun signe LSF ne sera reconnu tant qu’un modèle entraîné, autorisé et évalué n’est pas installé."}
              </p>
              <a href="#/aide">
                Voir le périmètre réel <ArrowUpRight size={13} />
              </a>
            </div>
          </div>
          {camera.modelError && (
            <p className="alert" role="alert">
              {camera.modelError}
            </p>
          )}
          <div className="provisional">
            <span>RÉSULTAT PROVISOIRE</span>
            <p>{camera.provisional || "Aucun résultat provisoire."}</p>
          </div>
          <label className="text-label" htmlFor="transcript">
            {edited
              ? "TEXTE CORRIGÉ MANUELLEMENT"
              : "TEXTE VALIDÉ · MODIFIABLE"}
          </label>
          <textarea
            id="transcript"
            value={text}
            maxLength={20000}
            onChange={(e) => {
              setText(e.target.value);
              setEdited(true);
            }}
            placeholder="Votre texte apparaîtra ici après validation d’un signe. Vous pouvez aussi saisir ou corriger du texte."
          />
          <div className="text-tools">
            <button onClick={() => void copy()} disabled={!text}>
              <Copy size={16} /> Copier
            </button>
            <button onClick={download} disabled={!text}>
              <Download size={16} /> Exporter .txt
            </button>
            <button
              onClick={() => {
                setText("");
                setEdited(false);
                setNotice("Texte effacé.");
              }}
              disabled={!text}
            >
              <Trash2 size={16} /> Effacer
            </button>
          </div>
          <div className="history-option">
            <label>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => toggleHistory(e.target.checked)}
              />{" "}
              Activer l’historique sur cet appareil
            </label>
            <p>
              Facultatif. Le texte est conservé uniquement quand vous cliquez
              sur « Enregistrer ». Désactiver efface l’historique.
            </p>
            {remember && (
              <button
                className="button secondary"
                disabled={!text}
                onClick={save}
              >
                Enregistrer ce texte
              </button>
            )}
          </div>
        </section>
      </div>
      <div className="session-bottom">
        <span>
          <ShieldCheck size={15} /> Aucune vidéo ni aucun repère enregistré.
        </span>
        <span>
          {camera.active && camera.stats.fps
            ? `${camera.stats.fps} images/s traitées · ${camera.stats.ms} ms pour la dernière mesure`
            : "Les performances s’affichent pendant le suivi."}
        </span>
      </div>
      {history.length > 0 && (
        <section className="history-list">
          <h2>Vos textes enregistrés</h2>
          {history.map((entry, i) => (
            <article key={entry.date + i}>
              <span>{new Date(entry.date).toLocaleString("fr-FR")}</span>
              <p>{entry.text}</p>
              <button
                className="button secondary"
                onClick={() => {
                  setText(entry.text);
                  setEdited(true);
                  setNotice("Texte restauré dans l’éditeur.");
                }}
              >
                Restaurer dans l’éditeur
              </button>
            </article>
          ))}
        </section>
      )}
      <p className="toast" role="status" aria-live="polite">
        {notice && (
          <>
            <Check size={16} />
            {notice}
          </>
        )}
      </p>
    </div>
  );
}
