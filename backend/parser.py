import re

def parse_condition(cond_str):
    # Regex to capture left operand, operator, and right operand
    # Supports >=, <=, ==
    condition_pattern = re.compile(r'^(?P<left>\w+)\s*(?P<op>==|>=|<=)\s*(?P<right>\w+)$')
    m = condition_pattern.match(cond_str.strip())
    
    if not m:
        # Fallback or error handling; for PoC we might just return what we can or raise
        # But let's try to be robust as per example
        raise ValueError(f"Condition format invalid: {cond_str}")
        
    left = m.group('left')
    op_symbol = m.group('op')
    right_token = m.group('right')
    
    # Type conversion for the right operand
    if right_token.isdigit():
        right_value = int(right_token)
    elif right_token.lower() in ('true', 'false'):
        right_value = True if right_token.lower() == 'true' else False
    else:
        right_value = right_token # Keep as string if not number or boolean
        
    return { "op": op_symbol, "left": left, "right": right_value }

def parse_document(doc_text):
    lines = doc_text.splitlines()
    ast = { "score_name": "", "variables": {}, "rules": [] }
    
    current_section = None
    
    # We iterate through lines manually to handle logic
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line or line.startswith("#"):
            i += 1
            continue
            
        if line.startswith("score_name:"):
            ast["score_name"] = line.split(":", 1)[1].strip()
            i += 1
        elif line.startswith("variables:"):
            current_section = "variables"
            i += 1
        elif line.startswith("rules:"):
            current_section = "rules"
            i += 1
        elif current_section == "variables":
            # Expect "name: type"
            if ":" in line:
                key, val = line.split(":", 1)
                ast["variables"][key.strip()] = val.strip()
            i += 1
        elif current_section == "rules":
            # Expect "- if: condition"
            # followed by "  add: value"
            if line.startswith("if:") or line.startswith("- if:"):
                # Handle optional dash
                cond_str = line.split("if:", 1)[1].strip()
                
                # Look ahead for action
                action_val = 0
                if i + 1 < len(lines):
                    next_line = lines[i+1].strip()
                    if next_line.startswith("add:"):
                        try:
                            action_val = int(next_line.split(":", 1)[1].strip())
                        except ValueError:
                            pass # default 0 or error
                        i += 1 # consume add line
                
                try:
                    cond_ast = parse_condition(cond_str)
                    ast["rules"].append({
                        "condition": cond_ast,
                        "action": { "type": "add", "value": action_val }
                    })
                except Exception as e:
                    print(f"Error parsing rule: {e}")
                
            i += 1
        else:
            i += 1
            
    return ast
