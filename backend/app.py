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
        # Check if it's a structured format (formula, score, or combined)
        if any(keyword in text.lower() for keyword in ['formula:', 'formula_name:', 'formulas:', 'score_name:']):
            # Parse using local parser
            ast = parse_formula(text)
        else:
            # Use AI Parser for natural language
            ast = parse_document_ai(text)
        return jsonify(ast)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def parse_formula(text):
    """Parse formula, score, or combined score_with_formula format"""
    lines = text.strip().split('\n')
    ast = {
        "variables": {},
        "type": "formula"
    }
    
    current_section = None
    current_rule = None
    
    for line in lines:
        line_stripped = line.strip()
        if not line_stripped:
            continue
            
        if line_stripped.startswith('formula_name:'):
            ast['formula_name'] = line_stripped.split(':', 1)[1].strip()
            ast['type'] = 'formula'
        elif line_stripped.startswith('score_name:'):
            ast['score_name'] = line_stripped.split(':', 1)[1].strip()
            ast['type'] = 'score'
        elif line_stripped.startswith('variables:'):
            current_section = 'variables'
        elif line_stripped.startswith('formulas:'):
            current_section = 'formulas'
            ast['formulas'] = {}
            ast['type'] = 'score_with_formula'
        elif line_stripped.startswith('rules:'):
            current_section = 'rules'
            ast['rules'] = []
        elif line_stripped.startswith('formula:') and current_section != 'formulas':
            ast['formula'] = line_stripped.split(':', 1)[1].strip()
        elif current_section == 'variables' and ':' in line_stripped:
            parts = line_stripped.split(':')
            var_name = parts[0].strip()
            var_type = parts[1].strip() if len(parts) > 1 else 'int'
            ast['variables'][var_name] = var_type
        elif current_section == 'formulas' and ':' in line_stripped:
            parts = line_stripped.split(':', 1)
            formula_name = parts[0].strip()
            formula_expr = parts[1].strip() if len(parts) > 1 else ''
            ast['formulas'][formula_name] = formula_expr
        elif current_section == 'rules':
            if line_stripped.startswith('- if:') or line_stripped.startswith('if:'):
                # New rule
                cond_str = line_stripped.split('if:', 1)[1].strip()
                current_rule = {'condition_str': cond_str}
                ast['rules'].append(current_rule)
            elif line_stripped.startswith('add:') and current_rule:
                add_val = int(line_stripped.split(':', 1)[1].strip())
                current_rule['action'] = {'type': 'add', 'value': add_val}
                # Parse condition string
                cond_str = current_rule.pop('condition_str', '')
                current_rule['condition'] = parse_condition_str(cond_str)
    
    return ast

def parse_condition_str(cond_str):
    """Parse condition string like 'BMI >= 25' into structured format"""
    import re
    # Match patterns like: BMI >= 25, age == 65, has_disease == true
    pattern = r'^(\w+)\s*(>=|<=|==|>|<)\s*(.+)$'
    match = re.match(pattern, cond_str.strip())
    if match:
        left = match.group(1)
        op = match.group(2)
        right_str = match.group(3).strip()
        
        # Convert right value
        if right_str.lower() == 'true':
            right = True
        elif right_str.lower() == 'false':
            right = False
        else:
            try:
                right = int(right_str)
            except:
                try:
                    right = float(right_str)
                except:
                    right = right_str
        
        return {'op': op, 'left': left, 'right': right}
    
    return {'op': '==', 'left': 'unknown', 'right': 0}

@app.route('/calculate', methods=['POST'])
def calculate_score():
    data = request.get_json()
    ast = data.get('ast')
    inputs = data.get('inputs', {})
    
    if not ast:
        return jsonify({"error": "No AST provided"}), 400
    
    try:
        # Setup safe eval environment
        import math
        allowed_names = {"__builtins__": {}}
        allowed_names['sqrt'] = math.sqrt
        allowed_names['pow'] = pow
        allowed_names['abs'] = abs
        
        # Create a context with all input values
        context = dict(inputs)
        
        # Step 1: Evaluate any formulas first
        if ast.get('formulas'):
            for formula_name, formula_expr in ast['formulas'].items():
                # Replace variables with values
                expr = formula_expr
                for var_name, var_value in context.items():
                    expr = re.sub(r'\b' + var_name + r'\b', str(var_value), expr)
                # Evaluate and store result
                result = eval(expr, allowed_names)
                context[formula_name] = result
        
        # Step 2: Check if pure formula type
        if ast.get('type') == 'formula' and ast.get('formula'):
            formula = ast['formula']
            for var_name, var_value in context.items():
                formula = re.sub(r'\b' + var_name + r'\b', str(var_value), formula)
            result = eval(formula, allowed_names)
            return jsonify({"result": round(result, 2)})
        
        # Step 3: Score-based calculation (with formula support)
        if ast.get('rules'):
            score = 0
            for rule in ast.get('rules', []):
                # Skip invalid rules
                if not rule or 'condition' not in rule or 'action' not in rule:
                    continue
                    
                cond = rule.get('condition', {})
                action = rule.get('action', {})
                
                # Skip if condition is incomplete
                if not cond.get('left') or not cond.get('op'):
                    continue
                
                # Get left value - could be from inputs or computed formulas
                left_val = context.get(cond['left'])
                right_val = cond.get('right', 0)
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
                    if action.get('type') == 'add':
                        score += action.get('value', 0)
                        
            return jsonify({"score": score, "computed": {k: round(v, 2) if isinstance(v, float) else v for k, v in context.items() if k not in inputs}})
        
        # Fallback for pure formula without type field
        if ast.get('formula'):
            formula = ast['formula']
            for var_name, var_value in context.items():
                formula = re.sub(r'\b' + var_name + r'\b', str(var_value), formula)
            result = eval(formula, allowed_names)
            return jsonify({"result": round(result, 2)})
            
        return jsonify({"error": "Unknown AST type"}), 400
        
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
    
    prompt = f"""You are a medical formula/rule assistant. Based on the user's request, generate the appropriate format.

User's request: {user_message}

FORMAT 1 - Pure FORMULA (like BMI, GFR calculations):
```
formula_name: [Name]
variables:
  [var1]: int
  [var2]: int
formula: [mathematical expression]
```

FORMAT 2 - Pure SCORING RULES (simple condition-based):
```
score_name: [Name]
variables:
  [var1]: int
  [var2]: boolean
rules:
  - if: [condition]
    add: [number]
```

FORMAT 3 - SCORING WITH FORMULAS (PREFERRED when rules use calculated values like BMI):
```
score_name: [Name]
variables:
  [var1]: int
  [var2]: int
formulas:
  [calculated_name]: [formula expression]
rules:
  - if: [calculated_name] [op] [value]
    add: [number]
```

EXAMPLE for FORMAT 3:
```
score_name: ObesityRisk
variables:
  weight: int
  height: int
formulas:
  BMI: weight / (height * height)
rules:
  - if: BMI >= 25
    add: 1
  - if: BMI >= 30
    add: 2
```

Important:
- Use FORMAT 3 when rules reference calculated values
- Math operators: +, -, *, /, **
- Condition operators: >=, <=, ==, >, <
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
