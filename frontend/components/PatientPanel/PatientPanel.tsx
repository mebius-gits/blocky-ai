import { useState } from 'react';

import type { AST, Patient, InputValues } from '@/types';

import styles from './PatientPanel.module.scss';

// Sample Patient Data for Demo
const SAMPLE_PATIENTS: Patient[] = [
    { id: 'p1', name: 'John Smith', age: 72, has_disease: true, weight: 80, height: 1.75, cholesterol: 220, medicalId: 'MRN-2024-001' },
    { id: 'p2', name: 'Mary Johnson', age: 45, has_disease: false, weight: 65, height: 1.65, cholesterol: 180, medicalId: 'MRN-2024-002' },
    { id: 'p3', name: 'Robert Lee', age: 68, has_disease: true, weight: 95, height: 1.80, cholesterol: 250, medicalId: 'MRN-2024-003' },
    { id: 'p4', name: 'Emily Chen', age: 55, has_disease: false, weight: 55, height: 1.60, cholesterol: 160, medicalId: 'MRN-2024-004' },
    { id: 'p5', name: 'James Wilson', age: 80, has_disease: true, weight: 75, height: 1.70, cholesterol: 190, medicalId: 'MRN-2024-005' },
];

interface PatientPanelProps {
    ast: AST | null;
    inputs: InputValues;
    setInputs: React.Dispatch<React.SetStateAction<InputValues>>;
    selectedPatient: Patient | null;
    setSelectedPatient: (patient: Patient | null) => void;
    onCalculate: () => void;
    loading?: boolean;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}

export default function PatientPanel({
    ast,
    inputs,
    setInputs,
    selectedPatient,
    setSelectedPatient,
    onCalculate,
    loading = false,
    collapsed = false,
    onToggleCollapse
}: PatientPanelProps) {
    const [medicalIdInput, setMedicalIdInput] = useState('');
    const [searchError, setSearchError] = useState('');

    const variables = ast ? Object.keys(ast.variables || {}) : [];

    const updateInput = (key: string, value: number | boolean | string) => {
        setInputs(prev => ({ ...prev, [key]: value }));
    };

    const loadPatient = (patientId: string) => {
        const patient = SAMPLE_PATIENTS.find(p => p.id === patientId);
        if (patient) {
            setSelectedPatient(patient);
            setMedicalIdInput(String(patient.medicalId || ''));
            setSearchError('');
            const newInputs: InputValues = {};
            variables.forEach(v => {
                if (patient[v] !== undefined) {
                    newInputs[v] = patient[v] as number | boolean | string;
                }
            });
            setInputs(prev => ({ ...prev, ...newInputs }));
        }
    };

    const searchByMedicalId = () => {
        if (!medicalIdInput.trim()) {
            setSearchError('請輸入病歷號');
            return;
        }
        const patient = SAMPLE_PATIENTS.find(
            p => String(p.medicalId || '').toLowerCase() === medicalIdInput.trim().toLowerCase()
        );
        if (patient) {
            loadPatient(patient.id);
        } else {
            setSearchError('找不到此病歷號');
            setSelectedPatient(null);
        }
    };

    return (
        <div className={styles.patientPanel}>
            {/* Header */}
            <div className={styles.panelHeader} onClick={onToggleCollapse}>
                <div className={styles.headerLeft}>
                    <span className={styles.panelIcon}>👤</span>
                    <span className={styles.panelTitle}>病人資料</span>
                    {collapsed && selectedPatient && (
                        <span className={styles.collapsedInfo}>{selectedPatient.name}</span>
                    )}
                </div>
                <span className={styles.collapseIcon}>
                    {collapsed ? '▼' : '▲'}
                </span>
            </div>

            {/* Content */}
            {!collapsed && (
                <div className={styles.panelContent}>
                    {/* Scrollable Content Area */}
                    <div className={styles.scrollableContent}>
                        {/* Medical ID Search */}
                        <div className={styles.searchSection}>
                            <label className={styles.fieldLabel}>病歷號查詢</label>
                            <div className={styles.searchRow}>
                                <input
                                    type="text"
                                    value={medicalIdInput}
                                    onChange={(e) => {
                                        setMedicalIdInput(e.target.value);
                                        setSearchError('');
                                    }}
                                    placeholder="輸入病歷號 (例: MRN-2024-001)"
                                    onKeyDown={(e) => e.key === 'Enter' && searchByMedicalId()}
                                    className={styles.searchInput}
                                />
                                <button onClick={searchByMedicalId} className={styles.searchBtn}>
                                    搜尋
                                </button>
                            </div>
                            {searchError && <div className={styles.searchError}>{searchError}</div>}
                        </div>

                        {/* Patient Dropdown */}
                        <div className={styles.selectSection}>
                            <label className={styles.fieldLabel}>或選擇病人</label>
                            <select
                                className={styles.patientSelect}
                                value={selectedPatient?.id || ''}
                                onChange={(e) => loadPatient(e.target.value)}
                            >
                                <option value="">-- 選擇病人 --</option>
                                {SAMPLE_PATIENTS.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({p.medicalId})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Patient Info */}
                        {selectedPatient && (
                            <div className={styles.patientInfo}>
                                <div className={styles.patientName}>{selectedPatient.name}</div>
                                <div className={styles.patientDetails}>
                                    病歷號: {selectedPatient.medicalId} | 年齡: {selectedPatient.age}
                                    <p>
                                        身高: {selectedPatient.height} | 體重: {selectedPatient.weight} | 膽固醇: {selectedPatient.cholesterol}
                                    </p>
                                    <p>
                                        是否患有常見疾病: {selectedPatient.has_disease ? '是' : '否'}
                                    </p>

                                </div>
                            </div>
                        )}

                        <div className={styles.divider}></div>

                        {/* Variables Section */}
                        <div className={styles.variablesSection}>
                            <div className={styles.fieldLabel}>變數輸入</div>
                            <div className={styles.variablesList}>
                                {variables.length === 0 ? (
                                    <div className={styles.emptyState}>請先解析規則以顯示變數</div>
                                ) : (
                                    variables.map(v => {
                                        const varType = (ast?.variables[v] || 'int').toLowerCase();
                                        const isBoolean = varType === 'boolean' || varType === 'bool';
                                        const isNumber = varType === 'int' || varType === 'number' || varType === 'float';

                                        return (
                                            <div key={v} className={styles.varRow}>
                                                <label>{v}</label>
                                                {isBoolean ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={!!inputs[v]}
                                                        onChange={(e) => updateInput(v, e.target.checked)}
                                                        className={styles.checkboxInput}
                                                    />
                                                ) : (
                                                    <input
                                                        type={isNumber ? 'number' : 'text'}
                                                        value={inputs[v] !== undefined ? String(inputs[v]) : ''}
                                                        onChange={(e) => {
                                                            const val = isNumber
                                                                ? Number(e.target.value)
                                                                : e.target.value;
                                                            updateInput(v, val);
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Fixed Calculate Button */}
                    <button
                        className={styles.btnCalculate}
                        onClick={onCalculate}
                        disabled={!ast || loading}
                    >
                        {loading ? '計算中...' : '計算結果'}
                    </button>
                </div>
            )}
        </div>
    );
}
