# Architecture et contrat de modèle

React 19 + TypeScript + Vite, Tailwind 4 et CSS de composition. Contrôles natifs sémantiques ; icônes Lucide. Pas de backend, télémétrie, compte, vidéo sauvegardée ou collecte d’apprentissage. La branche caméra transmet uniquement des ImageBitmap **au worker local** ; les bitmaps sont fermés après extraction.

## Cinq couches

1. `useCamera.ts` : permissions, sélection, pistes, cycle de vie et frame scheduling (cible maximale 15 images/s). Jeton de génération pour arrêter aussi un flux retourné après annulation d’une demande de permission. Une seule image en vol, pas de file.
2. `tracker.worker.ts` : Hand/Pose/Face Landmarker en mode VIDEO, CPU, sur la même image et le même timestamp monotone `performance.now()` (ms). Modèles et WASM de même origine. MediaPipe 0.10.32 utilise un fallback `self.import` dans un module worker ; `assets.mjs` produit des wrappers `.mjs` du chargeur officiel (export ModuleFactory), importés dynamiquement, sans eval. Il adapte aussi la déclaration de la fonction de debug `custom_dbg` en déclaration `var`, pour conserver sa portée en mode strict ES module. Les fichiers du paquet installé restent inchangés.
3. `features.ts` et `ml/schema.py` : normalisation partagée et fenêtres causales.
4. Inférence ONNX/WASM facultative et `TemporalGate` : seuil, maintien, suppression des doublons et réarmement après repos/inconnu. Pas d’accès aux images futures.
5. UI : repères, états, résultat provisoire non annoncé image par image, mots validés éditables. Les mots sont séparés par ` · ` pour ne pas les faire passer pour une phrase traduite.

## `signia-xy-mask-v1`

Une frame = 261 float32 : 87 repères × `[x_norm, y_norm, présent]`.

- Main étiquetée `Left` par le détecteur : 21 repères, ordre MediaPipe.
- Main `Right` : 21 repères.
- Pose : 33 repères.
- Visage : indices `[1,4,33,133,362,263,61,291,13,14,70,300]`.
- Centre = milieu des épaules pose 11/12 ; échelle = distance euclidienne des épaules en coordonnées normalisées image.
- `x_norm=(x-centre_x)/échelle`, idem y. Le z n’est pas fusionné : ses conventions diffèrent entre tâches.
- Un repère absent/non fini, ou une visibilité pose < 0,5, vaut `[0,0,0]`. Sans épaules fiables ou largeur < 0,02, la frame entière est invalide, pas imputée avec un corps inventé.

Les coordonnées x/y sont normalisées par les dimensions natives de l’image. Les différences de ratio et de résolution sont un risque de généralisation à évaluer. L’overlay utilise les dimensions vidéo réelles et un affichage `object-fit: contain`.

### Miroir et latéralité

Les images d’inférence **ne sont jamais retournées**. Miroir CSS uniquement sur vidéo et canvas. Les labels Left/Right sont ceux du modèle sur l’image native, sans permutation additionnelle en JS ou Python. Les conventions anatomiques doivent être vérifiées sur les données choisies et avec une personne signante avant activation. Ne jamais augmenter les données par miroir sans traiter la latéralité et le sens linguistique.

### Temps et fenêtres

Entrée ONNX `landmarks` : `[1,32,261]`, sortie `logits` : `[1,n_classes]`. Batch fixe, opset 17. LSTM **unidirectionnel**, 96 unités, dernière sortie → tête linéaire. Fenêtre strictement passée. Chaque échantillon 15 Hz reprend la dernière frame observée **au plus tard** à son instant (maintien causal, aucune interpolation future). Une lacune >200 ms ou un buste perdu coupe la fenêtre. Le débit affiché compte les images effectivement traitées, pas les échantillons maintenus.

Les deux premières classes doivent être `__rest__`, `__unknown__`. Softmax calculé après export. Seuil minimal autorisé 0,5 ; valeur initiale suggérée 0,85, maintien 500 ms et réarmement 450 ms. Ces valeurs sont configurables dans le manifest, à calibrer sur validation. Une interruption longue réinitialise la stabilisation. Un même mot peut être reconnu à nouveau après repos/inconnu durable ; il n’est pas répété à chaque image.

## Confidentialité, stockage et performance

Aucun repère dans localStorage, aucun transcript dans les logs. Historique : opt-in + sauvegarde explicite, dix textes maximum. Navigation/désactivation de la caméra termine le worker (cela libère ses modèles/tenseurs) et arrête toutes les pistes. L’initialisation a un timeout de 45 s ; une frame bloquée est arrêtée après 15 s. Les erreurs techniques du moteur sont limitées au message d’erreur, sans frame ou repère.

Une future reconnaissance nécessite 32 pas/15 Hz ≈ 2,07 s de contexte initial + maintien. Ce n’est pas une latence de traduction mesurée. Le panneau affiche le temps de traitement observé d’une image (extraction + inférence éventuelle) et le débit réel du worker. Aucune latence ou précision marketing n’est annoncée.

## WebMCP

Outil facultatif `read_signia_status` : état caméra et booléen reconnaissance, aucun texte, image ou repère exposé. Schema vide, readOnlyHint=true, abort à la sortie. Sans support navigateur, aucun impact sur l’application. Les entrées supplémentaires sont rejetées.
