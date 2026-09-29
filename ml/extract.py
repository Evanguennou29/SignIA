"""Import explicite de clips autorisés, sans téléchargement automatique de corpus."""
import argparse
import csv
import hashlib
import json
from contextlib import ExitStack
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from schema import normalize, SCHEMA, FPS


def points(values, with_visibility=False):
    return [{'x': p.x, 'y': p.y,
             'visibility': p.visibility if with_visibility else 1}
            for p in values]


def extract_clip(path, start, end, models):
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        capture.release()
        raise ValueError('Vidéo illisible')
    try:
        fps = capture.get(cv2.CAP_PROP_FPS)
        if not np.isfinite(fps) or fps <= 0:
            raise ValueError('Fréquence vidéo inconnue')
        Base, Vision = mp.tasks.BaseOptions, mp.tasks.vision
        mode = Vision.RunningMode.VIDEO
        # Chaque clip possède ses modèles : aucune mémoire de tracking entre personnes.
        with ExitStack() as stack:
            hand = stack.enter_context(Vision.HandLandmarker.create_from_options(
                Vision.HandLandmarkerOptions(
                    base_options=Base(model_asset_path=str(models/'hand_landmarker.task')),
                    running_mode=mode, num_hands=2)))
            pose = stack.enter_context(Vision.PoseLandmarker.create_from_options(
                Vision.PoseLandmarkerOptions(
                    base_options=Base(model_asset_path=str(models/'pose_landmarker_lite.task')),
                    running_mode=mode)))
            face = stack.enter_context(Vision.FaceLandmarker.create_from_options(
                Vision.FaceLandmarkerOptions(
                    base_options=Base(model_asset_path=str(models/'face_landmarker.task')),
                    running_mode=mode)))
            frames, timestamps = [], []
            last_processed, n = -1000, 0
            while True:
                success, bgr = capture.read()
                if not success:
                    break
                t = n*1000/fps
                n += 1
                if t < start:
                    continue
                if t >= end:
                    break
                if t-last_processed < 1000/FPS-1e-6:
                    continue
                last_processed = t
                clock = round(t-start)
                image = mp.Image(image_format=mp.ImageFormat.SRGB,
                                 data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
                h = hand.detect_for_video(image, clock)
                p = pose.detect_for_video(image, clock)
                f = face.detect_for_video(image, clock)
                raw = {
                    'left': [], 'right': [],
                    'pose': points(p.pose_landmarks[0], True) if p.pose_landmarks else [],
                    'face': points(f.face_landmarks[0]) if f.face_landmarks else []}
                for i, landmarks in enumerate(h.hand_landmarks):
                    side = 'left' if h.handedness[i][0].category_name == 'Left' else 'right'
                    raw[side] = points(landmarks)
                frames.append(normalize(raw))
                timestamps.append(t-start)
            if len(frames) < 2:
                raise ValueError('Clip trop court')
            return np.asarray(frames, dtype=np.float32), np.asarray(timestamps)
    finally:
        capture.release()


def run(manifest_path, data_root, output, models, acknowledge):
    if not acknowledge:
        raise ValueError('Confirmez les droits avec --rights-confirmed')
    output.mkdir(parents=True, exist_ok=True)
    root = data_root.resolve()
    with manifest_path.open(encoding='utf-8-sig', newline='') as file:
        rows = list(csv.DictReader(file))
    records = []
    for row in rows:
        required = ['video', 'signer', 'label', 'license', 'consent_reference', 'start_ms', 'end_ms']
        if not all(row.get(key) for key in required):
            raise ValueError('Manifest incomplet : '+', '.join(required))
        path = (root/row['video']).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError('Vidéo hors dossier autorisé ou absente')
        start, end = float(row['start_ms']), float(row['end_ms'])
        if not np.isfinite([start, end]).all() or start < 0 or end <= start:
            raise ValueError('Intervalle invalide')
        features, timestamps = extract_clip(path, start, end, models)
        name = hashlib.sha256(json.dumps(
            [row['video'], start, end, row['signer'], row['label']]).encode()).hexdigest()[:20]+'.npz'
        np.savez_compressed(output/name, features=features, timestamps=timestamps)
        records.append({'file': name, 'signer': row['signer'], 'label': row['label'],
                        'license': row['license'], 'schema': SCHEMA})
    (output/'index.json').write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for name in ['manifest', 'data-root', 'output', 'models']:
        parser.add_argument('--'+name, required=True, type=Path)
    parser.add_argument('--rights-confirmed', action='store_true')
    args = parser.parse_args()
    run(args.manifest, args.data_root, args.output, args.models, args.rights_confirmed)
