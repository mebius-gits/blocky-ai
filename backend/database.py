import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL is not set. Please add it to your .env file.\n"
        "Examples:\n"
        "  MySQL:      mysql+pymysql://user:pass@localhost/blocky_ai\n"
        "  PostgreSQL: postgresql+psycopg2://user:pass@localhost/blocky_ai"
    )


def _ensure_database_exists():
    """Auto-create the database if it doesn't exist (MySQL / PostgreSQL)."""
    from urllib.parse import urlparse

    parsed = urlparse(DATABASE_URL)
    db_name = parsed.path.lstrip("/")  # e.g. "blocky_ai"

    if not db_name:
        return

    # Build a connection URL without the database name
    base_url = DATABASE_URL.rsplit("/", 1)[0]

    try:
        tmp_engine = create_engine(base_url, isolation_level="AUTOCOMMIT")
        with tmp_engine.connect() as conn:
            if "mysql" in DATABASE_URL:
                conn.execute(
                    text(f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                         f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
                )
            elif "postgresql" in DATABASE_URL:
                # PostgreSQL doesn't support IF NOT EXISTS for CREATE DATABASE
                result = conn.execute(
                    text(f"SELECT 1 FROM pg_database WHERE datname = '{db_name}'")
                )
                if not result.fetchone():
                    conn.execute(text(f'CREATE DATABASE "{db_name}"'))
        tmp_engine.dispose()
        print(f"Database '{db_name}' is ready.")
    except Exception as e:
        print(f"Could not auto-create database: {e}")


_ensure_database_exists()

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables defined by ORM models."""
    import models  # noqa: F401 – ensure models are registered with Base
    Base.metadata.create_all(bind=engine)
