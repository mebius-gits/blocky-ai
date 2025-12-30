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
    
    Target JSON Format:
    {{
      "score_name": "string",
      "variables": {{ "variable_name": "int or boolean", ... }},
      "rules": [
        {{
          "condition": {{ "op": ">=" or "<=" or "==", "left": "variable_name", "right": value }},
          "action": {{ "type": "add", "value": number }}
        }}
      ]
    }}
    
    Rules:
    1. Parse 'score_name' from the text.
    2. Parse 'variables' and their types (int/boolean).
    3. Parse 'rules'. Each rule has an 'if' condition and an 'add' action.
    4. For conditions, split into 'left' (variable), 'op' (calculated from text, e.g., >=), and 'right' (value).
    5. Ensure 'right' value is the correct type (int or boolean).
    6. Return ONLY the raw JSON. Do not include markdown formatting like ```json ... ```.
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
