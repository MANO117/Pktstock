import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Storage } from '../lib/storage';
import { Scheme, Overseer, Panchayat, Beneficiary, StockTransaction, Material, SystemUser } from '../types';

interface DataContextType {
  user: any | null;
  loading: boolean;
  schemes: Scheme[];
  overseers: Overseer[];
  panchayats: Panchayat[];
  beneficiaries: Beneficiary[];
  materials: Material[];
  transactions: StockTransaction[];
  systemUsers: SystemUser[];
  isApproved: boolean;
  currentUser: SystemUser | null;
  dataLoading: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [overseers, setOverseers] = useState<Overseer[]>([]);
  const [panchayats, setPanchayats] = useState<Panchayat[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);

  const isApproved = user?.status === 'APPROVED';
  const currentUser = user;

  const refreshData = useCallback(async () => {
    try {
      const data = await Storage.getAllData();
      setSchemes(data.schemes || []);
      setOverseers(data.overseers || []);
      setPanchayats(data.panchayats || []);
      setBeneficiaries(data.beneficiaries || []);
      setMaterials(data.materials || []);
      setTransactions(data.transactions || []);
      setSystemUsers(data.users || []);
      
      // Cache data for faster initial load next time
      localStorage.setItem('cached_stock_pro_data', JSON.stringify(data));
      
      // Update local user state if changed in backend
      if (user) {
        const updatedUser = data.users.find((u: any) => u.id === user.id);
        if (updatedUser) {
          setUser(updatedUser);
          localStorage.setItem('app_user', JSON.stringify(updatedUser));
        }
      }
    } catch (e) {
      console.error("Failed to fetch data", e);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const savedUser = localStorage.getItem('app_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    // Try to load cached data for instant appearance
    const cachedDataString = localStorage.getItem('cached_stock_pro_data');
    if (cachedDataString) {
      const data = JSON.parse(cachedDataString);
      setSchemes(data.schemes || []);
      setOverseers(data.overseers || []);
      setPanchayats(data.panchayats || []);
      setBeneficiaries(data.beneficiaries || []);
      setMaterials(data.materials || []);
      setTransactions(data.transactions || []);
      setSystemUsers(data.users || []);
      setDataLoading(false); // We have cached data, don't block
    }

    setLoading(false);
    refreshData();
    
    const interval = setInterval(refreshData, 15000); // Relaxed poll interval to 15s instead of 5s
    return () => clearInterval(interval);
  }, []);

  const login = async (credentials: any) => {
    const result = await Storage.login(credentials);
    if (result.success) {
      setUser(result.user);
      localStorage.setItem('app_user', JSON.stringify(result.user));
      await refreshData();
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('app_user');
  };

  return (
    <DataContext.Provider value={{ 
      user, loading, schemes, overseers, panchayats, 
      beneficiaries, materials, transactions, systemUsers,
      isApproved,
      currentUser,
      dataLoading,
      login,
      logout,
      refreshData
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
