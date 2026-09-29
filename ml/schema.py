"""Contrat partagé avec frontend/src/features.ts : image native, sans miroir."""
import numpy as np

FACE_INDICES = [1, 4, 33, 133, 362, 263, 61, 291, 13, 14, 70, 300]
FEATURE_SIZE = 261
SCHEMA = 'signia-xy-mask-v1'
WINDOW = 32
FPS = 15

def normalize(frame):
    pose = frame.get('pose', [])
    output = np.zeros(FEATURE_SIZE, dtype=np.float32)
    if len(pose) < 13:
        return output
    a, b = pose[11], pose[12]
    if min(a.get('visibility', 1), b.get('visibility', 1)) < .5:
        return output
    width = np.hypot(a['x'] - b['x'], a['y'] - b['y'])
    if width < .02:
        return output
    cx, cy = (a['x'] + b['x']) / 2, (a['y'] + b['y']) / 2
    def take(name, indices):
        points = frame.get(name, [])
        return [points[i] if i < len(points) else None for i in indices]
    points = take('left', range(21)) + take('right', range(21)) + take('pose', range(33)) + take('face', FACE_INDICES)
    for i, point in enumerate(points):
        if point and point.get('visibility', 1) >= .5 and np.isfinite([point['x'], point['y']]).all():
            output[i*3:i*3+3] = [(point['x']-cx)/width, (point['y']-cy)/width, 1]
    return output

def windows(features, timestamps):
    """Échantillonnage causal à 15 Hz, sans interpolation d’images futures."""
    features, timestamps = np.asarray(features), np.asarray(timestamps)
    if features.ndim != 2 or features.shape[1] != FEATURE_SIZE or len(features) != len(timestamps):
        raise ValueError('Dimensions de repères invalides')
    if len(timestamps) < 2 or not np.isfinite(features).all() or not np.isfinite(timestamps).all() or np.any(np.diff(timestamps) <= 0):
        raise ValueError('Horodatages ou repères invalides')
    grid = np.arange(timestamps[0], timestamps[-1] + 1e-6, 1000/FPS)
    indices = np.searchsorted(timestamps, grid + 1e-6, side='right') - 1
    samples = features[indices]
    valid = (grid - timestamps[indices] <= 200) & np.any(samples != 0, axis=1)
    # Une lacune de suivi casse toute fenêtre qui la traverse.
    for i in range(1, len(timestamps)):
        if timestamps[i]-timestamps[i-1] > 200:
            valid[(grid > timestamps[i-1]) & (grid < timestamps[i])] = False
    result = []
    for end in range(WINDOW, len(grid)+1):
        if valid[end-WINDOW:end].all():
            result.append(samples[end-WINDOW:end])
    return np.stack(result) if result else np.empty((0, WINDOW, FEATURE_SIZE), dtype=np.float32)
