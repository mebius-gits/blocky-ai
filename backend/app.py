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
    current_risk = None
    
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
        elif line_stripped.startswith('risk_levels:'):
            current_section = 'risk_levels'
            ast['risk_levels'] = []
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
        elif current_section == 'risk_levels':
            if line_stripped.startswith('- if:') or line_stripped.startswith('if:'):
                cond_str = line_stripped.split('if:', 1)[1].strip()
                current_risk = {'condition_str': cond_str}
                ast['risk_levels'].append(current_risk)
            elif line_stripped.startswith('text:') and current_risk:
                text_val = line_stripped.split(':', 1)[1].strip()
                current_risk['text'] = text_val
                cond_str = current_risk.pop('condition_str', '')
                current_risk['condition'] = parse_condition_str(cond_str)
    
    return ast

def parse_condition_str(cond_str):
    """Parse condition string like 'BMI >= 25' or 'age > 50 and has_disease' into structured format"""
    import re
    cond_str = cond_str.strip()
    
    # Check for compound conditions with 'or' (lower precedence)
    # Split on ' or ' not inside parentheses
    or_parts = split_on_operator(cond_str, ' or ')
    if len(or_parts) > 1:
        return {
            'compound': 'or',
            'conditions': [parse_condition_str(part) for part in or_parts]
        }
    
    # Check for compound conditions with 'and' (higher precedence)
    and_parts = split_on_operator(cond_str, ' and ')
    if len(and_parts) > 1:
        return {
            'compound': 'and',
            'conditions': [parse_condition_str(part) for part in and_parts]
        }
    
    # Remove parentheses if wrapped
    if cond_str.startswith('(') and cond_str.endswith(')'):
        cond_str = cond_str[1:-1].strip()
    
    # Single condition: match pattern like BMI >= 25
    pattern = r'^(\w+)\s*(>=|<=|==|>|<)\s*(.+)$'
    match = re.match(pattern, cond_str)
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
    
    # Simple boolean variable
    if cond_str.isidentifier():
        return {'op': '==', 'left': cond_str, 'right': True}
    
    return {'op': '==', 'left': 'unknown', 'right': 0}

def evaluate_condition(cond, context):
    """Evaluate condition (simple or compound) against context values"""
    if not cond:
        return False
    
    # Handle compound conditions (and/or)
    if 'compound' in cond:
        compound_type = cond['compound']
        sub_conditions = cond.get('conditions', [])
        
        if compound_type == 'and':
            return all(evaluate_condition(sub, context) for sub in sub_conditions)
        elif compound_type == 'or':
            return any(evaluate_condition(sub, context) for sub in sub_conditions)
        return False
    
    # Simple condition
    if not cond.get('left') or not cond.get('op'):
        return False
    
    left_val = context.get(cond['left'])
    right_val = cond.get('right', 0)
    op = cond['op']
    
    if left_val is None:
        return False
    
    try:
        if op == ">=":
            return left_val >= right_val
        elif op == "<=":
            return left_val <= right_val
        elif op == "==":
            return left_val == right_val
        elif op == ">":
            return left_val > right_val
        elif op == "<":
            return left_val < right_val
    except TypeError:
        return False
    
    return False

def split_on_operator(s, op):
    """Split string on operator, respecting parentheses"""
    parts = []
    depth = 0
    current = ""
    i = 0
    while i < len(s):
        if s[i] == '(':
            depth += 1
            current += s[i]
        elif s[i] == ')':
            depth -= 1
            current += s[i]
        elif depth == 0 and s[i:i+len(op)] == op:
            parts.append(current.strip())
            current = ""
            i += len(op) - 1
        else:
            current += s[i]
        i += 1
    if current.strip():
        parts.append(current.strip())
    return parts

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
        allowed_names['True'] = True
        allowed_names['False'] = False
        
        # Create a context with all input values (convert booleans properly)
        context = {}
        for k, v in inputs.items():
            if isinstance(v, bool):
                context[k] = v
            elif isinstance(v, str) and v.lower() in ('true', 'false'):
                context[k] = v.lower() == 'true'
            else:
                context[k] = v
        
        # Step 1: Evaluate any formulas first (in order, as later formulas may depend on earlier ones)
        if ast.get('formulas'):
            for formula_name, formula_expr in ast['formulas'].items():
                # Replace variables with values
                expr = formula_expr
                for var_name, var_value in context.items():
                    # Convert Python booleans to proper format for eval
                    if isinstance(var_value, bool):
                        replacement = 'True' if var_value else 'False'
                    else:
                        replacement = str(var_value)
                    expr = re.sub(r'\b' + var_name + r'\b', replacement, expr)
                
                # Handle 'if...else' conditional expressions (convert to Python ternary)
                # Pattern: "value1 if condition else value2"
                # This is already valid Python syntax, just needs proper boolean handling
                expr = expr.replace(' true ', ' True ').replace(' false ', ' False ')
                expr = expr.replace('(true)', '(True)').replace('(false)', '(False)')
                
                # Evaluate and store result
                try:
                    result = eval(expr, allowed_names)
                    context[formula_name] = result
                except Exception as e:
                    # If formula fails, store error message but continue
                    context[formula_name] = 0
                    print(f"Formula error for {formula_name}: {e}")
        
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
                
                # Evaluate condition (supports compound and/or)
                matched = evaluate_condition(cond, context)
                    
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
    
    prompt = f"""You are a medical risk scoring assistant. Generate a complete, working scoring structure based on the user's request.

User's request: {user_message}

REQUIRED FORMAT:
```
score_name: [ScoreName]
variables:
  [var1]: int
  [var2]: int
  [bool_var]: boolean
formulas:
  dummy: 0
rules:
  - if: [var] [op] [value]
    add: [number]
risk_levels:
  - if: score >= [high]
    text: ⚠️ [High risk text]
  - if: score >= [medium]
    text: ⚡ [Medium risk text]
  - if: score < [medium]
    text: ✓ [Low risk text]
```

EXAMPLE - SOFA Score (ICU Mortality):
```
score_name: SOFA_Score
variables:
  pao2_fio2: int
  platelets: int
  bilirubin: int
  map: int
  dopamine: int
  gcs: int
  creatinine: int
formulas:
  dummy: 0
rules:
  - if: pao2_fio2 < 400
    add: 1
  - if: pao2_fio2 < 300
    add: 1
  - if: platelets < 150
    add: 1
  - if: platelets < 100
    add: 1
  - if: bilirubin >= 2
    add: 1
  - if: map < 70 or dopamine > 0
    add: 1
  - if: dopamine > 5
    add: 1
  - if: gcs < 15
    add: 1
  - if: gcs < 10
    add: 1
  - if: creatinine >= 2
    add: 1
risk_levels:
  - if: score >= 12
    text: ⚠️ 高危 - 死亡率 >35%
  - if: score >= 6
    text: ⚡ 中危 - 死亡率 20-30%
  - if: score < 6
    text: ✓ 低危 - 死亡率 <15%
```

STRICT RULES:
1. Include ALL 5 sections: score_name, variables, formulas, rules, risk_levels
2. Variable names: use simple snake_case (e.g., age, blood_pressure, gcs)
3. Variable types: int or boolean ONLY
4. Formulas: if none needed, use "dummy: 0"
5. Compound conditions: use "and" / "or" (e.g., "if: map < 70 or dopamine > 0")
6. NO comments (no # symbols)
7. Return ONLY the structure, no explanations

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
