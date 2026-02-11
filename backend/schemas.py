from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from datetime import datetime


# ──────────────────────────────────────────────
# Department
# ──────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class FormulaInDepartment(BaseModel):
    """Lightweight formula representation used when listing a department."""
    id: int
    name: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DepartmentResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    formulas: List[FormulaInDepartment] = []

    model_config = {"from_attributes": True}


class DepartmentListItem(BaseModel):
    """Used in the GET /departments list (no nested formulas)."""
    id: int
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Formula
# ──────────────────────────────────────────────

class FormulaCreate(BaseModel):
    name: str
    description: Optional[str] = None
    ast_data: Dict[str, Any]
    raw_text: Optional[str] = None


class FormulaUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    ast_data: Optional[Dict[str, Any]] = None
    raw_text: Optional[str] = None


class FormulaResponse(BaseModel):
    id: int
    department_id: int
    name: str
    description: Optional[str] = None
    ast_data: Dict[str, Any]
    raw_text: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
