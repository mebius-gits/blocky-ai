import { useEffect, useRef, useState } from 'react';
import { Panel, Group, Separator, type PanelImperativeHandle } from 'react-resizable-panels';

import FormulaListModal from '@/components/FormulaListModal';
import type { ChatMessage, ChatResponse, SavedFormula } from '@/types';
import { getFormulaList, saveFormula, deleteFormula } from '@/utils/formulaStorage';

import styles from './LeftPanel.module.scss';

interface LeftPanelProps {
    docText: string;
    setDocText: (text: string) => void;
    onParse: () => void;
    loading: boolean;
    error: string;
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

    // 儲存公式：名稱輸入與列表 Modal
    const [showSaveInput, setShowSaveInput] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [saveFeedback, setSaveFeedback] = useState('');
    const [showFormulaListModal, setShowFormulaListModal] = useState(false);
    const [formulaList, setFormulaList] = useState<SavedFormula[]>([]);

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

    const handleOpenFormulaList = () => {
        setFormulaList(getFormulaList());
        setShowFormulaListModal(true);
    };

    const handleLoadFormula = (formula: SavedFormula) => {
        setDocText(formula.dslText);
        setShowFormulaListModal(false);
        if (editorCollapsed && editorPanelRef.current) {
            editorPanelRef.current.expand();
            setEditorCollapsed(false);
        }
    };

    const handleDeleteFormula = (id: string) => {
        deleteFormula(id);
        setFormulaList(getFormulaList());
    };

    const handleConfirmSaveFormula = () => {
        const name = saveName.trim() || '未命名公式';
        saveFormula(name, docText);
        setSaveName('');
        setShowSaveInput(false);
        setSaveFeedback('已儲存');
        setTimeout(() => setSaveFeedback(''), 2000);
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
                                    <button
                                        type="button"
                                        className={styles.btnSecondary}
                                        onClick={() => setShowSaveInput(true)}
                                    >
                                        儲存公式
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.btnSecondary}
                                        onClick={handleOpenFormulaList}
                                    >
                                        查看公式列表
                                    </button>
                                </div>

                                {showSaveInput && (
                                    <div className={styles.saveFormulaRow}>
                                        <input
                                            type="text"
                                            value={saveName}
                                            onChange={(e) => setSaveName(e.target.value)}
                                            placeholder="輸入公式名稱"
                                            className={styles.saveNameInput}
                                            onKeyDown={(e) => e.key === 'Enter' && handleConfirmSaveFormula()}
                                        />
                                        <button type="button" className={styles.btnSmall} onClick={handleConfirmSaveFormula}>
                                            確認儲存
                                        </button>
                                        <button type="button" className={styles.btnSmall} onClick={() => { setShowSaveInput(false); setSaveName(''); }}>
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

            {showFormulaListModal && (
                <FormulaListModal
                    formulas={formulaList}
                    onLoad={handleLoadFormula}
                    onDelete={handleDeleteFormula}
                    onClose={() => setShowFormulaListModal(false)}
                />
            )}
        </div>
    );
}
