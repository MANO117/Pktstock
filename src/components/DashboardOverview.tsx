import React, { useState, useMemo } from 'react';
import { Storage } from '../lib/storage';
import { useData } from './DataProvider';
import { StockTransaction, MaterialType, Scheme, Overseer, Panchayat } from '../types';
import { 
  Package, 
  Calendar, 
  Users,
  Activity,
  ClipboardList
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
  subDays,
  eachDayOfInterval,
  isSameDay
} from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardOverviewProps {
  onNavigate: (tab: any) => void;
  isAdmin: boolean;
}

export default function DashboardOverview({ onNavigate, isAdmin }: DashboardOverviewProps) {
  const { transactions, schemes, overseers, panchayats, materials: allMaterials, beneficiaries } = useData();
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  // Pre-process transactions for faster lookup
  const txIndexes = useMemo(() => {
    const byBeneficiary: Record<string, StockTransaction[]> = {};
    const byMaterial: Record<string, StockTransaction[]> = {};
    
    transactions.forEach(t => {
      if (t.beneficiaryId) {
        if (!byBeneficiary[t.beneficiaryId]) byBeneficiary[t.beneficiaryId] = [];
        byBeneficiary[t.beneficiaryId].push(t);
      }
      if (!byMaterial[t.material]) byMaterial[t.material] = [];
      byMaterial[t.material].push(t);
    });
    
    return { byBeneficiary, byMaterial };
  }, [transactions]);

  // Calculate opening, receipts, issues, closing for all materials
  const materialSummary = useMemo(() => {
    const start = startOfDay(parseISO(dateRange.start));
    const end = endOfDay(parseISO(dateRange.end));

    return allMaterials.map(m => {
      let opening = 0;
      let receipts = 0;
      let issues = 0;

      const matTxs = txIndexes.byMaterial[m.name] || [];
      matTxs.forEach(t => {
        const tDate = parseISO(t.date);
        const amount = t.type === 'RECEIPT' ? t.quantity : -t.quantity;

        if (tDate < start || (t.isOpeningBalance && tDate <= end)) {
          opening += amount;
        } else if (tDate <= end) {
          if (t.type === 'RECEIPT') receipts += t.quantity;
          else issues += t.quantity;
        }
      });

      return {
        name: m.name,
        unit: m.unit,
        opening,
        receipts,
        issues,
        closing: opening + receipts - issues
      };
    });
  }, [allMaterials, txIndexes.byMaterial, dateRange]);

  // Overseer Performance (Stage-wise leading)
  const overseerPerformance = useMemo(() => {
    return overseers.map(o => {
      const assignedPanchayats = new Set(panchayats.filter(p => p.overseerId === o.id).map(p => p.id));
      const assignedBens = beneficiaries.filter(b => assignedPanchayats.has(b.panchayatId));
      
      let totalProgress = 0;
      const stageDistribution: Record<number, number> = {};

      assignedBens.forEach(b => {
        let maxSt = 0;
        const benTxs = txIndexes.byBeneficiary[b.id] || [];
        benTxs.forEach(t => {
          if (t.type === 'ISSUE') {
            if ((t.stage || 1) > maxSt) maxSt = t.stage || 1;
          }
        });
        if (maxSt > 0) {
          stageDistribution[maxSt] = (stageDistribution[maxSt] || 0) + 1;
          totalProgress += 1;
        }
      });

      const leadingStage = Object.entries(stageDistribution).sort((a,b) => Number(b[0]) - Number(a[0]))[0];

      return {
        id: o.id,
        name: o.name,
        activeBens: assignedBens.length,
        progressedBens: totalProgress,
        leadingStage: leadingStage ? `Stage ${leadingStage[0]}` : 'N/A',
        leadingCount: leadingStage ? leadingStage[1] : 0,
        panchayatCount: assignedPanchayats.size
      };
    }).sort((a,b) => b.progressedBens - a.progressedBens);
  }, [overseers, panchayats, beneficiaries, txIndexes.byBeneficiary]);

  // Calculate overseer-stage details if an overseer is selected
  const [activeOverseerId, setActiveOverseerId] = useState<string | null>(null);

  const overseerStageDetails = useMemo(() => {
    if (!activeOverseerId) return null;
    
    const o = overseers.find(ov => ov.id === activeOverseerId);
    if (!o) return null;

    const assignedPanchayatIds = new Set(panchayats.filter(p => p.overseerId === o.id).map(p => p.id));
    const assignedBens = beneficiaries.filter(b => assignedPanchayatIds.has(b.panchayatId));
    const assignedBenIds = new Set(assignedBens.map(b => b.id));
    
    // Get unique stages from all schemes
    const stagesFromSchemes = new Set<number>();
    schemes.forEach(s => {
      if (s.materialStages) {
        Object.keys(s.materialStages).forEach(matKey => {
          const stagesList = s.materialStages![matKey];
          stagesList.forEach(st => stagesFromSchemes.add(st.stageNumber));
        });
      }
    });

    if (stagesFromSchemes.size === 0) {
      transactions.forEach(t => {
        if (t.stage) stagesFromSchemes.add(t.stage);
      });
    }

    if (stagesFromSchemes.size === 0) stagesFromSchemes.add(1);

    const sortedStages = Array.from(stagesFromSchemes).sort((a, b) => a - b);

    const details = sortedStages.map(st => {
      const matStats: Record<string, { eligible: number, taken: number, pending: number, quantity: number }> = {};
      const stageEligibleBens = new Set<string>();
      const stageTakenBens = new Set<string>();
      let stageTotalQuantity = 0;
      
      allMaterials.forEach(m => {
        const bensEligibleForStage = assignedBens.filter(b => {
          const scheme = schemes.find(s => s.id === b.schemeId);
          return scheme?.materialStages?.[m.name]?.some(stage => stage.stageNumber === st);
        });

        const matTxs = txIndexes.byMaterial[m.name] || [];
        const txsAtStage = matTxs.filter(t => 
          t.stage === st && 
          t.type === 'ISSUE' &&
          t.beneficiaryId && assignedBenIds.has(t.beneficiaryId)
        );

        const bensWhoTookIds = Array.from(new Set(txsAtStage.map(t => t.beneficiaryId as string)));
        const bensWhoTookCount = bensWhoTookIds.length;
        const totalQty = txsAtStage.reduce((acc, curr) => acc + curr.quantity, 0);
        
        if (bensEligibleForStage.length > 0 || bensWhoTookCount > 0) {
          const pendingValue = Math.max(0, bensEligibleForStage.length - bensWhoTookCount);

          matStats[m.name] = {
            eligible: bensEligibleForStage.length,
            taken: bensWhoTookCount,
            pending: pendingValue,
            quantity: totalQty
          };

          bensEligibleForStage.forEach(b => stageEligibleBens.add(b.id as string));
          bensWhoTookIds.forEach(id => stageTakenBens.add(id as string));
          stageTotalQuantity += totalQty;
        }
      });

      return {
        stage: `Stage ${st}`,
        materials: matStats,
        totals: {
          eligible: stageEligibleBens.size,
          taken: stageTakenBens.size,
          pending: Math.max(0, stageEligibleBens.size - stageTakenBens.size),
          quantity: stageTotalQuantity
        }
      };
    });

    return {
      overseerName: o.name,
      totalBens: assignedBens.length,
      stages: details
    };
  }, [activeOverseerId, overseers, panchayats, beneficiaries, transactions, txIndexes.byMaterial, allMaterials, schemes]);

  // Calculate Material-wise Grand Totals for the selected overseer
  const materialGrandTotals = useMemo(() => {
    if (!activeOverseerId) return [];
    
    const o = overseers.find(ov => ov.id === activeOverseerId);
    if (!o) return [];

    const assignedPanchayatIds = new Set(panchayats.filter(p => p.overseerId === o.id).map(p => p.id));
    const assignedBens = beneficiaries.filter(b => assignedPanchayatIds.has(b.panchayatId));
    const assignedBenIds = new Set(assignedBens.map(b => b.id));

    return allMaterials.map(m => {
      const eligibleBens = assignedBens.filter(b => {
        const scheme = schemes.find(s => s.id === b.schemeId);
        return scheme?.materialStages?.[m.name] && Object.keys(scheme.materialStages[m.name]).length > 0;
      });

      const matTxs = txIndexes.byMaterial[m.name] || [];
      const txs = matTxs.filter(t => 
        t.type === 'ISSUE' &&
        t.beneficiaryId && assignedBenIds.has(t.beneficiaryId)
      );

      const uniqueBensTakenAtLeastOnce = new Set(txs.map(t => t.beneficiaryId)).size;
      const totalQuantity = txs.reduce((acc, curr) => acc + curr.quantity, 0);

      return {
        name: m.name,
        eligible: eligibleBens.length,
        taken: uniqueBensTakenAtLeastOnce,
        pending: Math.max(0, eligibleBens.length - uniqueBensTakenAtLeastOnce),
        quantity: totalQuantity
      };
    }).filter(m => m.eligible > 0 || m.taken > 0);
  }, [activeOverseerId, overseers, panchayats, beneficiaries, txIndexes.byMaterial, allMaterials, schemes]);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-blue-600" />
            Inventory & Progression Dashboard
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">
            Financial Year Analysis: {Storage.getFinancialYear()}
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-slate-200">
           <Calendar className="w-5 h-5 text-slate-400" />
           <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="text-[11px] font-black uppercase outline-none bg-transparent"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              />
              <span className="text-slate-300 font-bold">→</span>
              <input 
                type="date" 
                className="text-[11px] font-black uppercase outline-none bg-transparent"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              />
           </div>
        </div>
      </div>

      {/* Material Summary Table */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="px-10 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
           <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
             <Package className="w-4 h-4 text-blue-500" /> Material Summary Ledger
           </h3>
           <span className="text-[10px] font-black text-slate-400 uppercase">Opening - Receipt - Issues - Closing</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                <th className="px-10 py-5">Material Asset</th>
                <th className="px-8 py-5 text-right">Opening</th>
                <th className="px-8 py-5 text-right">Receipts</th>
                <th className="px-8 py-5 text-right">Issues</th>
                <th className="px-10 py-5 text-right">Closing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
               {materialSummary.map((m, i) => (
                 <tr key={m.name} className="hover:bg-slate-50/50 transition-colors">
                   <td className="px-10 py-6">
                      <p className="font-black text-slate-900 uppercase text-xs">{m.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter">{m.unit}</p>
                   </td>
                   <td className="px-8 py-6 text-right font-black text-slate-500">{m.opening.toLocaleString()}</td>
                   <td className="px-8 py-6 text-right font-black text-emerald-600">+{m.receipts.toLocaleString()}</td>
                   <td className="px-8 py-6 text-right font-black text-red-600">-{m.issues.toLocaleString()}</td>
                   <td className="px-10 py-6 text-right">
                      <span className={`px-4 py-1.5 rounded-xl font-black text-sm ${m.closing < 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100'}`}>
                        {m.closing.toLocaleString()}
                      </span>
                   </td>
                 </tr>
               ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Overseer Leaderboard with Drill-down capability */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden p-8 shadow-sm flex flex-col">
           <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-10 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" /> Overseer Audit (Click for Details)
           </h3>
           <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-2">
              {overseerPerformance.map((o, idx) => (
                <div 
                  key={o.id} 
                  onClick={() => setActiveOverseerId(o.id === activeOverseerId ? null : o.id)}
                  className={`p-5 rounded-3xl border transition-all cursor-pointer group ${o.id === activeOverseerId ? 'bg-blue-600 border-blue-700 text-white shadow-xl shadow-blue-600/20 translate-x-2' : 'bg-slate-50 border-slate-100 hover:border-blue-200'}`}
                >
                   <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${o.id === activeOverseerId ? 'bg-white text-blue-600' : 'bg-slate-900 text-white'}`}>{idx + 1}</div>
                         <div>
                            <p className={`text-xs font-black uppercase ${o.id === activeOverseerId ? 'text-white' : 'text-slate-900'}`}>{o.name}</p>
                            <p className={`text-[9px] font-bold uppercase tracking-tighter ${o.id === activeOverseerId ? 'text-blue-100' : 'text-slate-400'}`}>{o.panchayatCount} Panchayats Assigned</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${o.id === activeOverseerId ? 'bg-blue-500 text-white border border-blue-400' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                            {o.leadingStage}
                         </span>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className={`flex-1 h-2 rounded-full overflow-hidden ${o.id === activeOverseerId ? 'bg-blue-700' : 'bg-slate-200'}`}>
                        <div className={`h-full rounded-full ${o.id === activeOverseerId ? 'bg-white' : 'bg-blue-600'}`} style={{ width: `${(o.progressedBens / (o.activeBens || 1)) * 100}%` }}></div>
                      </div>
                      <span className={`text-[10px] font-black whitespace-nowrap ${o.id === activeOverseerId ? 'text-white' : 'text-slate-900'}`}>
                        {o.progressedBens} / {o.activeBens} Dispatch
                      </span>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Drill-down Detail View */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden p-8 shadow-sm">
           {overseerStageDetails ? (
             <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                   <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{overseerStageDetails.overseerName} Detailed Analysis</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Total Beneficiaries: {overseerStageDetails.totalBens}</p>
                   </div>
                   <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                      <Activity className="w-5 h-5" />
                   </div>
                </div>

                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead>
                         <tr className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 font-mono">
                            <th className="pb-4 px-2">Progress Stage</th>
                            <th className="pb-4 px-2 text-center">Bens</th>
                            <th className="pb-4 px-2">Material</th>
                            <th className="pb-4 px-2 text-right">Taken</th>
                            <th className="pb-4 px-2 text-right text-red-500">Pending</th>
                            <th className="pb-4 px-2 text-right">Quantity</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                         {overseerStageDetails.stages.map((st, i) => (
                           <React.Fragment key={i}>

                              {Object.entries(st.materials).map(([mat, stats], idx) => (
                                <tr key={`${i}-${idx}`} className="hover:bg-slate-50/50 group border-b border-slate-50">
                                   {idx === 0 && (
                                     <td rowSpan={Object.keys(st.materials).length} className="py-4 px-2 text-[10px] font-black text-slate-900 align-top border-r border-slate-50">
                                       {st.stage}
                                     </td>
                                   )}
                                   <td className="py-3 px-2 text-center">
                                      <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                                        {(stats as any).eligible}
                                      </span>
                                   </td>
                                   <td className="py-3 px-2 text-[10px] font-bold text-slate-600 uppercase">{mat}</td>
                                   <td className="py-3 px-2 text-right">
                                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{(stats as any).taken}</span>
                                   </td>
                                   <td className="py-3 px-2 text-right">
                                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${ (stats as any).pending > 0 ? 'bg-red-100 text-red-700 border border-red-200 shadow-sm shadow-red-100' : 'bg-slate-50 text-slate-400'}`}>
                                        {(stats as any).pending}
                                      </span>
                                   </td>
                                   <td className="py-3 px-2 text-right text-[10px] font-black text-slate-900">
                                      {(stats as any).quantity.toLocaleString()}
                                   </td>
                                </tr>
                              ))}

                           </React.Fragment>
                         ))}
                         {/* Material Grand Totals */}
                         <tr className="border-t-4 border-slate-900">
                            <td colSpan={6} className="py-6 px-4 text-xs font-black text-white uppercase tracking-[0.2em] bg-slate-900">
                               Overseer Material Audit Recap
                            </td>
                         </tr>
                         {materialGrandTotals.map((m, idx) => (
                           <tr key={idx} className="bg-slate-50 border-b border-slate-200">
                              <td colSpan={1} className="py-4 px-2 text-right opacity-30 text-[9px]">TOTAL</td>
                              <td className="py-4 px-2 text-center">
                                 <span className="text-[11px] font-black text-blue-900 bg-white px-3 py-1 rounded-full border border-blue-200 shadow-sm">
                                   {m.eligible}
                                 </span>
                              </td>
                              <td className="py-4 px-2 text-[11px] font-black text-slate-900 uppercase tracking-tighter">
                                {m.name} Resource Index
                              </td>
                              <td className="py-4 px-2 text-right font-black text-emerald-700 decoration-emerald-500/30 decoration-2 underline-offset-4 underline">{m.taken}</td>
                              <td className="py-4 px-2 text-right font-black text-red-700 decoration-red-500/30 decoration-2 underline-offset-4 underline">{m.pending}</td>
                              <td className="py-4 px-2 text-right font-black text-slate-900 bg-white/50">{m.quantity.toLocaleString()} Total Units</td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-center p-12">
                <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 border border-slate-100 border-dashed">
                   <Users className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">No Overseer Selected</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 max-w-[200px] leading-relaxed">
                   Select an overseer from the leaderboard to view detailed stage-wise progression audit
                </p>
             </div>
           )}
        </div>
      </div>

    </div>
  );
}

