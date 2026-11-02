# DiagnoMath Hugging Face AI Scanner Service

Vision AI microservice integrating:
1. **`ibm-granite/granite-docling-258M`** for Handwriting & Document OCR.
2. **`Flova/omr_transformer`** for Vision Transformer Optical Mark Recognition (OMR).

---

## 1. Models Overview

| Task | Hugging Face Model | Architecture | Size | Purpose |
|---|---|---|---|---|
| **Handwritten OCR** | [`ibm-granite/granite-docling-258M`](https://huggingface.co/ibm-granite/granite-docling-258M) | Idefics3 / SigLIP2 + Granite 165M | 258M parameters | High-precision document & handwriting recognition |
| **OMR Scanner** | [`Flova/omr_transformer`](https://huggingface.co/Flova/omr_transformer) | Donut (Swin Transformer + mBART) | ~200M parameters | Translates optical marks and bubbles into sequence tokens |

---

## 2. Installation & Quickstart

### Prerequisites
* Python 3.10+
* PyTorch (CPU or CUDA)

```bash
cd hf-scanner-service

# 1. Install dependencies
pip install -r requirements.txt

# 2. Start the server (default port 8000)
python app.py

# Optional: Run on CUDA GPU
USE_CUDA=1 python app.py
```

The service runs at `http://localhost:8000`.

---

## 3. Endpoints

### `GET /health`
Returns service status and active models.

```json
{
  "status": "ok",
  "device": "cpu",
  "models": {
    "ocr": "ibm-granite/granite-docling-258M",
    "omr": "Flova/omr_transformer"
  }
}
```

### `POST /scan/ocr` (IBM Granite Docling 258M)
* **Form Data**:
  * `image`: Multipart image file (JPEG or PNG).
  * `question_count`: Integer (e.g. 10).
* **Response**:
```json
{
  "model": "ibm-granite/granite-docling-258M",
  "rawText": "1. A\n2. B\n3. C\n4. D",
  "answers": [
    { "questionIndex": 0, "selectedOption": 0, "flag": "ok" },
    { "questionIndex": 1, "selectedOption": 1, "flag": "ok" }
  ]
}
```

### `POST /scan/omr` (Flova OMR Transformer)
* **Form Data**:
  * `image`: Multipart image file of the filled OMR sheet.
  * `question_count`: Integer (e.g. 10).
* **Response**:
```json
{
  "model": "Flova/omr_transformer",
  "answers": [
    { "questionIndex": 0, "selectedOption": 0, "flag": "ok" }
  ]
}
```

---

## 4. Mobile Client Integration (`my-app`)

The React Native client (`my-app`) includes an intelligent connector [`my-app/lib/scanner/aiScannerService.ts`](../my-app/lib/scanner/aiScannerService.ts):
* If `hf-scanner-service` is running on your computer or local network, the app sends images to the Hugging Face AI models.
* If offline or the server is not reachable, the app automatically and seamlessly falls back to on-device Google ML Kit and local auto-centering OMR!

