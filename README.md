# Medical Blockly - Rule Builder System

A visual medical rule builder that converts structured text into Blockly visual blocks. Supports **formulas**, **scoring rules**, and **combined formula+scoring** with automatic risk level interpretation.

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- Gemini API Key (get from [Google AI Studio](https://aistudio.google.com/))

### Step 1: Start Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Create .env file with your API key
echo "GEMINI_API_KEY=your_api_key_here" > .env

# Start server
python app.py
```

Backend runs at: `http://localhost:5000`

### Step 2: Start Frontend (New Terminal)

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: `http://localhost:5173`

### Step 3: Open Browser

Navigate to `http://localhost:5173` and start building!

---

## 📋 How to Use

1. **Click "Load Example"** to see a sample rule
2. **Click "Generate Blocks"** to create Blockly blocks
3. **Enter variable values** in the right panel
4. **Click "Calculate"** to see results with risk level

---

## 📝 Input Format

### Combined Format (Recommended)
Supports formulas within scoring rules:

```
score_name: ObesityRisk
variables:
  weight: int
  height: int
  age: int
formulas:
  BMI: weight / (height * height)
  age_doubled: age * 2
rules:
  - if: BMI >= 25
    add: 1
  - if: BMI >= 30
    add: 2
  - if: age_doubled >= 120
    add: 1
```

### Variables
- `int` - Numbers (age, weight, etc.)
- `boolean` - True/False (is_smoker, has_diabetes)

### Formulas
Define computed values using math operations: `+`, `-`, `*`, `/`, `**`

### Rules
- Operators: `>=`, `<=`, `==`, `>`, `<`
- Actions: `add: [number]`

---

## 🎯 Risk Level Interpretation

| Score | Risk Level |
|-------|------------|
| 0-1 | ✓ Low Risk |
| 2 | ⚡ Medium Risk |
| 3+ | ⚠️ High Risk |

---

## 📁 Project Structure

```
blocky ai/
├── backend/
│   ├── app.py              # Flask API + calculation logic
│   ├── parser_ai.py        # Gemini AI natural language parser
│   ├── parser.py           # Regex-based fallback parser
│   ├── .env                # API keys
│   └── requirements.txt
│
└── frontend/
    └── src/
        ├── App.jsx                    # Main UI
        ├── App.css                    # Styles
        ├── components/
        │   └── BlocklyComponent.jsx   # Blockly workspace
        └── utils/
            └── blocklyGenerator.js    # AST → Blockly blocks
```

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/parse` | POST | Convert text to AST JSON |
| `/calculate` | POST | Evaluate AST with input values |
| `/chat` | POST | AI generates rules from natural language |

---

## 🧪 Example: Complex Cardiovascular Risk

```
score_name: CardiovascularRisk
variables:
  age: int
  total_cholesterol: int
  hdl_cholesterol: int
  systolic_bp: int
  is_smoker: boolean
  has_diabetes: boolean
  weight: int
  height: int
formulas:
  BMI: weight / (height * height)
  cholesterol_ratio: total_cholesterol / hdl_cholesterol
  bp_adjusted: systolic_bp * 1.2
  age_risk_factor: (age - 20) / 5
rules:
  - if: age_risk_factor >= 8
    add: 3
  - if: age_risk_factor >= 6
    add: 2
  - if: cholesterol_ratio >= 6
    add: 3
  - if: cholesterol_ratio >= 5
    add: 2
  - if: bp_adjusted >= 180
    add: 3
  - if: bp_adjusted >= 156
    add: 2
  - if: BMI >= 30
    add: 2
  - if: BMI >= 25
    add: 1
  - if: is_smoker == true
    add: 4
  - if: has_diabetes == true
    add: 3
```

---

## ⚙️ Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google AI API key (required) |
| `GEMINI_MODEL` | Model name (default: gemini-1.5-flash) |
