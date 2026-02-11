import type { AST, Patient, ComputedValues } from '@/types';

import styles from './ResultPanel.module.scss';

interface ResultPanelProps {
    score: number | null;
    computed: ComputedValues;
    ast: AST | null;
    selectedPatient: Patient | null;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}

export default function ResultPanel({
    score,
    computed,
    ast,
    selectedPatient,
    collapsed = false,
    onToggleCollapse
}: ResultPanelProps) {
    // Determine risk level based on score and AST risk_levels
    const getRiskLevel = () => {
        if (score === null || !ast?.risk_levels) return null;
        
        for (const level of ast.risk_levels) {
            const { condition, text } = level;
            if (!condition) continue;
            
            const { op, right } = condition;
            const rightVal = typeof right === 'number' ? right : 0;
            
            let matches = false;
            switch (op) {
                case '>=': matches = score >= rightVal; break;
                case '<=': matches = score <= rightVal; break;
                case '>': matches = score > rightVal; break;
                case '<': matches = score < rightVal; break;
                case '==': matches = score === rightVal; break;
            }
            
            if (matches) return text;
        }
        return null;
    };

    const riskText = getRiskLevel();
    // Filter out RiskLevel from computed values as it's displayed separately
    const filteredComputed = Object.fromEntries(
        Object.entries(computed).filter(([key]) => key !== 'RiskLevel')
    );
    const hasComputedValues = Object.keys(filteredComputed).length > 0;
    const formulaName = ast?.formula_name || ast?.score_name || 'Result';

    // Determine severity class for risk display
    const getRiskClass = () => {
        if (!riskText) return '';
        const lower = riskText.toLowerCase();
        if (lower.includes('高') || lower.includes('high') || lower.includes('⚠️')) return styles.high;
        if (lower.includes('中') || lower.includes('medium') || lower.includes('⚡')) return styles.medium;
        return styles.low;
    };

    return (
        <div className={styles.resultPanel}>
            {/* Header */}
            <div className={styles.panelHeader} onClick={onToggleCollapse}>
                <div className={styles.headerLeft}>
                    <span className={styles.panelIcon}>📊</span>
                    <span className={styles.panelTitle}>計算結果</span>
                    {collapsed && score !== null && (
                        <span className={styles.collapsedInfo}>
                            {formulaName}: {typeof score === 'number' ? score.toFixed(2) : score}
                        </span>
                    )}
                </div>
                <span className={styles.collapseIcon}>
                    {collapsed ? '▼' : '▲'}
                </span>
            </div>

            {/* Content */}
            {!collapsed && (
                <div className={styles.panelContent}>
                    {score === null ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>📋</div>
                            <div className={styles.emptyText}>
                                尚未計算<br />
                                <span>輸入變數後按「計算結果」</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Main Score Display */}
                            <div className={styles.scoreCard}>
                                <div className={styles.scoreLabel}>{formulaName}</div>
                                <div className={styles.scoreValue}>
                                    {typeof score === 'number' ? score.toFixed(2) : score}
                                </div>
                            </div>
                            
                            {/* Computed Intermediate Values */}
                            {hasComputedValues && (
                                <div className={styles.computedSection}>
                                    <div className={styles.sectionLabel}>計算中間值</div>
                                    {Object.entries(filteredComputed).map(([key, value]) => (
                                        <div key={key} className={styles.computedRow}>
                                            <span className={styles.computedName}>{key}</span>
                                            <span className={styles.computedValue}>
                                                {typeof value === 'number' ? value.toFixed(2) : value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Risk Level */}
                            {riskText && (
                                <div className={`${styles.riskLevel} ${getRiskClass()}`}>
                                    {riskText}
                                </div>
                            )}

                            {/* Patient Tag */}
                            {selectedPatient && (
                                <div className={styles.patientTag}>
                                    病人: {selectedPatient.name} ({selectedPatient.medicalId || selectedPatient.id})
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
