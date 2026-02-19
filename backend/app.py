from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from parser_ai import parse_document_ai
from sqlalchemy.orm import Session
import re

import os

# Database imports
from database import get_db, init_db
import crud
import schemas

# Get root path from environment variable (for reverse proxy support)
ROOT_PATH = os.getenv("ROOT_PATH", "")

app = FastAPI(
    title="Medical Blockly API",
    root_path=ROOT_PATH,
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request validation
class ParseRequest(BaseModel):
    text: str

class CalculateRequest(BaseModel):
    ast: Dict[str, Any]
    inputs: Optional[Dict[str, Any]] = {}

class ChatRequest(BaseModel):
    message: str

@app.post('/parse')
async def parse_rule_doc(request: ParseRequest):
    text = request.text
    try:
        # Check if it's a structured format (formula, score, or combined)
        if any(keyword in text.lower() for keyword in ['formula:', 'formula_name:', 'formulas:', 'score_name:']):
            # Parse using local parser
            ast = parse_formula(text)
        else:
            # Use AI Parser for natural language
            ast = parse_document_ai(text)
        return ast
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    
    # Single condition: match pattern like BMI >= 25 or diabetes_present is true
    # Added support for 'is' and 'is not' operators
    pattern = r'^(\w+)\s*(>=|<=|==|>|<|is\s+not|is)\s*(.+)$'
    match = re.match(pattern, cond_str, re.IGNORECASE)
    if match:
        left = match.group(1)
        op = match.group(2).strip().lower()
        right_str = match.group(3).strip()
        
        # Map 'is' to '==' and 'is not' to '!='
        if op == 'is':
            op = '=='
        elif op == 'is not':
            op = '!='
        
        # Convert right value
        if right_str.lower() == 'true':
            right = True
        elif right_str.lower() == 'false':
            right = False
        else:
            try:
                # Try float first (handles both "3" and "3.0")
                right = float(right_str)
                # Convert to int if it's a whole number
                if right == int(right):
                    right = int(right)
            except:
                right = right_str
        
        return {'op': op, 'left': left, 'right': right}
    
    # Simple boolean variable (e.g., "diabetes_present" alone means == true)
    if cond_str.isidentifier():
        return {'op': '==', 'left': cond_str, 'right': True}
    
    # Return None for unparseable conditions (will be skipped)
    print(f"Warning: Could not parse condition: '{cond_str}'")
    return None

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

@app.post('/calculate')
async def calculate_score(request: CalculateRequest):
    ast = request.ast
    inputs = request.inputs or {}
    
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
            result = round(result, 2)

            # Evaluate risk_levels against the computed result (treated as "score")
            risk_level = None
            if ast.get('risk_levels'):
                risk_context = {**context, 'score': result}
                for risk in ast['risk_levels']:
                    if not risk or 'condition' not in risk:
                        continue
                    if evaluate_condition(risk['condition'], risk_context):
                        risk_level = risk.get('text', '')
                        break

            return {"result": result, "score": result, "risk_level": risk_level}
        
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
            
            # Step 4: Evaluate risk_levels to determine RiskLevel
            risk_level = None
            if ast.get('risk_levels'):
                # Add score to context for risk level evaluation
                risk_context = {**context, 'score': score}
                for risk in ast.get('risk_levels', []):
                    if not risk or 'condition' not in risk:
                        continue
                    cond = risk.get('condition', {})
                    if evaluate_condition(cond, risk_context):
                        risk_level = risk.get('text', '')
                        break  # First matching risk level wins
            
            # Build computed values
            computed_values = {k: round(v, 2) if isinstance(v, float) else v for k, v in context.items() if k not in inputs}
            if risk_level:
                computed_values['RiskLevel'] = risk_level
                        
            return {"score": score, "computed": computed_values, "risk_level": risk_level}
        
        # Fallback for pure formula without type field
        if ast.get('formula'):
            formula = ast['formula']
            for var_name, var_value in context.items():
                formula = re.sub(r'\b' + var_name + r'\b', str(var_value), formula)
            result = round(eval(formula, allowed_names), 2)
            risk_level = None
            if ast.get('risk_levels'):
                risk_context = {**context, 'score': result}
                for risk in ast['risk_levels']:
                    if not risk or 'condition' not in risk:
                        continue
                    if evaluate_condition(risk['condition'], risk_context):
                        risk_level = risk.get('text', '')
                        break
            return {"result": result, "score": result, "risk_level": risk_level}

        # Last-resort fallback: if formulas produced a 'score' value, use it
        if 'score' in context:
            score = round(context['score'], 2) if isinstance(context['score'], float) else context['score']
            risk_level = None
            if ast.get('risk_levels'):
                risk_context = {**context, 'score': score}
                for risk in ast.get('risk_levels', []):
                    if not risk or 'condition' not in risk:
                        continue
                    if evaluate_condition(risk['condition'], risk_context):
                        risk_level = risk.get('text', '')
                        break
            return {"result": score, "score": score, "risk_level": risk_level}

        raise HTTPException(status_code=400, detail="Unknown AST type")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/chat')
async def chat_generate_rules(request: ChatRequest, db: Session = Depends(get_db)):
    """Mixed-mode chat: general conversation OR formula generation depending on user intent."""
    import google.generativeai as genai
    import os
    from dotenv import load_dotenv

    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    genai.configure(api_key=api_key)

    user_message = request.message
    if not user_message:
        raise HTTPException(status_code=400, detail="No message provided")

    # Auto-fetch patient fields from DB (include label for unit info)
    db_fields = crud.get_patient_fields(db)

    # Build optional patient fields hint
    if db_fields:
        fields_list = ", ".join(
            f"{f.field_name} ({f.label})" if f.label else f.field_name
            for f in db_fields
        )
        patient_fields_hint = (
            f"\n\nAVAILABLE PATIENT FIELDS with units (optional hint): {fields_list}\n"
            f"Use the exact field_name as the variable name in formulas. The label shows the unit."
        )
    else:
        patient_fields_hint = ""

    prompt = f"""You are a helpful medical formula assistant. You can have general conversations AND generate medical scoring formulas.

DECIDE based on the user's message:
- If the user is asking a QUESTION, making SMALL TALK, requesting EXPLANATION, or saying something non-formula → reply conversationally in Traditional Chinese (繁體中文). Do NOT generate a formula.
- If the user is REQUESTING A FORMULA or scoring system → reply conversationally AND include the formula using the markers below.

User's message: {user_message}
{patient_fields_hint}

IF generating a formula, embed it exactly like this (markers on their own lines):
FORMULA_START
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
FORMULA_END

FORMULA RULES (only when generating):
1. All 5 sections required: score_name, variables, formulas, rules, risk_levels
2. Variable types: int or boolean ONLY
3. Variable names: snake_case
4. No comments (no # symbols)
5. Compound conditions: use "and" / "or"
6. If no formula needed, use dummy: 0 in formulas

EXAMPLE (SOFA Score):
FORMULA_START
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
FORMULA_END

Your conversational reply (in 繁體中文):"""

    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt)
        full_text = response.text.strip()

        # Parse: split conversational reply from formula block
        if "FORMULA_START" in full_text and "FORMULA_END" in full_text:
            before = full_text[:full_text.index("FORMULA_START")].strip()
            formula_raw = full_text[full_text.index("FORMULA_START") + len("FORMULA_START"):full_text.index("FORMULA_END")].strip()
            after = full_text[full_text.index("FORMULA_END") + len("FORMULA_END"):].strip()

            # Clean markdown fences inside formula block
            formula_lines = [l for l in formula_raw.split("\n") if not l.strip().startswith("```")]
            formula_text = "\n".join(formula_lines).strip()

            reply_parts = [p for p in [before, after] if p]
            reply_text = "\n".join(reply_parts) if reply_parts else "公式已生成，請點擊「載入到編輯器」使用。"

            return {"reply": reply_text, "generated_rules": formula_text}
        else:
            # Conversational reply only
            return {"reply": full_text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


# ──────────────────────────────────────────────
# Database Initialization
# ──────────────────────────────────────────────

@app.on_event("startup")
def on_startup():
    init_db()
    _seed_default_patient_fields()


def _seed_default_patient_fields():
    """Insert default patient fields (from PatientPanel sample data) if empty."""
    from schemas import PatientFieldCreate
    DEFAULT_FIELDS = [
        PatientFieldCreate(field_name="age",         label="年齡 (歲)",      field_type="int"),
        PatientFieldCreate(field_name="height",      label="身高 (公尺)",    field_type="float"),
        PatientFieldCreate(field_name="weight",      label="體重 (公斤)",    field_type="float"),
        PatientFieldCreate(field_name="cholesterol", label="膽固醇 (mg/dL)", field_type="float"),
        PatientFieldCreate(field_name="has_disease", label="是否患有常見疾病", field_type="boolean"),
    ]
    db = next(get_db())
    try:
        if crud.get_patient_fields(db):
            return  # already seeded
        for f in DEFAULT_FIELDS:
            try:
                crud.create_patient_field(db, f)
            except Exception:
                pass  # skip duplicate
    finally:
        db.close()


# ──────────────────────────────────────────────
# Department CRUD Endpoints
# ──────────────────────────────────────────────

@app.post('/departments', response_model=schemas.DepartmentListItem, status_code=201)
async def create_department(data: schemas.DepartmentCreate, db: Session = Depends(get_db)):
    """Create a new department."""
    try:
        return crud.create_department(db, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get('/departments', response_model=List[schemas.DepartmentListItem])
async def list_departments(db: Session = Depends(get_db)):
    """List all departments."""
    return crud.get_departments(db)


@app.get('/departments/{department_id}', response_model=schemas.DepartmentResponse)
async def get_department(department_id: int, db: Session = Depends(get_db)):
    """Get a single department with its formulas."""
    dept = crud.get_department(db, department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept


@app.put('/departments/{department_id}', response_model=schemas.DepartmentListItem)
async def update_department(
    department_id: int,
    data: schemas.DepartmentUpdate,
    db: Session = Depends(get_db),
):
    """Update a department."""
    dept = crud.update_department(db, department_id, data)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept


@app.delete('/departments/{department_id}')
async def delete_department(department_id: int, db: Session = Depends(get_db)):
    """Delete a department and all its formulas."""
    success = crud.delete_department(db, department_id)
    if not success:
        raise HTTPException(status_code=404, detail="Department not found")
    return {"detail": "Department deleted"}


# ──────────────────────────────────────────────
# Formula CRUD Endpoints
# ──────────────────────────────────────────────

@app.post(
    '/departments/{department_id}/formulas',
    response_model=schemas.FormulaResponse,
    status_code=201,
)
async def create_formula(
    department_id: int,
    data: schemas.FormulaCreate,
    db: Session = Depends(get_db),
):
    """Create a formula under a specific department."""
    # Verify department exists
    dept = crud.get_department(db, department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    try:
        return crud.create_formula(db, department_id, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get('/formulas', response_model=List[schemas.FormulaResponse])
async def list_formulas(
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """List all formulas. Optionally filter by department_id."""
    return crud.get_formulas(db, department_id)


@app.get('/formulas/{formula_id}', response_model=schemas.FormulaResponse)
async def get_formula(formula_id: int, db: Session = Depends(get_db)):
    """Get a single formula."""
    formula = crud.get_formula(db, formula_id)
    if not formula:
        raise HTTPException(status_code=404, detail="Formula not found")
    return formula


@app.put('/formulas/{formula_id}', response_model=schemas.FormulaResponse)
async def update_formula(
    formula_id: int,
    data: schemas.FormulaUpdate,
    db: Session = Depends(get_db),
):
    """Update a formula."""
    formula = crud.update_formula(db, formula_id, data)
    if not formula:
        raise HTTPException(status_code=404, detail="Formula not found")
    return formula


@app.delete('/formulas/{formula_id}')
async def delete_formula(formula_id: int, db: Session = Depends(get_db)):
    """Delete a formula."""
    success = crud.delete_formula(db, formula_id)
    if not success:
        raise HTTPException(status_code=404, detail="Formula not found")
    return {"detail": "Formula deleted"}


# ──────────────────────────────────────────────
# PatientField Endpoints  (field-name registry only)
# ──────────────────────────────────────────────

@app.get('/patient-fields', response_model=List[schemas.PatientFieldResponse])
async def list_patient_fields(db: Session = Depends(get_db)):
    """List all registered patient field names."""
    return crud.get_patient_fields(db)


@app.post('/patient-fields', response_model=schemas.PatientFieldResponse, status_code=201)
async def create_patient_field(data: schemas.PatientFieldCreate, db: Session = Depends(get_db)):
    """Register a new patient field name."""
    try:
        return crud.create_patient_field(db, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put('/patient-fields/{field_id}', response_model=schemas.PatientFieldResponse)
async def update_patient_field(
    field_id: int,
    data: schemas.PatientFieldUpdate,
    db: Session = Depends(get_db),
):
    """Update a patient field's label or type."""
    field = crud.update_patient_field(db, field_id, data)
    if not field:
        raise HTTPException(status_code=404, detail="Patient field not found")
    return field


@app.delete('/patient-fields/{field_id}')
async def delete_patient_field(field_id: int, db: Session = Depends(get_db)):
    """Remove a patient field from the registry."""
    success = crud.delete_patient_field(db, field_id)
    if not success:
        raise HTTPException(status_code=404, detail="Patient field not found")
    return {"detail": "Patient field deleted"}


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
