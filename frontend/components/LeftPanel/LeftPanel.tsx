import { useCallback, useEffect, useRef, useState } from 'react';
import { Panel, Group, Separator, type PanelImperativeHandle } from 'react-resizable-panels';

import DepartmentManager from '@/components/DepartmentManager';
import type { ChatMessage, ChatResponse, Department, FormulaRecord } from '@/types';
import { fetchDepartments, createFormula, updateFormulaApi } from '@/utils/api';

import styles from './LeftPanel.module.scss';

interface LeftPanelProps {
    docText: string;
    setDocText: (text: string) => void;
    onParse: () => void;
    loading: boolean;
    error: string;
    /** 目前 parse 出來的 AST，用於儲存到 DB */
    currentAst?: Record<string, unknown> | null;
    /** 載入 DB 公式時觸發，由父元件處理 AST 生成積木 */
    onLoadFormulaFromDb?: (formula: FormulaRecord) => void;
    /** 目前正在編輯的公式（若有），顯示更新按鈕用 */
    activeFormula?: FormulaRecord | null;
    /** 當新建或更新公式成功後，通知父元件更新 activeFormula */
    onActiveFormulaChange?: (formula: FormulaRecord) => void;
    initialChatHistory?: ChatMessage[];
    initialGeneratedRules?: string | null;
    /** 在 build 模式三欄 grid 內使用時為 true，避免 absolute 蓋住中間 viewport */
    embedInGrid?: boolean;
}

const DEFAULT_MESSAGE: ChatMessage = { 
    role: 'assistant', 
    content: '需要幫助嗎？描述您想建立的公式，例如：\n• 「計算 BMI」\n• 「心血管風險評分」' 
};

export default function LeftPanel({ 
    docText, 
    setDocText, 
    onParse, 
    loading, 
    error,
    currentAst,
    onLoadFormulaFromDb,
    activeFormula,
    onActiveFormulaChange,
    initialChatHistory,
    initialGeneratedRules,
    embedInGrid = false
}: LeftPanelProps) {
    const [chatCollapsed, setChatCollapsed] = useState(false);
    const [editorCollapsed, setEditorCollapsed] = useState(false);
    
    // Panel refs for collapse/expand control
    const chatPanelRef = useRef<PanelImperativeHandle>(null);
    const editorPanelRef = useRef<PanelImperativeHandle>(null);
    
    // Chat state - 使用初始聊天記錄（如果有的話）
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([DEFAULT_MESSAGE]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [generatedRules, setGeneratedRules] = useState<string | null>(null);

    // 儲存公式：名稱輸入與部門選擇
    const [showSaveInput, setShowSaveInput] = useState(false);
    const [saveMode, setSaveMode] = useState<'create' | 'update'>('create');
    const [saveName, setSaveName] = useState('');
    const [saveDesc, setSaveDesc] = useState('');
    const [saveFeedback, setSaveFeedback] = useState('');
    const [showDeptManager, setShowDeptManager] = useState(false);

    // 部門列表（用於儲存時選擇）
    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

    // 當從 WelcomeModal 傳入初始聊天記錄時更新
    useEffect(() => {
        if (initialChatHistory && initialChatHistory.length > 0) {
            setChatMessages(initialChatHistory);
        }
        if (initialGeneratedRules) {
            setGeneratedRules(initialGeneratedRules);
        }
    }, [initialChatHistory, initialGeneratedRules]);

    const sendChatMessage = async () => {
        if (!chatInput.trim()) return;

        const userMessage = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setChatLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage })
            });
            const data: ChatResponse = await response.json();

            if (data.error) {
                setChatMessages(prev => [...prev, { role: 'assistant', content: `錯誤: ${data.error}` }]);
            } else if (data.reply) {
                const replyContent = data.reply;
                setChatMessages(prev => [...prev, {
                    role: 'assistant' as const,
                    content: replyContent,
                    hasRules: !!data.generated_rules
                }]);
                if (data.generated_rules) {
                    setGeneratedRules(data.generated_rules);
                }
            }
        } catch (e) {
            const err = e as Error;
            setChatMessages(prev => [...prev, { role: 'assistant', content: `連線錯誤: ${err.message}` }]);
        } finally {
            setChatLoading(false);
        }
    };

    const useGeneratedRules = () => {
        if (generatedRules) {
            setDocText(generatedRules);
            setGeneratedRules(null);
            // Expand editor if collapsed
            if (editorCollapsed && editorPanelRef.current) {
                editorPanelRef.current.expand();
                setEditorCollapsed(false);
            }
        }
    };

    const toggleChatPanel = () => {
        if (chatPanelRef.current) {
            if (chatPanelRef.current.isCollapsed()) {
                chatPanelRef.current.expand();
                setChatCollapsed(false);
            } else {
                chatPanelRef.current.collapse();
                setChatCollapsed(true);
            }
        }
    };

    const toggleEditorPanel = () => {
        if (editorPanelRef.current) {
            if (editorPanelRef.current.isCollapsed()) {
                editorPanelRef.current.expand();
                setEditorCollapsed(false);
            } else {
                editorPanelRef.current.collapse();
                setEditorCollapsed(true);
            }
        }
    };

    // Handle resize to detect collapse state
    const handleChatResize = (size: { asPercentage: number }) => {
        setChatCollapsed(size.asPercentage < 5);
    };

    const handleEditorResize = (size: { asPercentage: number }) => {
        setEditorCollapsed(size.asPercentage < 5);
    };

    const handleOpenDeptManager = () => {
        setShowDeptManager(true);
    };

    const handleLoadFormula = (formula: FormulaRecord) => {
        // 委託給父元件處理 AST + Blockly 生成
        if (onLoadFormulaFromDb) {
            onLoadFormulaFromDb(formula);
        } else if (formula.raw_text) {
            setDocText(formula.raw_text);
        }
        setShowDeptManager(false);
        if (editorCollapsed && editorPanelRef.current) {
            editorPanelRef.current.expand();
            setEditorCollapsed(false);
        }
    };

    // 打開儲存時載入部門列表
    const handleOpenSave = useCallback(async (mode: 'create' | 'update') => {
        setSaving(true);
        // setError(''); // Removed as there's no `setError` state in this component
        try {
            const depts = await fetchDepartments();
            setDepartments(depts);
            
            // 設定模式與預填資料
            setSaveMode(mode);
            if (mode === 'update' && activeFormula) {
                setSaveName(activeFormula.name);
                setSaveDesc(activeFormula.description || '');
                setSelectedDeptId(activeFormula.department_id);
            } else {
                setSaveName('');
                setSaveDesc('');
                if (depts.length > 0 && !selectedDeptId) {
                    setSelectedDeptId(depts[0].id);
                }
            }
        } catch {
            setDepartments([]);
        } finally {
            setSaving(false);
            setShowSaveInput(true);
        }
    }, [selectedDeptId, activeFormula]);

    const handleConfirmSaveFormula = async () => {
        if (!selectedDeptId) {
            setSaveFeedback('請先選擇部門');
            setTimeout(() => setSaveFeedback(''), 2000);
            return;
        }
        const name = saveName.trim() || '未命名公式';
        const astData = currentAst || {};
        setSaving(true);
        try {
            let resultFormula: FormulaRecord;
            
            if (saveMode === 'create') {
                resultFormula = await createFormula(selectedDeptId, name, astData, docText, saveDesc.trim() || undefined);
                setSaveFeedback('已建立新公式');
            } else {
                // Update mode
                if (!activeFormula) throw new Error('無法更新：未選擇公式');
                resultFormula = await updateFormulaApi(
                    activeFormula.id,
                    name,
                    astData,
                    docText,
                    saveDesc.trim() || undefined // update description
                );
                // 如果部門變更了，可能需要額外處理？目前 API 不支援跨部門移動，或者需要後端支援
                // updateFormulaApi 目前只更新 name/desc/content
                // 若要支援移動部門，需要後端 updateFormula 支援 department_id
                setSaveFeedback('更新成功');
            }

            setSaveName('');
            setSaveDesc('');
            setShowSaveInput(false);
            
            if (onActiveFormulaChange) {
                onActiveFormulaChange(resultFormula);
            }
            setTimeout(() => setSaveFeedback(''), 2000);
        } catch (e) {
            setSaveFeedback((saveMode === 'create' ? '儲存' : '更新') + '失敗: ' + (e as Error).message);
            setTimeout(() => setSaveFeedback(''), 3000);
        } finally {
            setSaving(false);
        }
    };

    const showQuickPrompts = chatMessages.length === 1 && 
        chatMessages[0].content === DEFAULT_MESSAGE.content && 
        !generatedRules;

    const lastMessage = chatMessages[chatMessages.length - 1];
    const lastMessagePreview = lastMessage?.content.slice(0, 30) + (lastMessage?.content.length > 30 ? '...' : '');

    return (
        <div className={`${styles.leftPanel} ${embedInGrid ? styles.leftPanelInGrid : ''}`}>
            <Group orientation="vertical" className={styles.panelGroup}>
                {/* AI Chat Panel */}
                <Panel 
                    defaultSize={60} 
                    minSize={15}
                    collapsible={true}
                    collapsedSize={50}
                    panelRef={chatPanelRef}
                    onResize={handleChatResize}
                >
                    <div className={styles.chatSection}>
                        <div 
                            className={styles.sectionHeader}
                            onClick={toggleChatPanel}
                        >
                            <div className={styles.headerLeft}>
                                <span className={styles.sectionIcon}>🤖</span>
                                <span className={styles.sectionTitle}>AI 助手</span>
                                {chatCollapsed && (
                                    <span className={styles.collapsedInfo}>{lastMessagePreview}</span>
                                )}
                            </div>
                            <span className={styles.collapseIcon}>
                                {chatCollapsed ? '▼' : '▲'}
                            </span>
                        </div>

                        {!chatCollapsed && (
                            <div className={styles.chatContent}>
                                {showQuickPrompts && (
                                    <div className={styles.quickPrompts}>
                                        <button onClick={() => setChatInput('計算 BMI')}>BMI</button>
                                        <button onClick={() => setChatInput('糖尿病風險')}>糖尿病</button>
                                        <button onClick={() => setChatInput('HEART Score')}>HEART</button>
                                    </div>
                                )}

                                <div className={styles.chatMessages}>
                                    {chatMessages.map((msg, idx) => (
                                        <div key={idx} className={`${styles.chatMsg} ${styles[msg.role]}`}>
                                            <div className={styles.msgBubble}>
                                                <div className={styles.msgContent}>{msg.content}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {chatLoading && (
                                        <div className={`${styles.chatMsg} ${styles.assistant}`}>
                                            <div className={styles.msgBubble}>
                                                <div className={`${styles.msgContent} ${styles.typing}`}>
                                                    <span className={styles.dot}></span>
                                                    <span className={styles.dot}></span>
                                                    <span className={styles.dot}></span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {generatedRules && (
                                    <div className={styles.generatedCodeBox}>
                                        <div className={styles.codeHeader}>
                                            <span>生成的公式</span>
                                        </div>
                                        <pre>{generatedRules}</pre>
                                        <button className={styles.btnUse} onClick={useGeneratedRules}>
                                            載入到編輯器
                                        </button>
                                    </div>
                                )}

                                <div className={styles.chatInputArea}>
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="描述您想建立的公式..."
                                        onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                                        disabled={chatLoading}
                                    />
                                    <button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()}>
                                        發送
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </Panel>

                {/* Resize Handle */}
                <Separator className={styles.resizeHandle}>
                    <div className={styles.resizeHandleInner}>
                        <span className={styles.resizeDots}>⋮⋮</span>
                    </div>
                </Separator>

                {/* Editor Panel */}
                <Panel 
                    defaultSize={40} 
                    minSize={15}
                    collapsible={true}
                    collapsedSize={50}
                    panelRef={editorPanelRef}
                    onResize={handleEditorResize}
                >
                    <div className={styles.editorSection}>
                        <div 
                            className={styles.sectionHeader} 
                            onClick={toggleEditorPanel}
                        >
                            <div className={styles.headerLeft}>
                                <span className={styles.sectionIcon}>📝</span>
                                <span className={styles.sectionTitle}>DSL 編輯器</span>
                            </div>
                            <span className={styles.collapseIcon}>
                                {editorCollapsed ? '▼' : '▲'}
                            </span>
                        </div>

                        {!editorCollapsed && (
                            <div className={styles.editorContent}>
                                <textarea
                                    className={styles.codeEditor}
                                    value={docText}
                                    onChange={(e) => setDocText(e.target.value)}
                                    placeholder="輸入規則或公式..."
                                    spellCheck={false}
                                />

                                <button
                                    className={styles.btnPrimary}
                                    onClick={onParse}
                                    disabled={loading}
                                >
                                    {loading ? '處理中...' : '生成積木'}
                                </button>

                                <div className={styles.formulaActions}>
                                    {activeFormula && (
                                        <button
                                            type="button"
                                            className={styles.btnSecondary}
                                            onClick={() => handleOpenSave('update')}
                                            disabled={saving}
                                        >
                                            更新修改
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className={styles.btnSecondary}
                                        onClick={() => handleOpenSave('create')}
                                    >
                                        {activeFormula ? '另存新檔' : '儲存公式'}
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.btnSecondary}
                                        onClick={handleOpenDeptManager}
                                    >
                                        部門管理
                                    </button>
                                </div>

                                {showSaveInput && (
                                    <div className={styles.saveFormulaRow}>
                                        <select
                                            className={styles.saveNameInput}
                                            value={selectedDeptId ?? ''}
                                            onChange={(e) => setSelectedDeptId(Number(e.target.value) || null)}
                                        >
                                            <option value="">-- 選擇部門 --</option>
                                            {departments.map((d) => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            value={saveName}
                                            onChange={(e) => setSaveName(e.target.value)}
                                            placeholder="輸入公式名稱"
                                            className={styles.saveNameInput}
                                            onKeyDown={(e) => e.key === 'Enter' && handleConfirmSaveFormula()}
                                        />
                                        <input
                                            type="text"
                                            value={saveDesc}
                                            onChange={(e) => setSaveDesc(e.target.value)}
                                            placeholder="公式描述（選填）"
                                            className={styles.saveNameInput}
                                        />
                                        <button type="button" className={styles.btnSmall} onClick={handleConfirmSaveFormula} disabled={saving}>
                                            {saving ? '處理中...' : (saveMode === 'update' ? '確認更新' : '確認儲存')}
                                        </button>
                                        <button type="button" className={styles.btnSmall} onClick={() => { setShowSaveInput(false); setSaveName(''); setSaveDesc(''); }}>
                                            取消
                                        </button>
                                    </div>
                                )}
                                {saveFeedback && <div className={styles.saveFeedback}>{saveFeedback}</div>}

                                {error && <div className={styles.errorMsg}>{error}</div>}
                            </div>
                        )}
                    </div>
                </Panel>
            </Group>

            {showDeptManager && (
                <DepartmentManager
                    onClose={() => setShowDeptManager(false)}
                    onLoadFormula={handleLoadFormula}
                />
            )}
        </div>
    );
}
