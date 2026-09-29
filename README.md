# Sign’IA

Sign’IA est une application web de reconnaissance de signes isolés LSF. Elle compare localement les mouvements de la caméra à des références temporelles dérivées du dictionnaire vidéo, avec DTW. Elle ne traduit pas une phrase ni une conversation.

![Aperçu statique de l’interface Sign’IA](docs/interface.svg)

Cet aperçu statique présente les panneaux caméra et texte sans inventer de reconnaissance. Le rendu dans le navigateur peut varier selon l’écran.

## Fonctionnalités

- Activation explicite de la caméra, sélection de caméra, aperçu miroir et affichage facultatif des repères.
- Suivi MediaPipe dans un Web Worker, sans transfert des images à un serveur.
- Arrêt et libération des pistes vidéo et du worker à la fermeture, au changement de visibilité ou à l’arrêt manuel.
- États d’erreur caméra, modèle de suivi et détection de main.
- Texte manuel modifiable, copie, effacement et export texte.
- Historique des libellés confirmés et proposition locale à partir de cet ordre. Quelques patrons explicites mettent en forme des séquences courantes ; les autres restent dans l’ordre reconnu. La proposition est à relire et ne traduit pas une conversation.
- Modèle de références temporelles issu des vidéos LSF disponibles, chargé par le navigateur et exécuté localement.
- Calibrage facultatif d’un signe avec au moins trois prises, pour remplacer la référence de base sur cet appareil.
- Seuils de distance élargis de 45 % et validation temporelle ramenée à 350 ms pour mieux tolérer les variations de cadrage et de rythme. Les mouvements éloignés restent rejetés ; avec une seule vidéo par classe, les confusions restent possibles.
- Aide de cadrage, texte corrigible, copie, effacement et export.

Le modèle de base utilise au plus une vidéo par classe. Les seuils plus souples visent à réduire les refus, sans mesure indépendante de leur effet sur les faux positifs. Il n’a pas été évalué sur des signants indépendants et aucune précision linguistique n’est revendiquée. L’historique et quelques patrons de phrase locaux aident à relire les libellés confirmés ; aucun LLM n’est appelé et aucune traduction de conversation n’est implémentée.

## Architecture

L’application est une SPA React et Vite. MediaPipe extrait les repères dans un Web Worker ; huit instants pris dans chaque fenêtre caméra de 32 images sont comparés par DTW aux modèles réduits du dictionnaire. Les références et les éventuels exemples personnels restent des repères numériques. Aucun flux caméra n’est enregistré ni envoyé à un serveur. Il n’y a pas de backend.

## Installation et lancement

Node.js 24 LTS est la version testée. Depuis ce dossier :

```sh
npm ci
npm run assets
npm run dev
```

Ouvrir l’adresse locale indiquée par Vite. L’accès caméra est permis sur `localhost` ou HTTPS. `npm run assets` récupère les modèles de suivi MediaPipe et leurs bibliothèques WASM, pas un modèle LSF. `assets-lock.json` fixe leur origine, version et empreinte SHA-256. Toute différence d’empreinte fait échouer la récupération.

Vérifications disponibles :

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Les tests navigateur emploient une caméra synthétique. Ils contrôlent le comportement du logiciel et ne valident ni la langue ni la précision des signes.

## Données et modèles

MediaPipe fournit les points de repère. Le modèle livré charge les références du dictionnaire dès le démarrage de la caméra ; trois prises supplémentaires permettent de remplacer localement une classe. Le modèle calcule une distance temporelle DTW sur des fenêtres normalisées identiques à celles issues de la caméra.

Le dossier `lsf-data` fourni localement contient 1 131 vidéos et 1 141 libellés. Le modèle livré contient 1 024 classes : neuf références de fichiers manquent, une vidéo apparaît sous deux libellés (l’alias est écarté) et 107 clips n’ont pas fourni de fenêtre complète avec le buste suivi. Le dépôt source ne déclare pas de licence vidéo par fichier ; sa licence MIT couvre le code, pas les vidéos. Le modèle dérivé est intégré à la publication pour que le site puisse le charger. Aucune vidéo n’est intégrée au dépôt. Voir [docs/DATA.md](docs/DATA.md) pour les sources, l’attribution et la réserve de droits.

Ce corpus ne permet pas une évaluation fiable : aucune identité de signant n’est indiquée et la plupart des classes n’ont qu’une vidéo. Le modèle livré est un classifieur de références qui apprend ces clips uniques ; les seuils sont estimés à partir de fenêtres voisines du même clip et ne constituent pas un test indépendant. L’utilisateur indique que les données sont libres de droit et autorise l’entraînement et l’intégration du modèle. Les métadonnées amont ne permettent pas, à elles seules, de vérifier les licences de chaque vidéo.

Pour régénérer localement les références, récupérer les assets de suivi avec `npm run assets`, installer `ml/requirements-single-example.txt`, puis lancer le script depuis PowerShell :

```powershell
python -m pip install -r ml/requirements-single-example.txt
python ml/train_single_example.py --dataset-root "C:\Users\evanf\Downloads\lsf-data-master\lsf-data-master" --vocabulary "C:\Users\evanf\Downloads\lsf-data-master\lsf-data-master\vocabulaire.json" --model-dir frontend/public/models --cache-dir .cache/lsf-single-example
npm run build
```

Le script réutilise ses repères intermédiaires dans le cache, n’écrit aucune vidéo et produit un fichier de références quantifiées, un manifeste et leur empreinte SHA-256. Le navigateur vérifie l’empreinte et les dimensions avant d’utiliser les poids. La même extraction MediaPipe et normalisation de repères sert aux vidéos d’entraînement et à la caméra.

Une étude LaboSignes récente décrit un système de reconnaissance de signes isolés LSF, mais son dépôt public ne distribue pas les poids du modèle ni une licence de réutilisation applicable ; sa démonstration envoie le flux de repères à un service distant. Sign’IA ne transmet pas les données de caméra à ce service. [Article LaboSignes](https://doi.org/10.1145/3772363.3799328) · [Dépôt de démonstration](https://gitlab.lisn.upsaclay.fr/mtals/publications/chi2026-poster-labosignes).

Pour entraîner un modèle général évaluable, il faudra fournir plusieurs clips isolés par classe avec identités de personnes, annotations vérifiées, consentements, licence et temps de début/fin selon le schéma de `ml/schema.py`. Séparer les signants entre apprentissage, validation et test avant tout fenêtrage. `ml/config.example.json` contient un gabarit ; ses noms de classes sont des exemples techniques et ne forment pas un vocabulaire Sign’IA. Le pipeline enregistre des métriques de classification par classe, macro-F1 et matrice de confusion. Aucun résultat linguistique indépendant n’est encore publié.

La durée affichée correspond à la dernière image traitée ; la reconnaissance DTW n’est calculée qu’une fois toutes les 200 ms environ. Cette valeur dépend de l’appareil, n’inclut pas le temps complet de stabilisation du signe et ne constitue pas une mesure de latence linguistique.

## Déploiement

L’application fonctionne sans backend. GitHub Pages publie une version statique en HTTPS, nécessaire pour l’accès à la caméra. Le dépôt `Evanguennou29/SignIA` utilise le workflow `.github/workflows/pages.yml` : il installe Node.js 24, récupère et vérifie les modèles MediaPipe, lance les tests, construit `dist/` avec le préfixe du site et déploie le résultat à chaque push sur `main`.

Pour activer la publication, ouvrir les paramètres du dépôt GitHub, puis **Pages**, et choisir **GitHub Actions** comme source. Depuis la racine du projet, pousser ensuite la branche `main`. Le workflow publie le site à l’adresse `https://evanguennou29.github.io/SignIA/`. L’adresse sera disponible après le premier déploiement réussi ; vérifier son état dans l’onglet Actions avant de la partager. GitHub Pages est disponible sans frais pour les dépôts publics avec GitHub Free ; les minutes Actions des dépôts publics sur les runners standards sont gratuites. [Documentation GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [Tarification GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

Le build Pages utilise `/SignIA/` comme racine des fichiers : le code, les poids, les fichiers WASM et le worker sont ainsi chargés depuis le chemin du dépôt. En local et sur un hébergeur configuré à la racine d’un domaine, le build conserve `/`. Le modèle LSF dérivé et redistribuable est inclus ; les vidéos du corpus ne le sont pas.

## Mesures et limites

| Mesure | Résultat |
|---|---|
| Reconnaissance | Références temporelles DTW extraites du corpus local, tolérance élargie de 45 % |
| Clips d’apprentissage | 1 024, un par classe |
| Classes LSF chargées | 1 024 |
| Signants de test indépendants | 0 |
| Effectif du test linguistique indépendant | 0 |
| Exactitude et macro-F1 linguistiques | Non mesurées |
| Latence de reconnaissance mesurée | Non mesurée |
| Proposition de phrase | Patrons explicites pour quelques séquences, sinon les libellés confirmés sont conservés dans l’ordre |

Le protocole logiciel teste les distances, le décodage des références et le rejet sur séquences synthétiques. Ce résultat ne valide pas la langue. Aucun jeu de test réel ni aucune séparation des signants n’a été réalisé ; il n’y a donc pas de métrique linguistique à publier. La latence de bout en bout doit être mesurée sur l’appareil et la caméra utilisés. Safari/iOS et Android restent à vérifier sur appareils réels.

## Licences et attribution

Le code Sign’IA est publié sous la licence MIT incluse. Les dépendances et modèles de suivi conservent leurs licences et notices amont, répertoriées dans `frontend/public/third-party-licenses.txt` et [docs/DATA.md](docs/DATA.md). Le corpus vidéo reste externe ; seul le petit fichier de références dérivé est redistribué avec le site.

## GitHub

Le remote `origin` pointe vers le dépôt fourni : `https://github.com/Evanguennou29/SignIA.git`. L’utilisateur effectuera lui-même le push. Après vérification des fichiers, exécuter depuis le dossier du projet :

```sh
git config --global --add safe.directory "C:/Users/evanf/Documents/Codex/2026-09-29/files-pasted-by-the-user-cr/outputs/signia"
git status --short
git add -A
git commit -m "Préparer le déploiement GitHub Pages"
git push -u origin main
```

Le corpus, les vidéos, les fichiers `.env`, `.wrangler/` et les caches sont exclus par `.gitignore`. Le modèle de références autorisé est inclus afin que le site puisse le charger.
