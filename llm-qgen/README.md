# DiagnoMath — LLM Question Generation Module

Uses Google Gemini to identify relevant cognitive attributes from educational material and generate multiple-choice assessment questions.

## Setup

```bash
cd llm-qgen
npm install
npm test          # runs validation tests (no live API call)
npm start         # starts API on port 3100
```

Set your Gemini API key **before** starting:

```bash
export GEMINI_API_KEY="your-key-here"
# OR pass per-request via the x-llm-api-key header
```

> **Never** hard-code keys in source files or commit them to version control.

## API Endpoints

### `GET /health`
```json
{ "status": "ok" }
```

### `POST /llm/identify-attributes`
- **Body**: `multipart/form-data` with a `pdf` file field.
- **Header** (optional): `x-llm-api-key`
- **Response**: `{ "relevant_attributes": ["A4", "A6", "A11"] }`

### `POST /llm/generate-from-pdf`
- **Body**: `multipart/form-data`
  - `pdf` — the source PDF
  - `selected_attributes` — JSON array string, e.g. `["A4","A6"]`
  - `num_questions` (optional, default 10)
  - `difficulty` (optional: `easy` | `medium` | `hard`)
- **Response**: Full validated assessment/question JSON.

### `POST /llm/generate-from-text`
- **Body**: JSON
  ```json
  {
    "source_text": "...",
    "selected_attributes": ["A4", "A6"],
    "num_questions": 5,
    "difficulty": "medium"
  }
  ```
- **Response**: Full validated assessment/question JSON.

## Fixed Cognitive Attributes (A1–A12)

| ID  | Attribute |
|-----|-----------|
| A1  | Numerator and denominator identification |
| A2  | Fraction representation |
| A3  | Fraction classification (proper/improper/mixed) |
| A4  | Fraction simplification |
| A5  | Equivalent fractions |
| A6  | Fraction comparison |
| A7  | Fraction ordering |
| A8  | Mixed/improper conversion |
| A9  | Like-denominator addition |
| A10 | Unlike-denominator addition |
| A11 | Fraction subtraction |
| A12 | Fraction application / word problems |

## Integration

The output of this module (the `questions` array with `attribute_ids`) feeds directly into the **Q-Matrix module** (`q-matrix/`) to build the binary question-by-attribute matrix used by GNPC/DINA.

