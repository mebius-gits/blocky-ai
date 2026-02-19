from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from database import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationship: one department has many formulas
    formulas = relationship(
        "Formula", back_populates="department", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Department(id={self.id}, name='{self.name}')>"


class Formula(Base):
    __tablename__ = "formulas"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    department_id = Column(
        Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(255), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    ast_data = Column(JSON, nullable=False)
    raw_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationship back to department
    department = relationship("Department", back_populates="formulas")

    def __repr__(self):
        return f"<Formula(id={self.id}, name='{self.name}')>"


class PatientField(Base):
    """Registry of patient data field names available in the external system.
    Stores only field metadata (no actual patient values).
    Used to hint AI formula generation with available variable names.
    """
    __tablename__ = "patient_fields"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    field_name = Column(String(100), unique=True, nullable=False, index=True)  # e.g. "height"
    label = Column(String(255), nullable=True)    # e.g. "身高 (公尺)"
    field_type = Column(String(50), nullable=False, default="float")  # int / float / boolean / string
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<PatientField(id={self.id}, field_name='{self.field_name}')>"
