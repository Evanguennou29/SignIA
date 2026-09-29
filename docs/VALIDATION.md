# Validation de la livraison — 29 septembre 2026

## Vérifications exécutées

- `npm test` : **9 tests unitaires réussis** (normalisation, masques, causalité, fenêtres bornées, stabilisation, duplication/réarmement, refus de modèles incompatibles).
- `npm run build` : vérification TypeScript et build Vite réussis sur Node 24.13.0.
- Playwright sur **build de production**, Chromium 153 / Playwright 1.63 : **9 parcours réussis**. Le suivi utilise les vrais modèles MediaPipe sur un flux caméra synthétique du navigateur ; aucune personne ou performance LSF n’est impliquée.
- Pistes vidéo contrôlées : `readyState === ended` après arrêt et navigation ; redémarrage réussi. Aucun démarrage automatique.
- Refus d’autorisation, caméra absente, caméra occupée et chargement des modèles interrompu testés. Aucun texte fabriqué dans les résultats caméra.
- Édition manuelle, export `.txt`, sauvegarde volontaire, restauration et effacement du stockage après désactivation testés.
- Cinq routes vérifiées à 1440, 768, 390 et 320 px : aucun débordement horizontal.
- Inspection visuelle des captures complètes : accueil desktop/mobile, caméra desktop/mobile, aide tablette. Le panneau mobile a été agrandi après inspection pour préserver la lecture du texte sous le bouton.
- Focus initial clavier, réduction des mouvements et reflow de viewport équivalent au zoom 200 % contrôlés. Le vrai zoom navigateur avec technologies d’assistance reste à tester.
- axe-core : aucun problème détecté pour les règles automatisables WCAG 2/2.1/2.2 A/AA sur les cinq écrans. Ne vaut pas certification d’accessibilité complète.
- Python 3.12 / PyTorch 2.8 CPU : **5 tests logiciels réussis**, y compris entraînement synthétique d’une époque, sélection sur validation, test distinct, export ONNX, parité numérique PyTorch/ONNX Runtime et maintien du candidat inactif.
- Extraction Python MediaPipe/OpenCV exécutée sur une vidéo noire synthétique : fichier de repères produit, zéro reconnaissance attendue. Modèles réinitialisés par clip.
- WebMCP dans le navigateur supporté : outil `read_signia_status` enregistré avec schema et annotations attendus ; `{}` renvoie caméra inactive/reconnaissance false ; paramètres supplémentaires rejetés. Aucun texte ou repère exposé.
- Politique CSP du build : connexions limitées à la même origine. Aucun envoi d’images n’est implémenté.

## Limites de la preuve

Aucune évaluation LSF n’a eu lieu. Aucun corpus LSF, poids LSF ou classe lexicale active. Les résultats de tests synthétiques n’établissent aucune précision linguistique. Les mesures affichées dans l’UI sont locales et observées ; aucune valeur de latence générale n’est revendiquée.

Les tests de capture utilisent la caméra synthétique Chromium. Une séance sur caméra physique avec personnes signantes et un test Safari/iOS/Android restent nécessaires. Les tests automatisés ne couvrent pas toutes les technologies d’assistance, la précision des repères, les variantes de LSF ou les gestes réellement signés.

Les droits détaillés de Dicta-Sign et les droits d’accès STVD nécessitent une confirmation avant toute intégration. Voir DATA.md. Le candidat de modèle ne doit être activé qu’après validation linguistique, évaluation caméra et autorisation de diffusion.

La publication est confirmée uniquement par un statut de déploiement réussi et son URL. Les vérifications HTTPS après publication sont décrites dans le compte rendu de livraison.
