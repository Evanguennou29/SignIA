import unittest

import numpy as np

from train_single_example import MODEL_FRAMES, dtw, pick_template


class SingleExampleModelTests(unittest.TestCase):
    def test_picker_emits_camera_compatible_temporal_template(self):
        windows = np.zeros((3, MODEL_FRAMES, 261), dtype=np.float32)
        for sample in range(3):
            for frame in range(MODEL_FRAMES):
                windows[sample, frame, 0] = sample * 0.01 + frame * 0.02
                windows[sample, frame, 2] = 1
                windows[sample, frame, 5] = 1
        template, variants = pick_template(windows)
        self.assertEqual(template.shape, (MODEL_FRAMES, 261))
        self.assertGreaterEqual(len(variants), 1)
        self.assertEqual(dtw(template, template), 0)
        self.assertLess(dtw(template, variants[0]), 0.1)


if __name__ == "__main__":
    unittest.main()
