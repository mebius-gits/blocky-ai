import type { SavedFormula } from '@/types';

const STORAGE_KEY = 'mrb-formulas';

function loadList(): SavedFormula[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedFormula[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveList(list: SavedFormula[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function generateId(): string {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getFormulaList(): SavedFormula[] {
  return loadList();
}

export function saveFormula(name: string, dslText: string): SavedFormula {
  const list = loadList();
  const item: SavedFormula = {
    id: generateId(),
    name: name.trim() || '未命名公式',
    dslText,
    createdAt: Date.now(),
  };
  list.push(item);
  saveList(list);
  return item;
}

export function getFormulaById(id: string): SavedFormula | null {
  return loadList().find((f) => f.id === id) ?? null;
}

export function deleteFormula(id: string): void {
  const list = loadList().filter((f) => f.id !== id);
  saveList(list);
}

export function updateFormula(id: string, name: string, dslText: string): void {
  const list = loadList();
  const idx = list.findIndex((f) => f.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], name: name.trim() || list[idx].name, dslText };
  saveList(list);
}
