import * as Blockly from 'blockly';

import type { AST, Condition } from '@/types';

type BlocklyWorkspace = Blockly.WorkspaceSvg;
type BlocklyBlock = Blockly.BlockSvg;
type VarModel = Blockly.IVariableModel<Blockly.IVariableState>;
type VarMap = { [key: string]: VarModel };

// 設置積木樣式的輔助函數
function setBlockStyle(block: BlocklyBlock, styleName: string): void {
    if (block && block.setStyle) {
        block.setStyle(styleName);
    }
}

export function astToBlockly(ast: AST, workspace: BlocklyWorkspace): void {
    const name = ast.formula_name || ast.score_name || 'Result';

    // Create result variable
    let resultVar = workspace.getVariable(name);
    if (!resultVar) {
        resultVar = workspace.createVariable(name, 'Number');
    }
    const resultVarId = resultVar.getId();

    // Create input variables FIRST - store both name and model
    const varMap: VarMap = {};
    if (ast.variables) {
        for (const [varName, varType] of Object.entries(ast.variables)) {
            let varModel = workspace.getVariable(varName);
            if (!varModel) {
                varModel = workspace.createVariable(varName, varType === 'int' ? 'Number' : 'Boolean');
            }
            varMap[varName] = varModel;
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
        }
    }

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

function createFormulaBlocks(
    ast: AST,
    workspace: BlocklyWorkspace,
    resultVarId: string,
    varMap: VarMap
): void {
    const setBlock = workspace.newBlock('variables_set');
    setBlockStyle(setBlock, 'variable_blocks');
    setBlock.setFieldValue(resultVarId, 'VAR');

    const formulaBlock = parseFormula(ast.formula || '', workspace, varMap);

    if (formulaBlock) {
        const valueInput = setBlock.getInput('VALUE');
        if (valueInput && valueInput.connection && formulaBlock.outputConnection) {
            valueInput.connection.connect(formulaBlock.outputConnection);
        }
    }

    setBlock.initSvg();
    setBlock.moveBy(50, 50);
}

// Parse formula using varMap directly
function parseFormula(
    formula: string | null | undefined,
    workspace: BlocklyWorkspace,
    varMap: VarMap
): BlocklyBlock | null {
    // Handle undefined or null formula
    if (formula == null) return createNumber(workspace, 0);

    formula = String(formula).trim();

    if (!formula) return createNumber(workspace, 0);

    // Check for if...else conditional expression first
    // Pattern: "value1 if condition else value2"
    const ifElseMatch = formula.match(/^(.+?)\s+if\s+(.+?)\s+else\s+(.+)$/);
    if (ifElseMatch) {
        const thenValue = ifElseMatch[1].trim();
        const condition = ifElseMatch[2].trim();
        const elseValue = ifElseMatch[3].trim();

        // Create ternary block (if-then-else expression)
        const ternaryBlock = workspace.newBlock('logic_ternary');
        setBlockStyle(ternaryBlock, 'logic_blocks');

        // Parse condition (e.g., "is_female" or "age > 50")
        const conditionBlock = parseCondition(condition, workspace, varMap);
        if (conditionBlock) {
            conditionBlock.initSvg();
            const ifInput = ternaryBlock.getInput('IF');
            if (ifInput && ifInput.connection && conditionBlock.outputConnection) {
                ifInput.connection.connect(conditionBlock.outputConnection);
            }
        }

        // Parse then value
        const thenBlock = parseFormula(thenValue, workspace, varMap);
        if (thenBlock) {
            thenBlock.initSvg();
            const thenInput = ternaryBlock.getInput('THEN');
            if (thenInput && thenInput.connection && thenBlock.outputConnection) {
                thenInput.connection.connect(thenBlock.outputConnection);
            }
        }

        // Parse else value
        const elseBlock = parseFormula(elseValue, workspace, varMap);
        if (elseBlock) {
            elseBlock.initSvg();
            const elseInput = ternaryBlock.getInput('ELSE');
            if (elseInput && elseInput.connection && elseBlock.outputConnection) {
                elseInput.connection.connect(elseBlock.outputConnection);
            }
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
        setBlockStyle(opBlock, 'math_blocks');
        const opMap: { [key: string]: string } = { '+': 'ADD', '-': 'MINUS', '*': 'MULTIPLY', '/': 'DIVIDE', '**': 'POWER' };
        opBlock.setFieldValue(opMap[mainOp.op] || 'ADD', 'OP');

        const leftBlock = parseFormula(left, workspace, varMap);
        const rightBlock = parseFormula(right, workspace, varMap);

        if (leftBlock) {
            leftBlock.initSvg();
            const aInput = opBlock.getInput('A');
            if (aInput && aInput.connection && leftBlock.outputConnection) {
                aInput.connection.connect(leftBlock.outputConnection);
            }
        }
        if (rightBlock) {
            rightBlock.initSvg();
            const bInput = opBlock.getInput('B');
            if (bInput && bInput.connection && rightBlock.outputConnection) {
                bInput.connection.connect(rightBlock.outputConnection);
            }
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
        setBlockStyle(boolBlock, 'logic_blocks');
        boolBlock.setFieldValue(formula.toLowerCase() === 'true' ? 'TRUE' : 'FALSE', 'BOOL');
        boolBlock.initSvg();
        return boolBlock;
    }

    // Check if it's a variable using the varMap directly
    if (varMap[formula]) {
        const varModel = varMap[formula];
        const block = workspace.newBlock('variables_get');
        setBlockStyle(block, 'variable_blocks');
        block.setFieldValue(varModel.getId(), 'VAR');
        block.initSvg();
        return block;
    }

    return createNumber(workspace, 0);
}

// Parse condition for if...else (e.g., "is_female" or "age > 50")
function parseCondition(
    condition: string | null | undefined,
    workspace: BlocklyWorkspace,
    varMap: VarMap
): BlocklyBlock | null {
    // Handle undefined or null condition
    if (condition == null) {
        const trueBlock = workspace.newBlock('logic_boolean');
        setBlockStyle(trueBlock, 'logic_blocks');
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
        setBlockStyle(compareBlock, 'logic_blocks');
        const opMap: { [key: string]: string } = { '>=': 'GTE', '<=': 'LTE', '==': 'EQ', '>': 'GT', '<': 'LT' };
        compareBlock.setFieldValue(opMap[op] || 'EQ', 'OP');

        const leftBlock = parseFormula(left, workspace, varMap);
        if (leftBlock) {
            leftBlock.initSvg();
            const aInput = compareBlock.getInput('A');
            if (aInput && aInput.connection && leftBlock.outputConnection) {
                aInput.connection.connect(leftBlock.outputConnection);
            }
        }

        const rightBlock = parseFormula(right, workspace, varMap);
        if (rightBlock) {
            rightBlock.initSvg();
            const bInput = compareBlock.getInput('B');
            if (bInput && bInput.connection && rightBlock.outputConnection) {
                bInput.connection.connect(rightBlock.outputConnection);
            }
        }

        compareBlock.initSvg();
        return compareBlock;
    }

    // Simple variable (boolean)
    if (varMap[condition]) {
        const varModel = varMap[condition];
        const block = workspace.newBlock('variables_get');
        setBlockStyle(block, 'variable_blocks');
        block.setFieldValue(varModel.getId(), 'VAR');
        block.initSvg();
        return block;
    }

    // Fallback: true
    const trueBlock = workspace.newBlock('logic_boolean');
    setBlockStyle(trueBlock, 'logic_blocks');
    trueBlock.setFieldValue('TRUE', 'BOOL');
    trueBlock.initSvg();
    return trueBlock;
}

function isWrapped(formula: string): boolean {
    let depth = 0;
    for (let i = 0; i < formula.length; i++) {
        if (formula[i] === '(') depth++;
        else if (formula[i] === ')') depth--;
        if (depth === 0 && i < formula.length - 1) return false;
    }
    return true;
}

function findMainOperator(formula: string): { op: string; pos: number } | null {
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

function createNumber(workspace: BlocklyWorkspace, num: number): BlocklyBlock {
    const block = workspace.newBlock('math_number');
    setBlockStyle(block, 'math_blocks');
    block.setFieldValue(num, 'NUM');
    block.initSvg();
    return block;
}

// Create condition block for either simple or compound conditions
function createConditionBlock(
    condition: Condition | null | undefined,
    workspace: BlocklyWorkspace,
    varMap: VarMap,
    scoreVarId: string
): BlocklyBlock | null {
    if (!condition) return null;

    // Handle compound conditions (and/or)
    if (condition.compound) {
        const logicBlock = workspace.newBlock('logic_operation');
        setBlockStyle(logicBlock, 'logic_blocks');
        logicBlock.setFieldValue(condition.compound.toUpperCase(), 'OP'); // 'AND' or 'OR'

        const subConditions = condition.conditions || [];
        if (subConditions.length >= 1) {
            const leftBlock = createConditionBlock(subConditions[0], workspace, varMap, scoreVarId);
            if (leftBlock) {
                leftBlock.initSvg();
                const aInput = logicBlock.getInput('A');
                if (aInput && aInput.connection && leftBlock.outputConnection) {
                    aInput.connection.connect(leftBlock.outputConnection);
                }
            }
        }
        if (subConditions.length >= 2) {
            // For more than 2 conditions, we'd need to nest, but for now handle 2
            const rightBlock = createConditionBlock(subConditions[1], workspace, varMap, scoreVarId);
            if (rightBlock) {
                rightBlock.initSvg();
                const bInput = logicBlock.getInput('B');
                if (bInput && bInput.connection && rightBlock.outputConnection) {
                    bInput.connection.connect(rightBlock.outputConnection);
                }
            }
        }

        logicBlock.initSvg();
        return logicBlock;
    }

    // Simple condition (left op right)
    if (!condition.left || !condition.op || condition.left === 'unknown') return null;

    const condBlock = workspace.newBlock('logic_compare');
    setBlockStyle(condBlock, 'logic_blocks');
    const opMap: { [key: string]: string } = { '>=': 'GTE', '<=': 'LTE', '==': 'EQ', '>': 'GT', '<': 'LT' };
    condBlock.setFieldValue(opMap[condition.op] || 'EQ', 'OP');

    // Left side - variable
    const leftVarName = condition.left;
    let leftVarModel = varMap[leftVarName];
    if (!leftVarModel) {
        leftVarModel = workspace.createVariable(leftVarName, 'Number');
        varMap[leftVarName] = leftVarModel;
    }

    const leftBlock = workspace.newBlock('variables_get');
    setBlockStyle(leftBlock, 'variable_blocks');
    leftBlock.setFieldValue(leftVarModel.getId(), 'VAR');
    leftBlock.initSvg();
    const aInput = condBlock.getInput('A');
    if (aInput && aInput.connection && leftBlock.outputConnection) {
        aInput.connection.connect(leftBlock.outputConnection);
    }

    // Right side - value
    let rightBlock: BlocklyBlock;
    const rightVal = condition.right;
    if (typeof rightVal === 'number') {
        rightBlock = workspace.newBlock('math_number');
        setBlockStyle(rightBlock, 'math_blocks');
        rightBlock.setFieldValue(rightVal, 'NUM');
    } else if (typeof rightVal === 'boolean') {
        rightBlock = workspace.newBlock('logic_boolean');
        setBlockStyle(rightBlock, 'logic_blocks');
        rightBlock.setFieldValue(rightVal ? 'TRUE' : 'FALSE', 'BOOL');
    } else if (rightVal == null) {
        rightBlock = workspace.newBlock('math_number');
        setBlockStyle(rightBlock, 'math_blocks');
        rightBlock.setFieldValue(0, 'NUM');
    } else {
        const strVal = String(rightVal).toLowerCase();
        if (strVal === 'true' || strVal === 'false') {
            rightBlock = workspace.newBlock('logic_boolean');
            setBlockStyle(rightBlock, 'logic_blocks');
            rightBlock.setFieldValue(strVal === 'true' ? 'TRUE' : 'FALSE', 'BOOL');
        } else {
            rightBlock = workspace.newBlock('math_number');
            setBlockStyle(rightBlock, 'math_blocks');
            rightBlock.setFieldValue(parseFloat(rightVal) || 0, 'NUM');
        }
    }
    rightBlock.initSvg();
    const bInput = condBlock.getInput('B');
    if (bInput && bInput.connection && rightBlock.outputConnection) {
        bInput.connection.connect(rightBlock.outputConnection);
    }

    return condBlock;
}

function createScoreBlocks(
    ast: AST,
    workspace: BlocklyWorkspace,
    scoreVarId: string,
    varMap: VarMap
): void {
    const initBlock = workspace.newBlock('variables_set');
    setBlockStyle(initBlock, 'variable_blocks');
    initBlock.setFieldValue(scoreVarId, 'VAR');

    const zeroBlock = workspace.newBlock('math_number');
    setBlockStyle(zeroBlock, 'math_blocks');
    zeroBlock.setFieldValue(0, 'NUM');

    const valueInput = initBlock.getInput('VALUE');
    if (valueInput && valueInput.connection && zeroBlock.outputConnection) {
        valueInput.connection.connect(zeroBlock.outputConnection);
    }
    initBlock.initSvg();
    zeroBlock.initSvg();
    initBlock.moveBy(50, 50);

    let prevBlock: BlocklyBlock = initBlock;

    (ast.rules || []).forEach(rule => {
        // Skip rules without valid condition
        if (!rule || !rule.condition) return;

        const ifBlock = workspace.newBlock('controls_if');
        setBlockStyle(ifBlock, 'control_blocks');

        // Handle compound or simple conditions
        const condBlock = createConditionBlock(rule.condition, workspace, varMap, scoreVarId);
        if (!condBlock) return;

        condBlock.initSvg();
        const if0Input = ifBlock.getInput('IF0');
        if (if0Input && if0Input.connection && condBlock.outputConnection) {
            if0Input.connection.connect(condBlock.outputConnection);
        }

        const setScoreBlock = workspace.newBlock('variables_set');
        setBlockStyle(setScoreBlock, 'variable_blocks');
        setScoreBlock.setFieldValue(scoreVarId, 'VAR');

        const addBlock = workspace.newBlock('math_arithmetic');
        setBlockStyle(addBlock, 'math_blocks');
        addBlock.setFieldValue('ADD', 'OP');

        const currentScoreBlock = workspace.newBlock('variables_get');
        setBlockStyle(currentScoreBlock, 'variable_blocks');
        currentScoreBlock.setFieldValue(scoreVarId, 'VAR');
        currentScoreBlock.initSvg();

        const valBlock = workspace.newBlock('math_number');
        setBlockStyle(valBlock, 'math_blocks');
        valBlock.setFieldValue(rule.action.value, 'NUM');
        valBlock.initSvg();

        const addAInput = addBlock.getInput('A');
        if (addAInput && addAInput.connection && currentScoreBlock.outputConnection) {
            addAInput.connection.connect(currentScoreBlock.outputConnection);
        }
        const addBInput = addBlock.getInput('B');
        if (addBInput && addBInput.connection && valBlock.outputConnection) {
            addBInput.connection.connect(valBlock.outputConnection);
        }
        addBlock.initSvg();

        const setValueInput = setScoreBlock.getInput('VALUE');
        if (setValueInput && setValueInput.connection && addBlock.outputConnection) {
            setValueInput.connection.connect(addBlock.outputConnection);
        }
        setScoreBlock.initSvg();

        const do0Input = ifBlock.getInput('DO0');
        if (do0Input && do0Input.connection && setScoreBlock.previousConnection) {
            do0Input.connection.connect(setScoreBlock.previousConnection);
        }
        ifBlock.initSvg();

        if (prevBlock.nextConnection && ifBlock.previousConnection) {
            prevBlock.nextConnection.connect(ifBlock.previousConnection);
        }
        prevBlock = ifBlock;
    });
}

// New function: Creates formula blocks followed by scoring rules
function createFormulaWithScoreBlocks(
    ast: AST,
    workspace: BlocklyWorkspace,
    scoreVarId: string,
    varMap: VarMap
): void {
    let yOffset = 50;
    let prevBlock: BlocklyBlock | null = null;

    // Step 1: Create formula assignment blocks (e.g., set BMI = weight / height^2)
    for (const [formulaName, formulaExpr] of Object.entries(ast.formulas || {})) {
        // Skip empty or undefined formula expressions
        if (!formulaExpr) continue;

        const formulaVarModel = varMap[formulaName];
        if (!formulaVarModel) continue;

        const setBlock = workspace.newBlock('variables_set');
        setBlockStyle(setBlock, 'variable_blocks');
        setBlock.setFieldValue(formulaVarModel.getId(), 'VAR');

        const formulaBlock = parseFormula(formulaExpr, workspace, varMap);
        if (formulaBlock) {
            const valueInput = setBlock.getInput('VALUE');
            if (valueInput && valueInput.connection && formulaBlock.outputConnection) {
                valueInput.connection.connect(formulaBlock.outputConnection);
            }
        }

        setBlock.initSvg();
        setBlock.moveBy(50, yOffset);
        yOffset += 60;

        if (prevBlock && prevBlock.nextConnection && setBlock.previousConnection) {
            prevBlock.nextConnection.connect(setBlock.previousConnection);
        }
        prevBlock = setBlock;
    }

    // Step 2: Initialize score = 0
    const initBlock = workspace.newBlock('variables_set');
    setBlockStyle(initBlock, 'variable_blocks');
    initBlock.setFieldValue(scoreVarId, 'VAR');

    const zeroBlock = workspace.newBlock('math_number');
    setBlockStyle(zeroBlock, 'math_blocks');
    zeroBlock.setFieldValue(0, 'NUM');

    const initValueInput = initBlock.getInput('VALUE');
    if (initValueInput && initValueInput.connection && zeroBlock.outputConnection) {
        initValueInput.connection.connect(zeroBlock.outputConnection);
    }
    initBlock.initSvg();
    zeroBlock.initSvg();

    if (prevBlock && prevBlock.nextConnection && initBlock.previousConnection) {
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
        setBlockStyle(ifBlock, 'control_blocks');

        // Use createConditionBlock to handle both simple and compound conditions
        const condBlock = createConditionBlock(rule.condition, workspace, varMap, scoreVarId);
        if (!condBlock) return;

        condBlock.initSvg();
        const if0Input = ifBlock.getInput('IF0');
        if (if0Input && if0Input.connection && condBlock.outputConnection) {
            if0Input.connection.connect(condBlock.outputConnection);
        }

        // Action: score = score + value
        const setScoreBlock = workspace.newBlock('variables_set');
        setBlockStyle(setScoreBlock, 'variable_blocks');
        setScoreBlock.setFieldValue(scoreVarId, 'VAR');

        const addBlock = workspace.newBlock('math_arithmetic');
        setBlockStyle(addBlock, 'math_blocks');
        addBlock.setFieldValue('ADD', 'OP');

        const currentScoreBlock = workspace.newBlock('variables_get');
        setBlockStyle(currentScoreBlock, 'variable_blocks');
        currentScoreBlock.setFieldValue(scoreVarId, 'VAR');
        currentScoreBlock.initSvg();

        const valBlock = workspace.newBlock('math_number');
        setBlockStyle(valBlock, 'math_blocks');
        valBlock.setFieldValue(rule.action.value, 'NUM');
        valBlock.initSvg();

        const addAInput = addBlock.getInput('A');
        if (addAInput && addAInput.connection && currentScoreBlock.outputConnection) {
            addAInput.connection.connect(currentScoreBlock.outputConnection);
        }
        const addBInput = addBlock.getInput('B');
        if (addBInput && addBInput.connection && valBlock.outputConnection) {
            addBInput.connection.connect(valBlock.outputConnection);
        }
        addBlock.initSvg();

        const setValueInput = setScoreBlock.getInput('VALUE');
        if (setValueInput && setValueInput.connection && addBlock.outputConnection) {
            setValueInput.connection.connect(addBlock.outputConnection);
        }
        setScoreBlock.initSvg();

        const do0Input = ifBlock.getInput('DO0');
        if (do0Input && do0Input.connection && setScoreBlock.previousConnection) {
            do0Input.connection.connect(setScoreBlock.previousConnection);
        }
        ifBlock.initSvg();

        if (prevBlock && prevBlock.nextConnection && ifBlock.previousConnection) {
            prevBlock.nextConnection.connect(ifBlock.previousConnection);
        }
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
            { condition: { op: '>=', left: 'score', right: 3 } as Condition, text: '⚠️ High Risk' },
            { condition: { op: '==', left: 'score', right: 2 } as Condition, text: '⚡ Medium Risk' },
            { condition: { op: '<', left: 'score', right: 2 } as Condition, text: '✓ Low Risk' }
        ];

    // Generate blocks for each risk level
    riskLevels.forEach(riskLevel => {
        if (!riskLevel.condition || !riskLevel.text) return;

        const ifBlock = workspace.newBlock('controls_if');
        setBlockStyle(ifBlock, 'control_blocks');

        const condBlock = workspace.newBlock('logic_compare');
        setBlockStyle(condBlock, 'logic_blocks');
        const opMap: { [key: string]: string } = { '>=': 'GTE', '<=': 'LTE', '==': 'EQ', '>': 'GT', '<': 'LT' };
        condBlock.setFieldValue(opMap[riskLevel.condition.op] || 'EQ', 'OP');

        const scoreGetBlock = workspace.newBlock('variables_get');
        setBlockStyle(scoreGetBlock, 'variable_blocks');
        scoreGetBlock.setFieldValue(scoreVarId, 'VAR');
        scoreGetBlock.initSvg();
        const condAInput = condBlock.getInput('A');
        if (condAInput && condAInput.connection && scoreGetBlock.outputConnection) {
            condAInput.connection.connect(scoreGetBlock.outputConnection);
        }

        const numBlock = workspace.newBlock('math_number');
        setBlockStyle(numBlock, 'math_blocks');
        numBlock.setFieldValue(riskLevel.condition.right as number, 'NUM');
        numBlock.initSvg();
        const condBInput = condBlock.getInput('B');
        if (condBInput && condBInput.connection && numBlock.outputConnection) {
            condBInput.connection.connect(numBlock.outputConnection);
        }
        condBlock.initSvg();

        const if0Input = ifBlock.getInput('IF0');
        if (if0Input && if0Input.connection && condBlock.outputConnection) {
            if0Input.connection.connect(condBlock.outputConnection);
        }

        const setBlock = workspace.newBlock('variables_set');
        setBlockStyle(setBlock, 'variable_blocks');
        setBlock.setFieldValue(riskVarId, 'VAR');
        const textBlock = workspace.newBlock('text');
        setBlockStyle(textBlock, 'text_blocks');
        textBlock.setFieldValue(riskLevel.text, 'TEXT');
        textBlock.initSvg();
        const setValueInput = setBlock.getInput('VALUE');
        if (setValueInput && setValueInput.connection && textBlock.outputConnection) {
            setValueInput.connection.connect(textBlock.outputConnection);
        }
        setBlock.initSvg();

        const do0Input = ifBlock.getInput('DO0');
        if (do0Input && do0Input.connection && setBlock.previousConnection) {
            do0Input.connection.connect(setBlock.previousConnection);
        }
        ifBlock.initSvg();

        if (prevBlock && prevBlock.nextConnection && ifBlock.previousConnection) {
            prevBlock.nextConnection.connect(ifBlock.previousConnection);
        }
        prevBlock = ifBlock;
    });
}
