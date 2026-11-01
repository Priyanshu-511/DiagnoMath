# DiagnoMath — Q-Matrix Module

Converts question-to-attribute mappings into a binary Q-matrix for the DiagnoMath cognitive-diagnosis pipeline.

## Setup

```bash
cd q-matrix
npm install
npm test
npm start
```

The API server runs on **port 3200** by default (`PORT` env var overrides it).

## Fixed Attribute Bank (A1–A12)

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

## API Endpoints

### `GET /health`
Returns `{ "status": "ok" }`.

### `POST /qmatrix/generate`
**Body** (JSON): Assessment object with `assessment` metadata and `questions` array (questions must include `attribute_ids`).

### `POST /qmatrix/bert-tiny/generate` (100% Offline AI with prajjwal1/bert-tiny)
Uses the local `prajjwal1/bert-tiny` 128-d Transformer model instead of the Gemini API key.
- **Input**: Raw questions array with `question` text and options (NO manual `attribute_ids` required).
- **Output**: Automatically classifies each question into A1–A12 attributes and returns the binary Q-matrix.

**Response** (200):
```json
{
  "qmatrix": [[0,0,0,1,0,0,0,0,0,0,0,0], ...],
  "attributes": ["A1","A2","A3","A4","A5","A6","A7","A8","A9","A10","A11","A12"],
  "questionIds": ["Q1", "Q2", ...],
  "questions": [
    { "question_id": "Q1", "attribute_ids": ["A4"] }
  ],
  "rows": 10,
  "cols": 12,
  "model": "prajjwal1/bert-tiny"
}
```

**Response** (200):
```json
{
  "qmatrix": [[0,0,0,1,0,0,0,0,0,0,0,0], ...],
  "attributes": ["A1","A2","A3","A4","A5","A6","A7","A8","A9","A10","A11","A12"],
  "questionIds": ["Q1", "Q2", ...],
  "rows": 10,
  "cols": 12
}
```

**Error** (400): `{ "error": "<reason>" }`

## Question JSON Contract

```json
{
  "assessment": { "title": "...", "subject": "Mathematics", "topic": "Fractions" },
  "questions": [
    {
      "question_id": "Q1",
      "question": "Simplify 12/18.",
      "options": { "A": "2/3", "B": "3/4", "C": "4/5", "D": "6/9" },
      "correct_answer": "A",
      "attribute_ids": ["A4"],
      "difficulty": "medium"
    }
  ]
}
```

