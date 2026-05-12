import React, { useState, useEffect } from 'react';
import { Storage } from '../lib/storage';
import { useData } from './DataProvider';
import { StockTransaction, MaterialType, Panchayat, Overseer, Scheme } from '../types';
import { FileText, Download, PieChart, BarChart3, Filter, Edit2, Printer } from 'lucide-react';
import { format, parseISO, startOfMonth, startOfQuarter, startOfYear, isSameMonth, isSameQuarter, isSameYear } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function Reports({ onEdit, isAdmin }: { onEdit?: (tx: StockTransaction) => void, isAdmin?: boolean }) {
  const { transactions, panchayats, overseers, schemes, materials: materialList, beneficiaries } = useData();
  
  const [filter, setFilter] = useState({
    timeRange: 'Monthly' as 'Monthly' | 'Quarterly' | 'Yearly',
    material: 'All' as MaterialType | 'All',
    panchayatId: 'All',
    overseerId: 'All',
  });

  const getFilteredData = () => {
    let data = transactions;
    const now = new Date();

    // Time filter
    data = data.filter(t => {
      try {
        const tDate = parseISO(t.date);
        if (filter.timeRange === 'Monthly') return isSameMonth(tDate, now);
        if (filter.timeRange === 'Quarterly') return isSameQuarter(tDate, now);
        if (filter.timeRange === 'Yearly') return isSameYear(tDate, now);
      } catch (e) {
        return false;
      }
      return true;
    });

    // Material filter
    if (filter.material !== 'All') {
      data = data.filter(t => t.material === filter.material);
    }

    // Overseer/Panchayat filter
    if (filter.overseerId !== 'All') {
      const ps = panchayats.filter(p => p.overseerId === filter.overseerId).map(p => p.id);
      data = data.filter(t => t.panchayatId && ps.includes(t.panchayatId));
    }

    if (filter.panchayatId !== 'All') {
      data = data.filter(t => t.panchayatId === filter.panchayatId);
    }

    return data;
  };

  const safeFormat = (dateStr: string) => {
    try {
      if (!dateStr) return 'N/A';
      return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch (e) {
      return dateStr || 'N/A';
    }
  };

  const exportPDF = () => {
    try {
      const doc = new jsPDF();
      const data = getFilteredData();
      
      if (data.length === 0) {
        alert('No data available for the selected filters.');
        return;
      }

      doc.text(`Stock Report - ${filter.timeRange}`, 14, 15);
      
      const tableData = data.map(t => [
        safeFormat(t.date),
        t.type === 'RECEIPT' && t.isOpeningBalance ? 'OPENING BAL' : t.type,
        t.material + (t.stage ? ` (Stage ${t.stage})` : ''),
        t.quantity,
        schemes.find(s => s.id === t.schemeId)?.name || 'N/A',
        t.panchayatId ? panchayats.find(p => p.id === t.panchayatId)?.name : 'N/A'
      ]);

      autoTable(doc, {
        head: [['Date', 'Type', 'Material', 'Qty', 'Scheme', 'Panchayat']],
        body: tableData,
        startY: 20,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [51, 65, 85] }
      });
      
      doc.save(`StockReport_${filter.timeRange}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error('PDF Export failed:', error);
      alert('Failed to generate PDF. Error: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const exportExcel = () => {
    try {
      const filteredData = getFilteredData();
      if (filteredData.length === 0) {
        alert('No data available for the selected filters.');
        return;
      }

      const data = filteredData.map(t => ({
        Date: safeFormat(t.date),
        Type: t.type === 'RECEIPT' && t.isOpeningBalance ? 'OPENING BALANCE' : t.type,
        Material: t.material + (t.stage ? ` (Stage ${t.stage})` : ''),
        Quantity: t.quantity,
        Scheme: schemes.find(s => s.id === t.schemeId)?.name || 'N/A',
        Panchayat: t.panchayatId ? panchayats.find(p => p.id === t.panchayatId)?.name : 'N/A'
      }));
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `StockReport_${filter.timeRange}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    } catch (error) {
      console.error('Excel Export failed:', error);
      alert('Failed to generate Excel file. Error: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const filtered = getFilteredData();
  const summary = {
    receipts: filtered.filter(t => t.type === 'RECEIPT').reduce((acc, t) => acc + t.quantity, 0),
    issues: filtered.filter(t => t.type === 'ISSUE').reduce((acc, t) => acc + t.quantity, 0),
  };

  return (
    <div className="p-8 space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><BarChart3 className="w-6 h-6" /></div> Audit & Analytics
            </h2>
            <p className="text-slate-500 font-medium">Download high-fidelity statements for statistical evaluation</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-xl hover:text-blue-600 hover:border-blue-200 transition text-[11px] font-black uppercase tracking-widest text-slate-700 active:scale-95 shadow-sm"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button 
              onClick={exportPDF}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition text-[11px] font-black uppercase tracking-widest text-slate-700 active:scale-95 shadow-sm"
            >
              <FileText className="w-4 h-4" /> Export PDF
            </button>
            <button 
              onClick={exportExcel}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-[11px] font-black uppercase tracking-widest active:scale-95 shadow-lg shadow-blue-900/10"
            >
              <Download className="w-4 h-4" /> Export Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100 mb-10">
          <div className="space-y-1.5 font-sans">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time range</label>
            <select 
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-blue-100 font-bold text-slate-700"
              value={filter.timeRange}
              onChange={(e) => setFilter({ ...filter, timeRange: e.target.value as any })}
            >
              <option value="Monthly">This Month</option>
              <option value="Quarterly">Current Quarter</option>
              <option value="Yearly">Annual Overview</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Material Type</label>
            <select 
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-blue-100 font-bold text-slate-700"
              value={filter.material}
              onChange={(e) => setFilter({ ...filter, material: e.target.value as any })}
            >
              <option value="All">All Inventory</option>
              {materialList.map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Head Overseer</label>
            <select 
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-blue-100 font-bold text-slate-700"
              value={filter.overseerId}
              onChange={(e) => setFilter({ ...filter, overseerId: e.target.value, panchayatId: 'All' })}
            >
              <option value="All">All Operations</option>
              {overseers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Locality</label>
            <select 
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-blue-100 font-bold text-slate-700 disabled:opacity-50"
              value={filter.panchayatId}
              disabled={filter.overseerId === 'All'}
              onChange={(e) => setFilter({ ...filter, panchayatId: e.target.value })}
            >
              <option value="All">All Panchayats</option>
              {panchayats.filter(p => filter.overseerId === 'All' || p.overseerId === filter.overseerId).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-emerald-50/50 border border-emerald-100 p-8 rounded-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Total Receipts Incoming
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-5xl font-black text-emerald-800 tracking-tighter">{Math.round(summary.receipts).toLocaleString()}</p>
                <span className="text-xs font-bold text-emerald-600 uppercase">Units</span>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100 rounded-full -mr-16 -mt-16 opacity-40 group-hover:scale-125 transition-transform"></div>
          </div>
          
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl relative overflow-hidden group">
            <div className="relative z-10 text-white">
              <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-blue-500"></span> Total Material Issued
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-5xl font-black text-white tracking-tighter">{Math.round(summary.issues).toLocaleString()}</p>
                <span className="text-xs font-bold text-slate-400 uppercase">Units</span>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full -mr-16 -mt-16 group-hover:scale-125 transition-transform"></div>
          </div>
        </div>

        <div className="flex flex-col min-h-0 bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-8 py-4 bg-slate-50 border-b border-slate-100">
             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Transaction Log Table</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-slate-400 font-bold border-b border-slate-50">
                  <th className="px-8 py-4 font-black">Date</th>
                  <th className="px-6 py-4 font-black">Material</th>
                  <th className="px-6 py-4 font-black text-center">Operation</th>
                  <th className="px-6 py-4 font-black">Recipient & Area</th>
                  <th className="px-6 py-4 font-black">Administrator</th>
                  <th className="px-8 py-4 text-right font-black">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {filtered.map(t => {
                  const panchayat = panchayats.find(p => p.id === t.panchayatId);
                  const overseer = overseers.find(o => o.id === panchayat?.overseerId);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-8 py-4 text-slate-400 font-medium">{format(parseISO(t.date), 'MMM d, yyyy')}</td>
                      <td className="px-6 py-4 font-black text-slate-800">
                        {t.material}
                        {t.stage && <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase rounded border border-blue-100">Stage {t.stage}</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                         <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border ${t.type === 'RECEIPT' ? (t.isOpeningBalance ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100') : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                           {t.type === 'RECEIPT' && t.isOpeningBalance ? 'OPENING BALANCE' : t.type}
                         </span>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex flex-col">
                            <span className="font-bold text-slate-800">
                              {beneficiaries.find(b => b.id === t.beneficiaryId)?.name || (t.type === 'RECEIPT' ? 'Main Stock Entry' : 'Manual Issue')}
                            </span>
                            <span className="text-[10px] text-slate-400">{panchayat?.name || 'Central Store'}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-2">
                           <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600">{overseer?.name[0] || 'A'}</div>
                           <span className="font-bold text-slate-700">{overseer?.name || 'System Admin'}</span>
                           {onEdit && isAdmin && (
                             <button 
                               onClick={() => onEdit(t)} 
                               className="ml-auto text-blue-400 hover:text-blue-600"
                             >
                               <Edit2 className="w-3 h-3" />
                             </button>
                           )}
                         </div>
                      </td>
                      <td className={`px-8 py-4 text-right font-black text-sm ${t.type === 'RECEIPT' ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {t.type === 'RECEIPT' ? '+' : ''}{Math.round(t.quantity).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-32 text-center">
                      <div className="p-4 bg-slate-50 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 border border-slate-100">
                        <Filter className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-slate-400 font-medium italic">No matches found for current filter criteria.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
