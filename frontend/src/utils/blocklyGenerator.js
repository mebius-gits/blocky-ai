import * as Blockly from 'blockly';

export function astToBlockly(ast, workspace) {
    const name = ast.formula_name || ast.score_name || 'Result';

    console.log('AST received:', ast);

    // Create result variable
    let resultVar = workspace.getVariable(name);
    if (!resultVar) {
        resultVar = workspace.createVariable(name, 'Number');
    }
    const resultVarId = resultVar.getId();

    // Create input variables FIRST - store both name and model
    const varMap = {}; // name -> varModel
    if (ast.variables) {
        for (const [varName, varType] of Object.entries(ast.variables)) {
            let varModel = workspace.getVariable(varName);
            if (!varModel) {
                varModel = workspace.createVariable(varName, varType === 'int' ? 'Number' : 'Boolean');
            }
            varMap[varName] = varModel;
            console.log('Created variable:', varName, 'with id:', varModel.getId());
        }
    }

    // Create formula variables (computed values like BMI)
    if (ast.formulas) {
        for (const formulaName of Object.keys(ast.formulas)) {
            let varModel = workspace.getVariable(formulaName);
            if (!varModel) {
                varModel = workspace.createVariable(formulaName, 'Number');
            }
            varMap[formulaName] = varModel;
            console.log('Created formula variable:', formulaName, 'with id:', varModel.getId());
        }
    }

    console.log('Variable map:', Object.keys(varMap));
    console.log('Formula:', ast.formula);
    console.log('Formulas:', ast.formulas);

    // Check if has formulas to compute (score_with_formula type)
    if (ast.formulas && ast.rules) {
        createFormulaWithScoreBlocks(ast, workspace, resultVarId, varMap);
    } else if (ast.formula) {
        // Pure formula type
        createFormulaBlocks(ast, workspace, resultVarId, varMap);
    } else if (ast.rules) {
        // Pure score type
        createScoreBlocks(ast, workspace, resultVarId, varMap);
    }

    workspace.render();
}

function createFormulaBlocks(ast, workspace, resultVarId, varMap) {
    const setBlock = workspace.newBlock('variables_set');
    setBlock.setFieldValue(resultVarId, 'VAR');

    const formulaBlock = parseFormula(ast.formula, workspace, varMap);

    if (formulaBlock) {
        setBlock.getInput('VALUE').connection.connect(formulaBlock.outputConnection);
    }

    setBlock.initSvg();
    setBlock.moveBy(50, 50);
}

// Parse formula using varMap directly
function parseFormula(formula, workspace, varMap) {
    // Handle undefined or null formula
    if (formula == null) return createNumber(workspace, 0);

    formula = String(formula).trim();
    console.log('Parsing:', formula);

    if (!formula) return createNumber(workspace, 0);

    // Check for if...else conditional expression first
    // Pattern: "value1 if condition else value2"
    const ifElseMatch = formula.match(/^(.+?)\s+if\s+(.+?)\s+else\s+(.+)$/);
    if (ifElseMatch) {
        const thenValue = ifElseMatch[1].trim();
        const condition = ifElseMatch[2].trim();
        const elseValue = ifElseMatch[3].trim();

        console.log('Found if-else:', { thenValue, condition, elseValue });

        // Create ternary block (if-then-else expression)
        const ternaryBlock = workspace.newBlock('logic_ternary');

        // Parse condition (e.g., "is_female" or "age > 50")
        const conditionBlock = parseCondition(condition, workspace, varMap);
        if (conditionBlock) {
            conditionBlock.initSvg();
            ternaryBlock.getInput('IF').connection.connect(conditionBlock.outputConnection);
        }

        // Parse then value
        const thenBlock = parseFormula(thenValue, workspace, varMap);
        if (thenBlock) {
            thenBlock.initSvg();
            ternaryBlock.getInput('THEN').connection.connect(thenBlock.outputConnection);
        }

        // Parse else value
        const elseBlock = parseFormula(elseValue, workspace, varMap);
        if (elseBlock) {
            elseBlock.initSvg();
            ternaryBlock.getInput('ELSE').connection.connect(elseBlock.outputConnection);
        }

        ternaryBlock.initSvg();
        return ternaryBlock;
    }

    // Remove wrapping parentheses
    while (formula.startsWith('(') && formula.endsWith(')') && isWrapped(formula)) {
        formula = formula.slice(1, -1).trim();
    }

    // Find the main operator (lowest precedence, rightmost)
    const mainOp = findMainOperator(formula);

    if (mainOp) {
        const left = formula.substring(0, mainOp.pos).trim();
        const right = formula.substring(mainOp.pos + mainOp.op.length).trim();

        const opBlock = workspace.newBlock('math_arithmetic');
        const opMap = { '+': 'ADD', '-': 'MINUS', '*': 'MULTIPLY', '/': 'DIVIDE', '**': 'POWER' };
        opBlock.setFieldValue(opMap[mainOp.op] || 'ADD', 'OP');

        const leftBlock = parseFormula(left, workspace, varMap);
        const rightBlock = parseFormula(right, workspace, varMap);

        if (leftBlock) {
            leftBlock.initSvg();
            opBlock.getInput('A').connection.connect(leftBlock.outputConnection);
        }
        if (rightBlock) {
            rightBlock.initSvg();
            opBlock.getInput('B').connection.connect(rightBlock.outputConnection);
        }

        opBlock.initSvg();
        return opBlock;
    }

    // No operator found - must be a number or variable
    const num = parseFloat(formula);
    if (!isNaN(num)) {
        return createNumber(workspace, num);
    }

    // Check if it's a boolean (with null check)
    if (formula && (formula.toLowerCase() === 'true' || formula.toLowerCase() === 'false')) {
        const boolBlock = workspace.newBlock('logic_boolean');
        boolBlock.setFieldValue(formula.toLowerCase() === 'true' ? 'TRUE' : 'FALSE', 'BOOL');
        boolBlock.initSvg();
        return boolBlock;
    }

    // Check if it's a variable using the varMap directly
    console.log('Checking variable:', formula, 'in varMap:', Object.keys(varMap));
    if (varMap[formula]) {
        console.log('Found variable in varMap:', formula);
        const varModel = varMap[formula];
        const block = workspace.newBlock('variables_get');
        block.setFieldValue(varModel.getId(), 'VAR');
        block.initSvg();
        return block;
    }

    console.log('Variable not found, fallback to 0:', formula);
    return createNumber(workspace, 0);
}

// Parse condition for if...else (e.g., "is_female" or "age > 50")
function parseCondition(condition, workspace, varMap) {
    // Handle undefined or null condition
    if (condition == null) {
        const trueBlock = workspace.newBlock('logic_boolean');
        trueBlock.setFieldValue('TRUE', 'BOOL');
        trueBlock.initSvg();
        return trueBlock;
    }
    condition = String(condition).trim();

    // Check for comparison operators
    const compMatch = condition.match(/^(\w+)\s*(>=|<=|==|>|<)\s*(.+)$/);
    if (compMatch) {
        const left = compMatch[1].trim();
        const op = compMatch[2];
        const right = compMatch[3].trim();

        const compareBlock = workspace.newBlock('logic_compare');
        const opMap = { '>=': 'GTE', '<=': 'LTE', '==': 'EQ', '>': 'GT', '<': 'LT' };
        compareBlock.setFieldValue(opMap[op] || 'EQ', 'OP');

        const leftBlock = parseFormula(left, workspace, varMap);
        if (leftBlock) {
            leftBlock.initSvg();
            compareBlock.getInput('A').connection.connect(leftBlock.outputConnection);
        }

        const rightBlock = parseFormula(right, workspace, varMap);
        if (rightBlock) {
            rightBlock.initSvg();
            compareBlock.getInput('B').connection.connect(rightBlock.outputConnection);
        }

        compareBlock.initSvg();
        return compareBlock;
    }

    // Simple variable (boolean)
    if (varMap[condition]) {
        const varModel = varMap[condition];
        const block = workspace.newBlock('variables_get');
        block.setFieldValue(varModel.getId(), 'VAR');
        block.initSvg();
        return block;
    }

    // Fallback: true
    const trueBlock = workspace.newBlock('logic_boolean');
    trueBlock.setFieldValue('TRUE', 'BOOL');
    trueBlock.initSvg();
    return trueBlock;
}

function isWrapped(formula) {
    let depth = 0;
    for (let i = 0; i < formula.length; i++) {
        if (formula[i] === '(') depth++;
        else if (formula[i] === ')') depth--;
        if (depth === 0 && i < formula.length - 1) return false;
    }
    return true;
}

function findMainOperator(formula) {
    const operators = [['+', '-'], ['*', '/'], ['**']];

    for (const ops of operators) {
        let depth = 0;
        for (let i = formula.length - 1; i >= 0; i--) {
            if (formula[i] === ')') depth++;
            else if (formula[i] === '(') depth--;
            else if (depth === 0) {
                for (const op of ops) {
                    if (formula.substring(i, i + op.length) === op) {
                        if (op === '*' && (formula[i + 1] === '*' || (i > 0 && formula[i - 1] === '*'))) {
                            continue;
                        }
                        if (i > 0) {
                            return { op, pos: i };
                        }
                    }
                }
            }
        }
    }
    return null;
}

function createNumber(workspace, num) {
    const block = workspace.newBlock('math_number');
    block.setFieldValue(num, 'NUM');
    block.initSvg();
    return block;
}

// Create condition block for either simple or compound conditions
function createConditionBlock(condition, workspace, varMap, scoreVarId) {
    if (!condition) return null;

    // Handle compound conditions (and/or)
    if (condition.compound) {
        const logicBlock = workspace.newBlock('logic_operation');
        logicBlock.setFieldValue(condition.compound.toUpperCase(), 'OP'); // 'AND' or 'OR'

        const subConditions = condition.conditions || [];
        if (subConditions.length >= 1) {
            const leftBlock = createConditionBlock(subConditions[0], workspace, varMap, scoreVarId);
            if (leftBlock) {
                leftBlock.initSvg();
                logicBlock.getInput('A').connection.connect(leftBlock.outputConnection);
            }
        }
        if (subConditions.length >= 2) {
            // For more than 2 conditions, we'd need to nest, but for now handle 2
            const rightBlock = createConditionBlock(subConditions[1], workspace, varMap, scoreVarId);
            if (rightBlock) {
                rightBlock.initSvg();
                logicBlock.getInput('B').connection.connect(rightBlock.outputConnection);
            }
        }

        logicBlock.initSvg();
        return logicBlock;
    }

    // Simple condition (left op right)
    if (!condition.left || !condition.op || condition.left === 'unknown') return null;

    const condBlock = workspace.newBlock('logic_compare');
    const opMap = { '>=': 'GTE', '<=': 'LTE', '==': 'EQ', '>': 'GT', '<': 'LT' };
    condBlock.setFieldValue(opMap[condition.op] || 'EQ', 'OP');

    // Left side - variable
    const leftVarName = condition.left;
    let leftVarModel = varMap[leftVarName];
    if (!leftVarModel) {
        leftVarModel = workspace.createVariable(leftVarName, 'Number');
        varMap[leftVarName] = leftVarModel;
    }

    const leftBlock = workspace.newBlock('variables_get');
    leftBlock.setFieldValue(leftVarModel.getId(), 'VAR');
    leftBlock.initSvg();
    condBlock.getInput('A').connection.connect(leftBlock.outputConnection);

    // Right side - value
    let rightBlock;
    const rightVal = condition.right;
    if (typeof rightVal === 'number') {
        rightBlock = workspace.newBlock('math_number');
        rightBlock.setFieldValue(rightVal, 'NUM');
    } else if (typeof rightVal === 'boolean') {
        rightBlock = workspace.newBlock('logic_boolean');
        rightBlock.setFieldValue(rightVal ? 'TRUE' : 'FALSE', 'BOOL');
    } else if (rightVal == null) {
        rightBlock = workspace.newBlock('math_number');
        rightBlock.setFieldValue(0, 'NUM');
    } else {
        const strVal = String(rightVal).toLowerCase();
        if (strVal === 'true' || strVal === 'false') {
            rightBlock = workspace.newBlock('logic_boolean');
            rightBlock.setFieldValue(strVal === 'true' ? 'TRUE' : 'FALSE', 'BOOL');
        } else {
            rightBlock = workspace.newBlock('math_number');
            rightBlock.setFieldValue(parseFloat(rightVal) || 0, 'NUM');
        }
    }
    rightBlock.initSvg();
    condBlock.getInput('B').connection.connect(rightBlock.outputConnection);

    return condBlock;
}

function createScoreBlocks(ast, workspace, scoreVarId, varMap) {
    const initBlock = workspace.newBlock('variables_set');
    initBlock.setFieldValue(scoreVarId, 'VAR');

    const zeroBlock = workspace.newBlock('math_number');
    zeroBlock.setFieldValue(0, 'NUM');

    initBlock.getInput('VALUE').connection.connect(zeroBlock.outputConnection);
    initBlock.initSvg();
    zeroBlock.initSvg();
    initBlock.moveBy(50, 50);

    let prevBlock = initBlock;

    ast.rules.forEach(rule => {
        // Skip rules without valid condition
        if (!rule || !rule.condition) return;

        const ifBlock = workspace.newBlock('controls_if');

        // Handle compound or simple conditions
        const condBlock = createConditionBlock(rule.condition, workspace, varMap, scoreVarId);
        if (!condBlock) return;

        condBlock.initSvg();
        ifBlock.getInput('IF0').connection.connect(condBlock.outputConnection);

        const setScoreBlock = workspace.newBlock('variables_set');
        setScoreBlock.setFieldValue(scoreVarId, 'VAR');

        const addBlock = workspace.newBlock('math_arithmetic');
        addBlock.setFieldValue('ADD', 'OP');

        const currentScoreBlock = workspace.newBlock('variables_get');
        currentScoreBlock.setFieldValue(scoreVarId, 'VAR');
        currentScoreBlock.initSvg();

        const valBlock = workspace.newBlock('math_number');
        valBlock.setFieldValue(rule.action.value, 'NUM');
        valBlock.initSvg();

        addBlock.getInput('A').connection.connect(currentScoreBlock.outputConnection);
        addBlock.getInput('B').connection.connect(valBlock.outputConnection);
        addBlock.initSvg();

        setScoreBlock.getInput('VALUE').connection.connect(addBlock.outputConnection);
        setScoreBlock.initSvg();

        ifBlock.getInput('DO0').connection.connect(setScoreBlock.previousConnection);
        ifBlock.initSvg();

        prevBlock.nextConnection.connect(ifBlock.previousConnection);
        prevBlock = ifBlock;
    });
}

// New function: Creates formula blocks followed by scoring rules
function createFormulaWithScoreBlocks(ast, workspace, scoreVarId, varMap) {
    let yOffset = 50;
    let prevBlock = null;

    // Step 1: Create formula assignment blocks (e.g., set BMI = weight / height^2)
    for (const [formulaName, formulaExpr] of Object.entries(ast.formulas || {})) {
        // Skip empty or undefined formula expressions
        if (!formulaExpr) continue;

        const formulaVarModel = varMap[formulaName];
        if (!formulaVarModel) continue;

        const setBlock = workspace.newBlock('variables_set');
        setBlock.setFieldValue(formulaVarModel.getId(), 'VAR');

        const formulaBlock = parseFormula(formulaExpr, workspace, varMap);
        if (formulaBlock) {
            setBlock.getInput('VALUE').connection.connect(formulaBlock.outputConnection);
        }

        setBlock.initSvg();
        setBlock.moveBy(50, yOffset);
        yOffset += 60;

        if (prevBlock) {
            prevBlock.nextConnection.connect(setBlock.previousConnection);
        }
        prevBlock = setBlock;
    }

    // Step 2: Initialize score = 0
    const initBlock = workspace.newBlock('variables_set');
    initBlock.setFieldValue(scoreVarId, 'VAR');

    const zeroBlock = workspace.newBlock('math_number');
    zeroBlock.setFieldValue(0, 'NUM');

    initBlock.getInput('VALUE').connection.connect(zeroBlock.outputConnection);
    initBlock.initSvg();
    zeroBlock.initSvg();

    if (prevBlock) {
        prevBlock.nextConnection.connect(initBlock.previousConnection);
    } else {
        initBlock.moveBy(50, yOffset);
    }
    prevBlock = initBlock;

    // Step 3: Create scoring rule blocks (if BMI >= 25 then score += 1)
    (ast.rules || []).forEach(rule => {
        // Skip rules without valid condition
        if (!rule || !rule.condition) return;

        const ifBlock = workspace.newBlock('controls_if');

        // Use createConditionBlock to handle both simple and compound conditions
        const condBlock = createConditionBlock(rule.condition, workspace, varMap, scoreVarId);
        if (!condBlock) return;

        condBlock.initSvg();
        ifBlock.getInput('IF0').connection.connect(condBlock.outputConnection);

        // Action: score = score + value
        const setScoreBlock = workspace.newBlock('variables_set');
        setScoreBlock.setFieldValue(scoreVarId, 'VAR');

        const addBlock = workspace.newBlock('math_arithmetic');
        addBlock.setFieldValue('ADD', 'OP');

        const currentScoreBlock = workspace.newBlock('variables_get');
        currentScoreBlock.setFieldValue(scoreVarId, 'VAR');
        currentScoreBlock.initSvg();

        const valBlock = workspace.newBlock('math_number');
        valBlock.setFieldValue(rule.action.value, 'NUM');
        valBlock.initSvg();

        addBlock.getInput('A').connection.connect(currentScoreBlock.outputConnection);
        addBlock.getInput('B').connection.connect(valBlock.outputConnection);
        addBlock.initSvg();

        setScoreBlock.getInput('VALUE').connection.connect(addBlock.outputConnection);
        setScoreBlock.initSvg();

        ifBlock.getInput('DO0').connection.connect(setScoreBlock.previousConnection);
        ifBlock.initSvg();

        prevBlock.nextConnection.connect(ifBlock.previousConnection);
        prevBlock = ifBlock;
    });

    // Step 4: Add score interpretation blocks (set RiskLevel text)
    // Create RiskLevel variable
    let riskVar = workspace.getVariable('RiskLevel');
    if (!riskVar) {
        riskVar = workspace.createVariable('RiskLevel', 'String');
    }
    const riskVarId = riskVar.getId();

    // Use custom risk_levels if provided, otherwise use defaults
    const riskLevels = ast.risk_levels && ast.risk_levels.length > 0
        ? ast.risk_levels
        : [
            { condition: { op: '>=', left: 'score', right: 3 }, text: '⚠️ High Risk' },
            { condition: { op: '==', left: 'score', right: 2 }, text: '⚡ Medium Risk' },
            { condition: { op: '<', left: 'score', right: 2 }, text: '✓ Low Risk' }
        ];

    // Generate blocks for each risk level
    riskLevels.forEach(riskLevel => {
        if (!riskLevel.condition || !riskLevel.text) return;

        const ifBlock = workspace.newBlock('controls_if');

        const condBlock = workspace.newBlock('logic_compare');
        const opMap = { '>=': 'GTE', '<=': 'LTE', '==': 'EQ', '>': 'GT', '<': 'LT' };
        condBlock.setFieldValue(opMap[riskLevel.condition.op] || 'EQ', 'OP');

        const scoreGetBlock = workspace.newBlock('variables_get');
        scoreGetBlock.setFieldValue(scoreVarId, 'VAR');
        scoreGetBlock.initSvg();
        condBlock.getInput('A').connection.connect(scoreGetBlock.outputConnection);

        const numBlock = workspace.newBlock('math_number');
        numBlock.setFieldValue(riskLevel.condition.right, 'NUM');
        numBlock.initSvg();
        condBlock.getInput('B').connection.connect(numBlock.outputConnection);
        condBlock.initSvg();

        ifBlock.getInput('IF0').connection.connect(condBlock.outputConnection);

        const setBlock = workspace.newBlock('variables_set');
        setBlock.setFieldValue(riskVarId, 'VAR');
        const textBlock = workspace.newBlock('text');
        textBlock.setFieldValue(riskLevel.text, 'TEXT');
        textBlock.initSvg();
        setBlock.getInput('VALUE').connection.connect(textBlock.outputConnection);
        setBlock.initSvg();

        ifBlock.getInput('DO0').connection.connect(setBlock.previousConnection);
        ifBlock.initSvg();

        prevBlock.nextConnection.connect(ifBlock.previousConnection);
        prevBlock = ifBlock;
    });
}
