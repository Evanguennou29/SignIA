import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Camera,
  Play,
  ShieldCheck,
  MoveUpRight,
  Hand,
  ScanFace,
} from "lucide-react";
import CameraWorkspace from "./CameraWorkspace";
import { HelpPage, PrivacyPage, DemoPage } from "./Pages";
export function Logo() {
  return (
    <span className="logo">
      <svg aria-hidden="true" viewBox="0 0 40 40">
        <path d="M10 26C7 11 28 6 29 16S8 34 12 18" />
        <circle cx="29" cy="27" r="2" />
      </svg>
      Sign<span className="apostrophe">’</span>IA
      <span className="logo-dot">.</span>
    </span>
  );
}
export function Orbit() {
  return (
    <svg className="orbit" viewBox="0 0 560 430" fill="none" aria-hidden="true">
      <path
        d="M63 323C-3 237 84 100 228 128S486 315 441 351S212 285 250 149S474 48 488 124"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M101 339C15 190 149 23 315 93S540 256 398 290S147 200 212 75"
        stroke="currentColor"
        strokeWidth="1"
        opacity=".4"
      />
      <circle cx="228" cy="128" r="6" fill="#D9F36A" />
      <circle cx="441" cy="351" r="6" fill="#D9F36A" />
      <circle cx="488" cy="124" r="9" stroke="#D9F36A" strokeWidth="2" />
    </svg>
  );
}
function Home() {
  return (
    <>
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Aller au contenu
      </a>
      <header>
        <a href="#/" aria-label="Sign’IA, accueil">
          <Logo />
        </a>
        <nav aria-label="Navigation principale">
          <a href="#/camera">L’espace caméra</a>
          <a href="#/aide">Le projet & ses limites</a>
        </nav>
        <a className="nav-cta" href="#/camera">
          Essayer Sign’IA <ArrowUpRight size={16} />
        </a>
      </header>
      <main id="main" tabIndex={-1}>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <i /> LA LANGUE DES SIGNES FRANÇAISE, EN MOUVEMENT
            </span>
            <h1>
              Le mouvement
              <br />
              devient <em>langage.</em>
            </h1>
            <p className="lead">
              Un espace pour rapprocher les mondes.
              <br />
              Vos gestes, une caméra, de nouvelles possibilités
              <br className="desktop" /> pour se comprendre.
            </p>
            <div className="actions">
              <a className="button primary" href="#/camera">
                <Camera size={19} /> Ouvrir la caméra <ArrowUpRight size={18} />
              </a>
              <a className="button secondary" href="#/demo">
                <Play size={16} /> Voir une démonstration
              </a>
            </div>
            <p className="micro">
              <ShieldCheck size={15} /> Sans compte. Traitement sur votre
              appareil.
            </p>
          </div>
          <div className="hero-art">
            <div className="art-top">
              <span>UN AUTRE CHEMIN VERS LES MOTS</span>
              <MoveUpRight size={24} />
            </div>
            <Orbit />
            <div className="motion-label">
              <Hand size={19} /> Mouvement
            </div>
            <div className="art-bottom">
              <span className="art-tag">LSF</span>
              <span>
                Une langue vivante.
                <br />
                Toute sa singularité.
              </span>
              <span className="art-number">01 — ∞</span>
            </div>
            <span className="floating-word">
              Se comprendre<span>commence par un mouvement.</span>
            </span>
          </div>
        </section>
        <div className="scope-strip">
          <span className="badge">VERSION EXPLORATOIRE</span>
          <p>
            Le suivi corporel est disponible. La reconnaissance LSF attend un
            modèle validé.
          </p>
          <a href="#/aide">
            Comprendre le périmètre <ArrowRight size={17} />
          </a>
        </div>
        <section className="steps">
          <div className="section-heading">
            <span className="eyebrow">DU GESTE À LA RENCONTRE</span>
            <h2>
              Une fenêtre ouverte
              <br />
              sur votre mouvement.
            </h2>
            <p>
              Une expérience simple, et une ambition
              <br />
              qui se construit avec rigueur.
            </p>
          </div>
          <div className="step-grid">
            {[
              {
                icon: Camera,
                title: "Ouvrez votre caméra",
                text: "Installez-vous dans un espace éclairé. Gardez vos mains, votre buste et votre visage dans le cadre.",
              },
              {
                icon: ScanFace,
                title: "Explorez le suivi",
                text: "Visualisez les repères corporels en direct. Vos images restent sur votre appareil.",
              },
              {
                icon: Hand,
                title: "Préparez les mots",
                text: "Un modèle LSF validé permettra de reconnaître un vocabulaire précis. Cette étape est en préparation.",
              },
            ].map((s, i) => (
              <article className="step" key={s.title}>
                <div className="step-top">
                  <s.icon size={26} />
                  <span>0{i + 1}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="manifesto">
          <span className="eyebrow">UNE TECHNOLOGIE À SA JUSTE PLACE</span>
          <h2>
            La LSF est une langue.
            <br />
            <em>Pas une suite de gestes.</em>
          </h2>
          <p>
            Les mains, le regard, le corps et l’espace portent ensemble le sens.
            Reconnaître des signes isolés ne suffit pas à traduire une
            conversation. Sign’IA rend cette distinction visible, à chaque
            étape.
          </p>
          <a href="#/aide">
            Notre approche <ArrowUpRight size={17} />
          </a>
        </section>
      </main>
      <footer>
        <Logo />
        <span>Conçu pour se comprendre.</span>
        <a href="#/confidentialite">
          Confidentialité & accessibilité <ArrowUpRight size={14} />
        </a>
      </footer>
    </>
  );
}

export default function App() {
  const [route, setRoute] = useState(location.hash || "#/");
  useEffect(() => {
    const update = () => {
      setRoute(location.hash || "#/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  if (route === "#/") return <Home />;
  const page =
    route === "#/camera" ? (
      <CameraWorkspace />
    ) : route === "#/demo" ? (
      <DemoPage />
    ) : route === "#/confidentialite" ? (
      <PrivacyPage />
    ) : (
      <HelpPage />
    );
  return (
    <>
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Aller au contenu
      </a>
      <header>
        <a href="#/" aria-label="Sign’IA, accueil">
          <Logo />
        </a>
        <nav aria-label="Navigation principale">
          <a
            href="#/camera"
            aria-current={route === "#/camera" ? "page" : undefined}
          >
            L’espace caméra
          </a>
          <a
            href="#/aide"
            aria-current={route === "#/aide" ? "page" : undefined}
          >
            Le projet & ses limites
          </a>
        </nav>
        <a className="nav-cta" href="#/">
          Retour à l’accueil <ArrowUpRight size={16} />
        </a>
      </header>
      <main id="main" tabIndex={-1}>
        {page}
      </main>
      <footer>
        <Logo />
        <span>Conçu pour se comprendre.</span>
        <a href="#/confidentialite">
          Confidentialité & accessibilité <ArrowUpRight size={14} />
        </a>
      </footer>
    </>
  );
}
