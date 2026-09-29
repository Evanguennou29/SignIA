# Architecture

Sign’IA is a static React and Vite application. There is no backend and no image or landmark upload. The browser asks for camera permission only after an explicit user action. Stopping the camera closes its media tracks and terminates the worker.

## Camera and tracking

`CameraWorkspace.tsx` owns the camera display, editing field, controls and camera help. `useCamera.ts` manages the camera stream and worker lifecycle. `tracker.worker.ts` initializes MediaPipe Tasks Vision and analyzes at most one frame at a time, with a target sampling rate of 15 frames per second. The preview and canvas are local to the browser. CSS mirroring affects the display only.

MediaPipe hands, pose and face models estimate geometry. They do not classify LSF signs. The recognition manifest currently reports unavailable, so no prediction reaches the text field. Unknown and rest handling in the future recognizer must be calibrated from real authorized examples rather than arbitrary movement rules.

## Recognition pipeline status

`features.ts` contains the expected landmark schema, normalization, causal windows and prediction stabilization contracts. `ml/` contains experimental feature extraction and a temporal classifier/export path. These components have software tests, but no LSF dataset has been processed and no weights have been activated. They do not establish a useful or linguistically validated recognizer.

An eventual model requires the exact same landmark ordering, normalization, masks, sampling cadence and temporal window in training and browser inference. It also needs signer-disjoint evaluation, a measured rest and unknown class, controlled repeats and transitions, and confirmation that its weights may be redistributed. Until those conditions are met, the application makes no sign or sentence claims.

## Deployment

The output is `dist/`. Production requires HTTPS for camera access, same-origin ES modules and WebAssembly, and successful loading of the pinned tracking assets. The application runs fully in the browser; no Python service is required. Model artifacts for recognition, when authorized and evaluated, must be versioned, checksum-verified and available from the production origin.
