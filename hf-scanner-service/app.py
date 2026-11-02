"""
app.py - DiagnoMath Hugging Face AI Scanner Service

Models:
  1. OCR Scanner: ibm-granite/granite-docling-258M
     - Vision-Language Model (258M parameters) built on Idefics3/SigLIP2 architecture.
     - Performs end-to-end document and handwriting OCR.
  2. OMR Scanner: Flova/omr_transformer
     - Vision Transformer built on Donut (Swin Transformer + mBART decoder).
     - Translates visual optical marks directly into structured sequences.

Endpoints:
  - GET  /health     -> Service and model status
  - POST /scan/ocr   -> Runs ibm-granite/granite-docling-258M on handwriting image
  - POST /scan/omr   -> Runs Flova/omr_transformer on OMR bubble sheet
"""

import io
import os
import re
import logging
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hf-scanner-service")

app = FastAPI(
    title="DiagnoMath HF Scanner Service",
    description="Vision AI inference server with ibm-granite/granite-docling-258M and Flova/omr_transformer",
    version="1.0.0",
)

# Enable CORS for local app development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEVICE = "cuda" if os.environ.get("USE_CUDA", "").lower() in ("1", "true") else "cpu"

# ── Model 1: ibm-granite/granite-docling-258M ─────────────────────────────────
GRANITE_MODEL_ID = os.environ.get("GRANITE_MODEL_ID", "ibm-granite/granite-docling-258M")
granite_processor = None
granite_model = None

# ── Model 2: Flova/omr_transformer ───────────────────────────────────────────
OMR_MODEL_ID = os.environ.get("OMR_MODEL_ID", "Flova/omr_transformer")
omr_processor = None
omr_model = None

OCR_CHAR_MAP = {
    'a': 0, '4': 0, '^': 0, '@': 0, 'h': 0, 'r': 0,
    'b': 1, '8': 1, '13': 1, '|3': 1, '6': 1,
    'c': 2, '(': 2, '{': 2, '<': 2, '[': 2, 'g': 2,
    'd': 3, '0': 3, '|)': 3, ']': 3, 'o': 3, 'q': 3,
}

class DetectedAnswerResponse(BaseModel):
    questionIndex: int
    selectedOption: Optional[int]
    flag: str  # 'ok', 'blank', 'multiple'

class OcrScanResponse(BaseModel):
    model: str
    rawText: str
    answers: List[DetectedAnswerResponse]

class OmrScanResponse(BaseModel):
    model: str
    answers: List[DetectedAnswerResponse]


def get_granite():
    """Lazy load ibm-granite/granite-docling-258M model."""
    global granite_processor, granite_model
    if granite_model is None:
        logger.info(f"Loading {GRANITE_MODEL_ID} on {DEVICE}...")
        try:
            from transformers import AutoProcessor, AutoModelForVision2Seq
            import torch
            dtype = torch.float16 if DEVICE == "cuda" else torch.float32
            granite_processor = AutoProcessor.from_pretrained(GRANITE_MODEL_ID)
            granite_model = AutoModelForVision2Seq.from_pretrained(
                GRANITE_MODEL_ID,
                torch_dtype=dtype,
            ).to(DEVICE)
            granite_model.eval()
            logger.info("ibm-granite/granite-docling-258M loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load {GRANITE_MODEL_ID}: {e}")
            raise HTTPException(
                status_code=503,
                detail=f"Model {GRANITE_MODEL_ID} not loaded: {str(e)}. Run pip install -r requirements.txt."
            )
    return granite_processor, granite_model


def get_omr_transformer():
    """Lazy load Flova/omr_transformer model."""
    global omr_processor, omr_model
    if omr_model is None:
        logger.info(f"Loading {OMR_MODEL_ID} on {DEVICE}...")
        try:
            from transformers import DonutProcessor, VisionEncoderDecoderModel
            import torch
            dtype = torch.float16 if DEVICE == "cuda" else torch.float32
            omr_processor = DonutProcessor.from_pretrained(OMR_MODEL_ID)
            omr_model = VisionEncoderDecoderModel.from_pretrained(
                OMR_MODEL_ID,
                torch_dtype=dtype,
            ).to(DEVICE)
            omr_model.eval()
            logger.info("Flova/omr_transformer loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load {OMR_MODEL_ID}: {e}")
            raise HTTPException(
                status_code=503,
                detail=f"Model {OMR_MODEL_ID} not loaded: {str(e)}."
            )
    return omr_processor, omr_model


def parse_raw_text_to_answers(raw_text: str, question_count: int) -> List[Dict[str, Any]]:
    """Parse text from IBM Granite into structured DetectedAnswer list."""
    answers = [{"questionIndex": i, "selectedOption": None, "flag": "blank"} for i in range(question_count)]
    if not raw_text:
        return answers

    hits = {i: [] for i in range(question_count)}
    normalized = raw_text.replace('\r', '\n')
    normalized = re.sub(r'[\(\[\{]\s*([a-dA-D048^@oO])\s*[\)\]\}]', r' \1 ', normalized)

    pattern = re.compile(
        r'(?:q(?:uestion)?|ans(?:wer)?|no\.?)?\s*(\d{1,2})\s*[\.\)\:\-\=\s]+\s*([a-dA-D048^@oO(\{\<\]])',
        re.I
    )
    for m in pattern.finditer(normalized):
        q_idx = int(m.group(1)) - 1
        if 0 <= q_idx < question_count:
            char_key = m.group(2).lower()
            opt = OCR_CHAR_MAP.get(char_key)
            if opt is not None:
                hits[q_idx].append(opt)

    for i in range(question_count):
        h = hits[i]
        if len(h) == 1:
            answers[i] = {"questionIndex": i, "selectedOption": h[0], "flag": "ok"}
        elif len(h) > 1:
            if all(x == h[0] for x in h):
                answers[i] = {"questionIndex": i, "selectedOption": h[0], "flag": "ok"}
            else:
                answers[i] = {"questionIndex": i, "selectedOption": None, "flag": "multiple"}

    return answers


@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": DEVICE,
        "models": {
            "ocr": GRANITE_MODEL_ID,
            "omr": OMR_MODEL_ID,
        },
    }


@app.post("/scan/ocr", response_model=OcrScanResponse)
async def scan_ocr(
    image: UploadFile = File(...),
    question_count: int = Form(10),
):
    """
    OCR Scanner using ibm-granite/granite-docling-258M.
    Reads document / handwriting and extracts student answers.
    """
    contents = await image.read()
    try:
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image format: {e}")

    processor, model = get_granite()

    # Prompt Granite Docling to read the document answers
    prompt = (
        "<image>\n"
        "Extract all the question numbers and answers from this student answer sheet. "
        "Format output as a numbered list: 1. A, 2. B, 3. C, etc."
    )

    try:
        import torch
        inputs = processor(images=pil_image, text=prompt, return_tensors="pt").to(DEVICE)
        with torch.no_grad():
            output_tokens = model.generate(
                **inputs,
                max_new_tokens=256,
                do_sample=False,
            )
        raw_text = processor.decode(output_tokens[0], skip_special_tokens=True)
    except Exception as e:
        logger.error(f"Inference error with {GRANITE_MODEL_ID}: {e}")
        raise HTTPException(status_code=500, detail=f"Granite inference error: {e}")

    answers = parse_raw_text_to_answers(raw_text, question_count)
    return OcrScanResponse(
        model=GRANITE_MODEL_ID,
        rawText=raw_text,
        answers=[DetectedAnswerResponse(**a) for a in answers],
    )


@app.post("/scan/omr", response_model=OmrScanResponse)
async def scan_omr(
    image: UploadFile = File(...),
    question_count: int = Form(10),
):
    """
    OMR Scanner using Flova/omr_transformer.
    Uses Vision Transformer (Swin + mBART) to detect and parse optical marks.
    """
    contents = await image.read()
    try:
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image format: {e}")

    processor, model = get_omr_transformer()

    try:
        import torch
        # Prepare inputs with DonutProcessor
        pixel_values = processor(pil_image, return_tensors="pt").pixel_values.to(DEVICE)
        
        # Generation token prompt
        decoder_input_ids = processor.tokenizer(
            "<s_omr>", add_special_tokens=False, return_tensors="pt"
        ).input_ids.to(DEVICE)

        with torch.no_grad():
            outputs = model.generate(
                pixel_values,
                decoder_input_ids=decoder_input_ids,
                max_length=512,
                early_stopping=True,
                pad_token_id=processor.tokenizer.pad_token_id,
                eos_token_id=processor.tokenizer.eos_token_id,
                use_cache=True,
                num_beams=1,
            )

        sequence = processor.batch_decode(outputs)[0]
        sequence = sequence.replace(processor.tokenizer.eos_token, "").replace(processor.tokenizer.pad_token, "")
        sequence = re.sub(r"<.*?>", "", sequence, count=1).strip()
    except Exception as e:
        logger.error(f"Inference error with {OMR_MODEL_ID}: {e}")
        raise HTTPException(status_code=500, detail=f"OMR Transformer inference error: {e}")

    # Parse detected marks into DetectedAnswer objects
    answers = parse_raw_text_to_answers(sequence, question_count)

    return OmrScanResponse(
        model=OMR_MODEL_ID,
        answers=[DetectedAnswerResponse(**a) for a in answers],
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)

