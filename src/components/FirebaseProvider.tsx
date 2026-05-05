import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Scheme, Overseer, Panchayat, Beneficiary, StockTransaction, Material, SystemUser } from '../types';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  schemes: Scheme[];
  overseers: Overseer[];
  panchayats: Panchayat[];
  beneficiaries: Beneficiary[];
  materials: Material[];
  transactions: StockTransaction[];
  systemUsers: SystemUser[];
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [overseers, setOverseers] = useState<Overseer[]>([]);
  const [panchayats, setPanchayats] = useState<Panchayat[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Real-time listeners for master data
    const unsubSchemes = onSnapshot(collection(db, 'schemes'), (snapshot) => {
      setSchemes(snapshot.docs.map(doc => ({ ...doc.data() as Scheme, id: doc.id })));
    });
    const unsubOverseers = onSnapshot(collection(db, 'overseers'), (snapshot) => {
      setOverseers(snapshot.docs.map(doc => ({ ...doc.data() as Overseer, id: doc.id })));
    });
    const unsubPanchayats = onSnapshot(collection(db, 'panchayats'), (snapshot) => {
      setPanchayats(snapshot.docs.map(doc => ({ ...doc.data() as Panchayat, id: doc.id })));
    });
    const unsubBeneficiaries = onSnapshot(collection(db, 'beneficiaries'), (snapshot) => {
      setBeneficiaries(snapshot.docs.map(doc => ({ ...doc.data() as Beneficiary, id: doc.id })));
    });
    const unsubMaterials = onSnapshot(collection(db, 'materials'), (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ ...doc.data() as Material, id: doc.id })));
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setSystemUsers(snapshot.docs.map(doc => ({ ...doc.data() as SystemUser, id: doc.id })));
    });

    // For transactions, we might want to limit or filter, but for now we'll get the last 1000
    const transactionsQuery = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(1000));
    const unsubTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ ...doc.data() as StockTransaction, id: doc.id })));
    });

    return () => {
      unsubSchemes();
      unsubOverseers();
      unsubPanchayats();
      unsubBeneficiaries();
      unsubMaterials();
      unsubUsers();
      unsubTransactions();
    };
  }, [user]);

  return (
    <FirebaseContext.Provider value={{ 
      user, loading, schemes, overseers, panchayats, 
      beneficiaries, materials, transactions, systemUsers 
    }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
