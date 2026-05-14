import React, { useState, useEffect, useMemo } from 'react';
import { Storage } from '../lib/storage';
import { useData } from './DataProvider';
import { MaterialType, StockTransaction, Scheme, Panchayat, Beneficiary } from '../types';
import { PlusCircle, MinusCircle, History, Trash2, Search, Edit2, ClipboardList, Plus, ArrowRight, Package } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion } from 'motion/react';

interface StockEntryProps {
  editData?: StockTransaction | null;
  onComplete?: () => void;
  isAdmin?: boolean;
}

const StockEntry: React.FC<StockEntryProps> = ({ editData, onComplete, isAdmin }) => {
  const { schemes, panchayats, beneficiaries, transactions, materials: allMaterials, refreshData, addTransaction, removeTransaction } = useData();
  const [type, setType] = useState<'RECEIPT' | 'ISSUE'>('RECEIPT');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [viewMode, setViewMode] = useState<'standard' | 'mbook'>('standard');

  const [formData, setFormData] = useState<Partial<StockTransaction>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    material: '',
    quantity: 0,
    schemeId: '',
    panchayatId: '',
    beneficiaryId: '',
    invoiceNo: '',
    permitNumber: '',
    isOpeningBalance: false,
  });

  const materials = useMemo(() => allMaterials.map(m => m.name), [allMaterials]);

  useEffect(() => {
    if (editData) {
      setType(editData.type);
      setFormData({
        ...editData,
        date: editData.date
      });
    } else if (materials.length > 0 && !formData.material) {
      setFormData(prev => ({
        ...prev,
        material: materials[0] as MaterialType,
      }));
    }
  }, [editData, materials]);

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const filteredTransactions = useMemo(() => {
    const term = search.toLowerCase();
    // Sort descending for Activity Log (Latest First)
    const sorted = [...transactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    if (!term) return sorted;

    return sorted.filter(t => 
      t.material.toLowerCase().includes(term) || 
      (t.type === 'RECEIPT' ? 'receipt' : 'issue').includes(term) ||
      t.invoiceNo?.toLowerCase().includes(term) ||
      t.permitNumber?.toLowerCase().includes(term) ||
      (t.type === 'ISSUE' && beneficiaries.find(b => b.id === t.beneficiaryId)?.name.toLowerCase().includes(term))
    );
  }, [transactions, search, beneficiaries]);

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  const [benSearch, setBenSearch] = useState('');

  const filteredBeneficiaries = useMemo(() => {
    if (!formData.panchayatId || !formData.schemeId) return [];
    let bens = beneficiaries.filter(b => b.panchayatId === formData.panchayatId && b.schemeId === formData.schemeId);
    if (benSearch) {
      const term = benSearch.toLowerCase();
      bens = bens.filter(b => b.name.toLowerCase().includes(term) || b.id.toLowerCase().includes(term));
    }
    return bens;
  }, [beneficiaries, formData.panchayatId, formData.schemeId, benSearch]);

  const TransactionHistory = useMemo(() => {
    return (
      <div className="lg:col-span-2 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-slate-900 text-lg flex items-center gap-2 tracking-tight">
              <History className="w-5 h-5 text-blue-600" /> Activity Log
            </h3>
            <p className="text-xs text-slate-500 font-medium tracking-tight">Review latest material movements</p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Find record..." 
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100 w-full md:w-64 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[800px] custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black border-b border-slate-100 sticky top-0 bg-white z-10">
                <th className="px-8 py-4">Timestamp</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Asset</th>
                <th className="px-6 py-4 text-right">Units</th>
                <th className="px-6 py-4">Reference / Entity</th>
                <th className="px-8 py-4 text-center">Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {paginatedTransactions.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-8 py-4 text-slate-400 font-medium">{format(parseISO(tx.date), 'MMM d, yyyy')}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${tx.type === 'RECEIPT' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">
                    {tx.material} 
                    {tx.stage && <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-black uppercase rounded">Stage {tx.stage}</span>}
                  </td>
                  <td className={`px-6 py-4 text-right font-black text-sm ${tx.type === 'RECEIPT' ? 'text-emerald-700' : 'text-slate-900'}`}>
                    <div className="flex flex-col items-end">
                      <span>{tx.type === 'RECEIPT' ? '+' : ''}{Math.round(tx.quantity).toLocaleString()}</span>
                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">
                        {allMaterials.find(m => m.name === tx.material)?.unit || 'units'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {tx.type === 'RECEIPT' ? (
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">Invoice: {tx.invoiceNo || 'N/A'}</span>
                        {tx.permitNumber && <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Permit: {tx.permitNumber}</span>}
                        {tx.vehicleNo && <span className="text-[10px] text-slate-500 font-bold uppercase">Vehicle: {tx.vehicleNo}</span>}
                        <span className="text-[10px] text-slate-400">Scheme entry point</span>
                        {tx.isOpeningBalance && <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 font-black rounded w-fit mt-1">Opening Balance</span>}
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className="font-bold text-blue-700">{beneficiaries.find(b => b.id === tx.beneficiaryId)?.name}</span>
                        {tx.permitNumber && <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Permit: {tx.permitNumber}</span>}
                        {tx.vehicleNo && <span className="text-[10px] text-slate-500 font-bold uppercase">Vehicle: {tx.vehicleNo}</span>}
                        <span className="text-[10px] text-slate-400">{panchayats.find(p => p.id === tx.panchayatId)?.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button 
                        onClick={() => {
                          const win = window as any;
                          if (win.ais_edit_tx) win.ais_edit_tx(tx);
                        }}
                        className="text-slate-300 hover:text-blue-500 transition-colors p-1"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        type="button"
                        disabled={isProcessing}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirmDeleteId === tx.id) {
                            setIsProcessing(true);
                            try {
                              await removeTransaction(tx.id);
                            } catch (e) {
                              alert('Failed to delete transaction');
                            } finally {
                              setIsProcessing(false);
                              setConfirmDeleteId(null);
                            }
                          } else {
                            setConfirmDeleteId(tx.id);
                          }
                        }}
                        onMouseLeave={() => setConfirmDeleteId(null)}
                        className={`transition-colors p-1 rounded disabled:opacity-30 ${confirmDeleteId === tx.id ? 'bg-red-600 text-white' : 'text-slate-300 hover:text-red-500'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <p className="text-slate-400 font-medium italic">No transactions match your search</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Showing {Math.min(filteredTransactions.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredTransactions.length, currentPage * itemsPerPage)} of {filteredTransactions.length}
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum = currentPage;
                  if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  
                  if (pageNum <= 0 || pageNum > totalPages) return null;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${currentPage === pageNum ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 hover:bg-white border border-transparent hover:border-slate-200'}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }, [paginatedTransactions, search, currentPage, totalPages, isProcessing, confirmDeleteId, beneficiaries, panchayats, allMaterials, filteredTransactions.length, itemsPerPage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.schemeId || !formData.quantity || formData.quantity <= 0) return;
    
    // Duplicate Receipt Detection
    if (type === 'RECEIPT' && formData.invoiceNo && !editData) {
      const isDuplicate = transactions.some(t => 
        t.type === 'RECEIPT' && 
        t.invoiceNo?.toLowerCase() === formData.invoiceNo?.toLowerCase() &&
        t.material === formData.material &&
        t.date === formData.date
      );
      if (isDuplicate) {
        if (!confirm(`Warning: A receipt with Invoice No. "${formData.invoiceNo}" for "${formData.material}" on ${formData.date} already exists. Are you sure you want to add a duplicate entry?`)) {
          return;
        }
      }
    }

    if (type === 'ISSUE') {
      if (!formData.beneficiaryId) return;
      const currentBalance = Storage.getStockBalance(formData.material as MaterialType, transactions);
      if (formData.quantity > (currentBalance + (editData?.type === 'ISSUE' ? editData.quantity : 0))) {
        alert(`Insufficient stock! Current ${formData.material} balance: ${currentBalance}. You requested: ${formData.quantity}`);
        return;
      }
    }

    const newTx: StockTransaction = {
      id: editData ? editData.id : Storage.generateId(),
      type,
      material: formData.material as MaterialType,
      quantity: Number(formData.quantity),
      date: formData.date || format(new Date(), 'yyyy-MM-dd'),
      schemeId: formData.schemeId as string,
      panchayatId: formData.panchayatId,
      beneficiaryId: formData.beneficiaryId,
      invoiceNo: formData.invoiceNo,
      permitNumber: formData.permitNumber,
      vehicleNo: formData.vehicleNo,
      isOpeningBalance: formData.isOpeningBalance,
      stage: formData.stage,
      timestamp: editData?.timestamp || new Date().toISOString()
    };

    setIsProcessing(true);
    try {
      await addTransaction(newTx);
      setFormData({ ...formData, quantity: 0, beneficiaryId: '', invoiceNo: '' });
      if (onComplete) onComplete();
    } catch (e) {
      alert('Failed to save transaction');
    } finally {
      setIsProcessing(false);
    }
  };


  const handleAddBeneficiary = () => {
    // Stage-related logic in StockEntry
  };

  const handleStageChange = (stageNum: number) => {
    const scheme = schemes.find(s => s.id === formData.schemeId);
    if (scheme && scheme.materialStages && scheme.materialStages[formData.material as string]) {
      const stage = scheme.materialStages[formData.material as string].find(st => st.stageNumber === stageNum);
      if (stage) {
        // Calculate already issued for this stage
        const issued = transactions
          .filter(t => 
            t.beneficiaryId === formData.beneficiaryId && 
            t.material === formData.material && 
            t.stage === stageNum &&
            t.type === 'ISSUE'
          )
          .reduce((acc, t) => acc + t.quantity, 0);
        
        const remaining = Math.max(0, stage.quantity - issued);
        setFormData({ ...formData, stage: stageNum, quantity: remaining });
      }
    } else {
      setFormData({ ...formData, stage: stageNum });
    }
  };

  const currentScheme = schemes.find(s => s.id === formData.schemeId);
  const materialStages = currentScheme?.materialStages?.[formData.material as string] || [];

  // Pre-calculate issued quantities for the selected beneficiary and material to avoid O(N*M) in render
  const stageIssuedQuantities = useMemo(() => {
    if (type !== 'ISSUE' || !formData.beneficiaryId || !formData.material) return {};
    
    const relevantTxs = transactions.filter(t => 
      t.beneficiaryId === formData.beneficiaryId && 
      t.material === formData.material && 
      t.type === 'ISSUE'
    );

    const counts: Record<number, number> = {};
    relevantTxs.forEach(t => {
      if (t.stage !== undefined) {
        counts[t.stage] = (counts[t.stage] || 0) + t.quantity;
      }
    });
    return counts;
  }, [transactions, formData.beneficiaryId, formData.material, type]);

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header & View Mode Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-eng-blue tracking-tight uppercase">Resource Allocation</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Stock Pro • Field Operations Manager</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white premium-shadow p-1.5 rounded-2xl border border-slate-200">
           <button 
             onClick={() => setViewMode('standard')}
             className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === 'standard' ? 'bg-eng-blue text-white shadow-lg shadow-eng-blue/20' : 'text-slate-400 hover:text-eng-blue'}`}
           >
             Standard Entry
           </button>
           <button 
             onClick={() => setViewMode('mbook')}
             className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === 'mbook' ? 'bg-safety-yellow text-eng-blue shadow-lg shadow-safety-yellow/20' : 'text-slate-400 hover:text-safety-yellow'}`}
           >
             MBook Mode (Bulk)
           </button>
        </div>
      </div>

      <div className="flex gap-4 md:gap-6">
        <button 
          onClick={() => { setType('RECEIPT'); setFormData({...formData, stage: undefined}); }}
          className={`flex-1 py-5 rounded-2xl font-black text-[10px] md:text-sm tracking-[0.2em] flex items-center justify-center gap-3 transition-all duration-500 ${type === 'RECEIPT' ? 'bg-eng-blue text-white shadow-2xl shadow-eng-blue/30 active:scale-95' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-eng-blue'}`}
        >
          <PlusCircle className="w-5 h-5" /> ADD RECEIPT
        </button>
        <button 
          onClick={() => setType('ISSUE')}
          className={`flex-1 py-5 rounded-2xl font-black text-[10px] md:text-sm tracking-[0.2em] flex items-center justify-center gap-3 transition-all duration-500 ${type === 'ISSUE' ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/30 active:scale-95' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-900'}`}
        >
          <MinusCircle className="w-5 h-5" /> ISSUE RECORD
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Container */}
        <div className="lg:col-span-1">
          {viewMode === 'standard' ? (
            <form onSubmit={handleSubmit} className="glass-card p-8 rounded-[2rem] border border-slate-200 premium-shadow space-y-6 sticky top-24">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-900 text-xs tracking-widest uppercase">Entry Parameters</h3>
                <div className={`px-2 py-1 rounded text-[8px] font-black uppercase text-white ${type === 'RECEIPT' ? 'bg-emerald-500' : 'bg-amber-500'}`}>{type}</div>
              </div>
              
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Activity Date</label>
                  <input 
                    type="date" 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-eng-blue/50 transition-all font-bold text-sm"
                    value={formData.date || ''}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Scheme</label>
                  <select 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-eng-blue/50 transition-all font-bold text-sm appearance-none cursor-pointer"
                    value={formData.schemeId || ''}
                    onChange={(e) => setFormData({ ...formData, schemeId: e.target.value })}
                  >
                    <option value="">-- Choose active scheme --</option>
                    {schemes.map(s => <option key={s.id} value={s.id}>{s.name} [{s.year}]</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Material Specification</label>
                  <select 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-eng-blue/50 transition-all font-bold text-sm appearance-none cursor-pointer"
                    value={formData.material || ''}
                    onChange={(e) => setFormData({ ...formData, material: e.target.value as MaterialType })}
                  >
                    <option value="">-- Select material --</option>
                    {materials.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {type === 'ISSUE' && materialStages.length > 0 && formData.beneficiaryId && (
                  <div className="space-y-4 bg-blue-50/50 p-6 rounded-[1.5rem] border border-blue-100">
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] block mb-3">Construction Stages</label>
                    <div className="grid grid-cols-2 gap-3">
                      {materialStages.map(st => {
                        const issuedForThisStage = stageIssuedQuantities[st.stageNumber] || 0;
                        const isCompleted = issuedForThisStage >= st.quantity && st.quantity > 0;
                        const isSelected = formData.stage === st.stageNumber;

                        return (
                          <button
                            key={st.stageNumber}
                            type="button"
                            onClick={() => handleStageChange(st.stageNumber)}
                            className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all active:scale-95 ${
                              isSelected 
                                ? 'bg-eng-blue border-eng-blue text-white shadow-xl shadow-eng-blue/20' 
                                : isCompleted
                                  ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                  : 'bg-white border-slate-100 text-slate-500 hover:border-eng-blue/30'
                            }`}
                          >
                            <span className="text-[9px] font-black uppercase">Stage {st.stageNumber}</span>
                            <span className={`text-[10px] font-black mt-1 ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>
                              {issuedForThisStage}/{st.quantity}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry Magnitude</label>
                    <span className="text-[9px] font-black bg-slate-100 px-2 py-1 rounded-lg text-slate-500 uppercase">
                       {allMaterials.find(m => m.name === formData.material)?.unit || 'units'}
                    </span>
                  </div>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-eng-blue/50 transition-all font-black text-xl"
                    value={formData.quantity || ''}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  />
                </div>

                {type === 'RECEIPT' ? (
                  <div className="space-y-5">
                    <label className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${formData.isOpeningBalance ? 'bg-amber-50 border-amber-200 shadow-lg shadow-amber-900/5' : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-eng-blue hover:shadow-xl hover:shadow-eng-blue/5'}`}>
                      <input 
                        type="checkbox"
                        className="w-5 h-5 text-amber-500 rounded-lg focus:ring-amber-500 border-slate-300 transition-all"
                        checked={formData.isOpeningBalance || false}
                        onChange={(e) => setFormData({ ...formData, isOpeningBalance: e.target.checked })}
                      />
                      <div>
                        <span className={`text-[10px] font-black uppercase tracking-widest block ${formData.isOpeningBalance ? 'text-amber-800' : 'text-slate-600'}`}>Opening Balance Entry</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase">Will be excluded from dynamic receipts</span>
                      </div>
                    </label>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Invoice / Authorization ID</label>
                      <input 
                        type="text" 
                        placeholder="EX: INV-2024-KLA7"
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-eng-blue/50 transition-all font-bold text-sm"
                        value={formData.invoiceNo || ''}
                        onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Recipient Jurisdiction</label>
                      <select 
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-eng-blue/50 transition-all font-bold text-sm appearance-none cursor-pointer"
                        value={formData.panchayatId || ''}
                        onChange={(e) => setFormData({ ...formData, panchayatId: e.target.value, beneficiaryId: '' })}
                      >
                        <option value="">-- All Panchayats --</option>
                        {panchayats.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Beneficiary Target</label>
                      <div className="relative group">
                        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-eng-blue transition-colors" />
                        <input 
                          type="text" 
                          placeholder="Search Registry..." 
                          className="w-full pl-11 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-bold uppercase outline-none focus:ring-4 focus:ring-blue-100 focus:border-eng-blue/50 transition-all"
                          value={benSearch}
                          onChange={(e) => setBenSearch(e.target.value)}
                          disabled={!formData.panchayatId || !formData.schemeId}
                        />
                      </div>
                      <select 
                        className="w-full mt-3 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-eng-blue/50 transition-all font-bold text-sm appearance-none cursor-pointer"
                        value={formData.beneficiaryId || ''}
                        disabled={!formData.panchayatId || !formData.schemeId}
                        onChange={(e) => setFormData({ ...formData, beneficiaryId: e.target.value })}
                      >
                        <option value="">-- Choose Recipient ({filteredBeneficiaries.length}) --</option>
                        {filteredBeneficiaries.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      {(!formData.panchayatId || !formData.schemeId) && <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 ml-1">Requires jurisdiction and scheme selection</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Permit #</label>
                         <input 
                           type="text" 
                           placeholder="P-2024"
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs"
                           value={formData.permitNumber || ''}
                           onChange={(e) => setFormData({ ...formData, permitNumber: e.target.value })}
                         />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vehicle #</label>
                         <input 
                           type="text" 
                           placeholder="KL-XX"
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs"
                           value={formData.vehicleNo || ''}
                           onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value })}
                         />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <motion.button 
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isProcessing}
                className={`w-full py-5 rounded-2xl font-black text-xs tracking-[0.3em] uppercase text-white transition-all shadow-2xl disabled:opacity-50 flex items-center justify-center gap-3 ${type === 'RECEIPT' ? 'bg-eng-blue shadow-eng-blue/30 hover:bg-eng-blue-light' : 'bg-slate-900 shadow-slate-900/30 hover:bg-black'}`}
              >
                {isProcessing ? 'Processing Batch...' : 'Commit Transaction'}
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </form>
          ) : (
            /* MBook Entry Sidebar Helper */
            <div className="glass-card p-8 rounded-[2rem] border border-slate-200 premium-shadow space-y-6 sticky top-24">
              <h3 className="font-black text-slate-900 text-xs tracking-widest uppercase">MBook Bulk Config</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Common Date</label>
                  <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Scheme Filter</label>
                  <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" value={formData.schemeId} onChange={e => setFormData({...formData, schemeId: e.target.value})}>
                    <option value="">All Schemes</option>
                    {schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Panchayat Filter</label>
                  <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" value={formData.panchayatId} onChange={e => setFormData({...formData, panchayatId: e.target.value})}>
                    <option value="">All Panchayats</option>
                    {panchayats.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="p-4 bg-safety-yellow/10 border border-safety-yellow/20 rounded-2xl">
                 <p className="text-[9px] font-black text-safety-yellow uppercase leading-relaxed text-center">
                    MBook mode allows rapid entry by clicking beneficiaries in the grid and entering values.
                 </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Content Area: Either Activity Log or MBook Spreadsheet */}
        <div className="lg:col-span-2 flex flex-col min-h-[600px]">
          {viewMode === 'mbook' ? (
            <div className="bg-white rounded-[2rem] border border-slate-200 premium-shadow flex flex-col h-full overflow-hidden">
               <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                       <ClipboardList className="w-5 h-5 text-safety-yellow" /> M-Book Spreadsheet
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Bulk Issuance Interface</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="relative">
                       <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                       <input 
                         type="text" 
                         placeholder="Filter recipients..." 
                         className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-[10px] font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100"
                         value={benSearch}
                         onChange={e => setBenSearch(e.target.value)}
                       />
                    </div>
                  </div>
               </div>

               <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 z-20">
                      <tr className="text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-slate-100">
                        <th className="px-8 py-5">Register ID</th>
                        <th className="px-6 py-5">Beneficiary / Work Site</th>
                        <th className="px-6 py-5">Panchayat</th>
                        <th className="px-6 py-5">Allocation</th>
                        <th className="px-6 py-5 text-right">Commit Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredBeneficiaries.map((ben) => (
                        <tr key={ben.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-4">
                            <span className="text-[10px] font-mono text-slate-400 font-bold">{ben.id.slice(-8).toUpperCase()}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                               <span className="text-sm font-black text-slate-900 group-hover:text-eng-blue transition-colors">{ben.name}</span>
                               <span className="text-[9px] text-slate-400 font-bold uppercase">{ben.id}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[9px] font-black uppercase tracking-tight">
                               {panchayats.find(p => p.id === ben.panchayatId)?.name}
                             </span>
                          </td>
                          <td className="px-6 py-4">
                             <span className="text-[10px] font-bold text-slate-500">{schemes.find(s => s.id === ben.schemeId)?.name}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex items-center justify-end gap-3">
                                <input 
                                  type="number"
                                  placeholder="0.00"
                                  className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-black text-xs focus:ring-4 focus:ring-safety-yellow/20 focus:border-safety-yellow transition-all"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = Number((e.target as HTMLInputElement).value);
                                      if (val > 0) {
                                        setFormData({ ...formData, beneficiaryId: ben.id, quantity: val });
                                        // Trigger auto commit optionally or just use current logic
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const val = Number((e.target as HTMLInputElement).value);
                                    if (val > 0) {
                                      setFormData(prev => ({ ...prev, beneficiaryId: ben.id, quantity: val }));
                                    }
                                  }}
                                />
                                <button 
                                  onClick={async () => {
                                    if (!formData.quantity || formData.quantity <= 0) return;
                                    // Set beneficiary and submit
                                    const finalFormData = { ...formData, beneficiaryId: ben.id };
                                    // Manual execution of submit logic to avoid form state lag
                                    const newTx: StockTransaction = {
                                      id: Storage.generateId(),
                                      type,
                                      material: formData.material as MaterialType,
                                      quantity: Number(finalFormData.quantity),
                                      date: finalFormData.date || format(new Date(), 'yyyy-MM-dd'),
                                      schemeId: formData.schemeId || '',
                                      panchayatId: ben.panchayatId,
                                      beneficiaryId: ben.id,
                                      timestamp: new Date().toISOString()
                                    };

                                    setIsProcessing(true);
                                    try {
                                      await addTransaction(newTx);
                                      // Clear input (need ref handling for specific input ideally)
                                    } catch (e) {
                                      alert('MBook entry failed');
                                    } finally {
                                      setIsProcessing(false);
                                    }
                                  }}
                                  className="p-2 bg-eng-blue text-white rounded-lg hover:bg-eng-blue-light active:scale-90 transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                             </div>
                          </td>
                        </tr>
                      ))}
                      {filteredBeneficiaries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-8 py-32 text-center">
                            <Package className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Select scheme and panchayat to begin entry</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
               </div>
            </div>
          ) : (
            TransactionHistory
          )}
        </div>
      </div>
    </div>
  );
};

export default StockEntry;
