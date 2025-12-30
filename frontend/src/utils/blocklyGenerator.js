import * as Blockly from 'blockly';

export function astToBlockly(ast, workspace) {
    const scoreName = ast.score_name;

    // 1. Create Variables - MUST happen before any blocks that use them
    // Score variable
    let scoreVar = workspace.getVariable(scoreName);
    if (!scoreVar) {
        scoreVar = workspace.createVariable(scoreName, 'Number');
    }
    const scoreVarId = scoreVar.getId();

    // Rule variables - create them first!
    if (ast.variables) {
        for (const [varName, varType] of Object.entries(ast.variables)) {
            if (!workspace.getVariable(varName)) {
                workspace.createVariable(varName, varType === 'int' ? 'Number' : 'Boolean');
            }
        }
    }

    // 2. Create Initialization Block: score = 0
    const initBlock = workspace.newBlock('variables_set');
    initBlock.setFieldValue(scoreVarId, 'VAR');

    const zeroBlock = workspace.newBlock('math_number');
    zeroBlock.setFieldValue(0, 'NUM');

    initBlock.getInput('VALUE').connection.connect(zeroBlock.outputConnection);

    initBlock.initSvg();
    zeroBlock.initSvg();
    initBlock.moveBy(50, 50);

    let prevBlock = initBlock;

    // 3. Process Rules
    ast.rules.forEach(rule => {
        // Create IF block
        const ifBlock = workspace.newBlock('controls_if');

        // Create Condition Comparator
        const condBlock = workspace.newBlock('logic_compare');
        const opMap = { '>=': 'GTE', '<=': 'LTE', '==': 'EQ', '>': 'GT', '<': 'LT' };
        const opFieldValue = opMap[rule.condition.op] || 'EQ';
        condBlock.setFieldValue(opFieldValue, 'OP');

        // Left Operand (Variable) - use variable name from AST
        const leftVarName = rule.condition.left;
        let leftVarModel = workspace.getVariable(leftVarName);

        // If variable doesn't exist, create it
        if (!leftVarModel) {
            leftVarModel = workspace.createVariable(leftVarName, 'Number');
        }

        const leftBlock = workspace.newBlock('variables_get');
        leftBlock.setFieldValue(leftVarModel.getId(), 'VAR');
        leftBlock.initSvg();
        condBlock.getInput('A').connection.connect(leftBlock.outputConnection);

        // Right Operand (Value)
        let rightBlock;
        if (typeof rule.condition.right === 'number') {
            rightBlock = workspace.newBlock('math_number');
            rightBlock.setFieldValue(rule.condition.right, 'NUM');
        } else if (typeof rule.condition.right === 'boolean') {
            rightBlock = workspace.newBlock('logic_boolean');
            rightBlock.setFieldValue(rule.condition.right ? 'TRUE' : 'FALSE', 'BOOL');
        } else {
            // String - might be "true" or "false"
            if (String(rule.condition.right).toLowerCase() === 'true') {
                rightBlock = workspace.newBlock('logic_boolean');
                rightBlock.setFieldValue('TRUE', 'BOOL');
            } else if (String(rule.condition.right).toLowerCase() === 'false') {
                rightBlock = workspace.newBlock('logic_boolean');
                rightBlock.setFieldValue('FALSE', 'BOOL');
            } else {
                rightBlock = workspace.newBlock('math_number');
                rightBlock.setFieldValue(0, 'NUM');
            }
        }
        rightBlock.initSvg();
        condBlock.getInput('B').connection.connect(rightBlock.outputConnection);
        condBlock.initSvg();

        // Connect Condition to IF
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

        // Link to previous block
        prevBlock.nextConnection.connect(ifBlock.previousConnection);
        prevBlock = ifBlock;
    });

    workspace.render();
}
