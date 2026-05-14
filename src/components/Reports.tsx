import React, { useState, useEffect } from 'react';
import { Storage } from '../lib/storage';
import { useData } from './DataProvider';
import { StockTransaction, MaterialType, Panchayat, Overseer, Scheme } from '../types';
import { 
  FileText, 
  Download, 
  PieChart as LucidePieChart, 
  BarChart3, 
  Filter, 
  Edit2, 
  Printer, 
  MapPin,
  TrendingUp,
  Clock,
  AlertCircle,
  LayoutDashboard
} from 'lucide-react';
import { format, parseISO, startOfMonth, startOfQuarter, startOfYear, isSameMonth, isSameQuarter, isSameYear } from 'date-fns';
import { motion } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const safeFormat = (dateStr: string) => {
  try {
    if (!dateStr) return 'N/A';
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch (e) {
    return dateStr || 'N/A';
  }
};

export default function Reports({ onEdit, isAdmin }: { onEdit?: (tx: StockTransaction) => void, isAdmin?: boolean }) {
  const { transactions, panchayats, overseers, schemes, materials: materialList, beneficiaries } = useData();
  
  // Pre-process transactions for indexed lookup
  const txIndexes = React.useMemo(() => {
    const byBeneficiary: Record<string, StockTransaction[]> = {};
    const byMaterial: Record<string, StockTransaction[]> = {};
    const byPanchayat: Record<string, StockTransaction[]> = {};
    
    transactions.forEach(t => {
      if (t.beneficiaryId) {
        if (!byBeneficiary[t.beneficiaryId]) byBeneficiary[t.beneficiaryId] = [];
        byBeneficiary[t.beneficiaryId].push(t);
      }
      if (t.panchayatId) {
        if (!byPanchayat[t.panchayatId]) byPanchayat[t.panchayatId] = [];
        byPanchayat[t.panchayatId].push(t);
      }
      if (!byMaterial[t.material]) byMaterial[t.material] = [];
      byMaterial[t.material].push(t);
    });
    
    return { byBeneficiary, byMaterial, byPanchayat };
  }, [transactions]);

  type ReportTab = 'LEDGER' | 'SCHEME' | 'PANCHAYAT' | 'OVERSEER' | 'MOVEMENT' | 'BENEFICIARY';
  const [activeTab, setActiveTab] = useState<ReportTab>('LEDGER');
  const [filter, setFilter] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    materials: [] as MaterialType[],
    panchayatIds: [] as string[],
    overseerIds: [] as string[],
    schemeIds: [] as string[],
    finYear: Storage.getFinancialYear()
  });

  // Financial Year Filter Logic
  const filteredByFinYear = React.useMemo(() => {
    return transactions.filter(t => {
      const tDate = parseISO(t.date);
      return Storage.getFinancialYear(tDate) === filter.finYear;
    });
  }, [transactions, filter.finYear]);

  // Master Filtered List based on current filters
  const filteredTransactions = React.useMemo(() => {
    let data = Storage.sortTransactions(filteredByFinYear);
    
    // Date Range
    data = data.filter(t => t.date >= filter.startDate && t.date <= filter.endDate);

    // Materials
    if (filter.materials.length > 0) {
      const matSet = new Set(filter.materials);
      data = data.filter(t => matSet.has(t.material));
    }

    // Schemes
    if (filter.schemeIds.length > 0) {
      const schemeSet = new Set(filter.schemeIds);
      data = data.filter(t => schemeSet.has(t.schemeId));
    }

    // Overseers
    if (filter.overseerIds.length > 0) {
      const ps = new Set(panchayats.filter(p => filter.overseerIds.includes(p.overseerId)).map(p => p.id));
      data = data.filter(t => t.panchayatId && ps.has(t.panchayatId));
    }

    // Panchayats
    if (filter.panchayatIds.length > 0) {
      const ps = new Set(filter.panchayatIds);
      data = data.filter(t => t.panchayatId && ps.has(t.panchayatId));
    }

    return data;
  }, [filteredByFinYear, filter.startDate, filter.endDate, filter.materials, filter.schemeIds, filter.overseerIds, filter.panchayatIds, panchayats]);

  // Specific Report Data Calculations
  const ledgerData = React.useMemo(() => {
    const materialsToProcess = filter.materials.length === 0 ? materialList.map(m => m.name) : filter.materials;
    
    let allProcessed: any[] = [];
    materialsToProcess.forEach(m => {
      const running = Storage.calculateRunningBalances(filteredByFinYear, m, { 
        schemeIds: filter.schemeIds, 
        panchayatIds: filter.panchayatIds 
      });
      // Filter the running results by date range
      allProcessed = [...allProcessed, ...running.filter(r => r.date >= filter.startDate && r.date <= filter.endDate)];
    });
    
    return Storage.sortTransactions(allProcessed);
  }, [filteredByFinYear, filter.materials, filter.schemeIds, filter.panchayatIds, filter.startDate, filter.endDate, materialList]);

  const schemeConsumption = React.useMemo(() => {
    const stats: Record<string, { material: string, receipt: number, issue: number, balance: number, unit: string }> = {};
    
    filteredTransactions.forEach(t => {
      if (filter.schemeIds.length > 0 && !filter.schemeIds.includes(t.schemeId)) return;
      
      const key = `${t.schemeId}_${t.material}`;
      if (!stats[key]) {
        const mat = materialList.find(m => m.name === t.material);
        stats[key] = { material: t.material, receipt: 0, issue: 0, balance: 0, unit: mat?.unit || 'Units' };
      }
      if (t.type === 'RECEIPT') stats[key].receipt += t.quantity;
      else stats[key].issue += t.quantity;
      stats[key].balance = stats[key].receipt - stats[key].issue;
    });

    return Object.entries(stats).map(([key, value]) => {
      const schemeId = key.split('_')[0];
      return { schemeId, ...value, schemeName: schemes.find(s => s.id === schemeId)?.name || 'Unknown' };
    });
  }, [filteredTransactions, filter.schemeId, materialList, schemes]);

  const panchayatStock = React.useMemo(() => {
    const stats: Record<string, Record<string, { stock: number, unit: string }>> = {};
    
    // This needs current state, not just filtered by date range usually
    transactions.forEach(t => {
      if (!t.panchayatId) return;
      if (!stats[t.panchayatId]) stats[t.panchayatId] = {};
      if (!stats[t.panchayatId][t.material]) {
        const mat = materialList.find(m => m.name === t.material);
        stats[t.panchayatId][t.material] = { stock: 0, unit: mat?.unit || 'Units' };
      }
      
      if (t.type === 'RECEIPT') stats[t.panchayatId][t.material].stock += t.quantity;
      else stats[t.panchayatId][t.material].stock -= t.quantity;
    });

    return Object.entries(stats).map(([pid, mats]) => ({
      panchayatId: pid,
      panchayatName: panchayats.find(p => p.id === pid)?.name || 'Unknown',
      materials: Object.entries(mats).map(([name, data]) => ({ name, ...data }))
    }));
  }, [transactions, panchayats, materialList]);

  const overseerReport = React.useMemo(() => {
    const stats: Record<string, { received: number, issued: number, lastTx: string }> = {};
    
    filteredTransactions.forEach(t => {
      const p = panchayats.find(p => p.id === t.panchayatId);
      if (!p) return;
      const oid = p.overseerId;
      if (!stats[oid]) stats[oid] = { received: 0, issued: 0, lastTx: t.date };
      
      if (t.type === 'RECEIPT') stats[oid].received += t.quantity;
      else stats[oid].issued += t.quantity;
      if (t.date > stats[oid].lastTx) stats[oid].lastTx = t.date;
    });

    return Object.entries(stats).map(([oid, data]) => ({
      overseerId: oid,
      overseerName: overseers.find(o => o.id === oid)?.name || 'Unknown',
      ...data
    }));
  }, [filteredTransactions, overseers, panchayats]);

  const beneficiaryReport = React.useMemo(() => {
    let filteredBens = beneficiaries;
    if (filter.schemeIds.length > 0) {
      const schemeSet = new Set(filter.schemeIds);
      filteredBens = filteredBens.filter(b => schemeSet.has(b.schemeId));
    }
    if (filter.panchayatIds.length > 0) {
      const panSet = new Set(filter.panchayatIds);
      filteredBens = filteredBens.filter(b => panSet.has(b.panchayatId));
    }
    if (filter.overseerIds.length > 0) {
       const assignedPanchayats = new Set(panchayats.filter(p => filter.overseerIds.includes(p.overseerId)).map(p => p.id));
       filteredBens = filteredBens.filter(b => assignedPanchayats.has(b.panchayatId));
    }

    return filteredBens.map(b => {
      const benTransactions = txIndexes.byBeneficiary[b.id] || [];
      const scheme = schemes.find(s => s.id === b.schemeId);
      
      const materialSummaries = materialList.map(m => {
         const matTxs = benTransactions.filter(t => t.material === m.name);
         const issued = matTxs.filter(t => t.type === 'ISSUE').reduce((acc, curr) => acc + curr.quantity, 0);
         const stages = scheme?.materialStages?.[m.name] || [];
         const approved = stages.reduce((acc, curr) => acc + curr.quantity, 0);
         const lastTx = [...matTxs].sort((a, b) => b.date.localeCompare(a.date))[0];
         
         const lastStageTx = matTxs.filter(t => t.stage !== undefined).sort((a, b) => (b.stage || 0) - (a.stage || 0))[0];
         const currentStage = lastStageTx?.stage || 0;
         const nextStageObj = stages.find(s => s.stageNumber > currentStage);
         
         // Pending logic
         const isPending = approved > issued;
         const daysPending = lastTx ? Math.floor((new Date().getTime() - new Date(lastTx.date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
         
         return {
           material: m.name,
           issued,
           approved,
           balance: Math.max(0, approved - issued),
           lastIssueDate: lastTx?.date || null,
           currentStage,
           nextStage: nextStageObj?.stageNumber || null,
           unit: m.unit,
           isPending,
           daysPending,
           delayAlert: isPending && daysPending > 15
         };
      }).filter(ms => ms.approved > 0 || ms.issued > 0);

      const overallProgress = materialSummaries.length > 0 
        ? (materialSummaries.reduce((acc, s) => acc + (s.issued / (s.approved || 1)), 0) / materialSummaries.length) * 100
        : 0;

      return {
        id: b.id,
        name: b.name,
        panchayatName: panchayats.find(p => p.id === b.panchayatId)?.name || 'Unknown',
        schemeName: scheme?.name || 'Unknown',
        materialSummaries,
        progress: overallProgress,
        isCompleted: materialSummaries.length > 0 && materialSummaries.every(s => s.issued >= s.approved)
      };
    });
  }, [beneficiaries, txIndexes.byBeneficiary, schemes, materialList, filter, panchayats]);

  const beneficiaryAnalytics = React.useMemo(() => {
    // Stage-wise issue counts
    const stageData: Record<number, number> = {};
    beneficiaryReport.forEach(b => {
      b.materialSummaries.forEach(ms => {
        stageData[ms.currentStage] = (stageData[ms.currentStage] || 0) + 1;
      });
    });
    const stageChart = Object.entries(stageData)
      .map(([stage, count]) => ({ name: `Stage ${stage}`, count }))
      .sort((a,b) => a.name.localeCompare(b.name));

    // Completion status
    const completed = beneficiaryReport.filter(b => b.isCompleted).length;
    const inProgress = beneficiaryReport.filter(b => !b.isCompleted && b.progress > 0).length;
    const pending = beneficiaryReport.length - completed - inProgress;
    const completionChart = [
      { name: 'Completed', value: completed, color: '#10b981' },
      { name: 'In Progress', value: inProgress, color: '#f59e0b' },
      { name: 'Pending', value: pending, color: '#cbd5e1' }
    ].filter(v => v.value > 0);

    // Panchayat counts
    const panchayatBens: Record<string, number> = {};
    beneficiaryReport.forEach(b => {
      panchayatBens[b.panchayatName] = (panchayatBens[b.panchayatName] || 0) + 1;
    });
    const panchayatChart = Object.entries(panchayatBens)
      .map(([name, count]) => ({ name, count }))
      .sort((a,b) => b.count - a.count);

    return { stageChart, completionChart, panchayatChart };
  }, [beneficiaryReport]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, activeTab]);

  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    let source: any[] = [];
    if (activeTab === 'LEDGER') source = ledgerData;
    else if (activeTab === 'MOVEMENT') source = filteredTransactions;
    else if (activeTab === 'SCHEME') source = schemeConsumption;
    else if (activeTab === 'BENEFICIARY') source = beneficiaryReport;
    else if (activeTab === 'PANCHAYAT') source = filter.panchayatIds.length === 0 ? panchayatStock : beneficiaryReport;
    else if (activeTab === 'OVERSEER') source = filter.overseerIds.length === 0 ? overseerReport : beneficiaryReport;
    
    return source.slice(start, start + itemsPerPage);
  }, [ledgerData, filteredTransactions, schemeConsumption, panchayatStock, overseerReport, beneficiaryReport, currentPage, activeTab, filter.panchayatIds, filter.overseerIds]);

  const totalItems = React.useMemo(() => {
    if (activeTab === 'LEDGER') return ledgerData.length;
    if (activeTab === 'MOVEMENT') return filteredTransactions.length;
    if (activeTab === 'SCHEME') return schemeConsumption.length;
    if (activeTab === 'BENEFICIARY') return beneficiaryReport.length;
    if (activeTab === 'PANCHAYAT') return filter.panchayatIds.length === 0 ? panchayatStock.length : beneficiaryReport.length;
    if (activeTab === 'OVERSEER') return filter.overseerIds.length === 0 ? overseerReport.length : beneficiaryReport.length;
    return 0;
  }, [activeTab, ledgerData, filteredTransactions, schemeConsumption, panchayatStock, overseerReport, beneficiaryReport, filter.panchayatIds, filter.overseerIds]);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const panchayatMap = React.useMemo(() => {
    const map: Record<string, Panchayat> = {};
    panchayats.forEach(p => map[p.id] = p);
    return map;
  }, [panchayats]);

  const overseerMap = React.useMemo(() => {
    const map: Record<string, Overseer> = {};
    overseers.forEach(o => map[o.id] = o);
    return map;
  }, [overseers]);

  const beneficiaryMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    beneficiaries.forEach(b => map[b.id] = b.name);
    return map;
  }, [beneficiaries]);

  const exportPDF = () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const now = new Date();
      
      // Header Section (Government Style)
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('GOVERNMENT OF THE STATE', 148, 20, { align: 'center' });
      doc.setFontSize(14);
      doc.text('ENGINEERING DEPARTMENT - MATERIAL STOCK LEDGER', 148, 30, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on: ${format(now, 'dd/MM/yyyy HH:mm')}`, 148, 38, { align: 'center' });
      
      // Filter Summary
      doc.setFontSize(8);
      doc.text(`Report Type: ${activeTab}`, 14, 45);
      doc.text(`Period: ${safeFormat(filter.startDate)} to ${safeFormat(filter.endDate)}`, 14, 50);
      doc.text(`Financial Year: ${filter.finYear}`, 14, 55);
      doc.text(`Materials: ${filter.materials.length === 0 ? 'All' : filter.materials.join(', ')}`, 14, 60);

      let tableHead: string[][] = [];
      let tableBody: any[][] = [];

      if (activeTab === 'LEDGER') {
        tableHead = [['Date', 'Panchayat', 'Scheme', 'Material', 'OB', 'Receipt', 'Issue', 'CB', 'Unit']];
        tableBody = ledgerData.map(t => [
          safeFormat(t.date),
          panchayatMap[t.panchayatId || '']?.name || 'Central',
          schemes.find(s => s.id === t.schemeId)?.name || 'N/A',
          t.material,
          t.isOpeningBalance ? (t as any).closingBalance?.toLocaleString() : (t as any).openingBalance?.toLocaleString() || '0',
          (t.type === 'RECEIPT' && !t.isOpeningBalance) ? t.quantity.toLocaleString() : '0',
          t.type === 'ISSUE' ? t.quantity.toLocaleString() : '0',
          (t as any).closingBalance?.toLocaleString() || '0',
          materialList.find(m => m.name === t.material)?.unit || 'Units'
        ]);
      } else if (activeTab === 'SCHEME') {
        tableHead = [['Scheme', 'Material', 'Total Receipt', 'Total Issue', 'Current Balance', 'Unit']];
        tableBody = schemeConsumption.map(s => [
          s.schemeName, s.material, s.receipt, s.issue, s.balance, s.unit
        ]);
      } else if (activeTab === 'MOVEMENT') {
        tableHead = [['Date', 'Time', 'Material', 'Type', 'Qty', 'Panchayat', 'Ref/Vehicle', 'Destination']];
        tableBody = filteredTransactions.map(t => [
          safeFormat(t.date), 
          format(new Date(t.timestamp), 'HH:mm'),
          t.material, 
          t.type, 
          t.quantity.toLocaleString(), 
          panchayatMap[t.panchayatId || '']?.name || 'Central',
          `${t.invoiceNo || t.permitNumber || 'N/A'}${t.vehicleNo ? ` [${t.vehicleNo}]` : ''}`,
          beneficiaryMap[t.beneficiaryId || ''] || 'Buffer'
        ]);
      } else if ((activeTab === 'OVERSEER' && filter.overseerIds.length > 0) || (activeTab === 'PANCHAYAT' && filter.panchayatIds.length > 0)) {
        tableHead = [['Beneficiary', 'Panchayat', 'Scheme', 'Material', 'Approved', 'Issued', 'Balance', 'Progress', 'Status']];
        tableBody = beneficiaryReport.flatMap(b => 
          b.materialSummaries.map(ms => [
            b.name, b.panchayatName, b.schemeName, ms.material, ms.approved, ms.issued, ms.balance, 
            `${Math.round((ms.issued / (ms.approved || 1)) * 100)}%`,
            ms.issued >= ms.approved ? 'Completed' : ms.issued > 0 ? 'Partial' : 'Pending'
          ])
        );
      } else if (activeTab === 'PANCHAYAT') {
        tableHead = [['Panchayat', 'Material', 'Stock', 'Unit']];
        tableBody = panchayatStock.flatMap(ps => ps.materials.map(m => [ps.panchayatName, m.name, m.stock, m.unit]));
      } else if (activeTab === 'OVERSEER') {
        tableHead = [['Overseer', 'Receipts', 'Issues', 'Last Movement']];
        tableBody = overseerReport.map(o => [o.overseerName, o.received, o.issued, safeFormat(o.lastTx)]);
      } else {
        tableHead = [['Summary Information', 'Value']];
        tableBody = [['This report section is designed for screen viewing. Please use main export for detailed ledgers.', '']];
      }

      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: 65,
        styles: { fontSize: 8, font: 'helvetica' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });

      // Signatures
      const finalY = (doc as any).lastAutoTable.finalY + 30;
      doc.text('____________________', 40, finalY);
      doc.text('Accountant/Clerk', 40, finalY + 5);
      
      doc.text('____________________', 148, finalY, { align: 'center' });
      doc.text('Head Overseer', 148, finalY + 5, { align: 'center' });

      doc.text('____________________', 250, finalY);
      doc.text('Executive Engineer', 250, finalY + 5);
      
      doc.save(`Engineering_Report_${activeTab}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error('PDF Export failed:', error);
      alert('Failed to generate PDF.');
    }
  };

  const exportExcel = () => {
    try {
      let data: any[] = [];
      if (activeTab === 'LEDGER') data = ledgerData;
      else if ((activeTab === 'OVERSEER' && filter.overseerIds.length > 0) || (activeTab === 'PANCHAYAT' && filter.panchayatIds.length > 0)) {
        data = beneficiaryReport.flatMap(b => b.materialSummaries.map(ms => ({
          Beneficiary: b.name,
          Panchayat: b.panchayatName,
          Scheme: b.schemeName,
          Material: ms.material,
          Approved: ms.approved,
          Issued: ms.issued,
          Balance: ms.balance,
          Progress: `${Math.round((ms.issued / (ms.approved || 1)) * 100)}%`,
          Status: ms.issued >= ms.approved ? 'Completed' : ms.issued > 0 ? 'Partial' : 'Pending',
          LastIssueDate: ms.lastIssueDate || 'N/A'
        })));
      } else if (activeTab === 'PANCHAYAT') {
        data = panchayatStock.flatMap(ps => ps.materials.map(m => ({ Panchayat: ps.panchayatName, Material: m.name, Stock: m.stock, Unit: m.unit })));
      } else if (activeTab === 'OVERSEER') {
        data = overseerReport.map(o => ({ Overseer: o.overseerName, Receipts: o.received, Issues: o.issued, LastMovement: o.lastTx }));
      } else data = filteredTransactions;
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Engineering_Report");
      XLSX.writeFile(wb, `Engineering_Report_${activeTab}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    } catch (error) {
       alert('Excel export failed.');
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header & Main Controls */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <div className="p-3 bg-slate-900 rounded-2xl text-white shadow-xl shadow-slate-900/20"><FileText className="w-8 h-8" /></div> Advanced Engineering Reports
            </h2>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] mt-2">Departmental Material Accounting & Verification System</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl hover:text-blue-600 hover:border-blue-200 transition text-[11px] font-black uppercase tracking-widest text-slate-700 active:scale-95 shadow-sm"
            >
              <Printer className="w-4 h-4" /> Print Ledger
            </button>
            <button 
              onClick={exportPDF}
              className="flex items-center gap-2 px-6 py-3 bg-slate-100 border border-slate-200 rounded-2xl hover:bg-slate-200 transition text-[11px] font-black uppercase tracking-widest text-slate-700 active:scale-95 shadow-sm"
            >
              <FileText className="w-4 h-4" /> PDF Report
            </button>
            <button 
              onClick={exportExcel}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition text-[11px] font-black uppercase tracking-widest active:scale-95 shadow-lg shadow-emerald-900/10"
            >
              <Download className="w-4 h-4" /> Excel Ledger
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100 mb-8">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
              Period Range
              <span className="text-blue-600">Fin Year: {filter.finYear}</span>
            </label>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-blue-100 font-bold"
                value={filter.startDate}
                onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
              />
              <span className="text-slate-300">-</span>
              <input 
                type="date" 
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-blue-100 font-bold"
                value={filter.endDate}
                onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
              />
            </div>
          </div>
          
          <MultiSelect 
            label="Resource Materials" 
            placeholder="All Assets"
            options={materialList.map(m => ({ id: m.name, name: m.name }))}
            selected={filter.materials}
            onChange={(m) => setFilter({ ...filter, materials: m })}
          />

          <MultiSelect 
            label="Target Overseers" 
            placeholder="All Overseers"
            options={overseers.map(o => ({ id: o.id, name: o.name }))}
            selected={filter.overseerIds}
            onChange={(o) => setFilter({ ...filter, overseerIds: o, panchayatIds: [] })}
          />

          <MultiSelect 
            label="Target Panchayats" 
            placeholder="All Panchayats"
            options={panchayats.filter(p => filter.overseerIds.length === 0 || filter.overseerIds.includes(p.overseerId)).map(p => ({ id: p.id, name: p.name }))}
            selected={filter.panchayatIds}
            onChange={(p) => setFilter({ ...filter, panchayatIds: p })}
          />

          <MultiSelect 
            label="Target Schemes" 
            placeholder="All Schemes"
            options={schemes.map(s => ({ id: s.id, name: s.name }))}
            selected={filter.schemeIds}
            onChange={(s) => setFilter({ ...filter, schemeIds: s })}
          />

          <div className="space-y-1.5 md:col-span-1">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Year Selection</label>
             <select 
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-blue-100 font-bold text-slate-700"
              value={filter.finYear}
              onChange={(e) => setFilter({ ...filter, finYear: e.target.value })}
             >
               {/* Last 5 years */}
               {(() => {
                 const curr = new Date().getFullYear();
                 return Array.from({length: 5}, (_, i) => {
                   const y = curr - i;
                   return <option key={y} value={`${y}-${y+1}`}>{y}-{y+1}</option>
                 })
               })()}
             </select>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 gap-8">
           {(['LEDGER', 'SCHEME', 'PANCHAYAT', 'OVERSEER', 'MOVEMENT', 'BENEFICIARY'] as const).map(tab => (
             <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
             >
               {tab.replace('_', ' ')}
               {activeTab === tab && (
                 <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
               )}
             </button>
           ))}
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
        {activeTab === 'LEDGER' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase font-black tracking-widest text-slate-400">
                <tr>
                  <th className="px-8 py-5">Date</th>
                  <th className="px-6 py-5">Locality</th>
                  <th className="px-6 py-5">Scheme</th>
                  <th className="px-6 py-5">Material</th>
                  <th className="px-5 py-5 text-right">OB</th>
                  <th className="px-5 py-5 text-right text-emerald-600">Receipt</th>
                  <th className="px-5 py-5 text-right text-amber-600">Issue</th>
                  <th className="px-8 py-5 text-right font-black text-slate-900">CB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedData.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors text-xs">
                    <td className="px-8 py-4 text-slate-400 font-medium">{safeFormat(t.date)}</td>
                    <td className="px-6 py-4 font-bold text-slate-600">{panchayatMap[t.panchayatId || '']?.name || 'Central'}</td>
                    <td className="px-6 py-4 font-bold text-slate-600 truncate max-w-[150px]">{schemes.find(s => s.id === t.schemeId)?.name || 'N/A'}</td>
                    <td className="px-6 py-4 font-black">
                       <span className="text-slate-900 uppercase">{t.material}</span>
                       <p className="text-[9px] text-slate-400 font-bold">{materialList.find(m => m.name === t.material)?.unit}</p>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-slate-500">
                      {t.isOpeningBalance ? t.closingBalance?.toLocaleString() : t.openingBalance?.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right font-black text-emerald-600">
                      {t.type === 'RECEIPT' && !t.isOpeningBalance ? `+${t.quantity.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-5 py-4 text-right font-black text-amber-600">{t.type === 'ISSUE' ? t.quantity.toLocaleString() : '-'}</td>
                    <td className="px-8 py-4 text-right font-black text-slate-900 bg-slate-50/20">{t.closingBalance?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'SCHEME' && (
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedData.map(s => (
              <div key={`${s.schemeId}_${s.material}`} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-all">
                <div className="flex justify-between items-start mb-4">
                   <h4 className="text-xs font-black text-slate-900 uppercase leading-relaxed">{s.schemeName}</h4>
                   <span className="px-2 py-0.5 bg-white border border-slate-200 text-[8px] font-black rounded uppercase tracking-widest">{s.unit}</span>
                </div>
                <p className="text-[10px] font-bold text-blue-600 mb-6 border-b border-blue-100 pb-2">{s.material}</p>
                <div className="grid grid-cols-3 gap-4">
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">Receipts</p>
                      <p className="font-black text-emerald-600 font-mono">{s.receipt.toLocaleString()}</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">Issues</p>
                      <p className="font-black text-amber-600 font-mono">{s.issue.toLocaleString()}</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">Balance</p>
                      <p className="font-black text-slate-900 font-mono">{s.balance.toLocaleString()}</p>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'OVERSEER' && (
           <div className="overflow-x-auto">
             {filter.overseerIds.length === 0 ? (
               <table className="w-full text-left">
                 <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase font-black tracking-widest text-slate-400">
                    <tr>
                      <th className="px-8 py-5">Head Overseer</th>
                      <th className="px-8 py-5 text-right">Leading Stage</th>
                      <th className="px-8 py-5 text-right">Cumulative Receipts</th>
                      <th className="px-8 py-5 text-right">Cumulative Issues</th>
                      <th className="px-8 py-5 text-right">Last Movement</th>
                      <th className="px-8 py-5 text-center">Audit Status</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {paginatedData.map(o => {
                      // Calculate leading stage for this overseer
                      const ps = panchayats.filter(p => p.overseerId === o.overseerId).map(p => p.id);
                      const bens = beneficiaryReport.filter(b => ps.includes(b.panchayatId));
                      const stageCounts: Record<number, number> = {};
                      bens.forEach(b => {
                        b.materialSummaries.forEach(ms => {
                          stageCounts[ms.currentStage] = (stageCounts[ms.currentStage] || 0) + 1;
                        });
                      });
                      const leading = Object.entries(stageCounts).sort((a,b) => b[1] - a[1])[0];
                      const leadingLabel = leading ? `Stage ${leading[0]} (${leading[1]})` : 'N/A';

                      return (
                        <tr key={o.overseerId} className="hover:bg-slate-50/50 transition-colors text-xs">
                          <td className="px-8 py-6">
                            <p className="font-black text-slate-900 uppercase">{o.overseerName}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{ps.length} Assigned Panchayats</p>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-blue-100">
                               {leadingLabel}
                             </span>
                          </td>
                          <td className="px-8 py-6 text-right font-black text-emerald-600">+{o.received.toLocaleString()} units</td>
                          <td className="px-8 py-6 text-right font-black text-red-600">-{o.issued.toLocaleString()} units</td>
                          <td className="px-8 py-6 text-right font-bold text-slate-500">{safeFormat(o.lastTx)}</td>
                          <td className="px-8 py-6 text-center">
                             <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase">Verified</span>
                          </td>
                        </tr>
                      );
                    })}
                 </tbody>
               </table>
             ) : (
               <BeneficiaryMovementAudit 
                  data={paginatedData} 
                  analytics={beneficiaryAnalytics} 
                  title={`Overseer Audit: ${filter.overseerIds.length === 1 ? (overseerMap[filter.overseerIds[0]]?.name || 'Selection') : 'Multi-Overseer Selection'}`}
               />
             )}
           </div>
        )}

        {activeTab === 'PANCHAYAT' && (
           <div className="w-full">
             {filter.panchayatIds.length === 0 ? (
               <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {paginatedData.map(ps => (
                  <div key={ps.panchayatId} className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                    <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                       <h4 className="text-xs font-black uppercase tracking-widest">{ps.panchayatName}</h4>
                       <MapPin className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="p-6 space-y-4">
                      {ps.materials.map(m => (
                        <div key={m.name} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                           <div>
                              <p className="text-[10px] font-black text-slate-900 uppercase">{m.name}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{m.unit}</p>
                           </div>
                           <div className="text-right">
                              <p className={`font-black text-sm ${m.stock < 0 ? 'text-red-600' : 'text-slate-900'}`}>{m.stock.toLocaleString()}</p>
                              {m.stock <= 0 && <span className="text-[8px] font-black text-red-500 uppercase animate-pulse">Critical Level</span>}
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
             ) : (
               <BeneficiaryMovementAudit 
                  data={paginatedData} 
                  analytics={beneficiaryAnalytics} 
                  title={`Panchayat Audit: ${filter.panchayatIds.length === 1 ? (panchayatMap[filter.panchayatIds[0]]?.name || 'Selection') : 'Multi-Panchayat Selection'}`}
               />
             )}
           </div>
        )}

        {activeTab === 'MOVEMENT' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase font-black tracking-widest text-slate-400">
                <tr>
                  <th className="px-8 py-5">Date/Time</th>
                  <th className="px-6 py-5">Asset</th>
                  <th className="px-6 py-5 text-center">Type</th>
                  <th className="px-6 py-5">Vehicle/Supplier</th>
                  <th className="px-6 py-5">Destination</th>
                  <th className="px-8 py-5 text-right">Impact Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {paginatedData.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4 font-medium text-slate-400">
                      {safeFormat(t.date)}
                      <p className="text-[9px] opacity-75">{format(new Date(t.timestamp), 'HH:mm:ss')}</p>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-900 uppercase">{t.material}</td>
                    <td className="px-6 py-4 text-center">
                       <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border ${t.type === 'RECEIPT' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                         {t.type}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <p className="font-bold text-slate-700">{t.invoiceNo ? `Inv: ${t.invoiceNo}` : 'Direct Entry'}</p>
                       <div className="flex gap-2">
                         {t.permitNumber && <span className="text-[9px] text-blue-600 font-bold uppercase tracking-widest">Permit: {t.permitNumber}</span>}
                         {t.vehicleNo && <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Veh: {t.vehicleNo}</span>}
                       </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-600 underline decoration-slate-200 underline-offset-4">
                       {beneficiaryMap[t.beneficiaryId || ''] || 'Engineering Yard'}
                    </td>
                    <td className={`px-8 py-4 text-right font-black ${t.type === 'RECEIPT' ? 'text-emerald-700' : 'text-slate-900'}`}>
                       {t.type === 'RECEIPT' ? '+' : '-'}{t.quantity.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'BENEFICIARY' && (
           <div className="w-full">
               <BeneficiaryMovementAudit 
                  data={paginatedData} 
                  analytics={beneficiaryAnalytics} 
                  title="Master Beneficiary Dispatch Audit"
               />
           </div>
        )}

        {totalItems === 0 && (
          <div className="flex flex-col items-center justify-center p-32 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 border border-slate-100">
               <Filter className="w-8 h-8 text-slate-300" />
            </div>
            <h5 className="text-sm font-black text-slate-900 uppercase tracking-widest">No Statistical Records</h5>
            <p className="text-xs text-slate-400 mt-2 italic">Refine your audit filters to locate departmental data</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-8 py-6 bg-white border border-slate-200 rounded-3xl shadow-sm">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Audit Page: {currentPage} of {totalPages}</span>
           <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-6 py-2 bg-slate-50 text-slate-900 rounded-xl text-[10px] font-black uppercase disabled:opacity-20 transition"
              >Prev</button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase disabled:opacity-20 transition"
              >Next</button>
           </div>
        </div>
      )}
    </div>
  );
}

function MultiSelect({ label, options, selected, onChange, placeholder }: { 
  label: string, 
  options: { id: string, name: string }[], 
  selected: string[], 
  onChange: (selected: string[]) => void,
  placeholder: string
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-1.5 relative">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-blue-100 font-bold text-slate-700 text-left flex justify-between items-center group transition-all hover:border-slate-300"
      >
        <span className="truncate max-w-[150px]">
          {selected.length === 0 ? placeholder : `${selected.length} Selected`}
        </span>
        <Filter className={`w-3 h-3 transition-colors ${isOpen ? 'text-blue-500' : 'text-slate-400'}`} />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-20 max-h-60 overflow-y-auto p-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2">
            <div 
              className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
              onClick={() => onChange([])}
            >
              <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${selected.length === 0 ? 'bg-slate-900 border-slate-900' : 'border-slate-300'}`}>
                {selected.length === 0 && <div className="w-1 h-1 bg-white rounded-full" />}
              </div>
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">All Options</span>
            </div>
            <div className="h-px bg-slate-100 my-1 mx-2" />
            {options.map(opt => (
              <div 
                key={opt.id}
                className="flex items-center gap-2 p-2 hover:bg-blue-50 rounded-lg cursor-pointer group transition-colors"
                onClick={() => {
                  const newSelected = selected.includes(opt.id)
                    ? selected.filter(id => id !== opt.id)
                    : [...selected, opt.id];
                  onChange(newSelected);
                }}
              >
                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${selected.includes(opt.id) ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-200' : 'border-slate-300 group-hover:border-blue-300'}`}>
                   {selected.includes(opt.id) && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
                <span className={`text-[10px] font-bold transition-colors ${selected.includes(opt.id) ? 'text-blue-700' : 'text-slate-600'}`}>{opt.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BeneficiaryMovementAudit({ data, analytics, title }: { data: any[], analytics: any, title: string }) {
  return (
    <div className="space-y-8">
      {/* Report Custom Header */}
      <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
         <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">{title}</h4>
         <div className="flex gap-4">
            <div className="flex items-center gap-2">
               <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
               <span className="text-[9px] font-black text-slate-400 uppercase">Completed</span>
            </div>
            <div className="flex items-center gap-2">
               <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>
               <span className="text-[9px] font-black text-slate-400 uppercase">In Progress</span>
            </div>
         </div>
      </div>

      {/* Beneficiary Engineering Infographics */}
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-slate-50/50 border-b border-slate-100">
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
              <LayoutDashboard className="w-3 h-3" /> Area Scope
            </p>
            <p className="text-3xl font-black text-slate-900">{data.length}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase mt-2">Active beneficiaries</p>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Issue Coverage</p>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-black text-emerald-700">{data.filter(b => b.progress > 0).length}</p>
              <span className="text-xs font-black text-emerald-600 mb-1">{Math.round((data.filter(b => b.progress > 0).length / (data.length || 1)) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(data.filter(b => b.progress > 0).length / (data.length || 1)) * 100}%` }}></div>
            </div>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Avg Movement</p>
            <p className="text-3xl font-black text-amber-700">{Math.round(data.reduce((acc, b) => acc + b.progress, 0) / (data.length || 1))}%</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase mt-2">Completion index</p>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1 flex items-center gap-2">
              <AlertCircle className="w-3 h-3" /> Audit Dues
            </p>
            <p className="text-3xl font-black text-red-700">{data.filter(b => b.materialSummaries.some((s: any) => s.delayAlert)).length}</p>
            <p className="text-[9px] text-red-400 font-bold uppercase mt-2">Pending &gt; 15 days</p>
         </div>
      </div>

      {/* Main Registry Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase font-black tracking-widest text-slate-400 font-mono">
            <tr>
              <th className="px-8 py-5">Beneficiary Details</th>
              <th className="px-6 py-5">Material Progression (Current Stage)</th>
              <th className="px-6 py-5 text-right">Dispatch Metrics</th>
              <th className="px-8 py-5 text-center">Audit Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.map(b => (
              <tr key={b.id} className="hover:bg-slate-50/50 transition-colors text-xs align-top">
                <td className="px-8 py-6">
                  <p className="font-black text-slate-900 text-sm uppercase tracking-tight">{b.name}</p>
                  <div className="flex items-center gap-2 mt-2">
                     <MapPin className="w-3 h-3 text-slate-300" />
                     <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{b.panchayatName}</p>
                  </div>
                  <p className="text-[9px] text-slate-500 font-mono mt-3 bg-slate-100 inline-block px-2 py-0.5 rounded">SCHEME: {b.schemeName}</p>
                </td>
                <td className="px-6 py-6 font-mono">
                  <div className="space-y-3">
                    {b.materialSummaries.map((ms: any, idx: number) => (
                       <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100">
                          <span className="text-[9px] font-black text-slate-900 uppercase">{ms.material}</span>
                          <div className="flex items-center gap-3">
                             <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${ms.currentStage > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                               Stage {ms.currentStage || 0}
                             </span>
                             <span className="text-[9px] font-bold text-slate-500">
                               {ms.issued.toLocaleString()} / {ms.approved.toLocaleString()} {ms.unit}
                             </span>
                          </div>
                       </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-6 text-right">
                   <div className="inline-flex flex-col items-end">
                      <p className="text-2xl font-black text-slate-900">{Math.round(b.progress)}%</p>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Completion</span>
                   </div>
                </td>
                <td className="px-8 py-6 text-center">
                   <div className={`px-4 py-1.5 rounded-2xl text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-2 border shadow-sm ${b.isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : b.progress > 0 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                     {b.isCompleted ? 'Finalized' : b.progress > 0 ? 'Active Flow' : 'Pending'}
                   </div>
                   <p className="text-[8px] font-bold text-slate-300 uppercase mt-2 font-mono">
                     Last Movement: {b.materialSummaries[0]?.lastIssueDate ? safeFormat(b.materialSummaries[0].lastIssueDate) : 'None'}
                   </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
