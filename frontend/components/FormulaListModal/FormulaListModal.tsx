import type { SavedFormula } from '@/types';

import styles from './FormulaListModal.module.scss';

interface FormulaListModalProps {
  formulas: SavedFormula[];
  onLoad: (formula: SavedFormula) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function FormulaListModal({
  formulas,
  onLoad,
  onDelete,
  onClose,
}: FormulaListModalProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>公式列表</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="關閉">
            ×
          </button>
        </div>
        <div className={styles.body}>
          {formulas.length === 0 ? (
            <div className={styles.empty}>尚無儲存的公式</div>
          ) : (
            <ul className={styles.list}>
              {formulas.map((f) => (
                <li key={f.id} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{f.name}</span>
                    {f.createdAt != null && (
                      <span className={styles.itemDate}>
                        {new Date(f.createdAt).toLocaleDateString('zh-TW')}
                      </span>
                    )}
                  </div>
                  <div className={styles.itemActions}>
                    <button
                      type="button"
                      className={styles.btnLoad}
                      onClick={() => onLoad(f)}
                    >
                      載入到編輯器
                    </button>
                    <button
                      type="button"
                      className={styles.btnDelete}
                      onClick={() => onDelete(f.id)}
                      aria-label="刪除"
                    >
                      刪除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
