import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Scan,
  Type,
  ShieldCheck,
  Play,
  RotateCcw,
} from "lucide-react";
import { Orbit } from "./App";
import { validateManifest, type ModelManifest } from "./features";
export function HelpPage() {
  const [manifest, setManifest] = useState<ModelManifest | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/models/recognition.json", { signal: controller.signal })
      .then((r) => r.json())
      .then((m) => setManifest(validateManifest(m)))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <article className="reading-page">
      <span className="eyebrow">UN PÉRIMÈTRE CLAIR, UNE AMBITION OUVERTE</span>
      <h1>
        Ce que Sign’IA
        <br />
        <em>fait aujourd’hui.</em>
      </h1>
      <p className="reading-lead">
        Un suivi réel. Une reconnaissance à construire. Des limites visibles.
      </p>
      <div className="capability-grid">
        <section>
          <span className="badge available">DISPONIBLE</span>
          <h2>Détecter le mouvement</h2>
          <p>
            La caméra et MediaPipe extraient localement les repères des mains,
            du corps et du visage. Un repère détecté ne signifie pas qu’un signe
            a été compris.
          </p>
        </section>
        <section>
          <span className="badge">
            {manifest ? "MODÈLE INSTALLÉ" : "EN PRÉPARATION"}
          </span>
          <h2>Reconnaître un signe</h2>
          <p>
            {manifest
              ? "Classes installées : " + manifest.classes.slice(2).join(", ")
              : "Vocabulaire LSF reconnu : aucun. Aucun poids LSF entraîné et évalué n’est fourni. Le suivi ne produit donc jamais de mots à partir de votre caméra."}
          </p>
        </section>
        <section>
          <span className="badge">NON DISPONIBLE</span>
          <h2>Traduire une séquence</h2>
          <p>
            Reconnaître des mots isolés ne traduit pas la grammaire, les
            références dans l’espace ou les expressions de la LSF. Aucune
            traduction de conversation n’est annoncée.
          </p>
        </section>
      </div>
      <section className="help-section">
        <h2>Pour un bon cadrage</h2>
        <p>
          Placez-vous face à la caméra, à une distance qui laisse voir votre
          buste, votre visage et vos deux mains. Évitez le contre-jour, les
          objets devant les mains et les mouvements hors cadre. Les
          occultations, le flou et plusieurs personnes peuvent perturber le
          suivi.
        </p>
        <p>
          Le miroir est uniquement visuel. Les images traitées conservent leur
          orientation native. Le suivi s’arrête lorsque vous changez de page ou
          mettez l’onglet en arrière-plan.
        </p>
        <a className="button primary" href="#/camera">
          Ouvrir l’espace caméra <ArrowRight size={17} />
        </a>
      </section>
      <section className="help-section">
        <h2>Modèles & versions</h2>
        <p>
          Extraction : MediaPipe Tasks Vision 0.10.32. Hand Landmarker float16
          v1, Pose Landmarker Lite float16 v1 et Face Landmarker float16 v1. Ces
          modèles localisent des repères ; ils ne reconnaissent pas la LSF.
        </p>
        <p>
          {manifest
            ? `Reconnaissance installée : ${manifest.version}. Source : ${manifest.dataset}. Licence déclarée : ${manifest.license}. Macro-F1 déclarée : ${manifest.evaluation.macroF1}. Rapport : ${manifest.evaluation.report}. Ces informations proviennent du manifest du modèle.`
            : "Reconnaissance : aucun modèle installé, aucune mesure de précision disponible. Le pipeline fourni prépare un LSTM causal sur des fenêtres passées, puis exporte un modèle ONNX exécuté localement."}
        </p>
        <a
          className="source-link"
          href="https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker"
          target="_blank"
          rel="noreferrer"
        >
          Documentation MediaPipe <ArrowUpRight size={14} />
        </a>
      </section>
      <section className="help-section">
        <h2>Les données LSF, avec leurs conditions</h2>
        <div className="resource">
          <h3>Dicta-Sign-LSF-v2</h3>
          <p>
            Corpus de dialogues LSF avec annotations lexicales et non lexicales.
            La publication décrit des annotations à l’image. Les conditions
            précises du corpus doivent être confirmées sur sa fiche ORTOLANG
            avant récupération ou utilisation. Aucun fichier du corpus n’est
            redistribué ici.
          </p>
          <a
            className="source-link"
            href="https://hdl.handle.net/11403/dicta-sign-lsf-v2/v1"
            target="_blank"
            rel="noreferrer"
          >
            Fiche ORTOLANG <ArrowUpRight size={14} />
          </a>
          <a
            className="source-link"
            href="https://aclanthology.org/2020.lrec-1.740/"
            target="_blank"
            rel="noreferrer"
          >
            Publication scientifique <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="resource">
          <h3>STVD-LSF</h3>
          <p>
            La page officielle réserve l’accès à la recherche non commerciale
            après accord signé et validation. Des segments et un index sont
            décrits ; ils ne constituent pas directement des classes de signes
            isolés. Une annotation linguistique adaptée serait nécessaire.
          </p>
          <a
            className="source-link"
            href="https://www.dataset-stvd.univ-tours.fr/lsf/index.html"
            target="_blank"
            rel="noreferrer"
          >
            Conditions d’accès officielles <ArrowUpRight size={14} />
          </a>
        </div>
        <p>
          Les données d’autres langues des signes ne sont pas substituées à des
          données LSF. La baseline de Dicta-Sign utilise un réseau
          bidirectionnel et ne peut pas être présentée telle quelle comme une
          inférence sans délai en direct.
        </p>
      </section>
      <section className="help-section">
        <h2>Ce qui manque pour la reconnaissance</h2>
        <ol>
          <li>
            Des données LSF autorisées, des identités de personnes signantes et
            des annotations de classes validées.
          </li>
          <li>Un entraînement avec repos, signe inconnu et transitions.</li>
          <li>
            Une évaluation sur des personnes distinctes de l’entraînement, avec
            erreurs documentées.
          </li>
          <li>
            Des poids exportés, un rapport d’évaluation et un manifest indiquant
            le vocabulaire et les droits de diffusion.
          </li>
        </ol>
        <p>
          Une collecte future demanderait un consentement explicite dans un
          parcours séparé. L’application actuelle ne collecte pas de données
          d’apprentissage.
        </p>
      </section>
    </article>
  );
}
export function PrivacyPage() {
  return (
    <article className="reading-page">
      <span className="eyebrow">LA CONFIANCE FAIT PARTIE DE L’EXPÉRIENCE</span>
      <h1>
        Vos mouvements.
        <br />
        <em>Votre appareil.</em>
      </h1>
      <div className="privacy-intro">
        <ShieldCheck size={40} />
        <p>
          La caméra est inactive par défaut. Vous décidez quand elle s’ouvre, et
          quand elle s’arrête.
        </p>
      </div>
      <section className="help-section">
        <h2>Ce qui reste local</h2>
        <p>
          Les images de la caméra et les repères corporels sont traités dans
          votre navigateur. Ils ne sont ni envoyés à un serveur ni conservés.
          Les pistes vidéo et le traitement sont libérés à l’arrêt, en quittant
          l’espace caméra et lorsque l’onglet passe en arrière-plan.
        </p>
        <p>
          Aucun compte, cookie de suivi ou outil d’analyse d’audience n’est
          ajouté. L’hébergement reçoit les requêtes ordinaires de chargement de
          l’application et des modèles ; l’hébergeur peut conserver ses journaux
          d’accès, dont les adresses IP. Le code applicatif ne journalise aucun
          texte ni repère.
        </p>
      </section>
      <section className="help-section">
        <h2>Un historique volontaire</h2>
        <p>
          Votre texte reste en mémoire et disparaît au rechargement, sauf si
          vous activez l’historique et choisissez de l’enregistrer. L’historique
          stocke au maximum dix textes sur cet appareil. Le désactiver efface
          les textes enregistrés. Toute personne ayant accès à votre profil de
          navigateur pourrait les lire.
        </p>
        <p>
          Copier ou exporter crée une copie du texte à votre demande. Vous
          contrôlez ensuite ce fichier ou le contenu du presse-papiers.
        </p>
      </section>
      <section className="help-section">
        <h2>Une interface accessible</h2>
        <p>
          Les commandes ont des libellés explicites, un focus visible et
          fonctionnent au clavier. Les états sont décrits par du texte. Les
          animations respectent la préférence de réduction des mouvements. Les
          résultats provisoires ne sont pas annoncés à chaque image ; seuls les
          signes validés et les actions utiles le sont.
        </p>
        <p>
          Objectif : WCAG 2.2 AA. Des contrôles logiciels et visuels sont
          documentés dans le dépôt ; ils ne constituent pas une certification
          complète par des utilisateurs de technologies d’assistance.
        </p>
      </section>
      <section className="help-section">
        <h2>Une difficulté avec la caméra ?</h2>
        <ul>
          <li>
            Accès refusé : autorisez la caméra dans les paramètres du
            navigateur.
          </li>
          <li>
            Caméra occupée : fermez les autres applications utilisant la caméra.
          </li>
          <li>Aucune caméra : branchez-en une ou changez d’appareil.</li>
          <li>Modèles indisponibles : vérifiez la connexion puis réessayez.</li>
          <li>
            Suivi lent : améliorez l’éclairage et fermez les applications
            lourdes.
          </li>
        </ul>
      </section>
    </article>
  );
}
export function DemoPage() {
  const [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setStep((s) => {
          if (s >= 3) {
            setPlaying(false);
            return s;
          }
          return s + 1;
        }),
      1800,
    );
    return () => clearInterval(timer);
  }, [playing]);
  const stages = [
    {
      title: "Le mouvement",
      text: "Dans une session réelle, la caméra observe une image. Ici, le tracé est une illustration abstraite.",
      icon: Camera,
    },
    {
      title: "Les repères",
      text: "Les modèles de suivi localisent les mains, le buste et le visage. Ils ne comprennent pas une langue.",
      icon: Scan,
    },
    {
      title: "La reconnaissance",
      text: "Un modèle LSF validé analyserait une fenêtre de repères passés et proposerait une classe de signe.",
      icon: Scan,
    },
    {
      title: "Le texte",
      text: "Après stabilisation, le nom du signe pourrait être affiché. Cela ne constituerait pas une traduction de conversation.",
      icon: Type,
    },
  ];
  return (
    <section className="demo-page">
      <span className="badge demo-badge">
        DÉMONSTRATION · ILLUSTRATION DU PARCOURS
      </span>
      <h1>
        Du mouvement
        <br />
        <em>à la possibilité d’un mot.</em>
      </h1>
      <p>
        Cette animation explique le fonctionnement prévu. Elle n’utilise pas la
        caméra et ne représente aucun signe LSF authentifié.
      </p>
      <div className="demo-layout">
        <div className="demo-art">
          <Orbit />
          <span className="demo-label">Démonstration</span>
          <span className="demo-output">
            {step === 3 ? "[nom du signe]" : "Mouvement → repères"}
            <small>
              {step === 3
                ? "Texte illustratif. Aucun signe reconnu."
                : "Tracé abstrait, sans vidéo ni capture."}
            </small>
          </span>
        </div>
        <div className="demo-stages">
          {stages.map((s, i) => (
            <button
              key={s.title}
              className={i === step ? "demo-stage selected" : "demo-stage"}
              onClick={() => {
                setStep(i);
                setPlaying(false);
              }}
              aria-pressed={i === step}
            >
              <span>0{i + 1}</span>
              <div>
                <h2>{s.title}</h2>
                <p>{s.text}</p>
              </div>
              <s.icon size={22} />
            </button>
          ))}
        </div>
      </div>
      <div className="actions">
        <button
          className="button primary"
          disabled={playing}
          onClick={() => {
            setStep(0);
            setPlaying(true);
          }}
        >
          <Play size={16} /> Animer la démonstration
        </button>
        <button
          className="button secondary"
          onClick={() => {
            setStep(0);
            setPlaying(false);
          }}
        >
          <RotateCcw size={16} /> Réinitialiser
        </button>
        <a className="button secondary" href="#/camera">
          Explorer le suivi réel <ArrowUpRight size={16} />
        </a>
      </div>
    </section>
  );
}
