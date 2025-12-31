import React, { useState, useRef } from 'react';
import BlocklyComponent from './components/BlocklyComponent';
import { astToBlockly } from './utils/blocklyGenerator';
import './App.css';

const DEFAULT_DOC = `score_name: HEARTScore
variables:
  history_score: int
  ecg_score: int
  age: int
  risk_factor_count: int
  troponin_level: int
formulas:
  age_factor: (age - 45) / 20
rules:
  - if: history_score >= 2
    add: 2
  - if: history_score >= 1
    add: 1
  - if: ecg_score >= 2
    add: 2
  - if: ecg_score >= 1
    add: 1
  - if: age_factor >= 1
    add: 2
  - if: age_factor >= 0.5
    add: 1
  - if: risk_factor_count >= 3
    add: 2
  - if: risk_factor_count >= 1
    add: 1
  - if: troponin_level >= 2
    add: 2
  - if: troponin_level >= 1
    add: 1
risk_levels:
  - if: score >= 7
    text: ⚠️ 高危 - 需緊急介入 (50-65% MACE)
  - if: score >= 4
    text: ⚡ 中危 - 住院觀察 (12-16% MACE)
  - if: score < 4
    text: ✓ 低危 - 可考慮出院 (0.9-1.7% MACE)`;

// Sample Patient Data for Demo
const SAMPLE_PATIENTS = [
  { id: 'p1', name: 'John Smith', age: 72, has_disease: true, weight: 80, height: 1.75, cholesterol: 220 },
  { id: 'p2', name: 'Mary Johnson', age: 45, has_disease: false, weight: 65, height: 1.65, cholesterol: 180 },
  { id: 'p3', name: 'Robert Lee', age: 68, has_disease: true, weight: 95, height: 1.80, cholesterol: 250 },
  { id: 'p4', name: 'Emily Chen', age: 55, has_disease: false, weight: 55, height: 1.60, cholesterol: 160 },
  { id: 'p5', name: 'James Wilson', age: 80, has_disease: true, weight: 75, height: 1.70, cholesterol: 190 },
];

function App() {
  const [docText, setDocText] = useState(DEFAULT_DOC);
  const [ast, setAst] = useState(null);
  const [score, setScore] = useState(null);
  const [computed, setComputed] = useState({});  // Store computed formula values like BMI
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({});
  const [selectedPatient, setSelectedPatient] = useState(null);
  const workspaceRef = useRef(null);

  // Left panel tab state: 'editor' or 'chat'
  const [leftTab, setLeftTab] = useState('editor');

  // Chat state
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Describe the formula or scoring rule you want. Examples:\n• "Calculate BMI from weight and height"\n• "Create diabetes risk score based on age and blood sugar"' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [generatedRules, setGeneratedRules] = useState(null);

  const variables = ast ? Object.keys(ast.variables || {}) : [];

  const updateInput = (key, value) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const loadPatient = (patientId) => {
    const patient = SAMPLE_PATIENTS.find(p => p.id === patientId);
    if (patient) {
      setSelectedPatient(patient);
      const newInputs = {};
      variables.forEach(v => {
        if (patient[v] !== undefined) {
          newInputs[v] = patient[v];
        }
      });
      setInputs(prev => ({ ...prev, ...newInputs }));
    }
  };

  const loadExample = (type) => {
    setScore(null);
    setComputed({});
    if (type === 'score') {
      setDocText(`score_name: RiskScore
variables:
  age: int
  has_disease: boolean
rules:
  - if: age >= 65
    add: 1
  - if: has_disease == true
    add: 2`);
    } else if (type === 'formula') {
      setDocText(`formula_name: BMI_Calculator
variables:
  weight: int
  height: int
formula: weight / (height * height)`);
    } else if (type === 'combined') {
      // HEART Score with custom risk levels
      setDocText(`score_name: HEARTScore
variables:
  history_score: int
  ecg_score: int
  age: int
  risk_factor_count: int
  troponin_level: int
formulas:
  age_factor: (age - 45) / 20
rules:
  - if: history_score >= 2
    add: 2
  - if: history_score >= 1
    add: 1
  - if: ecg_score >= 2
    add: 2
  - if: ecg_score >= 1
    add: 1
  - if: age_factor >= 1
    add: 2
  - if: age_factor >= 0.5
    add: 1
  - if: risk_factor_count >= 3
    add: 2
  - if: risk_factor_count >= 1
    add: 1
  - if: troponin_level >= 2
    add: 2
  - if: troponin_level >= 1
    add: 1
risk_levels:
  - if: score >= 7
    text: ⚠️ 高危 - 需緊急介入 (50-65% MACE)
  - if: score >= 4
    text: ⚡ 中危 - 住院觀察 (12-16% MACE)
  - if: score < 4
    text: ✓ 低危 - 可考慮出院 (0.9-1.7% MACE)`);
    }
  };

  const handleParse = async () => {
    setError('');
    setLoading(true);
    setScore(null);
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

      const newInputs = {};
      Object.entries(data.variables || {}).forEach(([varName, varType]) => {
        if (selectedPatient && selectedPatient[varName] !== undefined) {
          newInputs[varName] = selectedPatient[varName];
        } else {
          // Handle different variable types with null check
          const type = (varType || 'int').toLowerCase();
          if (type === 'boolean' || type === 'bool') {
            newInputs[varName] = false;
          } else {
            newInputs[varName] = 0;
          }
        }
      });
      setInputs(newInputs);

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
    setError('');
    try {
      const response = await fetch('http://localhost:5000/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ast: ast, inputs: inputs })
      });
      const data = await response.json();

      // Check for error first
      if (data.error) {
        setError(data.error);
        return;
      }

      // Store computed formula values (like BMI)
      if (data.computed) {
        setComputed(data.computed);
      } else {
        setComputed({});
      }

      if (data.result !== undefined) {
        setScore(data.result);
      } else if (data.score !== undefined) {
        setScore(data.score);
      } else {
        setError('Calculation error: unexpected response format');
        console.log('Response data:', data);
      }
    } catch (e) {
      setError('Calculation failed: ' + e.message);
    }
  };

  const onWorkspaceInit = (workspace) => {
    workspaceRef.current = workspace;
  };

  // Chat functions
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const response = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });
      const data = await response.json();

      if (data.error) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }]);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply,
          hasRules: true
        }]);
        setGeneratedRules(data.generated_rules);
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Connection error: ${e.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const useGeneratedRules = () => {
    if (generatedRules) {
      setDocText(generatedRules);
      setLeftTab('editor');
      setGeneratedRules(null);
    }
  };

  return (
    <div className="app-wrapper">
      {/* Blockly as Full Background */}
      <div className="blockly-background">
        <BlocklyComponent onWorkspaceChange={onWorkspaceInit} />
      </div>

      {/* Floating Header */}
      <header className="floating-header">
        <h1>Medical Rule Builder</h1>
        <span className="version">PoC v0.5</span>
      </header>

      {/* Left Panel with Tabs */}
      <div className="floating-panel left-panel">
        {/* Tab Switcher */}
        <div className="tab-switcher">
          <button
            className={`tab-btn ${leftTab === 'editor' ? 'active' : ''}`}
            onClick={() => setLeftTab('editor')}
          >
            Editor
          </button>
          <button
            className={`tab-btn ${leftTab === 'chat' ? 'active' : ''}`}
            onClick={() => setLeftTab('chat')}
          >
            AI Chat
          </button>
        </div>

        {/* Editor Tab */}
        {leftTab === 'editor' && (
          <>


            <textarea
              className="code-editor"
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              placeholder="Enter rules or formula..."
              spellCheck="false"
            />

            <button
              className="btn-primary"
              onClick={handleParse}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Generate Blocks'}
            </button>

            {error && <div className="error-msg">{error}</div>}
          </>
        )}

        {/* Chat Tab */}
        {leftTab === 'chat' && (
          <div className="chat-container">
            {/* Quick Prompts */}
            {chatMessages.length <= 1 && !generatedRules && (
              <div className="quick-prompts">
                <div className="prompts-label">Try:</div>
                <button onClick={() => { setChatInput('Calculate BMI'); }}>BMI</button>
                <button onClick={() => { setChatInput('Diabetes risk score'); }}>Diabetes</button>
                <button onClick={() => { setChatInput('Heart disease risk'); }}>Heart</button>
              </div>
            )}

            {/* Messages */}
            <div className="chat-messages">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`chat-msg ${msg.role}`}>
                  <div className="msg-bubble">
                    <div className="msg-content">{msg.content}</div>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="chat-msg assistant">
                  <div className="msg-bubble">
                    <div className="msg-content typing">
                      <span className="dot"></span>
                      <span className="dot"></span>
                      <span className="dot"></span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Generated Code Preview */}
            {generatedRules && (
              <div className="generated-code-box">
                <div className="code-header">
                  <span>Generated Formula</span>
                  <span className="code-tag">Ready to use</span>
                </div>
                <pre>{generatedRules}</pre>
                <button className="btn-use" onClick={useGeneratedRules}>
                  Load into Editor
                </button>
              </div>
            )}

            {/* Input Area */}
            <div className="chat-input-area">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Describe your formula or scoring rule..."
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
              />
              <button onClick={sendChatMessage} disabled={chatLoading}>
                <span>Send</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: Patient & Variables */}
      <div className="floating-panel right-panel">
        <div className="panel-title">PATIENT DATA</div>
        <select
          className="patient-select"
          value={selectedPatient?.id || ''}
          onChange={(e) => loadPatient(e.target.value)}
        >
          <option value="">-- Select Patient --</option>
          {SAMPLE_PATIENTS.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {selectedPatient && (
          <div className="patient-info">
            <div className="patient-name">{selectedPatient.name}</div>
            <div className="patient-details">
              Age: {selectedPatient.age} | Weight: {selectedPatient.weight}kg
            </div>
          </div>
        )}

        <div className="divider"></div>

        <div className="panel-title">VARIABLES</div>
        <div className="variables-list">
          {variables.length === 0 ? (
            <div className="empty-state">Parse rules to see variables</div>
          ) : (
            variables.map(v => (
              <div key={v} className="var-row">
                <label>{v}</label>
                <input
                  type={ast.variables[v] === 'int' ? 'number' : 'text'}
                  value={inputs[v] !== undefined ? String(inputs[v]) : ''}
                  onChange={(e) => {
                    const val = ast.variables[v] === 'int'
                      ? Number(e.target.value)
                      : e.target.value === 'true';
                    updateInput(v, val);
                  }}
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
          Calculate
        </button>

        {score !== null && (
          <div className="score-card">
            {/* Show computed formula values first */}
            {Object.keys(computed).length > 0 && (
              <div className="computed-values">
                <div className="computed-label">Computed Values</div>
                {Object.entries(computed).map(([name, value]) => (
                  <div key={name} className="computed-row">
                    <span className="computed-name">{name}</span>
                    <span className="computed-value">{typeof value === 'number' ? value.toFixed(2) : value}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="score-label">{ast?.formula ? 'Result' : 'Final Score'}</div>
            <div className="score-value">{typeof score === 'number' ? score.toFixed(2) : score}</div>

            {/* Score interpretation */}
            {!ast?.formula && (
              <div className={`score-meaning ${score >= 3 ? 'high' : score >= 2 ? 'medium' : 'low'}`}>
                {score >= 3 ? '⚠️ High Risk' : score >= 2 ? '⚡ Medium Risk' : '✓ Low Risk'}
              </div>
            )}

            {selectedPatient && <div className="patient-tag">for {selectedPatient.name}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
