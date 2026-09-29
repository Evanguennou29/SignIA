# Sign’IA

Sign’IA est une application web qui ouvre la caméra et suit localement les mains, le corps et le visage avec MediaPipe. **Elle ne reconnaît actuellement aucun signe LSF.** Le suivi de points n’est pas une reconnaissance linguistique. Aucun mot n’est généré par une règle arbitraire.

![Aperçu statique de l’interface Sign’IA](docs/interface.svg)

Cet aperçu statique présente les panneaux caméra et texte sans inventer de reconnaissance. Le rendu dans le navigateur peut varier selon l’écran.

## Fonctionnalités

- Activation explicite de la caméra, sélection de caméra, aperçu miroir et affichage facultatif des repères.
- Suivi MediaPipe dans un Web Worker, sans transfert des images à un serveur.
- Arrêt et libération des pistes vidéo et du worker à la fermeture, au changement de visibilité ou à l’arrêt manuel.
- États d’erreur caméra, modèle de suivi et détection de main.
- Texte manuel modifiable, copie, effacement et export texte.
- Aide courte de cadrage et vocabulaire actuellement pris en charge : aucun signe.
- Pipeline d’apprentissage expérimental, inactif par défaut. Il ne comprend aucun jeu de données LSF ni poids de reconnaissance.

La reconnaissance de signes isolés, la traduction de séquences et de conversations ne sont pas opérationnelles. Les métriques linguistiques, les effectifs d’un jeu de test LSF et la latence de reconnaissance ne sont donc **pas disponibles**.

## Architecture

L’application est une SPA React et Vite. Le flux caméra reste dans le navigateur et les tâches de suivi s’exécutent dans un Web Worker. La normalisation des repères, les fenêtres temporelles, la stabilisation et les interfaces ONNX sont dans `frontend/src/`. `ml/` contient un pipeline PyTorch/ONNX qui attend des annotations et clips autorisés. Il n’y a pas de backend. Le manifest `frontend/public/models/recognition.json` déclare l’absence de modèle.

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

Les seuls modèles livrés sont les modèles génériques de suivi MediaPipe. Ils donnent des points de repère, pas des signes. Le vocabulaire LSF actif est vide.

Le dossier local `lsf-data` fourni par l’utilisateur contient 1 131 vidéos et 1 141 entrées de vocabulaire. Le dépôt amont ne déclare pas de licence vidéo par fichier ; sa licence MIT couvre le code du dépôt, pas les vidéos. La provenance comprend Éducation nationale, Elix et des vidéos YouTube de Laura Jauvert. Aucune vidéo ni aucun poids issu de ces vidéos n’est intégré au dépôt ou au site public. Voir [docs/DATA.md](docs/DATA.md) pour le contrôle détaillé et les références de droits.

Ce corpus ne permet pas de produire une évaluation exploitable : presque chaque signe n’a qu’une seule vidéo, aucune identité de personne signante n’est indiquée, neuf références de fichiers sont absentes et aucune classe n’est commune aux trois sources. Il ne permet donc ni séparation fiable des personnes entre apprentissage, validation et test, ni mesure honnête de généralisation. Aucun modèle n’a été entraîné à partir de ce dossier. L’utilisateur indique que les données sont libres de droit et autorise l’entraînement local ; les métadonnées amont ne suffisent toutefois pas à vérifier les droits d’utilisation et de redistribution des vidéos et des poids dérivés.

Une étude LaboSignes récente décrit un système de reconnaissance de signes isolés LSF, mais son dépôt public ne distribue pas les poids du modèle ni une licence de réutilisation applicable ; sa démonstration envoie le flux de repères à un service distant. Sign’IA ne transmet pas les données de caméra à ce service. [Article LaboSignes](https://doi.org/10.1145/3772363.3799328) · [Dépôt de démonstration](https://gitlab.lisn.upsaclay.fr/mtals/publications/chi2026-poster-labosignes).

Pour reprendre l’apprentissage, obtenir d’abord les droits d’accès et d’usage. Ensuite, fournir des clips isolés avec leurs annotations vérifiées, personnes, consentements, licence et temps de début/fin selon le schéma de `ml/schema.py`. Séparer les personnes entre apprentissage, validation et test avant tout fenêtrage. `ml/config.example.json` contient un gabarit ; ses noms de classes sont des exemples techniques et ne forment pas un vocabulaire Sign’IA. Le pipeline enregistre des métriques de classification par classe, macro-F1 et matrice de confusion. Aucun résultat linguistique n’est publié parce qu’aucune donnée réelle LSF n’a été évaluée.

La latence actuellement affichée concerne le suivi MediaPipe d’une image, non le temps de reconnaissance. Elle est mesurée côté navigateur pendant une session locale et dépend de l’appareil. Il n’existe pas encore de mesure de latence sur des signes.

## Déploiement

Le projet est statique : compiler avec `npm ci`, `npm run assets`, `npm run build`, puis publier le contenu du dossier `dist/` sur un hébergeur statique HTTPS qui sert les modules ES, workers et fichiers WASM de même origine. La caméra exige HTTPS en production. Cloudflare Pages et GitHub Pages hébergent les sites statiques ; GitHub Pages Free requiert un dépôt public. Aucun backend Python n’est requis.

Cloudflare Pages convient à ce site statique et gère HTTPS sur son sous-domaine public. Sur l’offre Free consultée le 29 septembre 2026, les requêtes vers les ressources statiques sont annoncées gratuites et sans plafond. Les limites documentées sont de 500 constructions par mois, 20 000 fichiers par site et 25 Mio par fichier. Le plus gros asset de suivi de ce build est le fichier WASM d’environ 14,2 Mio ; il reste sous cette limite. L’application n’utilise pas de Function ni de Worker facturé à l’usage. Le coût prévu est 0 € tant que le compte reste sur Free et n’ajoute aucun service payant. Vérifier les [tarifs des ressources Pages](https://developers.cloudflare.com/pages/functions/pricing/) et les [limites actuelles](https://developers.cloudflare.com/pages/platform/limits/) avant publication.

Configuration : utiliser le dossier `signia` comme racine, compiler avec `npm run build`, publier `dist/`, conserver le fichier `_headers` dans la sortie et choisir le nom du projet dans le compte. Pour un dépôt GitHub existant, le relier au projet Pages et régler la commande et le dossier comme ci-dessus. Pour une publication manuelle après authentification Cloudflare, lancer `npm exec --yes --package wrangler -- wrangler login`, puis `npm exec --yes --package wrangler -- wrangler pages deploy dist --project-name NOM-CHOISI` en remplaçant `NOM-CHOISI` par le nom retenu dans le compte. GitHub Pages est une autre option statique gratuite si le dépôt est public avec GitHub Free ; un dépôt privé exige un plan GitHub payant pour publier Pages.

Le projet Pages `signia-lsf-camera` est créé dans Cloudflare. Le déploiement public reste à publier : l’authentification Wrangler a expiré lors du retour OAuth. Une fois `wrangler login` achevé dans le même navigateur que celui ouvert par la commande, compiler puis publier `dist/` avec Wrangler. L’application ne devient pas une reconnaissance LSF par le seul fait d’être publiée.

## Mesures et limites

| Mesure | Résultat |
|---|---|
| Classes LSF reconnues | 0 |
| Signes LSF évalués | 0 |
| Macro-F1 et exactitude LSF | Non mesurées |
| Latence de reconnaissance LSF | Non mesurée |
| Séparation des personnes d’un test LSF | Sans objet, aucun corpus intégré |

Les suites logicielles et tests sur flux synthétique ne sont pas des tests linguistiques. La caméra physique, les personnes signantes, Safari/iOS et Android restent à contrôler sur appareils réels. La capacité à cadrer ses mains, l’éclairage et l’occultation peuvent affecter le suivi des points.

## Licences et attribution

Le code Sign’IA est publié sous la licence MIT incluse. Les dépendances et modèles de suivi conservent leurs licences et notices amont, répertoriées dans `frontend/public/third-party-licenses.txt` et [docs/DATA.md](docs/DATA.md). Aucun corpus, modèle LSF tiers ou poids volumineux n’est redistribué.

## GitHub

Le remote `origin` pointe vers le dépôt fourni : `https://github.com/Evanguennou29/SignIA.git`. L’utilisateur effectuera lui-même le push. Après vérification des fichiers, exécuter depuis le dossier du projet :

```sh
git status --short
git add README.md docs/DATA.md docs/VALIDATION.md
git commit -m "Document LSF data review and deployment status"
git push -u origin main
```

Ne pas ajouter le corpus, des vidéos de personnes, des fichiers locaux `.env`, des poids non autorisés ou des résultats d’entraînement privés. Le dossier `.cache/` est ignoré.
