# AI Prompt Structure for Blockly Generation

This document explains how AI processes user input to generate Blockly visual blocks.

---

## 🔄 Data Flow

```
User Input (Text) 
    ↓
Backend Parser (app.py)
    ↓
┌─────────────────────────────────────┐
│  Structured Text?                   │
│  (contains score_name/formulas)     │
└─────────────────────────────────────┘
    ├── YES → Local Parser (parse_formula)
    └── NO  → AI Parser (Gemini)
                  ↓
              AI Prompt
                  ↓
              AST JSON
                  ↓
Frontend (blocklyGenerator.js)
                  ↓
            Blockly Blocks
```

---

## 📝 AI Prompt Structure

### Location: `backend/parser_ai.py`

The AI receives a carefully crafted prompt with:

### 1. Role Definition
```
You are a medical rule parser. Convert the following text 
rule document into a specific JSON Abstract Syntax Tree (AST) format.
```

### 2. Input Text
```
Input Text:
{user_input}
```

### 3. Output Format Options

**FORMAT 1 - Pure Formula:**
```json
{
  "formula_name": "BMI",
  "type": "formula",
  "variables": { "weight": "int", "height": "int" },
  "formula": "weight / (height * height)"
}
```

**FORMAT 2 - Pure Scoring:**
```json
{
  "score_name": "RiskScore",
  "type": "score",
  "variables": { "age": "int" },
  "rules": [
    { "condition": { "op": ">=", "left": "age", "right": 65 }, 
      "action": { "type": "add", "value": 1 } }
  ]
}
```

**FORMAT 3 - Combined (Formula + Scoring):**
```json
{
  "score_name": "ObesityRisk",
  "type": "score_with_formula",
  "variables": { "weight": "int", "height": "int" },
  "formulas": { "BMI": "weight / (height * height)" },
  "rules": [
    { "condition": { "op": ">=", "left": "BMI", "right": 25 }, 
      "action": { "type": "add", "value": 1 } }
  ]
}
```

### 4. Few-Shot Example
```
EXAMPLE - Obesity Risk Score:
Input: "Create obesity risk score using BMI. If BMI >= 25 add 1"
Output: { ... complete JSON example ... }
```

### 5. Parsing Rules
```
Rules:
1. Detect which format is appropriate based on input.
2. If rules reference a calculated value (like BMI), use FORMAT 3.
3. Parse all input variables (raw inputs user provides).
4. Parse derived formulas (calculated from input variables).
5. Parse rules with condition (op, left, right) and action.
6. Operators: >=, <=, ==, >, <
7. Return ONLY raw JSON. No markdown formatting.
```

---

## 🧱 AST to Blockly Conversion

### Location: `frontend/src/utils/blocklyGenerator.js`

### Main Function: `astToBlockly(ast, workspace)`

```javascript
1. Create result variable (score name)
2. Create input variables (from ast.variables)
3. Create formula variables (from ast.formulas)

4. Check AST type:
   ├── ast.formulas && ast.rules → createFormulaWithScoreBlocks()
   ├── ast.formula              → createFormulaBlocks()
   └── ast.rules                → createScoreBlocks()
```

### Block Generation Flow

```
createFormulaWithScoreBlocks():
│
├── Step 1: Formula Blocks
│   set BMI to [weight ÷ (height × height)]
│
├── Step 2: Initialize Score
│   set Score to 0
│
├── Step 3: Rule Blocks
│   if [BMI >= 25] then
│     set Score to [Score + 1]
│
└── Step 4: Risk Interpretation
    if [Score >= 3] then
      set RiskLevel to "⚠️ High Risk"
    if [Score == 2] then
      set RiskLevel to "⚡ Medium Risk"
    if [Score < 2] then
      set RiskLevel to "✓ Low Risk"
```

---

## 🔧 Formula Parser

### Location: `parseFormula()` in blocklyGenerator.js

Converts math expressions to nested Blockly blocks:

```
Input:  "weight / (height * height)"

Output Blocks:
┌─────────────────────────────────┐
│  [weight] ÷ [(height) × (height)]
└─────────────────────────────────┘

Algorithm:
1. Find main operator (lowest precedence, rightmost)
2. Split into left and right expressions
3. Recursively parse each side
4. Create math_arithmetic block
5. Connect child blocks
```

### Operator Precedence
```
Level 1: + -      (lowest - parse first)
Level 2: * /
Level 3: **       (highest - parse last)
```

---

## 💡 How to Extend

### Add New Operator
1. `app.py` → Add to `calculate_score()` if/elif chain
2. `blocklyGenerator.js` → Add to `opMap` object

### Add New Variable Type
1. `parser_ai.py` → Update prompt to recognize new type
2. `app.py` → Update type conversion in calculation
3. `blocklyGenerator.js` → Create appropriate Blockly block

### Add New Block Type
1. Import from Blockly or define custom block
2. Add creation logic in `blocklyGenerator.js`
