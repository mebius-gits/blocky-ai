import google.generativeai as genai
import os
import json
import re
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    # Fallback or warning? For now print warning.
    print("WARNING: GEMINI_API_KEY not found in environment variables.")
else:
    genai.configure(api_key=api_key)

def parse_document_ai(doc_text):
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set. Please check your .env file.")

    # Try using a standard model that is generally available
    # If gemini-1.5-flash fails, try gemini-pro
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    try:
        model = genai.GenerativeModel(model_name)
    except:
        # Fallback
        model = genai.GenerativeModel('gemini-pro')

    prompt = f"""
    You are a medical rule parser. Convert the following text rule document into a specific JSON Abstract Syntax Tree (AST) format.
    
    Input Text:
    {doc_text}
    
    There are THREE possible formats:

    FORMAT 1 - Pure Formula (for calculations like BMI, GFR) with risk classification:
    {{
      "formula_name": "string",
      "type": "formula",
      "variables": {{ "variable_name": "int", ... }},
      "formula": "math expression using variable names",
      "risk_levels": [
        {{ "condition": {{ "op": ">=", "left": "score", "right": value }}, "text": "risk label" }},
        ...
      ]
    }}

    FORMAT 2 - Pure Scoring Rules:
    {{
      "score_name": "string",
      "type": "score",
      "variables": {{ "variable_name": "int or boolean", ... }},
      "rules": [
        {{ "condition": {{ "op": ">=", "left": "variable_name", "right": value }}, "action": {{ "type": "add", "value": number }} }}
      ],
      "risk_levels": [
        {{ "condition": {{ "op": ">=", "left": "score", "right": value }}, "text": "risk label" }},
        ...
      ]
    }}

    FORMAT 3 - Scoring with Formulas (when rules reference computed values):
    {{
      "score_name": "string",
      "type": "score_with_formula",
      "variables": {{ "weight": "int", "height": "int", ... }},
      "formulas": {{ "bmi": "weight / ((height / 100.0) * (height / 100.0))", ... }},
      "rules": [
        {{ "condition": {{ "op": ">=", "left": "bmi", "right": 25 }}, "action": {{ "type": "add", "value": 1 }} }}
      ],
      "risk_levels": [
        {{ "condition": {{ "op": ">=", "left": "score", "right": value }}, "text": "risk label" }},
        ...
      ]
    }}

    EXAMPLE - BMI Calculator with risk levels:
    Input DSL:
    score_name: BMI
    variables:
      weight: int
      height: int
    formulas:
      score: weight / ((height / 100.0) * (height / 100.0))
    rules:
      dummy: 0
    risk_levels:
      - if: score >= 30
        text: ⚠️ 肥胖
      - if: score >= 25
        text: ⚡ 過重
      - if: score >= 18.5
        text: ✓ 正常
      - if: score < 18.5
        text: ⚡ 體重過輕

    Output:
    {{
      "formula_name": "BMI",
      "type": "formula",
      "variables": {{ "weight": "int", "height": "int" }},
      "formula": "weight / ((height / 100.0) * (height / 100.0))",
      "risk_levels": [
        {{ "condition": {{ "op": ">=", "left": "score", "right": 30 }}, "text": "⚠️ 肥胖" }},
        {{ "condition": {{ "op": ">=", "left": "score", "right": 25 }}, "text": "⚡ 過重" }},
        {{ "condition": {{ "op": ">=", "left": "score", "right": 18.5 }}, "text": "✓ 正常" }},
        {{ "condition": {{ "op": "<", "left": "score", "right": 18.5 }}, "text": "⚡ 體重過輕" }}
      ]
    }}

    Rules:
    1. Detect which format is appropriate based on input.
    2. If the DSL has "formulas:" with a real expression and "rules: dummy: 0", use FORMAT 1 (pure formula).
    3. If rules reference a calculated value (like BMI), use FORMAT 3.
    4. For FORMAT 1, the "formula" field is the math expression (e.g. "weight / ((height/100.0)**2)").
    5. Always include risk_levels from the DSL. Map each "if: score >= X" to a condition with op/left/right and a text field.
    6. Operators: >=, <=, ==, >, <
    7. The "left" in risk_level conditions should always be "score".
    8. Return ONLY the raw JSON. Do not include markdown formatting.
    """
    
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Clean up potential markdown code blocks if the model ignores the instruction
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
             text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        return json.loads(text.strip())
        
    except Exception as e:
        raise RuntimeError(f"AI Parsing failed: {str(e)}")
