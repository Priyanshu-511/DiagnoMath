# DiagnoMath Mobile Client (`my-app`)

The core React Native / Expo application for **DiagnoMath**. Designed to run **100% offline on Android smartphones**.

---

## Capabilities

* **Offline Auto-Quiz Generator**: Blends mixed-concept and single-skill questions from built-in banks.
* **On-Device Q-Matrix Engine (`prajjwal1/bert-tiny`)**: Auto-tags imported questions with the 12 Fractions cognitive attributes ($A_1 \dots A_{12}$) in pure TypeScript on the phone CPU.
* **High-Accuracy Offline OMR Engine (80–95%+ Accuracy)**:
  - **4 Corner Registration Markers**: Solid $24 \times 24\text{px}$ fiducial squares in sheet corners correct camera crop, shift ($\Delta x, \Delta y$), and scale ($s_x, s_y$).
  - **16-Point Radial Ring Contrast Auto-Centering ($\pm 14\text{px}$)**: Maximizes perimeter ring-to-background contrast to lock onto bubble centers without false-positive border pulls.
  - **Adaptive Dual-Metric Fill Detection**: Combines inner dark-pixel binarization ($T = L_{\text{bg}} - 35$) with local paper contrast ratio to eliminate phone shadows and ambient lighting gradients.
  - **Interactive Teacher Verification**: One-tap bubble correction ($A \to B \to C \to D \to \text{blank}$) before grading.
* **Smart Handwritten Answer OCR**:
  - **On-Device ML Kit Recognition**: 100% offline text extraction with zero external server dependencies.
  - **Multi-Format Regex Parser**: Segments numbered items (`1. A`, `1) B`, `1: C`), bracketed answers (`1. (A)`, `[B]`), and two-column layouts.
  - **Option Value Matching**: If students write the answer text (e.g. `2/3`, `Proper fraction`, `0.75`) instead of letters, the parser resolves them to the correct option index.
  - **Handwriting Confusion Recovery**: Automatically recovers OCR confusions (`8 \to B`, `4 \to A`, `( \to C`, `0 \to D`).
* **DINA Cognitive Diagnosis**: Evaluates student skill profiles ($\boldsymbol{\alpha}$) on-device to pinpoint unmastered mathematical concepts.
* **Offline PDF Generation**: Creates printable Question Papers and OMR Bubble Sheets using system fonts and the Android OS Print Spooler.
* **Offline Auth & Storage**: Salted SHA-256 passwords and local `AsyncStorage`.

---

## Development & Testing

```bash
# 1. Install dependencies
npm install

# 2. Start the Expo development server
npx expo start
```

---

## Building the Standalone Offline APK

Your `eas.json` is preconfigured for generating direct APK files:

```bash
# Build standalone preview APK
npx eas build --profile preview --platform android

# Or build locally via Gradle
npx expo prebuild
cd android && ./gradlew assembleRelease
```
Once installed, the APK functions completely in airplane mode with zero network requests.
