import { useState } from 'react';

import type { ChatMessage, ChatResponse } from '@/types';

import styles from './WelcomeModal.module.scss';

interface WelcomeModalProps {
    onClose: (chatHistory: ChatMessage[], generatedRules: string | null) => void;
    onUseGeneratedRules: (rules: string, chatHistory: ChatMessage[]) => void;
}

export default function WelcomeModal({ onClose, onUseGeneratedRules }: WelcomeModalProps) {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        { 
            role: 'assistant', 
            content: '歡迎使用醫療計算機！\n\n請描述您想建立的公式或評分規則，例如：\n• 「計算 BMI 從體重和身高」\n• 「建立糖尿病風險評分」\n• 「心臟病風險計算器」' 
        }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [generatedRules, setGeneratedRules] = useState<string | null>(null);

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

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
            const error = e as Error;
            setChatMessages(prev => [...prev, { role: 'assistant', content: `連線錯誤: ${error.message}` }]);
        } finally {
            setChatLoading(false);
        }
    };

    const handleUseRules = () => {
        if (generatedRules) {
            onUseGeneratedRules(generatedRules, chatMessages);
        }
    };

    const handleSkip = () => {
        // 傳遞聊天記錄，即使跳過也保留對話歷史
        onClose(chatMessages, generatedRules);
    };

    const quickPrompts = [
        { label: 'BMI 計算', value: '計算 BMI 從體重和身高' },
        { label: '糖尿病風險', value: '建立糖尿病風險評分' },
        { label: '心血管風險', value: '心臟病風險計算器' },
        { label: 'HEART Score', value: '建立 HEART Score 急性冠心症風險評估' },
    ];

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                {/* Header */}
                <div className={styles.modalHeader}>
                    <div className={styles.logo}>
                        <span className={styles.logoIcon}>🏥</span>
                        <span className={styles.logoText}>Medical Rule Builder</span>
                    </div>
                    <button className={styles.skipBtn} onClick={handleSkip}>
                        跳過 →
                    </button>
                </div>

                {/* Main Chat Area */}
                <div className={styles.chatArea}>
                    {/* Quick Prompts */}
                    {chatMessages.length <= 1 && !generatedRules && (
                        <div className={styles.quickPrompts}>
                            <div className={styles.promptsLabel}>快速開始：</div>
                            <div className={styles.promptsGrid}>
                                {quickPrompts.map((prompt, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => setChatInput(prompt.value)}
                                        className={styles.promptBtn}
                                    >
                                        {prompt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Messages */}
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

                    {/* Generated Rules Preview */}
                    {generatedRules && (
                        <div className={styles.generatedCodeBox}>
                            <div className={styles.codeHeader}>
                                <span>生成的公式</span>
                                <span className={styles.codeTag}>準備使用</span>
                            </div>
                            <pre>{generatedRules}</pre>
                            <button className={styles.btnUse} onClick={handleUseRules}>
                                使用此公式並開始
                            </button>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className={styles.inputArea}>
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="描述您想建立的公式或評分規則..."
                        onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                        disabled={chatLoading}
                    />
                    <button 
                        onClick={sendChatMessage} 
                        disabled={chatLoading || !chatInput.trim()}
                        className={styles.sendBtn}
                    >
                        發送
                    </button>
                </div>
            </div>
        </div>
    );
}
