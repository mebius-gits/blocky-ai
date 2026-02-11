import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import type * as Blockly from 'blockly';
import { Panel, Group, Separator, type PanelImperativeHandle } from 'react-resizable-panels';

import Header from '@/components/Header';
import LeftPanel from '@/components/LeftPanel';
import PatientPanel from '@/components/PatientPanel';
import ResultPanel from '@/components/ResultPanel';
import WelcomeModal from '@/components/WelcomeModal';
import type { AST, Patient, InputValues, ComputedValues, ParseResponse, CalculateResponse, ChatMessage, SavedFormula, AppMode } from '@/types';
import { astToBlockly } from '@/utils/blocklyGenerator';
import { getFormulaList } from '@/utils/formulaStorage';
import styles from '@/styles/Home.module.scss';

const VALID_AST_TYPES = ['formula', 'score', 'score_with_formula'] as const;
type ASTType = typeof VALID_AST_TYPES[number];

function normalizeAstType(data: ParseResponse): ASTType | undefined {
    const t = data.type;
    if (t && VALID_AST_TYPES.includes(t as ASTType)) return t as ASTType;
    if (data.formulas && data.rules?.length) return 'score_with_formula';
    if (data.formula && !data.rules?.length) return 'formula';
    if (data.rules?.length) return 'score';
    if (data.formulas) return 'score_with_formula';
    if (data.formula) return 'formula';
    return undefined;
}

function getApiErrorMessage(data: { error?: string; detail?: string | Array<{ msg?: string }> }): string | undefined {
    if (data.error) return data.error;
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map((d) => d?.msg ?? String(d)).join('; ');
    return undefined;
}

const BlocklyComponent = dynamic(
    () => import('@/components/BlocklyComponent'),
    { ssr: false }
);

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

// 防抖工具函數
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout | null = null;
    return ((...args: any[]) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    }) as T;
}

export default function Home() {
    const [showWelcome, setShowWelcome] = useState(true);
    const [appMode, setAppMode] = useState<AppMode>('home');
    const [docText, setDocText] = useState(DEFAULT_DOC);
    const [ast, setAst] = useState<AST | null>(null);
    const [score, setScore] = useState<number | null>(null);
    const [computed, setComputed] = useState<ComputedValues>({});
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [calcLoading, setCalcLoading] = useState(false);
    const [inputs, setInputs] = useState<InputValues>({});
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);

    const [patientCollapsed, setPatientCollapsed] = useState(false);
    const [resultCollapsed, setResultCollapsed] = useState(false);
    const patientPanelRef = useRef<PanelImperativeHandle>(null);
    const resultPanelRef = useRef<PanelImperativeHandle>(null);
    
    // 防抖引用
    const debouncedSetPatientCollapsed = useRef<(collapsed: boolean) => void>();
    const debouncedSetResultCollapsed = useRef<(collapsed: boolean) => void>();
    
    const [leftPanelOpen, setLeftPanelOpen] = useState(false);
    const [rightPanelOpen, setRightPanelOpen] = useState(false);

    const [initialChatHistory, setInitialChatHistory] = useState<ChatMessage[] | undefined>(undefined);
    const [initialGeneratedRules, setInitialGeneratedRules] = useState<string | null>(null);

    const [formulaList, setFormulaList] = useState<SavedFormula[]>([]);
    const [selectedFormula, setSelectedFormula] = useState<SavedFormula | null>(null);
    const [useFormulaParseLoading, setUseFormulaParseLoading] = useState(false);
    const [useFormulaParseError, setUseFormulaParseError] = useState('');

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
    
    // 初始化防抖函數
    useEffect(() => {
        debouncedSetPatientCollapsed.current = debounce((collapsed: boolean) => {
            setPatientCollapsed(collapsed);
        }, 100);
        debouncedSetResultCollapsed.current = debounce((collapsed: boolean) => {
            setResultCollapsed(collapsed);
        }, 100);
    }, []);

    // 檢查訪問狀態
    useEffect(() => {
        const hasVisited = localStorage.getItem('mrb-visited');
        if (hasVisited) {
            setShowWelcome(false);
        }
    }, []);

    // 使用公式模式：載入公式列表
    useEffect(() => {
        if (appMode === 'use') {
            setFormulaList(getFormulaList());
        }
    }, [appMode]);

    // 使用公式模式：選中公式後解析 DSL
    useEffect(() => {
        if (appMode !== 'use' || !selectedFormula) {
            return;
        }
        let cancelled = false;
        setUseFormulaParseError('');
        setUseFormulaParseLoading(true);
        setError('');
        setScore(null);
        setComputed({});
        fetch(`${API_BASE_URL}/parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: selectedFormula.dslText })
        })
            .then((res) => res.json())
            .then((data: ParseResponse) => {
                if (cancelled) return;
                const parseErr = getApiErrorMessage(data);
                if (parseErr) {
                    setUseFormulaParseError(parseErr);
                    setAst(null);
                    setInputs({});
                    return;
                }
                const newAst: AST = {
                    formula_name: data.formula_name,
                    score_name: data.score_name,
                    variables: data.variables || {},
                    formula: data.formula,
                    formulas: data.formulas,
                    rules: data.rules,
                    risk_levels: data.risk_levels,
                    type: normalizeAstType(data)
                };
                setAst(newAst);
                const newInputs: InputValues = {};
                Object.entries(newAst.variables || {}).forEach(([varName, varType]) => {
                    const type = (varType || 'int').toLowerCase();
                    if (type === 'boolean' || type === 'bool') {
                        newInputs[varName] = false;
                    } else {
                        newInputs[varName] = 0;
                    }
                });
                setInputs(newInputs);
            })
            .catch((e: Error) => {
                if (!cancelled) {
                    setUseFormulaParseError('無法連接後端: ' + e.message);
                    setAst(null);
                }
            })
            .finally(() => {
                if (!cancelled) setUseFormulaParseLoading(false);
            });
        return () => { cancelled = true; };
    }, [appMode, selectedFormula, API_BASE_URL]);

    const handleCloseWelcome = (chatHistory: ChatMessage[], generatedRules: string | null) => {
        setShowWelcome(false);
        localStorage.setItem('mrb-visited', 'true');
        
        if (chatHistory && chatHistory.length > 1) {
            setInitialChatHistory(chatHistory);
        }
        if (generatedRules) {
            setInitialGeneratedRules(generatedRules);
        }
    };

    const handleUseGeneratedRules = (rules: string, chatHistory: ChatMessage[]) => {
        setDocText(rules);
        setShowWelcome(false);
        localStorage.setItem('mrb-visited', 'true');
        
        if (chatHistory && chatHistory.length > 0) {
            setInitialChatHistory(chatHistory);
        }
    };

    const handleParse = async () => {
        setError('');
        setLoading(true);
        setScore(null);
        try {
            const response = await fetch(`${API_BASE_URL}/parse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: docText })
            });
            const data: ParseResponse = await response.json();

            const parseErrMsg = getApiErrorMessage(data);
            if (parseErrMsg) {
                setError(parseErrMsg);
                return;
            }

            const newAst: AST = {
                formula_name: data.formula_name,
                score_name: data.score_name,
                variables: data.variables || {},
                formula: data.formula,
                formulas: data.formulas,
                rules: data.rules,
                risk_levels: data.risk_levels,
                type: normalizeAstType(data)
            };
            setAst(newAst);

            const newInputs: InputValues = {};
            Object.entries(newAst.variables || {}).forEach(([varName, varType]) => {
                if (selectedPatient && selectedPatient[varName] !== undefined) {
                    newInputs[varName] = selectedPatient[varName] as number | boolean | string;
                } else {
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
                astToBlockly(newAst, workspaceRef.current);
            }
        } catch (e) {
            const err = e as Error;
            setError('無法連接後端: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCalculate = async () => {
        if (!ast) return;
        setError('');
        setCalcLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/calculate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ast: ast, inputs: inputs })
            });
            const data: CalculateResponse = await response.json();

            const errMsg = getApiErrorMessage(data);
            if (errMsg) {
                setError(errMsg);
                setScore(null);
                setComputed({});
                return;
            }

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
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('Calculate API 未回傳 result/score:', data);
                }
                setError('計算錯誤: 未預期的回應格式（後端未回傳 result 或 score）');
                setScore(null);
                setComputed({});
            }
        } catch (e) {
            const err = e as Error;
            setError('計算失敗: ' + err.message);
            setScore(null);
            setComputed({});
        } finally {
            setCalcLoading(false);
        }
    };

    const onWorkspaceInit = useCallback((workspace: Blockly.WorkspaceSvg) => {
        workspaceRef.current = workspace;
    }, []);

    const togglePatientPanel = () => {
        if (patientPanelRef.current) {
            if (patientPanelRef.current.isCollapsed()) {
                patientPanelRef.current.expand();
                setPatientCollapsed(false);
            } else {
                patientPanelRef.current.collapse();
                setPatientCollapsed(true);
            }
        }
    };

    const toggleResultPanel = () => {
        if (resultPanelRef.current) {
            if (resultPanelRef.current.isCollapsed()) {
                resultPanelRef.current.expand();
                setResultCollapsed(false);
            } else {
                resultPanelRef.current.collapse();
                setResultCollapsed(true);
            }
        }
    };

    const handlePatientResize = (size: { asPercentage: number }) => {
        if (debouncedSetPatientCollapsed.current) {
            debouncedSetPatientCollapsed.current(size.asPercentage < 5);
        }
    };

    const handleResultResize = (size: { asPercentage: number }) => {
        if (debouncedSetResultCollapsed.current) {
            debouncedSetResultCollapsed.current(size.asPercentage < 5);
        }
    };

    return (
        <>
            <Head>
                <title>醫療計算機</title>
                <meta name="description" content="Medical Rule Builder - PoC v0.5" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>

            {showWelcome && (
                <WelcomeModal
                    onClose={handleCloseWelcome}
                    onUseGeneratedRules={handleUseGeneratedRules}
                />
            )}

            <div className={styles.appWrapper}>
                <Header
                    onBackToHome={appMode !== 'home' ? () => setAppMode('home') : undefined}
                />

                {!showWelcome && appMode === 'home' && (
                    <div className={styles.homeView}>
                        <div className={styles.homeCards}>
                            <button
                                type="button"
                                className={styles.homeCard}
                                onClick={() => setAppMode('use')}
                            >
                                <span className={styles.homeCardIcon}>📋</span>
                                <span className={styles.homeCardTitle}>使用公式</span>
                                <span className={styles.homeCardDesc}>從公式列表選擇公式，選擇病人後計算結果</span>
                            </button>
                            <button
                                type="button"
                                className={styles.homeCard}
                                onClick={() => setAppMode('build')}
                            >
                                <span className={styles.homeCardIcon}>🔧</span>
                                <span className={styles.homeCardTitle}>建構公式</span>
                                <span className={styles.homeCardDesc}>以 AI 或 DSL 編輯器建立、儲存並管理公式</span>
                            </button>
                        </div>
                    </div>
                )}

                {!showWelcome && appMode === 'use' && (
                    <div className={styles.useFormulaView}>
                        <div className={styles.useFormulaCard}>
                            <h2 className={styles.useFormulaHeading}>使用公式</h2>
                            <div className={styles.formulaSelectRow}>
                                <label className={styles.useFormulaLabel}>選擇公式</label>
                                <select
                                    className={styles.formulaSelect}
                                    value={selectedFormula?.id ?? ''}
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        setSelectedFormula(formulaList.find((f) => f.id === id) ?? null);
                                    }}
                                >
                                    <option value="">-- 請選擇公式 --</option>
                                    {formulaList.map((f) => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                            {formulaList.length === 0 && (
                                <p className={styles.useFormulaHint}>請先到「建構公式」建立並儲存公式</p>
                            )}
                            {useFormulaParseError && (
                                <div className={styles.useFormulaError}>{useFormulaParseError}</div>
                            )}
                            {useFormulaParseLoading && (
                                <div className={styles.useFormulaLoading}>解析公式中...</div>
                            )}
                            {ast && !useFormulaParseLoading && (
                                <>
                                    {error && (
                                        <div className={styles.calcErrorBanner} role="alert">
                                            {error}
                                        </div>
                                    )}
                                    <div className={styles.useFormulaPatient}>
                                        <PatientPanel
                                            ast={ast}
                                            inputs={inputs}
                                            setInputs={setInputs}
                                            selectedPatient={selectedPatient}
                                            setSelectedPatient={setSelectedPatient}
                                            onCalculate={handleCalculate}
                                            loading={calcLoading}
                                            collapsed={false}
                                            onToggleCollapse={() => {}}
                                        />
                                    </div>
                                    <div className={styles.useFormulaResult}>
                                        <ResultPanel
                                            score={score}
                                            computed={computed}
                                            ast={ast}
                                            selectedPatient={selectedPatient}
                                            collapsed={false}
                                            onToggleCollapse={() => {}}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {!showWelcome && appMode === 'build' && (
                    <>
                        <div className={styles.buildGrid}>
                            <div className={`${styles.leftPanelWrapper} ${leftPanelOpen ? styles.open : ''}`}>
                                <LeftPanel
                                    docText={docText}
                                    setDocText={setDocText}
                                    onParse={handleParse}
                                    loading={loading}
                                    error={error}
                                    initialChatHistory={initialChatHistory}
                                    initialGeneratedRules={initialGeneratedRules}
                                    embedInGrid
                                />
                            </div>

                            <div className={styles.blocklyViewport}>
                                <div className={styles.blocklyHeader}>LOGIC VISUALIZATION</div>
                                <div className={styles.blocklyCanvas}>
                                    <BlocklyComponent onWorkspaceChange={onWorkspaceInit} />
                                </div>
                            </div>

                            <div className={`${styles.rightPanels} ${rightPanelOpen ? styles.open : ''}`}>
                                {error && (
                                    <div className={styles.calcErrorBanner} role="alert">
                                        {error}
                                    </div>
                                )}
                                <Group orientation="vertical" className={styles.panelGroup}>
                                    <Panel 
                                        defaultSize={55} 
                                        minSize={15} 
                                        collapsible={true} 
                                        collapsedSize={50}
                                        panelRef={patientPanelRef}
                                        onResize={handlePatientResize}
                                    >
                                        <PatientPanel
                                            ast={ast}
                                            inputs={inputs}
                                            setInputs={setInputs}
                                            selectedPatient={selectedPatient}
                                            setSelectedPatient={setSelectedPatient}
                                            onCalculate={handleCalculate}
                                            loading={calcLoading}
                                            collapsed={patientCollapsed}
                                            onToggleCollapse={togglePatientPanel}
                                        />
                                    </Panel>
                                    <Separator className={styles.resizeHandle}>
                                        <div className={styles.resizeHandleInner}>
                                            <span className={styles.resizeDots}>⋮⋮</span>
                                        </div>
                                    </Separator>
                                    <Panel 
                                        defaultSize={45} 
                                        minSize={15} 
                                        collapsible={true} 
                                        collapsedSize={50}
                                        panelRef={resultPanelRef}
                                        onResize={handleResultResize}
                                    >
                                        <ResultPanel
                                            score={score}
                                            computed={computed}
                                            ast={ast}
                                            selectedPatient={selectedPatient}
                                            collapsed={resultCollapsed}
                                            onToggleCollapse={toggleResultPanel}
                                        />
                                    </Panel>
                                </Group>
                            </div>
                        </div>

                        {(leftPanelOpen || rightPanelOpen) && (
                            <div 
                                className={styles.mobileOverlay}
                                onClick={() => {
                                    setLeftPanelOpen(false);
                                    setRightPanelOpen(false);
                                }}
                            />
                        )}

                        <button 
                            className={styles.mobileToggleLeft}
                            onClick={() => {
                                setLeftPanelOpen(!leftPanelOpen);
                                setRightPanelOpen(false);
                            }}
                            aria-label="切換左側面板"
                        >
                            🤖
                        </button>
                        <button 
                            className={styles.mobileToggleRight}
                            onClick={() => {
                                setRightPanelOpen(!rightPanelOpen);
                                setLeftPanelOpen(false);
                            }}
                            aria-label="切換右側面板"
                        >
                            👤
                        </button>
                    </>
                )}
            </div>
        </>
    );
}
