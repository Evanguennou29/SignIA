import { useState } from "react";
import { BookOpen, CircleHelp } from "lucide-react";
import CameraWorkspace from "./CameraWorkspace";

export function Logo() {
  return <span className="logo">Sign<span className="apostrophe">’</span>IA<span className="logo-dot">.</span></span>;
}

export default function App() {
  const [help, setHelp] = useState(false);
  const [vocabulary, setVocabulary] = useState(false);
  return <>
    <a className="skip" href="#main">Aller au contenu</a>
    <header className="app-header">
      <a href="#/" aria-label="Sign’IA, accueil"><Logo /></a>
      <div className="app-title"><h1>Reconnaissance de signes LSF par caméra</h1><span>Le suivi local des mains est disponible, mais aucun signe LSF n’est reconnu sans modèle évalué.</span></div>
      <div className="header-actions"><button className="help-toggle" aria-expanded={vocabulary} onClick={() => setVocabulary(v => !v)}><BookOpen size={17} /> Vocabulaire</button><button className="help-toggle" aria-expanded={help} aria-controls="camera-help" onClick={() => setHelp(v => !v)}><CircleHelp size={18} /> Aide</button></div>
    </header>
    <main id="main" tabIndex={-1}>
      {help && <aside id="camera-help" className="quick-help"><button className="quick-help-close" onClick={() => setHelp(false)} aria-label="Fermer l’aide">×</button><strong>Conseils de cadrage</strong><p>Placez-vous face à la caméra, avec le visage, le buste et les deux mains visibles. Évitez le contre-jour et les mains hors cadre. Le miroir ne change que l’aperçu.</p></aside>}
      {vocabulary && <aside className="quick-help vocabulary-panel" aria-live="polite"><button className="quick-help-close" onClick={() => setVocabulary(false)} aria-label="Fermer le vocabulaire">×</button><strong>Vocabulaire pris en charge</strong><p>Aucun signe LSF n’est actuellement disponible : le modèle n’a pas encore été validé.</p></aside>}
      <CameraWorkspace />
    </main>
  </>;
}
