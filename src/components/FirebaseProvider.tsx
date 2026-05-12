import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Storage } from '../lib/storage';
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
  isApproved: boolean;
  currentUser: SystemUser | null;
  dataLoading: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [overseers, setOverseers] = useState<Overseer[]>([]);
  const [panchayats, setPanchayats] = useState<Panchayat[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);

  const currentUserProfile = useMemo(() => {
    if (!user) return null;
    const manualId = localStorage.getItem('manual_user_id');
    const targetId = (user.isAnonymous && manualId) ? manualId : user.uid;
    return systemUsers.find(u => u.id === targetId);
  }, [systemUsers, user]);
  
  const isApproved = currentUserProfile?.status === 'APPROVED';

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (u) {
        // Boostrap check
        const isOwner = u.email === 'ranjanmano11795@gmail.com';
        // We check if we need to create the record if it doesn't exist yet
        // Since systemUsers might be empty, we just try to set it if it's the owner
        // or if it's a new user. Storage.setUserData checks if document exists if needed,
        // but here we can just do a firestore check.
        // Actually, App.tsx already has this logic, let's just make it more robust.
      }
      
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Listener for Users - allowed for all signed in users
  useEffect(() => {
    if (!user) {
      setSystemUsers([]);
      return;
    }

    const unsubUsers = onSnapshot(
      collection(db, 'users'), 
      (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ ...doc.data() as SystemUser, id: doc.id }));
        setSystemUsers(usersData);
        setDataLoading(false);
        
        // Auto-bootstrap logic when users list arrives
        const hasAdmin = usersData.find(u => u.username === 'admin');
        const hasViewer = usersData.find(u => u.username === 'viewer');
        
        if (!hasAdmin || !hasViewer) {
           // Only seed if we are authenticated (otherwise rules block)
           if (user) {
              const isOwner = user.email === 'ranjanmano11795@gmail.com';
              // If the owner is logged in, they have permission to seed these
              if (isOwner) {
                if (!hasAdmin) {
                  const defaultAdmin: SystemUser = {
                    id: 'admin-001',
                    username: 'admin',
                    password: 'admin123',
                    role: 'ADMIN',
                    status: 'APPROVED',
                    requestedAt: new Date().toISOString()
                  };
                  Storage.setUserData(defaultAdmin);
                }
                if (!hasViewer) {
                  const defaultViewer: SystemUser = {
                    id: 'viewer-001',
                    username: 'viewer',
                    password: 'viewer123',
                    role: 'USER',
                    status: 'APPROVED',
                    requestedAt: new Date().toISOString()
                  };
                  Storage.setUserData(defaultViewer);
                }
              }
           }
        }

        if (user) {
          const exists = usersData.find(u => u.id === user.uid);
          if (!exists) {
            const isOwner = user.email === 'ranjanmano11795@gmail.com';
            const newUser: SystemUser = {
                id: user.uid,
                username: user.displayName || user.email?.split('@')[0] || 'User',
                status: isOwner ? 'APPROVED' : 'PENDING',
                role: isOwner ? 'ADMIN' : 'USER',
                requestedAt: new Date().toISOString()
            };
            Storage.setUserData(newUser);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
        setDataLoading(false);
      }
    );

    return () => unsubUsers();
  }, [user]);

  // Restricted data listeners - only start when isApproved is true
  useEffect(() => {
    if (!user || !isApproved) {
      // Clear data if no user or not approved
      setSchemes([]);
      setOverseers([]);
      setPanchayats([]);
      setBeneficiaries([]);
      setMaterials([]);
      setTransactions([]);
      return;
    }

    const unsubSchemes = onSnapshot(
      collection(db, 'schemes'), 
      (snapshot) => setSchemes(snapshot.docs.map(doc => ({ ...doc.data() as Scheme, id: doc.id }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'schemes')
    );
    const unsubOverseers = onSnapshot(
      collection(db, 'overseers'), 
      (snapshot) => setOverseers(snapshot.docs.map(doc => ({ ...doc.data() as Overseer, id: doc.id }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'overseers')
    );
    const unsubPanchayats = onSnapshot(
      collection(db, 'panchayats'), 
      (snapshot) => setPanchayats(snapshot.docs.map(doc => ({ ...doc.data() as Panchayat, id: doc.id }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'panchayats')
    );
    const unsubBeneficiaries = onSnapshot(
      collection(db, 'beneficiaries'), 
      (snapshot) => setBeneficiaries(snapshot.docs.map(doc => ({ ...doc.data() as Beneficiary, id: doc.id }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'beneficiaries')
    );
    const unsubMaterials = onSnapshot(
      collection(db, 'materials'), 
      (snapshot) => setMaterials(snapshot.docs.map(doc => ({ ...doc.data() as Material, id: doc.id }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'materials')
    );

    const transactionsQuery = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(1000));
    const unsubTransactions = onSnapshot(
      transactionsQuery, 
      (snapshot) => setTransactions(snapshot.docs.map(doc => ({ ...doc.data() as StockTransaction, id: doc.id }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'transactions')
    );

    return () => {
      unsubSchemes();
      unsubOverseers();
      unsubPanchayats();
      unsubBeneficiaries();
      unsubMaterials();
      unsubTransactions();
    };
  }, [user, isApproved]);

  return (
    <FirebaseContext.Provider value={{ 
      user, loading, schemes, overseers, panchayats, 
      beneficiaries, materials, transactions, systemUsers,
      isApproved,
      currentUser: currentUserProfile || null,
      dataLoading
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
