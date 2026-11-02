# DiagnoMath

**DiagnoMath** is an offline, lightweight mobile application designed for Class 6–7 Mathematics teachers to conduct assessments, scan student answer sheets, and perform **Cognitive Diagnostic Assessment (CDA)** using the **DINA (Deterministic Inputs, Noisy AND gate)** model.

The application is engineered to run **100% offline on a simple smartphone** inside a single standalone Android APK—with **zero backend servers, zero cloud APIs, and zero network calls**.

---

## Key Features

### 1. 🎲 Offline Auto Quiz Generator with Mixed Concepts
* **Mixed-Concept Generation**: Generates balanced math quizzes blending multi-attribute (cross-concept) questions with stratified single-skill questions across selected topics (Fractions, Integers, Whole Numbers, Algebra, Geometry, Ratio & Proportion).
* **Fractions Cognitive Question Bank**: Includes 36 offline questions mapped to the fixed 12 Fractions Cognitive Attributes ($A_1 \dots A_{12}$).
* **Single-Tap Printable PDFs**: Exports clean, formatted Question Papers and standard OMR Bubble Sheets directly via Android Print Spooler (`expo-print` + `expo-sharing`).

### 2. 🧠 Offline Q-Matrix Engine (`prajjwal1/bert-tiny`)
* **100% On-Device AI**: Powered by a pure TypeScript implementation of the **`prajjwal1/bert-tiny`** 128-dimensional Transformer encoder (2 layers, 2 attention heads, 128 hidden dim).
* **Automatic Skill Tagging**: When teachers import custom questions from CSV or Excel without skill annotations, `bert-tiny` automatically classifies them into the 12 Fractions Cognitive Attributes in < 5 milliseconds directly on the phone's CPU.
* **Deterministic Binary Q-Matrix**: Produces the $J \times 12$ binary matrix ($q_{jk} \in \{0, 1\}$) required for cognitive diagnosis.

#### The 12 Fractions Cognitive Attributes:
| ID | Attribute Name | Description |
|---|---|---|
| **A1** | Numerator & Denominator Identification | Identifying top and bottom parts of a fraction |
| **A2** | Fraction Representation | Representing parts of a whole or shaded diagrams |
| **A3** | Fraction Classification | Proper, improper, and mixed numbers |
| **A4** | Fraction Simplification | Reducing fractions to lowest terms |
| **A5** | Equivalent Fractions | Verifying and scaling equivalent values |
| **A6** | Fraction Comparison | Comparing values ($>, <, =$) |
| **A7** | Fraction Ordering | Ascending and descending sequence arrangement |
| **A8** | Mixed / Improper Conversion | Converting between mixed numbers and improper fractions |
| **A9** | Like-Denominator Addition | Adding fractions with identical denominators |
| **A10** | Unlike-Denominator Addition | Finding common denominators (LCM) and adding |
| **A11** | Fraction Subtraction | Subtracting like and unlike fractions |
| **A12** | Word Problems / Applications | Real-world problem solving (sharing, recipes, tanks) |

### 3. 📷 High-Accuracy Offline OMR Engine (80–95%+ Accuracy)
* **Corner Registration Markers**: The generated sheet template places solid $24 \times 24\text{px}$ fiducial squares in all 4 corners. The engine detects these markers on camera capture to compute global scale ($s_x, s_y$) and translation offsets ($\Delta x, \Delta y$), correcting camera crop, angle, and tilt.
* **16-Point Radial Ring Contrast Auto-Centering ($\pm 14\text{px}$)**: Samples 16 points along the perimeter ring vs 8 points outside. Maximizing contrast locks directly onto the circle perimeter ring without being pulled off-center by printed letters or border rings.
* **Dual-Metric Fill Detection (Anti-Shadow)**: Combines:
  1. *Inner dark pixel ratio* ($r \le 0.65R$) binarized against local background threshold ($T = L_{\text{bg}} - 35$).
  2. *Mean local contrast ratio* against the immediate surrounding paper ring.
  This gives a fill separation gap $> 40\%$ between empty and filled bubbles, neutralizing phone shadows and lighting gradients.
* **Interactive Teacher Verification**: Displays an interactive preview table of detected bubbles ($A \to B \to C \to D \to \text{blank}$) for one-tap verification before saving.

### 4. ✏️ On-Device Handwritten Answer Scanner
* **Hardware-Accelerated OCR**: Uses Google ML Kit's on-device text recognition (`@react-native-ml-kit/text-recognition`), running 100% offline with zero server requirements.
* **Option Value & Text Matching**: If students write option values (e.g. `2/3`, `Proper fraction`, `0.75`) instead of letters, the parser automatically correlates the text with the test's question options.
* **Multi-Format Lookahead Parser**: Handles standard lists (`1. A`, `1) B`, `1: C`), bracketed answers (`1. (A)`, `2. [B]`), two-column layouts without skipping columns, and resolves handwriting OCR confusions (`4` $\to A$, `8` $\to B$, `(` $\to C$, `0` $\to D$).

### 5. 📊 DINA Cognitive Diagnosis Engine
* **Cognitive Mastery Estimation**: Uses student response vectors $\mathbf{X} \in \{0, 1\}^J$ and the binary Q-matrix $Q \in \{0, 1\}^{J \times K}$ to evaluate all $2^K$ latent skill profiles $\boldsymbol{\alpha} = (\alpha_1, \dots, \alpha_K)$.
* **Actionable Teacher Reports**: Rather than just a numerical score (e.g. *80%*), the app identifies specific cognitive deficiencies (e.g. *"Student has mastered addition and representation, but fails whenever simplification ($A_4$) is required"*).

### 6. 🔒 Offline Authentication & Storage
* **Local Security**: Passwords are never stored in plain text—salted and hashed using SHA-256 (`expo-crypto`).
* **Zero Cloud Storage**: All student records, tests, banks, and diagnosis histories persist on-device via `AsyncStorage`.

---

## Project Structure

```
DiagnoMath/
├── my-app/                         # Main React Native / Expo mobile application
│   ├── app/                        # Expo Router screen navigation
│   │   ├── (tabs)/                 # Bottom navigation tabs (Home, Explore)
│   │   ├── auto-quiz.tsx           # Auto-quiz generator with Mixed Concepts toggle
│   │   ├── scan.tsx                # OMR Bubble scanning screen
│   │   ├── handwritten-scan.tsx    # Handwritten OCR scanning screen
│   │   ├── questions-import.tsx    # CSV/Excel importer with BERT-tiny auto-tagging
│   │   ├── tests-create.tsx        # Test creator
│   │   ├── results.tsx             # Test results list
│   │   └── results-detail.tsx      # Detailed DINA cognitive diagnosis breakdown
│   ├── components/
│   │   ├── omr/BubbleScanner.tsx   # OMR scanner with auto-centering & review table
│   │   └── handwritten/            # Handwritten scanner component
│   ├── lib/
│   │   ├── qmatrix/                # 100% offline prajjwal1/bert-tiny engine
│   │   │   ├── bert-tiny/          # Tokenizer, Transformer model, prototypes, classifier
│   │   │   └── index.ts            # Public Q-matrix & auto-tagging APIs
│   │   ├── quiz/                   # Mixed-concept generator & Fractions question bank
│   │   ├── omr/                    # Layout geometry & headless canvas scanner HTML
│   │   ├── handwritten/            # Multi-format handwriting parser
│   │   ├── diagnosis/              # DINA mathematical cognitive model
│   │   └── auth/                   # Offline crypto & AsyncStorage session manager
│   └── package.json
└── q-matrix/                       # Companion Node.js module & API service
    ├── src/
    │   ├── attributes.js           # 12 Fractions cognitive attributes definition
    │   ├── qmatrix.js              # Deterministic Q-matrix generator
    │   ├── validator.js            # Structural & matrix validator
    │   ├── bert-qmatrix.js         # Offline bert-tiny classifier for Node.js
    │   └── server.js               # HTTP API server (port 3200)
    └── data/                       # Sample test fixtures (JSON & CSV)
```

---

## Getting Started

### Prerequisites
* Node.js 18+
* Expo CLI (`npm install -g expo-cli`)

### Running the Mobile App
```bash
cd my-app
npm install
npx expo start
```

### Building the Standalone Offline APK
To generate the standalone Android APK for offline use on any phone:

```bash
cd my-app

# Option A: Build via EAS (Cloud or Local Worker)
npx eas build --profile preview --platform android

# Option B: Build locally with Gradle
npx expo prebuild
cd android && ./gradlew assembleRelease
```
The resulting `.apk` file can be copied directly to any Android smartphone via USB or Bluetooth and installed without requiring an active internet connection.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
