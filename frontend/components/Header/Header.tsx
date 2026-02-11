import styles from './Header.module.scss';

interface HeaderProps {
    onBackToHome?: () => void;
}

export default function Header({ onBackToHome }: HeaderProps) {
    return (
        <header className={styles.floatingHeader}>
            {onBackToHome && (
                <button
                    type="button"
                    className={styles.backBtn}
                    onClick={onBackToHome}
                >
                    回首頁
                </button>
            )}
            <h1>醫療計算機</h1>
            <span className={styles.version}>測試版</span>
        </header>
    );
}
