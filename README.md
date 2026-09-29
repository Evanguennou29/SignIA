# Sign’IA — Le mouvement devient langage

Application web française, sans compte, de capture caméra et de suivi local des mains, du corps et du visage. **Cette livraison ne reconnaît aucun signe LSF et ne traduit aucune conversation.** Aucun poids LSF entraîné n’est fourni. Les résultats caméra ne sont jamais simulés.

## Ce qui fonctionne

- Accueil éditorial responsive et identité SVG originale (le logo n’est pas un signe LSF).
- Démarrage explicite, arrêt, choix de caméra, miroir visuel et repères optionnels.
- Véritable extraction MediaPipe dans un Web Worker, avec une seule image en cours.
- Arrêt des pistes et libération du worker à la navigation, à l’arrêt et en arrière-plan.
- Erreurs d’autorisation, caméra absente/occupée, interruption du flux et modèles indisponibles.
- Texte éditable, copie, export UTF-8 `.txt`, effacement et historique local opt-in.
- Démonstration abstraite distincte, toujours indiquée comme illustrative.
- Pages périmètre, sources et confidentialité ; état « Modèle indisponible ».
- Pipeline d’import de clips autorisés, extraction, fenêtres causales, LSTM PyTorch, évaluation par personnes disjointes, export ONNX, vérification numérique et activation explicite.

## Lancer

Node.js **24 LTS** (versions vérifiées dans `package-lock.json`). Depuis ce dossier :

```sh
npm ci
npm run assets
npm run dev
```

Ouvrir l’adresse affichée (habituellement http://127.0.0.1:5173). Aucun `.env` n’est nécessaire. `npm run assets` récupère uniquement les modèles de suivi Google officiels et copie les runtimes WASM locaux. Les empreintes SHA-256 sont enregistrées et contrôlées dans `assets-lock.json`. Une empreinte différente provoque un échec. La reconnaissance n’est pas activée par cette commande.

```sh
npm test
npm run build
npm run preview
npx playwright install chromium
# Lancer les tests contre l’URL de preview ; variable SIGNIA_TEST_URL facultative.
npm run test:e2e
```

La caméra requiert HTTPS ou localhost, un navigateur récent avec WASM, OffscreenCanvas, ImageBitmap et module workers. Safari/iOS et les appareils mobiles physiques restent à valider. Les dimensions mobiles sont testées dans Chromium ; ce n’est pas une mesure matérielle mobile.

## Organisation

```text
frontend/src/             UI, capture, extraction, normalisation et stabilisation
frontend/public/models/  manifest ; poids récupérés/installés hors Git
ml/                      extraction Python, entraînement, évaluation et activation
scripts/assets.mjs       récupération reproductible des modèles de suivi
docs/                    architecture, données/licences et validation
tests/                   parcours navigateur et accessibilité automatisée
.github/workflows/       CI frontend et ML
```

Un backend d’inférence n’est pas nécessaire : les images et repères ne quittent pas le navigateur. Les futurs poids ONNX sont exécutés localement. Aucun FastAPI ni WebSocket inutile n’est ajouté.

## Données et apprentissage

Consulter [docs/DATA.md](docs/DATA.md) avant tout téléchargement. STVD-LSF impose un accord signé et une utilisation de recherche non commerciale. Les droits précis de Dicta-Sign-LSF-v2 et des éventuels poids dérivés doivent être confirmés. La licence d’une publication n’est pas celle des vidéos.

Créer un environnement Python **3.12** :

```sh
python -m venv .venv
# Activer .venv selon votre système.
python -m pip install torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r ml/requirements.txt
cd ml
python -m unittest test_pipeline
cd ..
```

Préparer un CSV de clips annotés et autorisés. Aucun exemple linguistique inventé n’est fourni. Colonnes obligatoires : `video,signer,label,license,consent_reference,start_ms,end_ms`. Les chemins vidéo sont relatifs au dossier de données autorisées. `start_ms` inclusif et `end_ms` exclusif délimitent un clip isolé. Fournir aussi des clips de repos `__rest__`, d’inconnu `__unknown__` et des transitions correctement annotées. `consent_reference` peut référencer la documentation de droits du corpus ; ne pas ajouter de données personnelles au dépôt.

```sh
python ml/extract.py --manifest data/clips.csv --data-root data/videos --output data/features --models frontend/public/models --rights-confirmed
```

Copier `ml/config.example.json` vers `data/config.json`, remplacer les classes fictives et préciser les personnes dans chaque partition. Toutes les classes doivent être présentes dans chaque partition. Les partitions sont disjointes par personne, avant génération des fenêtres : aucune fuite entre entraînement, validation et test.

```sh
python ml/train.py --data data/features --config data/config.json --output runs/lsf-v1
```

L’entraînement sauvegarde `best.pt`, `evaluation.json`, `lsf.onnx` et `recognition.candidate.json`. La meilleure époque est choisie sur la validation ; le test est évalué ensuite. Le rapport fournit macro-F1, matrice de confusion, F1 par classe et tailles. Il évalue des fenêtres de signes isolés, **pas** une traduction ou une segmentation continue. Une mesure par séquence, une analyse d’erreurs linguistique, des tests de transitions et une validation caméra restent nécessaires avant toute promesse publique.

Le candidat reste inactif. Après revue des annotations, des métriques, du comportement caméra, de la latéralité et des droits de diffusion :

```sh
python ml/activate.py --source runs/lsf-v1 --target frontend/public/models --reviewed-and-authorized
npm run build
```

Le navigateur exige un manifest LSF compatible, une empreinte des poids correcte et un rapport d’évaluation déclaré. Ces contrôles logiciels ne prouvent pas à eux seuls la validité linguistique ou juridique des déclarations. Aucun poids aléatoire ni modèle d’une autre langue n’est livré comme LSF.

## Déployer

Site statique : `npm ci && npm run assets && npm run build`, puis publier **dist/** sur un hébergement HTTPS avec support des fichiers WASM et workers de même origine. React utilise des routes par hash ; aucun serveur de routage n’est nécessaire. Le fichier `.openai/hosting.json` décrit le site Sites de cette livraison. Le déploiement Sites est géré via le plugin et son workflow de source/archives. Pour un autre hébergeur, utiliser les mêmes fichiers de `dist/`.

Après publication, contrôler le chargement de chaque modèle, les types MIME des `.mjs`/`.wasm`, la caméra, l’arrêt, les erreurs et les tailles mobiles. Les scripts sont servis localement ; aucun CDN externe n’est nécessaire au fonctionnement de l’application. Pas de service Python à héberger.

## GitHub

Le code, le lockfile, la CI et les documents sont prêts pour un dépôt GitHub. Les données, poids volumineux, dépendances, fichiers `.env`, résultats de tests et entraînements sont exclus. L’historique Sites peut comporter un commit créé lors de la publication. Aucun dépôt GitHub utilisateur n’est créé sans URL ou destination choisie. Pour pousser : créer/choisir un dépôt, ajouter un remote GitHub, puis pousser la branche existante ; aucun secret dans le code.

## Limites

Vocabulaire LSF actif : **0 classe**. Précision LSF : **non mesurée**. La détection peut échouer en cas d’occultation, faible lumière, mouvement rapide ou plusieurs personnes. Les performances affichées sont le débit traité et le temps de traitement d’une image, pas une latence complète de traduction. Une fenêtre future de 32 pas à 15 Hz demande environ 2,07 s d’historique, puis le maintien temporel configuré. Les petites tailles et le zoom sont contrôlés ; la conformité WCAG complète demande des essais humains complémentaires. Voir [docs/VALIDATION.md](docs/VALIDATION.md).
