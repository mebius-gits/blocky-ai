from flask import Flask, request, jsonify
from flask_cors import CORS
from parser_ai import parse_document_ai

app = Flask(__name__)
CORS(app)

@app.route('/parse', methods=['POST'])
def parse_rule_doc():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "No text provided"}), 400
    
    text = data['text']
    try:
        # Use AI Parser
        ast = parse_document_ai(text)
        return jsonify(ast)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/calculate', methods=['POST'])
def calculate_score():
    # This is a sample backend calculation endpoint 
    # if we wanted to run the logic server-side.
    # Payload: { "ast": ..., "inputs": { "age": 70, "has_disease": true } }
    
    data = request.get_json()
    ast = data.get('ast')
    inputs = data.get('inputs', {})
    
    if not ast:
        return jsonify({"error": "No AST provided"}), 400
        
    score = 0
    # Simple interpreter
    try:
        # Initialize score? In AST it's 0 usually.
        
        for rule in ast.get('rules', []):
            cond = rule['condition']
            action = rule['action']
            
            left_val = inputs.get(cond['left'])
            right_val = cond['right']
            op = cond['op']
            
            if left_val is None:
                continue # Skip or error?
                
            matched = False
            if op == ">=":
                matched = left_val >= right_val
            elif op == "<=":
                matched = left_val <= right_val
            elif op == "==":
                matched = left_val == right_val
                
            if matched:
                if action['type'] == 'add':
                    score += action['value']
                    
        return jsonify({"score": score})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
