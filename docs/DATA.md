# Ressources LSF, droits et attributions

Consultation : 29 septembre 2026. Aucune vidéo de corpus ni aucun poids LSF n’a été téléchargé, entraîné ou redistribué pour cette livraison.

## Dicta-Sign-LSF-v2

- Fiche : https://hdl.handle.net/11403/dicta-sign-lsf-v2/v1
- Article : https://aclanthology.org/2020.lrec-1.740/
- PDF : https://aclanthology.org/2020.lrec-1.740.pdf
- Belissen, Braffort et Gouiffès, LREC 2020.

L’article décrit un corpus de dialogues LSF, 16 personnes, 11 heures annotées et des annotations lexicales/non lexicales à l’image au format CSV, ainsi que des caractéristiques précalculées. Ces caractéristiques ne correspondent pas au contrat MediaPipe de Sign’IA : il faut réextraire les repères à partir des vidéos autorisées, ou développer/valider un adaptateur distinct.

La baseline utilise des couches récurrentes bidirectionnelles et vise une tâche hors ligne. Elle exploite un contexte futur et ne constitue pas un modèle causal prêt à exécuter ici. Les catégories lexical/non-lexical ne sont pas automatiquement un vocabulaire de mots isolés avec noms français validés.

Le resolver ORTOLANG n’a pas permis de confirmer les conditions détaillées et les autorisations de diffusion lors de cette session. La visibilité publique et la licence CC BY 4.0 de l’article ne suffisent pas à autoriser les vidéos, l’usage commercial ou la diffusion des poids. **Blocage de droits et de poids compatibles explicite.** Contacter le détenteur ou consulter la fiche complète avant utilisation.

## STVD-LSF

Source officielle : https://www.dataset-stvd.univ-tours.fr/lsf/index.html

La version bêta « Hello World » annonce environ 7,5 heures, 15 interprètes, 58 segments et un index CSV. La page décrit vidéos, audio/transcriptions et métadonnées temporelles ; elle ne fournit pas directement des annotations de classes de signes isolés prêtes pour ce pipeline.

L’accès est réservé à la **recherche non commerciale**. Il faut télécharger l’accord, le compléter et le signer, puis l’envoyer au contact indiqué ; la validation donne le mot de passe d’extraction. Sign’IA n’a pas signé ni envoyé cet accord. Aucun contournement, téléchargement de corpus ou extraction protégée n’a été tenté. Un déploiement public commercial ne serait pas autorisé par défaut ; les droits des vidéos et des modèles dérivés doivent être confirmés séparément.

## Procédure d’intégration

1. Obtenir les droits d’usage et vérifier les droits de redistribution des poids, conserver la preuve hors Git.
2. Faire valider les classes et segments par des personnes compétentes en LSF, avec consentements ou base de droits du corpus.
3. Adapter les annotations corpus vers le CSV documenté. Aucun convertisseur inventé pour un format inaccessible.
4. Affecter des identités disjointes à train/validation/test ; préserver ces identités au découpage des clips.
5. Réextraire mains/pose/visage avec les mêmes assets Tasks v1 et normalisation que le navigateur.
6. Évaluer, analyser les confusions et les transitions, tester la caméra réelle et la latéralité, puis revoir les droits de diffusion avant activation.

ASL, LSB/LSFB et LSF ne sont pas interchangeables. Aucun modèle de gestes génériques n’est présenté comme LSF.

## Dépendances et modèles de suivi

Les versions effectivement installées sont figées par `package-lock.json` et `ml/requirements.txt`.

| Ressource | Attribution/licence amont |
|---|---|
| React, Vite, Tailwind, TypeScript, Vitest | MIT pour React/Vite/Tailwind/Vitest ; Apache-2.0 pour TypeScript |
| Lucide | ISC |
| Playwright, axe-core / axe-core Playwright | Apache-2.0 pour Playwright ; MPL-2.0 pour axe-core et axe-core Playwright |
| MediaPipe / Tasks Vision | Google, Apache-2.0 pour le code ; licences et notices amont à conserver |
| ONNX Runtime | Microsoft, MIT |
| PyTorch | PyTorch contributors, BSD-3-Clause |
| OpenCV | Apache-2.0 pour la version 4.12 |
| NumPy | BSD-3-Clause |
| ONNX | Apache-2.0 |

Les modèles de suivi sont ceux liés par la documentation MediaPipe officielle : https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker ; https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker ; https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker . URL et empreinte exacte dans `assets-lock.json`. Source logicielle et licence : https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE . Lire aussi les model cards et conditions amont avant une redistribution commerciale. Le code Apache ne remplace pas les éventuelles conditions propres à un asset.

Le design, le logo abstrait et le code applicatif sont originaux. Les noms LSF futurs doivent venir d’annotations vérifiées. Aucune vidéo pédagogique inventée ni image de personne signante n’est utilisée.
