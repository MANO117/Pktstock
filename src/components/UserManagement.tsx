import React, { useState, useEffect } from 'react';
import { Storage } from '../lib/storage';
import { useFirebase } from './FirebaseProvider';
import { SystemUser } from '../types';
import { Users, UserCheck, UserX, Clock, Shield, Key, Edit2, Plus, X as CloseIcon, Save, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function UserManagement() {
  const { systemUsers: users } = useFirebase();
  const [isAdding, setIsAdding] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'USER' as 'ADMIN' | 'USER',
    status: 'APPROVED' as 'APPROVED' | 'PENDING' | 'REJECTED'
  });

  const handleApprove = async (id: string) => {
    await Storage.approveUser(id);
  };

  const handleReject = async (id: string) => {
    await Storage.rejectUser(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      await Storage.updateUser(editingUser.id, formData);
      setEditingUser(null);
    } else {
      const newUser: SystemUser = {
        id: Storage.generateId(),
        username: formData.username,
        password: formData.password,
        role: formData.role,
        status: formData.status,
        requestedAt: new Date().toISOString()
      };
      await Storage.setUserData(newUser);
      setIsAdding(false);
    }
    setFormData({ username: '', password: '', role: 'USER', status: 'APPROVED' });
  };

  const startEdit = (user: SystemUser) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: user.password || '',
      role: user.role,
      status: user.status
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      await Storage.deleteUser(id);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <div className="p-2 bg-slate-100 rounded-xl text-slate-700"><Shield className="w-6 h-6" /></div>
             Access Control
          </h2>
          <p className="text-slate-500 font-medium">Review and manage inventory system authorization manual accounts</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-900/10"
        >
          <Plus className="w-4 h-4" />
          Create Manual User
        </button>
      </div>

      {(isAdding || editingUser) && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
           <form onSubmit={handleSubmit} className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">
                   {editingUser ? 'Edit Internal User' : 'New Manual User'}
                 </h3>
                 <button onClick={() => { setIsAdding(false); setEditingUser(null); }} type="button" className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><CloseIcon className="w-5 h-5" /></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                    <input 
                      type="text" required
                      className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 font-bold"
                      value={formData.username}
                      onChange={e => setFormData({ ...formData, username: e.target.value })}
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                    <input 
                      type="text" required
                      className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 font-bold"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Role</label>
                      <select 
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                      >
                        <option value="USER">Viewer</option>
                        <option value="ADMIN">Administrator</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                      <select 
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                      >
                        <option value="APPROVED">Approved</option>
                        <option value="PENDING">Pending</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                 <button onClick={() => { setIsAdding(false); setEditingUser(null); }} type="button" className="px-6 py-3 text-[10px] font-black uppercase text-slate-500 hover:text-slate-900 tracking-widest">Cancel</button>
                 <button type="submit" className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-600/20 active:scale-95">
                    <Save className="w-4 h-4" />
                    Commit Changes
                 </button>
              </div>
           </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-slate-800">
        <div className="px-8 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
           <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">System User Directory</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-slate-400 font-bold border-b border-slate-50">
                <th className="px-8 py-4 font-black">Account Name</th>
                <th className="px-6 py-4 font-black">Credentials</th>
                <th className="px-6 py-4 font-black">Account Role</th>
                <th className="px-6 py-4 font-black">Status</th>
                <th className="px-8 py-4 text-right font-black">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {users.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-600 text-[10px]">{u.username[0].toUpperCase()}</div>
                       <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{u.username}</span>
                          <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Ref: {u.id.substring(0,8)}</span>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-2 group-hover:bg-white p-1 rounded transition-colors w-fit">
                        <Key className="w-3 h-3 text-slate-300" />
                        <span className="font-mono text-[10px] text-slate-500">{u.password ? '••••••••' : 'Cloud Auth (SSO)'}</span>
                     </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border transition-all ${
                      u.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-sm shadow-indigo-100/50' : 'bg-slate-50 text-slate-500 border-slate-100'
                    }`}>
                      {u.role === 'ADMIN' ? 'Administrator' : 'Viewer'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                      u.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      u.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                      'bg-red-50 text-red-600 border-red-100'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center justify-end gap-2">
                       <button onClick={() => startEdit(u)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit Profile"><Edit2 className="w-4 h-4" /></button>
                       {u.status === 'PENDING' && (
                          <button onClick={() => handleApprove(u.id)} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all" title="Fast Approve"><UserCheck className="w-4 h-4" /></button>
                       )}
                       <button onClick={() => handleDelete(u.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Terminate Account"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                   <td colSpan={5} className="px-8 py-20 text-center text-slate-400 italic font-medium">No system accounts defined. Add manual users to begin.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
