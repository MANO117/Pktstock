import { Scheme, Overseer, Panchayat, Beneficiary, StockTransaction, MaterialType, SystemUser, Material } from '../types';
import { format, isSameDay, parseISO, startOfDay, subDays } from 'date-fns';
import { db } from './firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

export const Storage = {
  // Master Data Write Operations
  setMaterial: async (data: Material) => {
    await setDoc(doc(db, 'materials', data.id), data);
  },
  deleteMaterial: async (id: string) => {
    await deleteDoc(doc(db, 'materials', id));
  },

  setScheme: async (data: Scheme) => {
    await setDoc(doc(db, 'schemes', data.id), data);
  },
  deleteScheme: async (id: string) => {
    await deleteDoc(doc(db, 'schemes', id));
  },
  
  setOverseer: async (data: Overseer) => {
    await setDoc(doc(db, 'overseers', data.id), data);
  },
  deleteOverseer: async (id: string) => {
    await deleteDoc(doc(db, 'overseers', id));
  },
  
  setPanchayat: async (data: Panchayat) => {
    await setDoc(doc(db, 'panchayats', data.id), data);
  },
  deletePanchayat: async (id: string) => {
    await deleteDoc(doc(db, 'panchayats', id));
  },
  
  setBeneficiary: async (data: Beneficiary) => {
    await setDoc(doc(db, 'beneficiaries', data.id), data);
  },
  deleteBeneficiary: async (id: string) => {
    await deleteDoc(doc(db, 'beneficiaries', id));
  },
  
  setTransaction: async (data: StockTransaction) => {
    await setDoc(doc(db, 'transactions', data.id), data);
  },
  deleteTransaction: async (id: string) => {
    await deleteDoc(doc(db, 'transactions', id));
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
    await setDoc(doc(db, 'users', data.id), data);
  },
  
  approveUser: async (userId: string) => {
    await updateDoc(doc(db, 'users', userId), { status: 'APPROVED' });
  },
  
  rejectUser: async (userId: string) => {
    await updateDoc(doc(db, 'users', userId), { status: 'REJECTED' });
  },

  generateId: (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
};

