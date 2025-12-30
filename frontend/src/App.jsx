import React, { useState, useRef } from 'react';
import BlocklyComponent from './components/BlocklyComponent';
import { astToBlockly } from './utils/blocklyGenerator';
import './App.css';

const DEFAULT_DOC = `score_name: SampleScore
variables:
  age: int
  has_disease: boolean
rules:
  - if: age >= 65
    add: 1
  - if: has_disease == true
    add: 2`;

function App() {
  const [docText, setDocText] = useState(DEFAULT_DOC);
  const [ast, setAst] = useState(null);
  const [score, setScore] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({ age: 70, has_disease: true });
  const workspaceRef = useRef(null);

  const variables = ast ? Object.keys(ast.variables || {}) : [];

  const updateInput = (key, value) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const loadExample = (type) => {
    if (type === 'simple') {
      setDocText(`score_name: SimpleScore
variables:
  age: int
  has_disease: boolean
rules:
  - if: age >= 65
    add: 1
  - if: has_disease == true
    add: 2`);
    } else if (type === 'natural') {
      setDocText(`score_name: HeartHealth
variables:
  cholesterol: int
  smoker: boolean
rules:
  - If cholesterol > 200, add 2 points.
  - If smoker is true, add 3 points.`);
    }
  };

  const handleParse = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: docText })
      });
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setAst(data);
      if (workspaceRef.current) {
        workspaceRef.current.clear();
        astToBlockly(data, workspaceRef.current);
      }
    } catch (e) {
      setError('Failed to connect to backend: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    if (!ast) return;
    try {
      const response = await fetch('http://localhost:5000/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ast: ast, inputs: inputs })
      });
      const data = await response.json();
      if (data.score !== undefined) {
        setScore(data.score);
      } else {
        setError('Calculation error');
      }
    } catch (e) {
      setError('Calculation failed: ' + e.message);
    }
  };

  const onWorkspaceInit = (workspace) => {
    workspaceRef.current = workspace;
  };

  return (
    <div className="app-wrapper">
      {/* Blockly as Full Background */}
      <div className="blockly-background">
        <BlocklyComponent onWorkspaceChange={onWorkspaceInit} />
      </div>

      {/* Floating Header */}
      <header className="floating-header">
        <h1>🏥 Medical Rule Builder</h1>
        <span className="version">PoC v0.2</span>
      </header>

      {/* Floating Left Panel: Editor */}
      <div className="floating-panel left-panel">
        <div className="panel-title">📝 Rules Editor</div>

        <div className="quick-actions">
          <button className="btn-sm" onClick={() => loadExample('simple')}>📋 Template</button>
          <button className="btn-sm" onClick={() => loadExample('natural')}>💬 Natural</button>
        </div>

        <textarea
          className="code-editor"
          value={docText}
          onChange={(e) => setDocText(e.target.value)}
          placeholder="Enter your medical rules..."
          spellCheck="false"
        />

        <button
          className="btn-primary"
          onClick={handleParse}
          disabled={loading}
        >
          {loading ? '⏳ Processing...' : '🚀 Generate Blocks'}
        </button>

        {error && <div className="error-msg">⚠️ {error}</div>}
      </div>

      {/* Floating Right Panel: Watch & Score */}
      <div className="floating-panel right-panel">
        <div className="panel-title">👁️ Variable Watch</div>

        <div className="variables-list">
          {variables.length === 0 ? (
            <div className="empty-state">No variables yet</div>
          ) : (
            variables.map(v => (
              <div key={v} className="var-row">
                <label>{v}</label>
                <input
                  type={ast.variables[v] === 'int' ? 'number' : 'text'}
                  value={inputs[v] !== undefined ? inputs[v] : ''}
                  onChange={(e) => updateInput(v, e.target.type === 'number' ? Number(e.target.value) : e.target.value === 'true')}
                />
              </div>
            ))
          )}
        </div>

        <button
          className="btn-success"
          onClick={handleCalculate}
          disabled={!ast}
        >
          🧮 Calculate
        </button>

        {score !== null && (
          <div className="score-card">
            <div className="score-label">Score</div>
            <div className="score-value">{score}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
