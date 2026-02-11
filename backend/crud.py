from sqlalchemy.orm import Session
from typing import Optional, List

from models import Department, Formula
from schemas import (
    DepartmentCreate,
    DepartmentUpdate,
    FormulaCreate,
    FormulaUpdate,
)


# ──────────────────────────────────────────────
# Department CRUD
# ──────────────────────────────────────────────

def create_department(db: Session, data: DepartmentCreate) -> Department:
    dept = Department(name=data.name, description=data.description)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


def get_departments(db: Session) -> List[Department]:
    return db.query(Department).order_by(Department.id).all()


def get_department(db: Session, department_id: int) -> Optional[Department]:
    return db.query(Department).filter(Department.id == department_id).first()


def update_department(
    db: Session, department_id: int, data: DepartmentUpdate
) -> Optional[Department]:
    dept = get_department(db, department_id)
    if not dept:
        return None
    if data.name is not None:
        dept.name = data.name
    if data.description is not None:
        dept.description = data.description
    db.commit()
    db.refresh(dept)
    return dept


def delete_department(db: Session, department_id: int) -> bool:
    dept = get_department(db, department_id)
    if not dept:
        return False
    db.delete(dept)
    db.commit()
    return True


# ──────────────────────────────────────────────
# Formula CRUD
# ──────────────────────────────────────────────

def create_formula(
    db: Session, department_id: int, data: FormulaCreate
) -> Formula:
    formula = Formula(
        department_id=department_id,
        name=data.name,
        description=data.description,
        ast_data=data.ast_data,
        raw_text=data.raw_text,
    )
    db.add(formula)
    db.commit()
    db.refresh(formula)
    return formula


def get_formulas(
    db: Session, department_id: Optional[int] = None
) -> List[Formula]:
    query = db.query(Formula)
    if department_id is not None:
        query = query.filter(Formula.department_id == department_id)
    return query.order_by(Formula.id).all()


def get_formula(db: Session, formula_id: int) -> Optional[Formula]:
    return db.query(Formula).filter(Formula.id == formula_id).first()


def update_formula(
    db: Session, formula_id: int, data: FormulaUpdate
) -> Optional[Formula]:
    formula = get_formula(db, formula_id)
    if not formula:
        return None
    if data.name is not None:
        formula.name = data.name
    if data.description is not None:
        formula.description = data.description
    if data.ast_data is not None:
        formula.ast_data = data.ast_data
    if data.raw_text is not None:
        formula.raw_text = data.raw_text
    db.commit()
    db.refresh(formula)
    return formula


def delete_formula(db: Session, formula_id: int) -> bool:
    formula = get_formula(db, formula_id)
    if not formula:
        return False
    db.delete(formula)
    db.commit()
    return True
