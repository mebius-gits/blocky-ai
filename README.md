# Medical Blockly - Rule Builder System

A visual medical rule builder that converts natural language or structured text into Blockly visual blocks. Uses Gemini AI for parsing.

## System Architecture

```
blocky ai/
├── backend/           # Python Flask API
│   ├── app.py         # Main API server (endpoints)
│   ├── parser_ai.py   # Gemini AI parser (text → AST)
│   ├── .env           # API keys (GEMINI_API_KEY, GEMINI_MODEL)
│   └── requirements.txt
│
└── frontend/          # React + Vite
    └── src/
        ├── App.jsx              # Main UI component
        ├── App.css              # All styles
        ├── components/
        │   └── BlocklyComponent.jsx  # Blockly workspace wrapper
        └── utils/
            └── blocklyGenerator.js   # AST → Blockly blocks
```

## Data Flow

```
User Input → Backend API → Gemini AI → AST JSON → Frontend → Blockly Blocks
     ↓
  Calculate → Backend evaluates rules/formula → Returns result
```

## Key Files to Modify

### Adding New Formula Types
**File:** `backend/app.py` → `parse_formula()` function

### Changing AI Parsing Prompt
**File:** `backend/parser_ai.py` → `parse_document_ai()` function

### Adding New Blockly Block Types
**File:** `frontend/src/utils/blocklyGenerator.js`
- `parseFormula()` - for formula expressions
- `createScoreBlocks()` - for if-then rules

### Changing UI Layout/Style
**File:** `frontend/src/App.css`

### Adding New UI Components
**File:** `frontend/src/App.jsx`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/parse` | POST | Convert text to AST JSON |
| `/calculate` | POST | Evaluate AST with inputs |
| `/chat` | POST | AI generates rule structure |

## AST Format

### Formula Type
```json
{
  "formula_name": "BMI_Calculator",
  "type": "formula",
  "variables": { "weight": "int", "height": "int" },
  "formula": "weight / (height * height)"
}
```

### Score Type
```json
{
  "score_name": "RiskScore",
  "type": "score",
  "variables": { "age": "int", "has_disease": "boolean" },
  "rules": [
    { "condition": { "op": ">=", "left": "age", "right": 65 }, "action": { "type": "add", "value": 1 } }
  ]
}
```

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
# Create .env with GEMINI_API_KEY=your_key
python app.py

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google AI API key |
| `GEMINI_MODEL` | Model name (default: gemini-1.5-flash) |

## Adding New Features

### New Variable Type
1. Update `backend/parser_ai.py` prompt to recognize new type
2. Update `backend/app.py` → `calculate_score()` to handle type
3. Update `frontend/blocklyGenerator.js` to create correct blocks

### New Operator
1. Add to `backend/app.py` → `calculate_score()` operator handling
2. Add to `frontend/blocklyGenerator.js` → `opMap` object

### New Block Type
1. Import block from Blockly or define custom
2. Add creation logic in `blocklyGenerator.js`
