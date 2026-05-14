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
import { Scheme, Overseer, Panchayat, Beneficiary, StockTransaction, Material, SystemUser } from './types';
import { DataProvider, useData } from './components/DataProvider';
import { Storage } from './lib/storage';

type Tab = 'dashboard' | 'master' | 'entry' | 'view' | 'reports' | 'users';

function AppContent() {
  const { user, loading, dataLoading, isApproved, currentUser, systemUsers, login, logout, refreshData } = useData();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [editingTransaction, setEditingTransaction] = useState<StockTransaction | null>(null);
  const [manualCredentials, setManualCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regFormData, setRegFormData] = useState({ username: '', password: '', fullName: '' });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsAuthenticating(true);
    try {
      await Storage.register(regFormData);
      setIsRegistering(false);
      setLoginError('Registration successful. Awaiting admin approval.');
    } catch (err: any) {
      setLoginError(err.message || 'Registration failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsAuthenticating(true);
    
    try {
      await login(manualCredentials);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    logout();
    setActiveTab('dashboard');
  };

  (window as any).ais_edit_tx = (tx: StockTransaction) => {
    setEditingTransaction(tx);
    setActiveTab('entry');
  };

  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-100 to-slate-200">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] w-full max-w-md overflow-hidden border border-white"
        >
          <div className="bg-slate-900 p-10 text-center relative">
            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-2xl mb-6 shadow-lg shadow-blue-500/20">
                <Package className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">Stock Pro</h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Registry Management v3.0</p>
            </div>
          </div>
          
          <div className="p-10 space-y-8">
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {user ? 'Awaiting Approval' : (isRegistering ? 'Create Account' : 'Welcome Back')}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                {user ? 'Your account is pending administrator review' : (isRegistering ? 'Register your credentials' : 'Login to access the registry')}
              </p>
            </div>

            {user && !isApproved ? (
              <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
                  <UserCheck className="w-8 h-8 text-blue-500 mx-auto mb-3" />
                  <p className="text-xs text-slate-600 font-bold uppercase tracking-tight">
                    Identity: {user.username}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    Access will be granted once the administrator verifies your account.
                  </p>
                </div>
                <button 
                  onClick={() => refreshData()}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all transform active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  Check Approval Status
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest py-2 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : isRegistering ? (
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    type="text" required
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500/50 transition-all text-sm font-medium"
                    placeholder="John Doe"
                    value={regFormData.fullName}
                    onChange={(e) => setRegFormData({ ...regFormData, fullName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                  <input 
                    type="text" required
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500/50 transition-all text-sm font-medium"
                    placeholder="johndoe"
                    value={regFormData.username}
                    onChange={(e) => setRegFormData({ ...regFormData, username: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                  <input 
                    type="password" required
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500/50 transition-all text-sm font-medium"
                    placeholder="••••••••"
                    value={regFormData.password}
                    onChange={(e) => setRegFormData({ ...regFormData, password: e.target.value })}
                  />
                </div>
                {loginError && <p className="text-red-500 text-[10px] font-bold uppercase tracking-tight text-center bg-red-50 py-2 rounded-lg">{loginError}</p>}
                <button 
                  type="submit"
                  disabled={isAuthenticating}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isAuthenticating ? 'Processing...' : 'Request Access'}
                </button>
                <button 
                  type="button"
                  onClick={() => { setIsRegistering(false); setLoginError(''); }}
                  className="w-full text-slate-400 hover:text-slate-600 font-bold text-[10px] uppercase tracking-widest"
                >
                  Back to Login
                </button>
              </form>
            ) : (
              <form onSubmit={handleManualLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                  <input 
                    type="text" required
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500/50 transition-all text-sm font-medium"
                    placeholder="admin"
                    value={manualCredentials.username}
                    onChange={(e) => setManualCredentials({ ...manualCredentials, username: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                  <input 
                    type="password" required
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500/50 transition-all text-sm font-medium"
                    placeholder="••••••••"
                    value={manualCredentials.password}
                    onChange={(e) => setManualCredentials({ ...manualCredentials, password: e.target.value })}
                  />
                </div>
                {loginError && (
                  <p className={`text-[10px] font-bold uppercase tracking-tight text-center py-2 rounded-lg ${loginError.includes('successful') ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                    {loginError}
                  </p>
                )}
                <button 
                  type="submit"
                  disabled={isAuthenticating}
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-slate-900/20 hover:bg-black transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isAuthenticating && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                  {isAuthenticating ? 'Verifying...' : 'Login to Dashboard'}
                </button>
                <div className="flex flex-col gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => { setIsRegistering(true); setLoginError(''); }}
                    className="w-full text-slate-400 hover:text-slate-600 font-bold text-[10px] uppercase tracking-widest"
                  >
                    Create new account
                  </button>
                  <p className="text-[10px] text-slate-400 text-center font-bold mt-4 bg-slate-50 py-2 rounded-lg border border-slate-100">
                    Admin Access (Test): <span className="text-blue-600">admin</span> / <span className="text-blue-600">admin</span>
                  </p>
                  <p className="text-[8px] text-slate-300 text-center uppercase tracking-tighter mt-2 opacity-50">
                    Engine Mode: {Storage.getEngineMode()}
                  </p>
                </div>
              </form>
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
        className={`${isSidebarOpen ? 'w-72' : 'w-24'} bg-eng-blue text-white transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex flex-col shadow-2xl z-50`}
      >
        <div className="p-8 pb-12 flex items-center justify-between overflow-hidden">
          <AnimatePresence mode="wait">
            {isSidebarOpen ? (
              <motion.div 
                key="logo-full"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-safety-yellow rounded-xl flex items-center justify-center shadow-lg shadow-safety-yellow/20">
                  <Package className="w-6 h-6 text-eng-blue" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-xl font-black tracking-tighter leading-none">CIVIL<span className="text-safety-yellow">PRO</span></h1>
                  <span className="text-[8px] font-black uppercase tracking-[0.4em] opacity-40 mt-1">Registry v3.0</span>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="logo-collapsed"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-10 h-10 bg-safety-yellow rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-safety-yellow/20"
              >
                <Package className="w-6 h-6 text-eng-blue" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`w-full relative flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group overflow-hidden ${activeTab === item.id ? 'bg-white/10 text-white shadow-xl inset-shadow-xs' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              {activeTab === item.id && (
                <motion.div 
                  layoutId="active-tab-indicator"
                  className="absolute left-0 w-1 h-6 bg-safety-yellow rounded-r-full"
                />
              )}
              <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110 ${activeTab === item.id ? 'text-safety-yellow' : 'text-slate-500 group-hover:text-slate-300'}`} />
              {isSidebarOpen && <span className="text-sm font-bold tracking-tight">{item.label}</span>}
            </button>
          ))}
          
          <div className="pt-8 mt-8 border-t border-white/5 px-4">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-4 py-3 rounded-2xl transition-all duration-300 group text-slate-400 hover:text-red-400`}
            >
              <LogOut className="w-5 h-5 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
              {isSidebarOpen && <span className="text-xs font-black uppercase tracking-widest text-left">Disconnect</span>}
            </button>
          </div>
        </nav>

        <div className="p-6">
          <div 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center cursor-pointer transition-all active:scale-95 group"
          >
            <AnimatePresence mode="wait">
              {isSidebarOpen ? (
                <motion.div key="chevron-left" initial={{ rotate: 180 }} animate={{ rotate: 0 }}>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white rotate-180" />
                </motion.div>
              ) : (
                <motion.div key="chevron-right" initial={{ rotate: 0 }} animate={{ rotate: 0 }}>
                   <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
        <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-10 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] shrink-0 z-40">
          <div className="flex items-center gap-6">
             <div className="px-4 py-2 bg-slate-100 rounded-xl border border-slate-200">
                <h1 className="text-[10px] font-black text-eng-blue uppercase tracking-[0.2em]">
                  {menuItems.find(m => m.id === activeTab)?.label}
                </h1>
             </div>
             <div className="h-4 w-px bg-slate-200 hidden md:block"></div>
             <div className="hidden md:flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Sync Active</span>
             </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="hidden lg:flex flex-col items-end">
               <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">System Authority</p>
               <div className="flex items-center gap-2">
                 <Shield className={`w-3.5 h-3.5 ${isAdmin ? 'text-amber-500' : 'text-slate-400'}`} />
                 <p className={`text-xs font-bold leading-none ${isAdmin ? 'text-slate-900' : 'text-slate-500'}`}>
                   {isAdmin ? 'Administrator Level' : 'Standard Access'}
                 </p>
               </div>
            </div>
            
            <div className="h-10 w-px bg-slate-100 hidden lg:block"></div>

            <div className="flex items-center gap-4 group cursor-pointer p-1 pr-4 hover:bg-slate-50 rounded-2xl transition-colors">
              <div className="relative">
                <div className={`w-10 h-10 rounded-2xl overflow-hidden shadow-lg transform group-hover:rotate-3 transition-transform ${isAdmin ? 'bg-eng-blue' : 'bg-slate-700'} flex items-center justify-center`}>
                  <span className="text-white text-xs font-black">
                    {(currentUser?.username || '??').substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-black text-slate-900 leading-tight uppercase tracking-tight">{currentUser?.username}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{currentUser?.role || 'Guest'}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
          <div className="max-w-7xl mx-auto w-full pb-20">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 1.02 }}
                transition={{ duration: 0.35, ease: [0.32, 1, 0.67, 1] }}
              >
                {activeTab === 'dashboard' && <DashboardOverview onNavigate={setActiveTab} isAdmin={isAdmin} />}
                {activeTab === 'master' && <MasterData isAdmin={isAdmin} />}
                {activeTab === 'entry' && isAdmin && (
                  <div className="relative">
                    {editingTransaction && (
                      <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-eng-blue-light text-white px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] flex justify-between items-center z-20 shadow-2xl rounded-2xl mb-8"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-safety-yellow rounded-full animate-ping"></div>
                          In-Place Revision: {editingTransaction.id.slice(0, 8)}
                        </div>
                        <button 
                          onClick={() => setEditingTransaction(null)} 
                          className="bg-white/10 px-4 py-2 rounded-xl hover:bg-white/20 transition-all font-black text-[9px]"
                        >
                          Cancel Override
                        </button>
                      </motion.div>
                    )}
                    <StockEntry 
                      key={editingTransaction ? `edit-${editingTransaction.id}` : 'new-entry'}
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
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
