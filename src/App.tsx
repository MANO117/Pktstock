/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Database, ClipboardList, BookOpen, BarChart3, Menu, X, LogOut, Shield, Package, LogIn, ChevronRight, UserCheck } from 'lucide-react';
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
import { auth, signInWithGoogle, signInAsGuest } from './lib/firebase';

type Tab = 'dashboard' | 'master' | 'entry' | 'view' | 'reports' | 'users';

function AppContent() {
  const { user, loading, dataLoading, isApproved, currentUser, systemUsers } = useFirebase();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [editingTransaction, setEditingTransaction] = useState<StockTransaction | null>(null);
  const [manualCredentials, setManualCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
      alert('Failed to sign in with Google');
    }
  };

  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Effect to handle manual login validation after data arrives
  useEffect(() => {
    const checkManualEscalation = async () => {
      const pendingManual = localStorage.getItem('pending_manual_login');
      if (pendingManual && user && systemUsers.length > 0) {
         const { username, password } = JSON.parse(pendingManual);
         const targetUser = systemUsers.find(u => 
            u.username.toLowerCase() === username.toLowerCase() && 
            u.password === password
         );
  
         if (targetUser) {
            if (targetUser.status === 'APPROVED') {
               try {
                  // Escalation: Sync the current UID record with the target account's status/role
                  await Storage.setUserData({
                    id: user.uid,
                    role: targetUser.role,
                    status: 'APPROVED',
                    username: targetUser.username,
                    requestedAt: new Date().toISOString()
                  });
                  localStorage.setItem('manual_user_id', targetUser.id);
                  localStorage.removeItem('pending_manual_login');
                  setIsAuthenticating(false);
               } catch (err) {
                  console.error('Escalation failed:', err);
                  setLoginError('Verification failed. Your account may not have permission to sync.');
                  setIsAuthenticating(false);
               }
            } else {
               setLoginError(`Account status: ${targetUser.status}`);
               localStorage.removeItem('pending_manual_login');
               if (user.isAnonymous) auth.signOut();
               setIsAuthenticating(false);
            }
         } else {
            setLoginError('Invalid username or password');
            localStorage.removeItem('pending_manual_login');
            if (user.isAnonymous) auth.signOut();
            setIsAuthenticating(false);
         }
      }
    };

    checkManualEscalation();
  }, [user, systemUsers]);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsAuthenticating(true);
    
    // Store credentials temporarily
    localStorage.setItem('pending_manual_login', JSON.stringify(manualCredentials));
    
    if (!user) {
       // Force Google login first if not authenticated at all
       try {
         await handleGoogleLogin();
       } catch (err) {
         setLoginError('Authentication failed. Please use Google Sign-In.');
         setIsAuthenticating(false);
       }
       return;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('manual_user_id');
    auth.signOut();
    setActiveTab('dashboard');
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

  if (loading || (user && dataLoading)) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || !isApproved) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
        >
          <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-10 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-2xl mb-6 backdrop-blur-md border border-white/20 shadow-2xl">
                <Package className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Stock Pro</h1>
              <p className="text-blue-100/70 text-[10px] font-black uppercase tracking-[0.2em]">Infrastructure Asset Control</p>
            </div>
          </div>
          
          <div className="p-10">
            {user && isApproved ? (
              <div className="text-center">
                <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-emerald-100 shadow-sm">
                  <UserCheck className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Identity Verified</h2>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                  Welcome back, <span className="text-slate-900 font-bold">{currentUser?.username}</span>. Your access to the central stock registry is active.
                </p>
                <div className="animate-pulse flex items-center justify-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                  Redirecting to Dashboard...
                </div>
              </div>
            ) : user ? (
              <div className="p-10 space-y-6">
                <div className="text-center">
                  <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-100 shadow-sm text-amber-500">
                    <Shield className="w-10 h-10" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Syncing Required</h2>
                  <p className="text-slate-500 text-xs mb-6 leading-relaxed">
                    Account: <span className="text-slate-900 font-bold">{user.email || 'Guest Session'}</span>. 
                    Verify internal credentials to access the registry.
                  </p>
                </div>

                <form onSubmit={handleManualLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <input 
                      type="text" 
                      required
                      className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-all font-bold text-slate-700 text-sm"
                      placeholder="Username"
                      value={manualCredentials.username}
                      onChange={(e) => setManualCredentials({ ...manualCredentials, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <input 
                      type="password" 
                      required
                      className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-all font-bold text-slate-700 text-sm"
                      placeholder="Password"
                      value={manualCredentials.password}
                      onChange={(e) => setManualCredentials({ ...manualCredentials, password: e.target.value })}
                    />
                  </div>
                  {loginError && <p className="text-red-500 text-[10px] font-black uppercase text-center">{loginError}</p>}
                  <button 
                    type="submit"
                    disabled={isAuthenticating}
                    className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                  >
                    {isAuthenticating ? 'Syncing...' : 'Verify Credentials'}
                  </button>
                </form>

                <div className="pt-4 border-t border-slate-100">
                  <button 
                    onClick={handleLogout}
                    className="w-full text-slate-400 hover:text-slate-600 font-black text-[10px] uppercase tracking-widest py-2"
                  >
                    Switch Account
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2">Internal Portal</h2>
                  <p className="text-slate-400 text-xs font-medium">Authentication Required</p>
                </div>
                
                <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center leading-relaxed">
                    Access is restricted to authorized personnel. Please verify your identity using corporate SSO.
                  </p>
                </div>

                <button
                  onClick={handleGoogleLogin}
                  className="w-full bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-900/20 active:scale-95 group hover:bg-black"
                >
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all" />
                  <span>Authorize with Google</span>
                </button>

                <div className="text-center">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                    Infrastructure Asset Control System v2.0
                  </p>
                </div>
              </div>
            )}
          </div>
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
