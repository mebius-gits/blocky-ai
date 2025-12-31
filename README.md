# Medical Blockly - AI-Powered Rule Builder

A visual medical scoring rule builder that converts text into Blockly blocks. Supports complex formulas, compound conditions, and custom risk levels.

## ✨ Features

- 🤖 **AI Chat** - Generate scoring rules from natural language
- 📊 **Visual Blocks** - Blockly-based rule visualization
- ➕ **Compound Conditions** - Support for `and`/`or` logic
- 📐 **Formula Support** - BMI, GFR, and custom calculations
- 🎯 **Custom Risk Levels** - Define your own risk thresholds
- 🔄 **Live Calculation** - Instant score computation

---

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- [Gemini API Key](https://aistudio.google.com/)

### 1. Start Backend
```bash
cd backend
pip install -r requirements.txt
echo "GEMINI_API_KEY=your_key_here" > .env
python app.py
```
→ Runs at `http://localhost:5000`

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
→ Runs at `http://localhost:5173`

---

## 📝 Input Format

### Basic Structure
```yaml
score_name: MyScore
variables:
  age: int
  has_disease: boolean
formulas:
  bmi: weight / (height * height)
rules:
  - if: age >= 65
    add: 1
  - if: bmi >= 25 or has_disease
    add: 2
risk_levels:
  - if: score >= 3
    text: ⚠️ High Risk
  - if: score >= 1
    text: ⚡ Medium Risk
  - if: score < 1
    text: ✓ Low Risk
```

### Supported Features

| Feature | Syntax | Example |
|---------|--------|---------|
| Variables | `int`, `boolean` | `age: int` |
| Formulas | `+`, `-`, `*`, `/`, `**` | `bmi: weight / (height ** 2)` |
| Conditions | `>=`, `<=`, `==`, `>`, `<` | `if: age >= 65` |
| Compound | `and`, `or` | `if: gcs < 10 or map < 70` |
| Ternary | `if...else` | `factor: 0.85 if is_female else 1.0` |

---

## 🏥 Example Scores

### SOFA Score (ICU)
```yaml
score_name: SOFA_Score
variables:
  pao2_fio2: int
  platelets: int
  gcs: int
  map: int
  dopamine: int
  creatinine: int
formulas:
  dummy: 0
rules:
  - if: pao2_fio2 < 400
    add: 1
  - if: platelets < 150
    add: 1
  - if: gcs < 15
    add: 1
  - if: map < 70 or dopamine > 0
    add: 1
  - if: creatinine >= 2
    add: 1
risk_levels:
  - if: score >= 10
    text: ⚠️ Critical - Mortality >50%
  - if: score >= 6
    text: ⚡ Moderate - Mortality 20-30%
  - if: score < 6
    text: ✓ Low - Mortality <15%
```

### HEART Score (Cardiac)
```yaml
score_name: HEART_Score
variables:
  history: int
  ecg: int
  age: int
  risk_factors: int
  troponin: int
formulas:
  age_factor: (age - 45) / 20
rules:
  - if: history >= 2
    add: 2
  - if: ecg >= 2
    add: 2
  - if: age_factor >= 1
    add: 2
  - if: risk_factors >= 3
    add: 2
  - if: troponin >= 2
    add: 2
risk_levels:
  - if: score >= 7
    text: ⚠️ High - Intervention needed
  - if: score >= 4
    text: ⚡ Medium - Admit for observation
  - if: score < 4
    text: ✓ Low - Consider discharge
```

---

## 🔌 API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/parse` | POST | Parse text → AST |
| `/calculate` | POST | Compute score from inputs |
| `/chat` | POST | AI generates scoring rules |

---

## 📁 Project Structure

```
blocky-ai/
├── backend/
│   ├── app.py           # Flask API
│   ├── parser_ai.py     # Gemini AI parser
│   ├── .env             # API keys
│   └── requirements.txt
└── frontend/
    └── src/
        ├── App.jsx      # Main UI
        └── utils/
            └── blocklyGenerator.js  # AST → Blocks
```

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google AI API key |
| `GEMINI_MODEL` | No | Model name (default: gemini-1.5-flash) |
