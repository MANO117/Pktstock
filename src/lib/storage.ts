import { Scheme, Overseer, Panchayat, Beneficiary, StockTransaction, MaterialType, SystemUser, Material } from '../types';
import { isSameDay, parseISO, startOfDay, subDays } from 'date-fns';

const API_BASE = '/api';

export const Storage = {
  // Auth Operations
  login: async (credentials: any) => {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Login failed');
    }
    return res.json();
  },

  register: async (user: any) => {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Registration failed');
    }
    return res.json();
  },

  getAllData: async () => {
    const res = await fetch(`${API_BASE}/data`);
    return res.json();
  },

  // Master Data Write Operations
  setMaterial: async (data: Material) => {
    await fetch(`${API_BASE}/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  deleteMaterial: async (id: string) => {
    await fetch(`${API_BASE}/materials/${id}`, { method: 'DELETE' });
  },

  setScheme: async (data: Scheme) => {
    await fetch(`${API_BASE}/schemes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  deleteScheme: async (id: string) => {
    await fetch(`${API_BASE}/schemes/${id}`, { method: 'DELETE' });
  },
  
  setOverseer: async (data: Overseer) => {
    await fetch(`${API_BASE}/overseers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  deleteOverseer: async (id: string) => {
    await fetch(`${API_BASE}/overseers/${id}`, { method: 'DELETE' });
  },
  
  setPanchayat: async (data: Panchayat) => {
    await fetch(`${API_BASE}/panchayats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  deletePanchayat: async (id: string) => {
    await fetch(`${API_BASE}/panchayats/${id}`, { method: 'DELETE' });
  },
  
  setBeneficiary: async (data: Beneficiary) => {
    await fetch(`${API_BASE}/beneficiaries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  deleteBeneficiary: async (id: string) => {
    await fetch(`${API_BASE}/beneficiaries/${id}`, { method: 'DELETE' });
  },
  
  setTransaction: async (data: StockTransaction) => {
    await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  deleteTransaction: async (id: string) => {
    await fetch(`${API_BASE}/transactions/${id}`, { method: 'DELETE' });
  },

  calculateDailyBalance: (material: MaterialType, targetDate: string, transactions: StockTransaction[]) => {
    const matTransactions = transactions.filter(t => t.material === material);
    
    const getBalanceAtEndOf = (dateIso: string) => {
      const dayEnd = parseISO(dateIso);
      return matTransactions
        .filter(t => parseISO(t.date) <= dayEnd)
        .reduce((acc, t) => acc + (t.type === 'RECEIPT' ? t.quantity : -t.quantity), 0);
    };

    const targetStart = startOfDay(parseISO(targetDate));
    const yesterday = subDays(targetStart, 1);
    
    const openingBalance = getBalanceAtEndOf(yesterday.toISOString());
    const dayTransactions = matTransactions.filter(t => isSameDay(parseISO(t.date), targetStart));
    
    const receipts = dayTransactions.filter(t => t.type === 'RECEIPT').reduce((acc, t) => acc + t.quantity, 0);
    const issues = dayTransactions.filter(t => t.type === 'ISSUE').reduce((acc, t) => acc + t.quantity, 0);
    const closingBalance = openingBalance + receipts - issues;

    return { openingBalance, receipts, issues, closingBalance };
  },

  getStockBalance: (material: MaterialType, transactions: StockTransaction[]): number => {
    const matTransactions = transactions.filter(t => t.material === material);
    return matTransactions.reduce((acc, t) => acc + (t.type === 'RECEIPT' ? t.quantity : -t.quantity), 0);
  },

  setUserData: async (data: SystemUser) => {
    await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  
  updateUser: async (userId: string, data: Partial<SystemUser>) => {
    await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  deleteUser: async (userId: string) => {
    await fetch(`${API_BASE}/users/${userId}`, { method: 'DELETE' });
  },
  
  approveUser: async (userId: string) => {
    await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED' })
    });
  },
  
  rejectUser: async (userId: string) => {
    await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REJECTED' })
    });
  },

  generateId: (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
};

