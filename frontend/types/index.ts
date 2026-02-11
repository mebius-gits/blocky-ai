export type VariableType = 'int' | 'number' | 'float' | 'boolean' | 'bool' | 'string';

export interface Variables {
  [key: string]: VariableType;
}

export interface Condition {
  left: string;
  op: '>=' | '<=' | '==' | '>' | '<';
  right: number | boolean | string;
  compound?: 'and' | 'or';
  conditions?: Condition[];
}

export interface Action {
  type: 'add' | 'set';
  value: number;
}

export interface Rule {
  condition: Condition;
  action: Action;
}

export interface RiskLevel {
  condition: Condition;
  text: string;
}

export interface AST {
  formula_name?: string;
  score_name?: string;
  variables: Variables;
  formula?: string;
  formulas?: { [key: string]: string };
  rules?: Rule[];
  risk_levels?: RiskLevel[];
  type?: 'formula' | 'score' | 'score_with_formula';
}

export type AppMode = 'home' | 'build' | 'use' | 'manage';

export interface SavedFormula {
  id: string;
  name: string;
  dslText: string;
  createdAt?: number;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  has_disease?: boolean;
  weight?: number;
  height?: number;
  cholesterol?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  hasRules?: boolean;
}

export interface InputValues {
  [key: string]: number | boolean | string;
}

export interface ComputedValues {
  [key: string]: number | string;
}

export interface ParseResponse {
  error?: string;
  detail?: string | Array<{ msg?: string }>;
  formula_name?: string;
  score_name?: string;
  variables?: Variables;
  formula?: string;
  formulas?: { [key: string]: string };
  rules?: Rule[];
  risk_levels?: RiskLevel[];
  type?: 'formula' | 'score' | 'score_with_formula';
}

export interface CalculateResponse {
  error?: string;
  detail?: string | Array<{ msg?: string }>;
  result?: number;
  score?: number;
  computed?: ComputedValues;
}

export interface ChatResponse {
  error?: string;
  reply?: string;
  generated_rules?: string;
}

// ──────────────────────────────────────────────
// Database-backed types (Department & Formula)
// ──────────────────────────────────────────────

export interface Department {
  id: number;
  name: string;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  formulas?: FormulaRecord[];
}

export interface FormulaRecord {
  id: number;
  department_id: number;
  name: string;
  description?: string | null;
  ast_data: Record<string, unknown>;
  raw_text?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
