# Validation

## Linguistic recognition

The active prototype is a DTW classifier over one reference video per class, with optional personal calibration. It has not been evaluated with human signers or against a language benchmark. There are zero held-out signers, zero independent test clips and zero real-sign camera trials. Accuracy, precision, recall, macro-F1, per-class F1, unknown rejection and linguistic latency have not been measured. These are missing measurements, not zero-accuracy measurements.

The current references were extracted from one video per available class. The generated intra-clip threshold is not an independent validation split. A useful future evaluation must state source corpus and authorization; signers, clips and class counts in each partition; a person-disjoint split made before windowing; class-wise precision/recall/F1, macro-F1, balanced accuracy and a confusion matrix; performance on rest, transitions and unknown signs; and repeated camera trials from signers not present in training. Recognition latency must include the complete temporal window and stabilization delay, identify device/browser/model version, report warm and cold load, and give median and upper percentile. No complete-sequence translation metric applies to this isolated-sign pipeline.

## Software checks

Vitest checks the personal DTW distance and rejection on synthetic feature windows, along with the remaining app tests. Playwright exercises a synthetic camera stream and checks lifecycle, permission/model errors, text editing and export, responsive layout, reduced-motion behavior, keyboard access and automated accessibility rules. Synthetic tests are software tests only. They cannot validate lexical meaning or the correctness of an LSF prediction.

Record the current command results in the delivery note after running:

```sh
npm test
npm run build
npm run test:e2e
python -m unittest test_pipeline
```

## Device coverage

Chromium viewport checks do not equal testing on a physical phone. Camera hardware, iOS Safari, Android browsers, screen readers and assistive technology require separate hands-on checks. No user footage is retained by the application; ordinary hosting access logs are controlled by the host.
