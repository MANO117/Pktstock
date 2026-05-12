import React, { useState, useMemo } from 'react';
import { Storage } from '../lib/storage';
import { useData } from './DataProvider';
import { StockTransaction, MaterialType, Scheme, Overseer, Panchayat } from '../types';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Calendar, 
  Filter,
  Users,
  MapPin,
  ChevronDown
} from 'lucide-react';
import { 
  format, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  isWithinInterval,
  parseISO,
  subDays
} from 'date-fns';

interface DashboardOverviewProps {
  onNavigate: (tab: any) => void;
  isAdmin: boolean;
}

export default function DashboardOverview({ onNavigate, isAdmin }: DashboardOverviewProps) {
  const { transactions, schemes, overseers, panchayats, materials: allMaterials } = useData();
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialType | 'All'>('All');

  const materials = useMemo(() => allMaterials.map(m => m.name), [allMaterials]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const dateMatch = isWithinInterval(parseISO(t.date), {
        start: startOfDay(parseISO(dateRange.start)),
        end: endOfDay(parseISO(dateRange.end))
      });
      const materialMatch = selectedMaterial === 'All' || t.material === selectedMaterial;
      return dateMatch && materialMatch;
    });
  }, [transactions, dateRange, selectedMaterial]);

  // Totals
  const receiptsCount = filteredTransactions.filter(t => t.type === 'RECEIPT').length;
  const issuesCount = filteredTransactions.filter(t => t.type === 'ISSUE').length;

  // Stock Balance Logic
  const calculateBalances = (material: MaterialType) => {
    const allBefore = transactions.filter(t => t.material === material && parseISO(t.date) < startOfDay(parseISO(dateRange.start)));
    const opening = allBefore.reduce((acc, t) => acc + (t.type === 'RECEIPT' ? t.quantity : -t.quantity), 0);
    
    const during = transactions.filter(t => t.material === material && isWithinInterval(parseISO(t.date), {
      start: startOfDay(parseISO(dateRange.start)),
      end: endOfDay(parseISO(dateRange.end))
    }));
    
    const receipts = during.filter(t => t.type === 'RECEIPT').reduce((acc, t) => acc + t.quantity, 0);
    const issues = during.filter(t => t.type === 'ISSUE').reduce((acc, t) => acc + t.quantity, 0);
    
    return { opening, receipts, issues, closing: opening + receipts - issues };
  };
  
  // Frequency Stats
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const dailyIssuesQty = transactions
    .filter(t => t.type === 'ISSUE' && isWithinInterval(parseISO(t.date), { start: dayStart, end: dayEnd }))
    .reduce((acc, t) => acc + t.quantity, 0);

  const weeklyIssuesQty = transactions
    .filter(t => t.type === 'ISSUE' && isWithinInterval(parseISO(t.date), { start: startOfWeek(now), end: endOfWeek(now) }))
    .reduce((acc, t) => acc + t.quantity, 0);

  const monthlyIssuesQty = transactions
    .filter(t => t.type === 'ISSUE' && isWithinInterval(parseISO(t.date), { start: startOfMonth(now), end: endOfMonth(now) }))
    .reduce((acc, t) => acc + t.quantity, 0);

  const yearlyIssuesQty = transactions
    .filter(t => t.type === 'ISSUE' && isWithinInterval(parseISO(t.date), { start: startOfYear(now), end: endOfYear(now) }))
    .reduce((acc, t) => acc + t.quantity, 0);

  // Rankings
  const overseerIssues = overseers.map(o => {
    const pIds = panchayats.filter(p => p.overseerId === o.id).map(p => p.id);
    const totalQty = transactions
      .filter(t => t.type === 'ISSUE' && t.panchayatId && pIds.includes(t.panchayatId))
      .reduce((acc, t) => acc + t.quantity, 0);
    return { ...o, totalQty };
  }).sort((a, b) => b.totalQty - a.totalQty);

  const panchayatAllocations = panchayats.map(p => {
    const totalQty = transactions
      .filter(t => t.type === 'ISSUE' && t.panchayatId === p.id)
      .reduce((acc, t) => acc + t.quantity, 0);
    return { ...p, totalQty };
  }).sort((a, b) => b.totalQty - a.totalQty);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header & Main Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase tracking-widest flex items-center gap-3">
             <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/20"><BarChart3 className="w-6 h-6" /></div>
             Executive Analytics
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-tighter mt-1">Real-time infrastructure stock intelligence</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 border-r pr-4 border-slate-100">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input 
              type="date" 
              className="text-xs font-bold outline-none bg-transparent"
              value={dateRange.start}
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
            />
            <span className="text-slate-300">to</span>
            <input 
              type="date" 
              className="text-xs font-bold outline-none bg-transparent"
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              className="text-xs font-bold outline-none bg-transparent appearance-none cursor-pointer pr-4"
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value as any)}
            >
              <option value="All">All Materials</option>
              {materials.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Frequency Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Issues Today', count: dailyIssuesQty, color: 'blue' },
          { label: 'Weekly Issues', count: weeklyIssuesQty, color: 'indigo' },
          { label: 'Monthly Issues', count: monthlyIssuesQty, color: 'emerald' },
          { label: 'Yearly Issues', count: yearlyIssuesQty, color: 'amber' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-400 transition-colors">
            <div className={`text-3xl font-black text-slate-900 mb-1 group-hover:text-${stat.color}-600 transition-colors`}>
              {Math.round(stat.count).toLocaleString()}
            </div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{stat.label}</div>
            <div className={`absolute -right-4 -bottom-4 w-16 h-16 bg-${stat.color}-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity`}></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ledger Overview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" /> Stock Balances
              </h3>
              <p className="text-[10px] text-slate-400 font-bold italic">Calculated for selected period</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                    <th className="px-8 py-4">Asset Name</th>
                    <th className="px-4 py-4 text-right">Opening</th>
                    <th className="px-4 py-4 text-right text-emerald-600">Receipts (+)</th>
                    <th className="px-4 py-4 text-right text-amber-600">Issues</th>
                    <th className="px-8 py-4 text-right bg-slate-50/50">Closing</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-50">
                  {materials.filter(m => selectedMaterial === 'All' || m === selectedMaterial).map(m => {
                    const bal = calculateBalances(m);
                    return (
                      <tr key={m} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-4 font-bold text-slate-800">{m}</td>
                        <td className="px-4 py-4 text-right font-medium text-slate-500">{Math.round(bal.opening).toLocaleString()}</td>
                        <td className="px-4 py-4 text-right font-bold text-emerald-600">+{Math.round(bal.receipts).toLocaleString()}</td>
                        <td className="px-4 py-4 text-right font-bold text-amber-600">{Math.round(bal.issues).toLocaleString()}</td>
                        <td className="px-8 py-4 text-right font-black bg-blue-50/20 text-blue-900">{Math.round(bal.closing).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activity Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><TrendingUp className="w-5 h-5" /></div>
                  <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">Receipt Highlights</h4>
                </div>
                <div className="space-y-4">
                  {filteredTransactions.filter(t => t.type === 'RECEIPT').slice(0, 3).map(tx => (
                    <div key={tx.id} className="flex justify-between items-center pb-3 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-xs font-bold text-slate-700">{tx.material}</p>
                        <p className="text-[9px] text-slate-400 font-medium">Invoice: {tx.invoiceNo || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-emerald-600">+{Math.round(tx.quantity).toLocaleString()}</p>
                        <p className="text-[8px] text-slate-400 uppercase font-black">{format(parseISO(tx.date), 'MMM d')}</p>
                      </div>
                    </div>
                  ))}
                  {receiptsCount === 0 && <p className="text-center py-6 text-slate-400 text-[10px] italic">No receipts in range</p>}
                </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><TrendingDown className="w-5 h-5" /></div>
                  <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">Distribution Flow</h4>
                </div>
                <div className="space-y-4">
                  {filteredTransactions.filter(t => t.type === 'ISSUE').slice(0, 3).map(tx => (
                    <div key={tx.id} className="flex justify-between items-center pb-3 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-xs font-bold text-slate-700">{tx.material}</p>
                        <p className="text-[9px] text-slate-400 font-medium">{panchayats.find(p => p.id === tx.panchayatId)?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-amber-600">{Math.round(tx.quantity).toLocaleString()}</p>
                        <p className="text-[8px] text-slate-400 uppercase font-black">{format(parseISO(tx.date), 'MMM d')}</p>
                      </div>
                    </div>
                  ))}
                  {issuesCount === 0 && <p className="text-center py-6 text-slate-400 text-[10px] italic">No issues in range</p>}
                </div>
            </div>
          </div>
        </div>

        {/* Sidebar Rankings */}
        <div className="space-y-8">
           {/* Overseer Ranking */}
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-[0.2em] mb-6 flex items-center justify-between">
                 Staff Efficiency <Users className="w-4 h-4 text-blue-500" />
              </h3>
              <div className="space-y-4">
                 {overseerIssues.slice(0, 5).map((o, idx) => (
                   <div key={o.id} className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-amber-100 text-amber-700 shadow-md shadow-amber-500/10' : 'bg-slate-100 text-slate-500'}`}>
                         {idx + 1}
                      </div>
                      <div className="flex-1">
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-800 tracking-tight">{o.name}</span>
                            <span className="text-[10px] font-black text-blue-600">{o.totalQty.toLocaleString()} Units</span>
                         </div>
                         <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                            <div 
                              className="bg-blue-600 h-full rounded-full transition-all duration-1000" 
                              style={{ width: `${(o.totalQty / Math.max(...overseerIssues.map(oi => oi.totalQty), 1)) * 100}%` }}
                            ></div>
                         </div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           {/* Panchayat Allocation */}
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-[0.2em] mb-6 flex items-center justify-between">
                 Zone Allocation <MapPin className="w-4 h-4 text-emerald-500" />
              </h3>
              <div className="space-y-4">
                 {panchayatAllocations.slice(0, 5).map((p, idx) => (
                   <div key={p.id} className="flex items-center gap-4">
                      <div className="flex-1">
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-800 tracking-tight">{p.name}</span>
                            <span className="text-[10px] font-black text-slate-500">{p.totalQty.toLocaleString()} Total</span>
                         </div>
                         <div className="w-full bg-slate-50 h-1.5 rounded-full overflow-hidden border border-slate-100">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                              style={{ width: `${(p.totalQty / Math.max(...panchayatAllocations.map(pa => pa.totalQty), 1)) * 100}%` }}
                            ></div>
                         </div>
                      </div>
                   </div>
                 ))}
              </div>
              <button 
                onClick={() => onNavigate('view')}
                className="w-full mt-6 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all"
              >
                View Full Scale Ledger
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
