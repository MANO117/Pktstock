import { Scheme, Overseer, Panchayat, Beneficiary, StockTransaction, MaterialType, SystemUser, Material } from '../types';
import { isSameDay, parseISO, startOfDay, subDays, endOfDay } from 'date-fns';

const API_BASE = '/api';

// Persistence logic that handles both API and LocalStorage
const Engine = {
  isLocal: false,

  getMode() {
    return this.isLocal ? 'LocalStorage' : 'Backend API';
  },

  async request(path: string, options: any = {}) {
    if (this.isLocal) return this.localRequest(path, options);

    try {
      const res = await fetch(`${API_BASE}${path}`, options);
      if (res.status === 404 || res.status === 504 || res.status === 405) {
        console.warn('API unavailable or method blocked, falling back to LocalStorage');
        this.isLocal = true;
        return this.localRequest(path, options);
      }
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Server error');
      }
      return res.json();
    } catch (e: any) {
      if (e.message.includes('fetch') || e.message.includes('Network') || e.message.includes('Failed to fetch')) {
        console.warn('Network error, falling back to LocalStorage');
        this.isLocal = true;
        return this.localRequest(path, options);
      }
      throw e;
    }
  },

  localRequest(path: string, options: any) {
    const rawData = localStorage.getItem('stock_pro_db');
    let data = rawData ? JSON.parse(rawData) : {
      users: [{ id: 'admin-001', username: 'admin', fullName: 'Demo Admin', password: 'admin', role: 'ADMIN', status: 'APPROVED' }],
      materials: [], schemes: [], overseers: [], panchayats: [], beneficiaries: [], transactions: []
    };

    const save = () => localStorage.setItem('stock_pro_db', JSON.stringify(data));

    if (path === '/login' && options.method === 'POST') {
      const { username, password } = JSON.parse(options.body);
      const user = data.users.find((u: any) => u.username.toLowerCase() === username.toLowerCase() && String(u.password) === String(password));
      if (!user) {
        console.error('Local Login Failed: User not found or password mismatch', { providedUsername: username });
        throw new Error('Invalid username or password (Local Mode)');
      }
      if (user.status !== 'APPROVED') throw new Error(`Access Denied: Account status is ${user.status}`);
      return { success: true, user };
    }

    if (path === '/register' && options.method === 'POST') {
      const newUser = JSON.parse(options.body);
      if (data.users.find((u: any) => u.username.toLowerCase() === newUser.username.toLowerCase())) throw new Error('User exists');
      data.users.push({ ...newUser, id: Date.now().toString(), status: 'PENDING', role: 'USER' });
      save();
      return { success: true };
    }

    if (path === '/data') return data;

    // Handle generic CRUD
    const parts = path.split('/');
    const collection = parts[1];
    const id = parts[2];

    if (options.method === 'POST') {
      const item = JSON.parse(options.body);
      const index = data[collection].findIndex((i: any) => i.id === item.id);
      if (index >= 0) data[collection][index] = item;
      else data[collection].push(item);
    } else if (options.method === 'PATCH') {
      const updates = JSON.parse(options.body);
      const index = data[collection].findIndex((i: any) => i.id === id);
      if (index >= 0) data[collection][index] = { ...data[collection][index], ...updates };
    } else if (options.method === 'DELETE') {
      data[collection] = data[collection].filter((i: any) => i.id !== id);
    }
    
    save();
    return { success: true };
  }
};

export const Storage = {
  // Auth Operations
  login: (credentials: any) => Engine.request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  }),

  register: (user: any) => Engine.request('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  }),

  getAllData: () => Engine.request('/data'),

  // Master Data Write Operations
  setMaterial: (data: Material) => Engine.request('/materials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  deleteMaterial: (id: string) => Engine.request(`/materials/${id}`, { method: 'DELETE' }),

  setScheme: (data: Scheme) => Engine.request('/schemes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  deleteScheme: (id: string) => Engine.request(`/schemes/${id}`, { method: 'DELETE' }),
  
  setOverseer: (data: Overseer) => Engine.request('/overseers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  deleteOverseer: (id: string) => Engine.request(`/overseers/${id}`, { method: 'DELETE' }),
  
  setPanchayat: (data: Panchayat) => Engine.request('/panchayats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  deletePanchayat: (id: string) => Engine.request(`/panchayats/${id}`, { method: 'DELETE' }),
  
  setBeneficiary: (data: Beneficiary) => Engine.request('/beneficiaries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  deleteBeneficiary: (id: string) => Engine.request(`/beneficiaries/${id}`, { method: 'DELETE' }),
  
  setTransaction: (data: StockTransaction) => Engine.request('/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  deleteTransaction: (id: string) => Engine.request(`/transactions/${id}`, { method: 'DELETE' }),

  calculateDailyBalance: (material: MaterialType, targetDate: string, transactions: StockTransaction[]) => {
    const targetDateObj = parseISO(targetDate);
    const targetStart = startOfDay(targetDateObj);
    const targetEnd = endOfDay(targetDateObj);
    
    let openingBalance = 0;
    let receipts = 0;
    let issues = 0;

    for (const t of transactions) {
      if (t.material !== material) continue;
      
      const tDate = parseISO(t.date);
      const amount = t.type === 'RECEIPT' ? t.quantity : -t.quantity;

      if (tDate < targetStart) {
        openingBalance += amount;
      } else if (tDate <= targetEnd) {
        if (t.type === 'RECEIPT') receipts += t.quantity;
        else issues += t.quantity;
      }
    }
    
    return {
      openingBalance,
      receipts,
      issues,
      closingBalance: openingBalance + receipts - issues
    };
  },

  getStockBalance: (material: MaterialType, transactions: StockTransaction[]): number => {
    const matTransactions = transactions.filter(t => t.material === material);
    return matTransactions.reduce((acc, t) => acc + (t.type === 'RECEIPT' ? t.quantity : -t.quantity), 0);
  },

  setUserData: (data: SystemUser) => Engine.request('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  
  updateUser: (userId: string, data: Partial<SystemUser>) => Engine.request(`/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),

  deleteUser: (userId: string) => Engine.request(`/users/${userId}`, { method: 'DELETE' }),
  
  approveUser: (userId: string) => Engine.request(`/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'APPROVED' })
  }),
  
  rejectUser: (userId: string) => Engine.request(`/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'REJECTED' })
  }),

  generateId: (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  },

  getEngineMode: () => Engine.getMode()
};

