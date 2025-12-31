# AI Prompt & System Architecture

This document explains how AI processes user input to generate Blockly visual blocks.

---

## 🔄 System Flow

```
User Input (Text/Natural Language)
         ↓
    Backend API (/parse or /chat)
         ↓
┌─────────────────────────────────┐
│  Structured Format?             │
│  (has score_name/variables)     │
└─────────────────────────────────┘
    YES → Local Parser
    NO  → Gemini AI Parser
         ↓
      AST JSON
         ↓
   Frontend (blocklyGenerator.js)
         ↓
     Blockly Blocks
```

---

## 📝 AST JSON Format

### Full Structure
```json
{
  "score_name": "MyScore",
  "type": "score_with_formula",
  "variables": {
    "age": "int",
    "is_female": "boolean"
  },
  "formulas": {
    "bmi": "weight / (height * height)",
    "factor": "0.85 if is_female else 1.0"
  },
  "rules": [
    {
      "condition": {
        "op": ">=",
        "left": "bmi",
        "right": 25
      },
      "action": { "type": "add", "value": 1 }
    },
    {
      "condition": {
        "compound": "or",
        "conditions": [
          { "op": "<", "left": "map", "right": 70 },
          { "op": ">", "left": "dopamine", "right": 0 }
        ]
      },
      "action": { "type": "add", "value": 1 }
    }
  ],
  "risk_levels": [
    {
      "condition": { "op": ">=", "left": "score", "right": 3 },
      "text": "⚠️ High Risk"
    }
  ]
}
```

---

## 🤖 AI Chat Prompt Structure

Located in: `backend/app.py` → `/chat` endpoint

### Key Components

1. **Role Definition**
   ```
   You are a medical risk scoring assistant.
   ```

2. **Required Format**
   - score_name
   - variables (int/boolean)
   - formulas (use dummy:0 if none)
   - rules (with add: action)
   - risk_levels (3 levels)

3. **Example** - SOFA Score with compound conditions

4. **Strict Rules**
   - No comments (#)
   - snake_case variables
   - Only return structure

---

## 🧱 AST → Blockly Conversion

Located in: `frontend/src/utils/blocklyGenerator.js`

### Main Functions

| Function | Purpose |
|----------|---------|
| `astToBlockly()` | Entry point - routes to correct builder |
| `createFormulaBlocks()` | Pure formula (BMI calc) |
| `createScoreBlocks()` | Pure scoring rules |
| `createFormulaWithScoreBlocks()` | Combined formula + scoring |
| `createConditionBlock()` | Handles simple & compound conditions |
| `parseFormula()` | Math expression → Blockly blocks |
| `parseCondition()` | Condition string → Blockly blocks |

### Block Generation Flow

```
1. Create Variables (inputs + formulas)
         ↓
2. Create Formula Blocks
   set BMI to [weight ÷ (height × height)]
         ↓
3. Initialize Score = 0
         ↓
4. Create Rule Blocks
   if [BMI >= 25] then
     set Score to [Score + 1]
         ↓
5. Create Risk Level Blocks
   if [Score >= 3] then
     set RiskLevel to "⚠️ High Risk"
```

---

## 🔧 Compound Condition Handling

### Parser (Backend)
```python
# backend/app.py
def parse_condition_str(cond_str):
    # Splits on 'or' (low precedence)
    # Then splits on 'and' (high precedence)
    # Returns: { compound: 'or', conditions: [...] }
```

### Evaluator (Backend)
```python
def evaluate_condition(cond, context):
    if 'compound' in cond:
        if compound == 'and':
            return all(sub_conditions)
        if compound == 'or':
            return any(sub_conditions)
    # Simple condition evaluation
```

### Blockly (Frontend)
```javascript
function createConditionBlock(condition, workspace, varMap) {
    if (condition.compound) {
        // Create logic_operation block (AND/OR)
    } else {
        // Create logic_compare block (>=, <, etc.)
    }
}
```

---

## 📊 Formula Parser

### Supported Expressions

| Type | Example | Blockly Block |
|------|---------|---------------|
| Math | `a + b * c` | `math_arithmetic` |
| Power | `x ** 2` | `math_arithmetic` (POWER) |
| Ternary | `0.85 if is_female else 1.0` | `logic_ternary` |
| Variable | `age` | `variables_get` |
| Number | `25` | `math_number` |
| Boolean | `true` | `logic_boolean` |

### Operator Precedence
```
1. + -      (lowest)
2. * /
3. **       (highest)
```

---

## 💡 Extending the System

### Add New Variable Type
1. `app.py` → Update `parse_condition_str()` type conversion
2. `app.py` → Update `calculate_score()` value handling
3. `App.jsx` → Update input field rendering
4. `blocklyGenerator.js` → Add block creation logic

### Add New Operator
1. `app.py` → Add to `evaluate_condition()`
2. `blocklyGenerator.js` → Add to `opMap` in `createConditionBlock()`

### Add New Block Type
1. Import from Blockly or define custom block
2. Add creation logic in appropriate function
