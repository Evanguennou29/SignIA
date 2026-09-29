"""Extract one short DTW template per LSF dictionary clip, without copying video."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
import sys
import unicodedata
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

from schema import FEATURE_SIZE, FPS, SCHEMA, normalize

MODEL_FRAMES = 8
SAMPLE_STEP = 4
TEMPLATE_SIZE = MODEL_FRAMES * FEATURE_SIZE


def label_key(value: str) -> str:
    return unicodedata.normalize("NFC", value).casefold()


def pick_template(sequences: np.ndarray) -> tuple[np.ndarray, list[list[float]]]:
    """Pick the most active fully tracked 32-frame window; retain nearby variants."""
    best_index, best_score = 0, -1.0
    for index, seq in enumerate(sequences):
        hands = seq[:, : 42 * 3].reshape(MODEL_FRAMES, 42, 3)
        visible = hands[:, :, 2] > 0
        visibility = float(visible.mean())
        speeds = []
        for frame in range(1, MODEL_FRAMES):
            common = visible[frame] & visible[frame - 1]
            if common.any():
                delta = hands[frame, common, :2] - hands[frame - 1, common, :2]
                speeds.extend(np.linalg.norm(delta, axis=1).tolist())
        motion = float(np.mean(speeds)) if speeds else 0.0
        score = motion + visibility * 0.025
        if score > best_score:
            best_index, best_score = index, score
    selected = sequences[best_index]
    # Neighbouring windows are temporal augmentation from this same recording,
    # not independent signing examples or an evaluation split.
    start = max(0, best_index - 2)
    end = min(len(sequences), best_index + 3)
    neighborhood = sequences[start:end]
    samples = []
    for window in neighborhood:
        samples.append(window.astype(np.float32).tolist())
    template = selected.astype(np.float32)
    return template, samples


def extract_video(path: Path, models, timestamp_base: int):
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise ValueError("vidéo illisible")
    try:
        fps = capture.get(cv2.CAP_PROP_FPS)
        if not np.isfinite(fps) or fps <= 0:
            raise ValueError("fréquence vidéo inconnue")
        hand, pose, face = models
        frames, timestamps = [], []
        n, last_processed = 0, -1000.0
        while True:
            ok, bgr = capture.read()
            if not ok:
                break
            ms = n * 1000.0 / fps
            n += 1
            if ms - last_processed < 1000 / (FPS / SAMPLE_STEP) - 1e-6:
                continue
            last_processed = ms
            clock = timestamp_base + round(ms)
            image = mp.Image(image_format=mp.ImageFormat.SRGB,
                             data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
            h = hand.detect_for_video(image, clock)
            p = pose.detect_for_video(image, clock)
            f = face.detect_for_video(image, clock)

            def pack(points, with_visibility=False):
                return [{"x": item.x, "y": item.y,
                         "visibility": item.visibility if with_visibility else 1}
                        for item in points]

            raw = {
                "left": [], "right": [],
                "pose": pack(p.pose_landmarks[0], True) if p.pose_landmarks else [],
                "face": pack(f.face_landmarks[0]) if f.face_landmarks else [],
            }
            for i, points in enumerate(h.hand_landmarks):
                side = "left" if h.handedness[i][0].category_name == "Left" else "right"
                raw[side] = pack(points)
            frames.append(normalize(raw))
            timestamps.append(ms)
        if len(frames) < 2:
            raise ValueError("clip trop court")
        features = np.asarray(frames, np.float32)
        times = np.asarray(timestamps)
        sequences = []
        for end in range(MODEL_FRAMES, len(features) + 1):
            start = end - MODEL_FRAMES
            if np.any(np.diff(times[start:end]) > 400):
                continue
            window = features[start:end]
            if np.all(np.any(window != 0, axis=1)):
                sequences.append(window)
        return np.asarray(sequences, np.float32).reshape(-1, MODEL_FRAMES, FEATURE_SIZE)
    finally:
        capture.release()


def load_template(cache_file: Path):
    if not cache_file.exists():
        return None
    data = np.load(cache_file)
    return data["template"], data["variants"]


def distance(a, b):
    # Same common-visible-landmark distance as the browser classifier.
    mask = (a[:, 2] > 0) & (b[:, 2] > 0)
    if not mask.any():
        return 1.0
    return float(np.sqrt(np.square(a[mask, :2] - b[mask, :2]).sum(axis=1).mean()))


def dtw(a: np.ndarray, b: np.ndarray) -> float:
    a, b = np.asarray(a), np.asarray(b)
    rows = len(a)
    prev = np.full(rows + 1, np.inf, np.float32)
    prev[0] = 0
    for i in range(1, rows + 1):
        cur = np.full(rows + 1, np.inf, np.float32)
        for j in range(max(1, i - 2), min(rows, i + 2) + 1):
            cur[j] = distance(a[i - 1].reshape(87, 3), b[j - 1].reshape(87, 3)) + min(
                cur[j - 1], prev[j], prev[j - 1])
        prev = cur
    return float(prev[-1] / rows)


def train(root: Path, vocabulary: Path, model_dir: Path, cache_dir: Path):
    root, model_dir, cache_dir = root.resolve(), model_dir.resolve(), cache_dir.resolve()
    records = json.loads(vocabulary.read_text(encoding="utf-8"))
    files = {label_key(f"{p.parent.name}/{p.name}"): p for p in (root / "videos").rglob("*.webm")}
    labels, duplicate_aliases, missing_references = {}, [], []
    for record in records:
        path = files.get(label_key(record["video"]))
        if path is not None:
            if path in labels:
                duplicate_aliases.append({"label": record["key"], "sameVideoAs": labels[path][0]})
            else:
                labels[path] = [record["key"]]
        else:
            missing_references.append({"label": record["key"], "video": record["video"]})

    cache_dir.mkdir(parents=True, exist_ok=True)
    model_dir.mkdir(parents=True, exist_ok=True)
    task = mp.tasks.vision
    base = mp.tasks.BaseOptions
    mode = task.RunningMode.VIDEO
    options = [
        task.HandLandmarkerOptions(base_options=base(model_asset_path=str(model_dir / "hand_landmarker.task")), running_mode=mode, num_hands=2),
        task.PoseLandmarkerOptions(base_options=base(model_asset_path=str(model_dir / "pose_landmarker_lite.task")), running_mode=mode, num_poses=1),
        task.FaceLandmarkerOptions(base_options=base(model_asset_path=str(model_dir / "face_landmarker.task")), running_mode=mode, num_faces=1),
    ]
    templates, variants, skipped = {}, {}, []
    progress_path = cache_dir / "progress.json"
    if progress_path.exists():
        saved = json.loads(progress_path.read_text(encoding="utf-8"))
        for label, meta in saved.items():
            if "skipped" in meta:
                skipped.append({"label": label, "reason": meta["skipped"]})
                continue
            cache = cache_dir / meta["cache"]
            cached = load_template(cache)
            if cached:
                templates[label], variants[label] = cached

    timestamp_base = 0
    with mp.tasks.vision.HandLandmarker.create_from_options(options[0]) as hand, \
         mp.tasks.vision.PoseLandmarker.create_from_options(options[1]) as pose, \
         mp.tasks.vision.FaceLandmarker.create_from_options(options[2]) as face:
        for i, (path, path_labels) in enumerate(labels.items(), 1):
            labels_here = path_labels
            if not labels_here:
                continue
            label = labels_here[0]
            if label in templates:
                continue
            clip_timestamp = timestamp_base
            timestamp_base += 60_000
            try:
                windows_found = extract_video(path, (hand, pose, face), clip_timestamp)
                if not len(windows_found):
                    raise ValueError("aucune fenêtre complète avec le buste visible")
                template, neighbor_variants = pick_template(windows_found)
                cache_name = hashlib.sha256(str(path).encode("utf-8")).hexdigest()[:20] + ".npz"
                np.savez_compressed(cache_dir / cache_name,
                                    template=template,
                                    variants=np.asarray(neighbor_variants, dtype=np.float32))
                for word in labels_here:
                    templates[word] = template
                    variants[word] = np.asarray(neighbor_variants, dtype=np.float32)
                progress = json.loads(progress_path.read_text(encoding="utf-8")) if progress_path.exists() else {}
                for word in labels_here:
                    progress[word] = {"cache": cache_name}
                progress_path.write_text(json.dumps(progress, ensure_ascii=False), encoding="utf-8")
            except Exception as exc:
                reason = str(exc)
                skipped.extend({"label": word, "video": str(path.relative_to(root / "videos")), "reason": reason} for word in labels_here)
                progress = json.loads(progress_path.read_text(encoding="utf-8")) if progress_path.exists() else {}
                progress[label] = {"skipped": reason}
                progress_path.write_text(json.dumps(progress, ensure_ascii=False), encoding="utf-8")
            if i % 25 == 0 or i == len(labels):
                print(f"{i}/{len(labels)} clips; {len(templates)} labels extracted; {len(skipped)} skipped", flush=True)

    # One class per vocabulary label. Neighbouring windows only estimate a
    # permissive same-clip tolerance; they are not held-out validation data.
    classes, binary = [], bytearray()
    thresholded, collided = 0, []
    for label in sorted(templates, key=label_key):
        template = templates[label]
        same = variants[label]
        internal = [dtw(template, variant) for variant in same]
        threshold = max(0.12, float(np.quantile(internal, 0.9)) * 2.0)
        threshold = min(threshold, 0.85)
        if not np.isfinite(template).all() or template.shape != (MODEL_FRAMES, FEATURE_SIZE):
            continue
        q = np.clip(np.rint(template * 1000), -32768, 32767).astype("<i2")
        binary.extend(q.tobytes(order="C"))
        classes.append({"label": label, "threshold": threshold})

    data_path = model_dir / "lsf-single-example-v1.bin"
    data_path.write_bytes(binary)
    digest = hashlib.sha256(binary).hexdigest()
    manifest = {
        "version": 1, "language": "LSF", "schema": SCHEMA,
        "source": "parlr/lsf-data local videos", "frames": MODEL_FRAMES,
        "sourceRepository": "https://github.com/parlr/lsf-data",
        "vocabularyIndexSha256": hashlib.sha256(vocabulary.read_bytes()).hexdigest(),
        "extractor": "MediaPipe Tasks Vision 0.10.32 / signia-xy-mask-v1",
        "inputWindow": 32, "inputFps": FPS, "sampleStep": SAMPLE_STEP,
        "quantization": 1000, "classes": classes, "sha256": digest,
        "binary": "/models/lsf-single-example-v1.bin",
        "trainingClips": len(classes),
        "duplicateAliasesExcluded": duplicate_aliases,
        "missingReferences": missing_references,
        "skipped": skipped,
        "evaluation": "Aucun test indépendant. Une vidéo par étiquette au plus ; seuils estimés sur fenêtres voisines du même clip.",
    }
    manifest_path = model_dir / "single-example.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"classes": len(classes), "skipped": len(skipped), "binaryBytes": len(binary),
                      "sha256": digest, "manifest": str(manifest_path)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--vocabulary", type=Path, required=True)
    parser.add_argument("--model-dir", type=Path, default=Path("frontend/public/models"))
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache/lsf-single-example"))
    args = parser.parse_args()
    train(args.dataset_root, args.vocabulary, args.model_dir, args.cache_dir)
