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

    FORMAT 1 - Pure Formula (for calculations like BMI, GFR):
    {{
      "formula_name": "string",
      "type": "formula",
      "variables": {{ "variable_name": "int", ... }},
      "formula": "math expression"
    }}

    FORMAT 2 - Pure Scoring Rules:
    {{
      "score_name": "string",
      "type": "score",
      "variables": {{ "variable_name": "int or boolean", ... }},
      "rules": [
        {{ "condition": {{ "op": ">=", "left": "variable_name", "right": value }}, "action": {{ "type": "add", "value": number }} }}
      ]
    }}

    FORMAT 3 - Scoring with Formulas (PREFERRED when rules use calculated values):
    {{
      "score_name": "string",
      "type": "score_with_formula",
      "variables": {{ "weight": "int", "height": "int", ... }},
      "formulas": {{ "BMI": "weight / (height * height)", ... }},
      "rules": [
        {{ "condition": {{ "op": ">=", "left": "BMI", "right": 25 }}, "action": {{ "type": "add", "value": 1 }} }}
      ]
    }}

    EXAMPLE - Obesity Risk Score:
    Input: "Create obesity risk score using BMI. If BMI >= 25 add 1, if BMI >= 30 add 2"
    Output:
    {{
      "score_name": "ObesityRisk",
      "type": "score_with_formula",
      "variables": {{ "weight": "int", "height": "int" }},
      "formulas": {{ "BMI": "weight / (height * height)" }},
      "rules": [
        {{ "condition": {{ "op": ">=", "left": "BMI", "right": 25 }}, "action": {{ "type": "add", "value": 1 }} }},
        {{ "condition": {{ "op": ">=", "left": "BMI", "right": 30 }}, "action": {{ "type": "add", "value": 2 }} }}
      ]
    }}

    Rules:
    1. Detect which format is appropriate based on input.
    2. If rules reference a calculated value (like BMI), use FORMAT 3 with "formulas" field.
    3. Parse all input variables (the raw inputs user provides).
    4. Parse derived formulas (calculated from input variables).
    5. Parse rules with condition (op, left, right) and action.
    6. Operators: >=, <=, ==, >, <
    7. Return ONLY the raw JSON. Do not include markdown formatting.
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
