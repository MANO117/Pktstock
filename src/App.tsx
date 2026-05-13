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
                {(currentUser?.username || '??').substring(0, 2).toUpperCase()}
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
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
