/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LayoutDashboard, Database, ClipboardList, BookOpen, BarChart3, Menu, X, LogOut, Shield, Package, User, Lock, ChevronRight } from 'lucide-react';
import MasterData from './components/MasterData';
import StockEntry from './components/StockEntry';
import StockView from './components/StockView';
import Reports from './components/Reports';
import DashboardOverview from './components/DashboardOverview';
import UserManagement from './components/UserManagement';
import { motion, AnimatePresence } from 'motion/react';
import { StockTransaction, SystemUser } from './types';
import { FirebaseProvider, useFirebase } from './components/FirebaseProvider';
import { Storage } from './lib/storage';
import { auth, db } from './lib/firebase';
import { signInAnonymously } from 'firebase/auth';

type Tab = 'dashboard' | 'master' | 'entry' | 'view' | 'reports' | 'users';

function AppContent() {
  const { user, loading, systemUsers } = useFirebase();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [editingTransaction, setEditingTransaction] = useState<StockTransaction | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [showSignup, setShowSignup] = useState(false);
  const [signupData, setSignupData] = useState({ username: '', password: '' });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure we are "signed in" to Firebase to interact with Firestore
    if (!user) {
      await signInAnonymously(auth);
    }

    if (credentials.username === 'admin' && credentials.password === 'admin123') {
      setIsLoggedIn(true);
      setCurrentUser({ id: 'admin', username: 'admin', role: 'ADMIN', status: 'APPROVED', requestedAt: new Date().toISOString() });
      return;
    }

    if (credentials.username === 'viewer' && credentials.password === 'viewer123') {
      setIsLoggedIn(true);
      setCurrentUser({ id: 'viewer', username: 'viewer', role: 'USER', status: 'APPROVED', requestedAt: new Date().toISOString() });
      return;
    }

    const targetUser = systemUsers.find(u => u.username === credentials.username && (u as any).password === credentials.password);
    
    if (targetUser) {
      if (targetUser.status === 'APPROVED') {
        setIsLoggedIn(true);
        setCurrentUser(targetUser);
      } else if (targetUser.status === 'PENDING') {
        alert('Your access request is still pending admin approval.');
      } else {
        alert('Access request denied by administrator.');
      }
    } else {
      alert('Invalid username or password');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      await signInAnonymously(auth);
    }

    if (systemUsers.find(u => u.username === signupData.username)) {
      alert('Username already taken.');
      return;
    }
    const newUser: SystemUser = {
      id: Storage.generateId(),
      username: signupData.username,
      status: 'PENDING',
      role: 'USER',
      requestedAt: new Date().toISOString()
    };
    // Include password in Firestore for this simple migration (In real apps, use Firebase Auth passwords)
    await Storage.setUserData({ ...newUser, password: signupData.password } as any);
    alert('Access request submitted! Contact admin for approval.');
    setShowSignup(false);
    setSignupData({ username: '', password: '' });
  };


  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveTab('dashboard');
    setCredentials({ username: '', password: '' });
  };

  (window as any).ais_edit_tx = (tx: StockTransaction) => {
    setEditingTransaction(tx);
    setActiveTab('entry');
  };

  const isAdmin = currentUser?.role === 'ADMIN';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ...(isAdmin ? [{ id: 'master', label: 'Master Data', icon: Database }] : []),
    ...(isAdmin ? [{ id: 'entry', label: 'Stock Transaction', icon: ClipboardList }] : []),
    { id: 'view', label: 'Stock Register', icon: BookOpen },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    ...(isAdmin ? [{ id: 'users', label: 'User Admin', icon: Shield }] : []),
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border border-white/10"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white font-black text-3xl mx-auto mb-4 shadow-2xl shadow-blue-600/30">SR</div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase tracking-[0.2em]">Stock Registry</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.1em] mt-2">Authorized Access Only</p>
          </div>

          {showSignup ? (
            <form onSubmit={handleSignup} className="space-y-6">
               <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-4">Request Credentials</h2>
               <div className="space-y-4">
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                   <input 
                     type="text" 
                     required
                     className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 font-bold text-slate-700"
                     placeholder="Pick a username"
                     value={signupData.username || ''}
                     onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                   />
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                   <input 
                     type="password" 
                     required
                     className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 font-bold text-slate-700"
                     placeholder="••••••••"
                     value={signupData.password || ''}
                     onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                   />
                 </div>
               </div>
               <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95">Send Approval Request</button>
               <button type="button" onClick={() => setShowSignup(false)} className="w-full text-[9px] font-black uppercase text-slate-400 tracking-widest hover:text-slate-900 transition-colors">Already registered? Log in</button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all font-bold text-slate-700"
                  placeholder="Enter username"
                  value={credentials.username || ''}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <input 
                  type="password" 
                  required
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all font-bold text-slate-700"
                  placeholder="••••••••"
                  value={credentials.password || ''}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                />
              </div>
              <div className="pt-2 flex flex-col gap-4">
                <button 
                  type="submit"
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 hover:bg-black transition-all transform active:scale-95 flex items-center justify-center gap-3"
                >
                  Launch Portal
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowSignup(true)}
                  className="w-full text-[9px] font-black uppercase text-blue-600 tracking-widest hover:underline transition-colors"
                >
                  Request New Account Approval
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-[9px] text-slate-400 mt-10 leading-relaxed font-black uppercase tracking-[0.2em] opacity-50">
            Secure Infrastructure Protocol <br/>
            Central Asset Control v4.0
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <aside 
        className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white transition-all duration-300 flex flex-col shadow-xl z-20`}
      >
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-tight text-blue-400">STOCK REGISTRY</h1>
          {isSidebarOpen && <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">Infrastructure Management</p>}
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-4 overflow-y-auto">
          {isSidebarOpen && <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 px-3">Main Menu</div>}
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}`} />
              {isSidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          ))}
          
          <div className="pt-4 mt-4 border-t border-slate-800">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-red-400 hover:bg-red-500/10 hover:text-red-300`}
            >
              <LogOut className="w-5 h-5 flex-shrink-0 text-red-500 opacity-50 group-hover:opacity-100" />
              {isSidebarOpen && <span className="text-sm font-black uppercase tracking-widest">Exit Portal</span>}
            </button>
          </div>
        </nav>

        <div className="p-4 bg-slate-800/50 border-t border-slate-700">
          <div className="flex items-center justify-between">
            {isSidebarOpen && (
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Fiscal Year</div>
                <div className="text-xs font-bold text-slate-200">{new Date().getFullYear()} - {new Date().getFullYear() + 1}</div>
              </div>
            )}
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-700 transition"
            >
              {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm shrink-0 z-10">
          <div className="flex items-center gap-4">
             <h1 className="text-sm font-black text-slate-700 uppercase tracking-[0.2em]">
              {menuItems.find(m => m.id === activeTab)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:block text-right border-r pr-6 border-slate-100">
               <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Live Session</p>
               <p className={`text-xs font-bold ${isAdmin ? 'text-blue-600' : 'text-slate-500'}`}>{isAdmin ? 'Administrator Access' : 'Viewer Access'}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full ${isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'} flex items-center justify-center text-xs font-bold`}>
                {currentUser?.username.substring(0, 2).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          <div className="max-w-7xl mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'dashboard' && <DashboardOverview onNavigate={setActiveTab} isAdmin={isAdmin} />}
                {activeTab === 'master' && <MasterData isAdmin={isAdmin} />}
                {activeTab === 'entry' && isAdmin && (
                  <div className="relative">
                    {editingTransaction && (
                      <div className="bg-blue-600 text-white px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] flex justify-between items-center z-20 shadow-xl rounded-b-xl animate-in slide-in-from-top duration-300">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
                          Editing Record ID: {editingTransaction.id.slice(0, 8)}...
                        </div>
                        <button onClick={() => setEditingTransaction(null)} className="bg-white/20 px-3 py-1 rounded hover:bg-white/30 transition">Discard Changes</button>
                      </div>
                    )}
                    <StockEntry 
                      editData={editingTransaction} 
                      onComplete={() => setEditingTransaction(null)} 
                      isAdmin={isAdmin}
                    />
                  </div>
                )}
                {activeTab === 'view' && <StockView isAdmin={isAdmin} />}
                {activeTab === 'reports' && (
                  <Reports 
                    onEdit={(tx) => {
                      if (isAdmin) {
                        setEditingTransaction(tx);
                        setActiveTab('entry');
                      }
                    }} 
                    isAdmin={isAdmin}
                  />
                )}
                {activeTab === 'users' && isAdmin && <UserManagement />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <AppContent />
    </FirebaseProvider>
  );
}
