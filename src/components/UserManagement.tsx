import React, { useState, useEffect } from 'react';
import { Storage } from '../lib/storage';
import { useFirebase } from './FirebaseProvider';
import { SystemUser } from '../types';
import { Users, UserCheck, UserX, Clock, Shield } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function UserManagement() {
  const { systemUsers: users } = useFirebase();

  const handleApprove = async (id: string) => {
    await Storage.approveUser(id);
  };

  const handleReject = async (id: string) => {
    await Storage.rejectUser(id);
  };

  return (
    <div className="p-8 space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <div className="p-2 bg-slate-100 rounded-xl text-slate-700"><Shield className="w-6 h-6" /></div>
             Access Control
          </h2>
          <p className="text-slate-500 font-medium">Review and manage inventory system authorization requests</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
           <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Pending Requests ({users.filter(u => u.status === 'PENDING').length})</h4>
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
              <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Active Verification Flow</span>
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-slate-400 font-bold border-b border-slate-50">
                <th className="px-8 py-4 font-black">Account Name</th>
                <th className="px-6 py-4 font-black">Requested Date</th>
                <th className="px-6 py-4 font-black">Status</th>
                <th className="px-6 py-4 font-black">Role</th>
                <th className="px-8 py-4 text-center font-black">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {users.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-600 text-[10px]">{u.username[0].toUpperCase()}</div>
                       <span className="font-bold text-slate-800">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400 font-medium flex items-center gap-2">
                    <Clock className="w-3 h-3 text-slate-300" />
                    {format(parseISO(u.requestedAt), 'MMM d, yyyy HH:mm')}
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
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{u.role}</span>
                  </td>
                  <td className="px-8 py-4 text-center">
                    {u.status === 'PENDING' ? (
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleApprove(u.id)}
                          className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition shadow-sm"
                          title="Approve Access"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleReject(u.id)}
                          className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition shadow-sm"
                          title="Deny Access"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-[9px] font-bold uppercase">No actions available</span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                   <td colSpan={5} className="px-8 py-20 text-center text-slate-400 italic">No access requests recorded</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
