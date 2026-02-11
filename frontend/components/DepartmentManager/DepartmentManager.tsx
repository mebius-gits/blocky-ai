import { useCallback, useEffect, useState } from 'react';

import type { Department, FormulaRecord } from '@/types';
import {
    fetchDepartments,
    createDepartment,
    deleteDepartment,
    fetchFormulas,
    deleteFormulaApi,
} from '@/utils/api';

import styles from './DepartmentManager.module.scss';

interface DepartmentManagerProps {
    onClose: () => void;
    /** 當使用者從公式列表點擊「載入」時 */
    onLoadFormula?: (formula: FormulaRecord) => void;
}

export default function DepartmentManager({ onClose, onLoadFormula }: DepartmentManagerProps) {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // 建立部門表單
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [creating, setCreating] = useState(false);

    // 展開某部門查看公式
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [formulas, setFormulas] = useState<FormulaRecord[]>([]);
    const [formulasLoading, setFormulasLoading] = useState(false);

    const loadDepartments = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await fetchDepartments();
            setDepartments(data);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDepartments();
    }, [loadDepartments]);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        setError('');
        try {
            await createDepartment(newName.trim(), newDesc.trim() || undefined);
            setNewName('');
            setNewDesc('');
            await loadDepartments();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('確定要刪除此部門及其所有公式嗎？')) return;
        setError('');
        try {
            await deleteDepartment(id);
            if (expandedId === id) {
                setExpandedId(null);
                setFormulas([]);
            }
            await loadDepartments();
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const handleToggleExpand = async (id: number) => {
        if (expandedId === id) {
            setExpandedId(null);
            setFormulas([]);
            return;
        }
        setExpandedId(id);
        setFormulasLoading(true);
        try {
            const data = await fetchFormulas(id);
            setFormulas(data);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setFormulasLoading(false);
        }
    };

    const handleDeleteFormula = async (formulaId: number) => {
        if (!confirm('確定要刪除此公式嗎？')) return;
        try {
            await deleteFormulaApi(formulaId);
            setFormulas((prev) => prev.filter((f) => f.id !== formulaId));
        } catch (e) {
            setError((e as Error).message);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <span className={styles.title}>部門管理</span>
                    <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="關閉">
                        ×
                    </button>
                </div>

                {/* Create Department Form */}
                <div className={styles.createForm}>
                    <div className={styles.createRow}>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="部門名稱"
                            className={styles.inputName}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                        <input
                            type="text"
                            value={newDesc}
                            onChange={(e) => setNewDesc(e.target.value)}
                            placeholder="描述（選填）"
                            className={styles.inputDesc}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                        <button
                            type="button"
                            className={styles.btnCreate}
                            onClick={handleCreate}
                            disabled={creating || !newName.trim()}
                        >
                            {creating ? '建立中...' : '建立部門'}
                        </button>
                    </div>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                {/* Department List */}
                <div className={styles.body}>
                    {loading ? (
                        <div className={styles.empty}>載入中...</div>
                    ) : departments.length === 0 ? (
                        <div className={styles.empty}>尚無部門，請先建立</div>
                    ) : (
                        <ul className={styles.list}>
                            {departments.map((dept) => (
                                <li key={dept.id} className={styles.deptItem}>
                                    <div className={styles.deptRow}>
                                        <div
                                            className={styles.deptInfo}
                                            onClick={() => handleToggleExpand(dept.id)}
                                        >
                                            <span className={styles.expandIcon}>
                                                {expandedId === dept.id ? '▼' : '▶'}
                                            </span>
                                            <span className={styles.deptName}>{dept.name}</span>
                                            {dept.description && (
                                                <span className={styles.deptDesc}>
                                                    {dept.description}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className={styles.btnDelete}
                                            onClick={() => handleDelete(dept.id)}
                                        >
                                            刪除
                                        </button>
                                    </div>

                                    {/* Expanded formula list */}
                                    {expandedId === dept.id && (
                                        <div className={styles.formulaList}>
                                            {formulasLoading ? (
                                                <div className={styles.formulaEmpty}>載入公式中...</div>
                                            ) : formulas.length === 0 ? (
                                                <div className={styles.formulaEmpty}>此部門尚無公式</div>
                                            ) : (
                                                formulas.map((f) => (
                                                    <div key={f.id} className={styles.formulaItem}>
                                                        <span className={styles.formulaName}>{f.name}</span>
                                                        <div className={styles.formulaActions}>
                                                            {onLoadFormula && (
                                                                <button
                                                                    type="button"
                                                                    className={styles.btnLoad}
                                                                    onClick={() => onLoadFormula(f)}
                                                                >
                                                                    載入
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                className={styles.btnDeleteSmall}
                                                                onClick={() => handleDeleteFormula(f.id)}
                                                            >
                                                                刪除
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
