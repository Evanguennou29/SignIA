import { useState } from "react";
import { BookOpen, CircleHelp } from "lucide-react";
import CameraWorkspace from "./CameraWorkspace";

export function Logo() {
  return <span className="logo"><svg className="logo-mark" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4.5c10.77 0 19.5 8.73 19.5 19.5S34.77 43.5 24 43.5 4.5 34.77 4.5 24 13.23 4.5 24 4.5Z"/><path d="M17 28.5V17.2c0-1.7 2.5-2 2.8-.1l.8 5.6V13.3c0-2 2.9-2 3 0l.3 9.2.4-7.7c.1-1.9 2.9-1.7 2.9.1v8.1l.8-5.4c.3-1.8 3-.9 2.7.8l-1.2 8.5c-.7 4.8-3.4 7.1-7.4 7.1-2.7 0-5.1-1.8-6.1-4.4l-1.5-3.9c-.6-1.6 1.6-2.8 2.5-1.2l1 1.8"/></svg><span>Sign<span className="apostrophe">’</span>IA</span></span>;
}

export default function App() {
  const [help, setHelp] = useState(false);
  const [vocabulary, setVocabulary] = useState(false);
  return <>
    <a className="skip" href="#main">Aller au contenu</a>
    <header className="app-header">
      <a href="#/" aria-label="Sign’IA, accueil"><Logo /></a>
      <div className="app-title"><h1>Reconnaissance de signes LSF par caméra</h1><span>Classification locale de signes isolés à partir d’exemples du dictionnaire vidéo.</span></div>
      <div className="header-actions"><button className="help-toggle" aria-expanded={vocabulary} onClick={() => setVocabulary(v => !v)}><BookOpen size={17} /> Vocabulaire</button><button className="help-toggle" aria-expanded={help} aria-controls="camera-help" onClick={() => setHelp(v => !v)}><CircleHelp size={18} /> Aide</button></div>
    </header>
    <main id="main" tabIndex={-1}>
      {help && <aside id="camera-help" className="quick-help"><button className="quick-help-close" onClick={() => setHelp(false)} aria-label="Fermer l’aide">×</button><strong>Conseils de cadrage</strong><p>Placez-vous face à la caméra, avec le visage, le buste et les deux mains visibles. Évitez le contre-jour et les mains hors cadre. Le miroir ne change que l’aperçu.</p></aside>}
      {vocabulary && <aside className="quick-help vocabulary-panel" aria-live="polite"><button className="quick-help-close" onClick={() => setVocabulary(false)} aria-label="Fermer le vocabulaire">×</button><strong>Vocabulaire</strong><p>Le modèle charge les classes extraites des vidéos disponibles. Pour remplacer une référence par votre façon de signer, sélectionnez le libellé et enregistrez trois prises caméra.</p></aside>}
      <CameraWorkspace />
    </main>
  </>;
}
