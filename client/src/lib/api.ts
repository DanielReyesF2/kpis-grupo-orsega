import { apiRequest } from '@/lib/queryClient';
import type { 
  InsertUser, 
  InsertCompany, 
  InsertArea, 
  InsertKpi, 
  InsertKpiValue, 
  InsertActionPlan 
} from '@shared/schema';

// Auth API
export const login = async (email: string, password: string) => {
  const res = await apiRequest('POST', '/api/auth/login', { email, password });
  return await res.json();
};

export const logout = async () => {
  const res = await apiRequest('POST', '/api/auth/logout', {});
  return await res.json();
};

export const getSession = async () => {
  const res = await apiRequest('GET', '/api/auth/session', undefined);
  return await res.json();
};

// Users API
export const createUser = async (user: InsertUser) => {
  const res = await apiRequest('POST', '/api/users', user);
  return await res.json();
};

export const updateUser = async (id: number, user: Partial<InsertUser>) => {
  const res = await apiRequest('PUT', `/api/users/${id}`, user);
  return await res.json();
};

// Companies API
export const createCompany = async (company: InsertCompany) => {
  const res = await apiRequest('POST', '/api/companies', company);
  return await res.json();
};

export const updateCompany = async (id: number, company: Partial<InsertCompany>) => {
  const res = await apiRequest('PUT', `/api/companies/${id}`, company);
  return await res.json();
};

// Areas API
export const createArea = async (area: InsertArea) => {
  const res = await apiRequest('POST', '/api/areas', area);
  return await res.json();
};

export const updateArea = async (id: number, area: Partial<InsertArea>) => {
  const res = await apiRequest('PUT', `/api/areas/${id}`, area);
  return await res.json();
};

// KPIs API
export const createKpi = async (kpi: InsertKpi) => {
  const res = await apiRequest('POST', '/api/kpis', kpi);
  return await res.json();
};

export const updateKpi = async (id: number, kpi: Partial<InsertKpi>) => {
  const res = await apiRequest('PUT', `/api/kpis/${id}`, kpi);
  return await res.json();
};

// KPI Values API
export const createKpiValue = async (kpiValue: InsertKpiValue) => {
  const res = await apiRequest('POST', '/api/kpi-values', kpiValue);
  return await res.json();
};

// Action Plans API
export const createActionPlan = async (actionPlan: InsertActionPlan) => {
  const res = await apiRequest('POST', '/api/action-plans', actionPlan);
  return await res.json();
};

export const updateActionPlan = async (id: number, actionPlan: Partial<InsertActionPlan>) => {
  const res = await apiRequest('PUT', `/api/action-plans/${id}`, actionPlan);
  return await res.json();
};
