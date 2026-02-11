import type { Department, FormulaRecord } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

// ──────────────────────────────────────────────
// Department API
// ──────────────────────────────────────────────

export async function fetchDepartments(): Promise<Department[]> {
    const res = await fetch(`${API_BASE_URL}/departments`);
    if (!res.ok) throw new Error('Failed to fetch departments');
    return res.json();
}

export async function fetchDepartment(id: number): Promise<Department> {
    const res = await fetch(`${API_BASE_URL}/departments/${id}`);
    if (!res.ok) throw new Error('Department not found');
    return res.json();
}

export async function createDepartment(name: string, description?: string): Promise<Department> {
    const res = await fetch(`${API_BASE_URL}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || null }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to create department');
    }
    return res.json();
}

export async function updateDepartment(id: number, name?: string, description?: string): Promise<Department> {
    const body: Record<string, string | null> = {};
    if (name !== undefined) body.name = name;
    if (description !== undefined) body.description = description;
    const res = await fetch(`${API_BASE_URL}/departments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to update department');
    return res.json();
}

export async function deleteDepartment(id: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/departments/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete department');
}

// ──────────────────────────────────────────────
// Formula API
// ──────────────────────────────────────────────

export async function fetchFormulas(departmentId?: number): Promise<FormulaRecord[]> {
    const url = departmentId
        ? `${API_BASE_URL}/formulas?department_id=${departmentId}`
        : `${API_BASE_URL}/formulas`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch formulas');
    return res.json();
}

export async function fetchFormula(id: number): Promise<FormulaRecord> {
    const res = await fetch(`${API_BASE_URL}/formulas/${id}`);
    if (!res.ok) throw new Error('Formula not found');
    return res.json();
}

export async function createFormula(
    departmentId: number,
    name: string,
    astData: Record<string, unknown>,
    rawText?: string,
    description?: string,
): Promise<FormulaRecord> {
    const res = await fetch(`${API_BASE_URL}/departments/${departmentId}/formulas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            description: description || null,
            ast_data: astData,
            raw_text: rawText || null,
        }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to create formula');
    }
    return res.json();
}

export async function updateFormulaApi(
    id: number,
    name?: string,
    astData?: Record<string, unknown>,
    rawText?: string,
    description?: string,
): Promise<FormulaRecord> {
    const body: Record<string, unknown> = {};
    if (name !== undefined) body.name = name;
    if (description !== undefined) body.description = description;
    if (astData !== undefined) body.ast_data = astData;
    if (rawText !== undefined) body.raw_text = rawText;
    const res = await fetch(`${API_BASE_URL}/formulas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to update formula');
    return res.json();
}

export async function deleteFormulaApi(id: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/formulas/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete formula');
}
