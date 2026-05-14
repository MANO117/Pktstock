import React, { useState, useEffect, useMemo } from 'react';
import { Storage } from '../lib/storage';
import { useData } from './DataProvider';
import { MaterialType, StockTransaction, Scheme, Panchayat, Beneficiary } from '../types';
import { PlusCircle, MinusCircle, History, Trash2, Search, Edit2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface StockEntryProps {
  editData?: StockTransaction | null;
  onComplete?: () => void;
  isAdmin?: boolean;
}

export default function StockEntry({ editData, onComplete, isAdmin }: StockEntryProps) {
  const { schemes, panchayats, beneficiaries, transactions, materials: allMaterials, refreshData, addTransaction, removeTransaction } = useData();
  const [type, setType] = useState<'RECEIPT' | 'ISSUE'>('RECEIPT');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const initialized = React.useRef(false);
  
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
    } else if (!initialized.current && materials.length > 0) {
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        material: materials[0] || '',
        quantity: 0,
        schemeId: '',
        panchayatId: '',
        beneficiaryId: '',
        invoiceNo: '',
        permitNumber: '',
        isOpeningBalance: false,
      });
      initialized.current = true;
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
    <div className="p-8 space-y-8">
      <div className="flex gap-6">
        <button 
          onClick={() => { setType('RECEIPT'); setFormData({...formData, stage: undefined}); }}
          className={`flex-1 py-6 rounded-2xl font-black text-sm tracking-widest flex items-center justify-center gap-3 transition-all duration-300 ${type === 'RECEIPT' ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/20 active:scale-95' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'}`}
        >
          <PlusCircle className="w-5 h-5" /> ADD RECEIPT (INVOICE)
        </button>
        <button 
          onClick={() => setType('ISSUE')}
          className={`flex-1 py-6 rounded-2xl font-black text-sm tracking-widest flex items-center justify-center gap-3 transition-all duration-300 ${type === 'ISSUE' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20 active:scale-95' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'}`}
        >
          <MinusCircle className="w-5 h-5" /> ISSUE TO BENEFICIARY
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Container */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 sticky top-8">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-black text-slate-900 text-sm tracking-widest uppercase">{type === 'RECEIPT' ? 'Transaction: Receipt' : 'Transaction: Issue'}</h3>
              <div className={`w-3 h-3 rounded-full ${type === 'RECEIPT' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`}></div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry Date</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-medium"
                  value={formData.date || ''}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Scheme</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-medium"
                  value={formData.schemeId || ''}
                  onChange={(e) => setFormData({ ...formData, schemeId: e.target.value, stage: undefined })}
                >
                  <option value="">-- Choose active scheme --</option>
                  {schemes.map(s => <option key={s.id} value={s.id}>{s.name} [{s.year}]</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Material Type</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-medium appearance-none"
                  value={formData.material || ''}
                  onChange={(e) => setFormData({ ...formData, material: e.target.value as MaterialType, stage: undefined })}
                >
                  {materials.map(m => <option key={m} value={m}>{m}</option>)}
                  {materials.length === 0 && <option value="">No materials defined</option>}
                </select>
              </div>

              {type === 'ISSUE' && materialStages.length > 0 && formData.beneficiaryId && (
                <div className="space-y-3 md:col-span-2 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Select Construction Stage</label>
                    <span className="text-[10px] font-bold text-blue-400 uppercase">Beneficiary Progress</span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {materialStages.map(st => {
                      const issuedForThisStage = stageIssuedQuantities[st.stageNumber] || 0;
                      
                      const isCompleted = issuedForThisStage >= st.quantity && st.quantity > 0;
                      const isSelected = formData.stage === st.stageNumber;

                      return (
                        <button
                          key={st.stageNumber}
                          type="button"
                          onClick={() => handleStageChange(st.stageNumber)}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                            isSelected 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 scale-105' 
                              : isCompleted
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                          }`}
                        >
                          <span className="text-[10px] font-black uppercase">Stage {st.stageNumber}</span>
                          <span className={`text-[11px] font-bold mt-1 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            {issuedForThisStage}/{st.quantity}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-blue-500 font-bold italic text-center">
                    Click a stage to auto-set the remaining quantity for that stage
                  </p>
                </div>
              )}

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</label>
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-widest">
                       {allMaterials.find(m => m.name === formData.material)?.unit || 'units'}
                    </span>
                  </div>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-bold text-lg"
                    value={formData.quantity || ''}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  />
                </div>

                {type === 'RECEIPT' && (
                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.isOpeningBalance ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                    <input 
                      type="checkbox"
                      className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-slate-300"
                      checked={formData.isOpeningBalance || false}
                      onChange={(e) => setFormData({ ...formData, isOpeningBalance: e.target.checked })}
                    />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${formData.isOpeningBalance ? 'text-amber-700' : 'text-slate-600'}`}>Is Opening Balance Entry?</span>
                  </label>
                )}

              {type === 'RECEIPT' ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice / Reference No.</label>
                    <input 
                      type="text" 
                      placeholder="E.g. INV-2024-001"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-medium"
                      value={formData.invoiceNo || ''}
                      onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle Number (Logistics)</label>
                    <input 
                      type="text" 
                      placeholder="KL-01-AB-1234"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-medium"
                      value={formData.vehicleNo || ''}
                      onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Beneficiary Panchayat</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-medium"
                      value={formData.panchayatId || ''}
                      onChange={(e) => setFormData({ ...formData, panchayatId: e.target.value, beneficiaryId: '' })}
                    >
                      <option value="">-- Select area --</option>
                      {panchayats.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Individual Recipient</label>
                    {formData.panchayatId && formData.schemeId && (
                      <div className="mb-2 relative">
                        <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Filter beneficiaries..." 
                          className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] outline-none focus:ring-1 focus:ring-blue-200"
                          value={benSearch}
                          onChange={(e) => setBenSearch(e.target.value)}
                        />
                      </div>
                    )}
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-medium"
                      value={formData.beneficiaryId || ''}
                      disabled={!formData.panchayatId || !formData.schemeId}
                      onChange={(e) => setBenSearch('') || setFormData({ ...formData, beneficiaryId: e.target.value })}
                    >
                      <option value="">-- Choose beneficiary ({filteredBeneficiaries.length}) --</option>
                      {filteredBeneficiaries.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    {(!formData.panchayatId || !formData.schemeId) && <p className="text-[10px] text-slate-400 italic">Select panchayat and scheme first</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Permit Number (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="Enter permit #"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-medium"
                      value={formData.permitNumber || ''}
                      onChange={(e) => setFormData({ ...formData, permitNumber: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle Number (Logistics)</label>
                    <input 
                      type="text" 
                      placeholder="KL-01-AB-1234"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-medium"
                      value={formData.vehicleNo || ''}
                      onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            <button 
              type="submit"
              disabled={isProcessing}
              className={`w-full py-4 rounded-xl font-black text-xs tracking-[0.2em] uppercase text-white transition-all shadow-lg disabled:opacity-50 ${type === 'RECEIPT' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/20' : 'bg-slate-900 hover:bg-black shadow-slate-900/20'}`}
            >
              {isProcessing ? 'Saving...' : 'Commit Transaction'}
            </button>
          </form>
        </div>

        {/* Transaction History Log */}
        {TransactionHistory}
      </div>
    </div>
  );
}
