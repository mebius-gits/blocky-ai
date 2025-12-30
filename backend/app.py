from flask import Flask, request, jsonify
from flask_cors import CORS
from parser_ai import parse_document_ai
import re

app = Flask(__name__)
CORS(app)

@app.route('/parse', methods=['POST'])
def parse_rule_doc():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "No text provided"}), 400
    
    text = data['text']
    try:
        # Check if it's a formula or score rules
        if 'formula:' in text.lower() or 'formula_name:' in text.lower():
            # Parse formula directly
            ast = parse_formula(text)
        else:
            # Use AI Parser for rules
            ast = parse_document_ai(text)
        return jsonify(ast)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def parse_formula(text):
    """Parse a simple formula definition"""
    lines = text.strip().split('\n')
    ast = {
        "formula_name": "",
        "variables": {},
        "formula": "",
        "type": "formula"
    }
    
    current_section = None
    
    for line in lines:
        line_stripped = line.strip()
        if not line_stripped:
            continue
            
        if line_stripped.startswith('formula_name:'):
            ast['formula_name'] = line_stripped.split(':', 1)[1].strip()
        elif line_stripped.startswith('score_name:'):
            ast['formula_name'] = line_stripped.split(':', 1)[1].strip()
            ast['type'] = 'score'
        elif line_stripped.startswith('variables:'):
            current_section = 'variables'
        elif line_stripped.startswith('formula:'):
            ast['formula'] = line_stripped.split(':', 1)[1].strip()
        elif current_section == 'variables' and ':' in line_stripped:
            # Variable definition
            parts = line_stripped.split(':')
            var_name = parts[0].strip()
            var_type = parts[1].strip() if len(parts) > 1 else 'int'
            ast['variables'][var_name] = var_type
    
    return ast

@app.route('/calculate', methods=['POST'])
def calculate_score():
    data = request.get_json()
    ast = data.get('ast')
    inputs = data.get('inputs', {})
    
    if not ast:
        return jsonify({"error": "No AST provided"}), 400
    
    try:
        # Check if formula type
        if ast.get('formula'):
            # Evaluate formula
            formula = ast['formula']
            # Replace variables with values
            for var_name, var_value in inputs.items():
                formula = re.sub(r'\b' + var_name + r'\b', str(var_value), formula)
            
            # Safe eval with only math operations
            allowed_names = {"__builtins__": {}}
            import math
            allowed_names['sqrt'] = math.sqrt
            allowed_names['pow'] = pow
            allowed_names['abs'] = abs
            
            result = eval(formula, allowed_names)
            return jsonify({"result": round(result, 2)})
        else:
            # Score-based calculation
            score = 0
            for rule in ast.get('rules', []):
                cond = rule['condition']
                action = rule['action']
                
                left_val = inputs.get(cond['left'])
                right_val = cond['right']
                op = cond['op']
                
                if left_val is None:
                    continue
                    
                matched = False
                if op == ">=":
                    matched = left_val >= right_val
                elif op == "<=":
                    matched = left_val <= right_val
                elif op == "==":
                    matched = left_val == right_val
                elif op == ">":
                    matched = left_val > right_val
                elif op == "<":
                    matched = left_val < right_val
                    
                if matched:
                    if action['type'] == 'add':
                        score += action['value']
                        
            return jsonify({"score": score})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat_generate_rules():
    """Generate rule structure from natural language description"""
    import google.generativeai as genai
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    
    if not api_key:
        return jsonify({"error": "GEMINI_API_KEY not configured"}), 500
    
    genai.configure(api_key=api_key)
    
    data = request.get_json()
    user_message = data.get('message', '')
    
    if not user_message:
        return jsonify({"error": "No message provided"}), 400
    
    prompt = f"""You are a medical formula/rule assistant. Based on the user's request, generate EITHER a formula OR scoring rules.

User's request: {user_message}

If user wants a CALCULATION FORMULA (like BMI, GFR, etc), use this format:
```
formula_name: [Name]
variables:
  [var1]: int
  [var2]: int
formula: [mathematical expression using variables]
```

If user wants SCORING RULES (risk scores, etc), use this format:
```
score_name: [Name]
variables:
  [var1]: int
  [var2]: boolean
rules:
  - if: [condition]
    add: [number]
```

Important:
- For formulas: use standard math operators (+, -, *, /, **)
- For rules: use operators >=, <=, ==, >, <
- Variables are int or boolean only
- Respond with ONLY the structure, no explanation

Generate:"""

    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt)
        generated_text = response.text.strip()
        
        # Clean up markdown
        if '```' in generated_text:
            lines = generated_text.split('\n')
            clean_lines = [l for l in lines if not l.strip().startswith('```')]
            generated_text = '\n'.join(clean_lines)
        
        return jsonify({
            "reply": "Generated! Click 'Use This' to load it.",
            "generated_rules": generated_text.strip()
        })
    except Exception as e:
        return jsonify({"error": f"AI generation failed: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
