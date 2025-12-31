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
    formula = formula.trim();
    console.log('Parsing:', formula);

    if (!formula) return createNumber(workspace, 0);

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
        const ifBlock = workspace.newBlock('controls_if');

        const condBlock = workspace.newBlock('logic_compare');
        const opMap = { '>=': 'GTE', '<=': 'LTE', '==': 'EQ', '>': 'GT', '<': 'LT' };
        condBlock.setFieldValue(opMap[rule.condition.op] || 'EQ', 'OP');

        const leftVarName = rule.condition.left;
        let leftVarModel = varMap[leftVarName];
        if (!leftVarModel) {
            leftVarModel = workspace.createVariable(leftVarName, 'Number');
            varMap[leftVarName] = leftVarModel;
        }

        const leftBlock = workspace.newBlock('variables_get');
        leftBlock.setFieldValue(leftVarModel.getId(), 'VAR');
        leftBlock.initSvg();
        condBlock.getInput('A').connection.connect(leftBlock.outputConnection);

        let rightBlock;
        if (typeof rule.condition.right === 'number') {
            rightBlock = workspace.newBlock('math_number');
            rightBlock.setFieldValue(rule.condition.right, 'NUM');
        } else if (typeof rule.condition.right === 'boolean') {
            rightBlock = workspace.newBlock('logic_boolean');
            rightBlock.setFieldValue(rule.condition.right ? 'TRUE' : 'FALSE', 'BOOL');
        } else {
            const strVal = String(rule.condition.right).toLowerCase();
            if (strVal === 'true' || strVal === 'false') {
                rightBlock = workspace.newBlock('logic_boolean');
                rightBlock.setFieldValue(strVal === 'true' ? 'TRUE' : 'FALSE', 'BOOL');
            } else {
                rightBlock = workspace.newBlock('math_number');
                rightBlock.setFieldValue(0, 'NUM');
            }
        }
        rightBlock.initSvg();
        condBlock.getInput('B').connection.connect(rightBlock.outputConnection);
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
    for (const [formulaName, formulaExpr] of Object.entries(ast.formulas)) {
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
    ast.rules.forEach(rule => {
        const ifBlock = workspace.newBlock('controls_if');

        const condBlock = workspace.newBlock('logic_compare');
        const opMap = { '>=': 'GTE', '<=': 'LTE', '==': 'EQ', '>': 'GT', '<': 'LT' };
        condBlock.setFieldValue(opMap[rule.condition.op] || 'EQ', 'OP');

        // Left side - the formula variable (e.g., BMI)
        const leftVarName = rule.condition.left;
        let leftVarModel = varMap[leftVarName];
        if (!leftVarModel) {
            leftVarModel = workspace.createVariable(leftVarName, 'Number');
            varMap[leftVarName] = leftVarModel;
        }

        const leftBlock = workspace.newBlock('variables_get');
        leftBlock.setFieldValue(leftVarModel.getId(), 'VAR');
        leftBlock.initSvg();
        condBlock.getInput('A').connection.connect(leftBlock.outputConnection);

        // Right side - the comparison value
        let rightBlock;
        if (typeof rule.condition.right === 'number') {
            rightBlock = workspace.newBlock('math_number');
            rightBlock.setFieldValue(rule.condition.right, 'NUM');
        } else if (typeof rule.condition.right === 'boolean') {
            rightBlock = workspace.newBlock('logic_boolean');
            rightBlock.setFieldValue(rule.condition.right ? 'TRUE' : 'FALSE', 'BOOL');
        } else {
            rightBlock = workspace.newBlock('math_number');
            rightBlock.setFieldValue(parseFloat(rule.condition.right) || 0, 'NUM');
        }
        rightBlock.initSvg();
        condBlock.getInput('B').connection.connect(rightBlock.outputConnection);
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
}
