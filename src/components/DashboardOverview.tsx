import React, { useState, useMemo } from 'react';
import { Storage } from '../lib/storage';
import { useData } from './DataProvider';
import { StockTransaction, MaterialType, Scheme, Overseer, Panchayat } from '../types';
import { 
  Package, 
  Calendar,
  Users,
  Activity,
  ClipboardList,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Clock,
  Filter,
  Search
} from 'lucide-react';
import { 
  format, 
  startOfDay, 
  endOfDay, 
  startOfMonth, 
  parseISO,
  subDays
} from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardOverviewProps {
  onNavigate: (tab: any) => void;
  isAdmin: boolean;
}

export default function DashboardOverview({ onNavigate, isAdmin }: DashboardOverviewProps) {
  const { transactions, schemes, overseers, panchayats, materials: allMaterials, beneficiaries } = useData();
  const [activeOverseerId, setActiveOverseerId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const isTxInRange = (tx: StockTransaction) => {
    return tx.date >= dateRange.start && tx.date <= dateRange.end;
  };

  // 1. Material Ledger Summary
  const materialSummary = useMemo(() => {
    return allMaterials.map(mat => {
      const matTxs = transactions.filter(t => t.material === mat.name);
      
      // Opening balance: receipts with isOpeningBalance=true
      const opening = matTxs
        .filter(t => t.type === 'RECEIPT' && t.isOpeningBalance)
        .reduce((sum, t) => sum + t.quantity, 0);

      // Current Receipts: within range, not opening
      const received = matTxs
        .filter(t => t.type === 'RECEIPT' && !t.isOpeningBalance && isTxInRange(t))
        .reduce((sum, t) => sum + t.quantity, 0);

      // Current Issues: within range
      const issued = matTxs
        .filter(t => t.type === 'ISSUE' && isTxInRange(t))
        .reduce((sum, t) => sum + t.quantity, 0);

      // Historical aggregates (up to range start) to calculate dynamic opening if needed
      // (Simplified: using the static opening + all prior range txs)
      const priorReceived = matTxs
        .filter(t => t.type === 'RECEIPT' && !t.isOpeningBalance && t.date < dateRange.start)
        .reduce((sum, t) => sum + t.quantity, 0);
      
      const priorIssued = matTxs
        .filter(t => t.type === 'ISSUE' && t.date < dateRange.start)
        .reduce((sum, t) => sum + t.quantity, 0);

      const computedOpening = opening + priorReceived - priorIssued;
      const closing = computedOpening + received - issued;

      return {
        name: mat.name,
        unit: mat.unit,
        opening: computedOpening,
        received,
        issued,
        closing
      };
    });
  }, [transactions, allMaterials, dateRange]);

  // 2. Overseer Impact Leaderboard
  const overseerPerformance = useMemo(() => {
    return overseers.map(ov => {
      const ovPanchayatIds = panchayats.filter(p => p.overseerId === ov.id).map(p => p.id);
      const ovTransactions = transactions.filter(t => 
        t.panchayatId && 
        ovPanchayatIds.includes(t.panchayatId) && 
        isTxInRange(t)
      );
      
      const issueCount = ovTransactions.filter(t => t.type === 'ISSUE').length;
      
      // Find most active stage for this overseer
      const stageCounts: Record<number, number> = {};
      ovTransactions.filter(t => t.type === 'ISSUE' && t.stage).forEach(t => {
        stageCounts[t.stage!] = (stageCounts[t.stage!] || 0) + 1;
      });
      
      const leadingStage = Object.entries(stageCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      return {
        ...ov,
        issueCount,
        leadingStage
      };
    }).sort((a, b) => b.issueCount - a.issueCount);
  }, [overseers, schemes, transactions, panchayats, dateRange]);

  // 3. Drill-down: Overseer Detailed Stage Analysis (Stage-centric)
  const overseerStageDetails = useMemo(() => {
    if (!activeOverseerId) return null;
    
    const ovPanchayatIds = panchayats.filter(p => p.overseerId === activeOverseerId).map(p => p.id);
    const ovBeneficiaries = beneficiaries.filter(b => ovPanchayatIds.includes(b.panchayatId));
    const ovSchemeIds = Array.from(new Set(ovBeneficiaries.map(b => b.schemeId)));
    const ovSchemes = schemes.filter(s => ovSchemeIds.includes(s.id));
    
    const ovIssues = transactions.filter(t => 
      t.type === 'ISSUE' && 
      t.panchayatId && 
      ovPanchayatIds.includes(t.panchayatId)
    );

    // Key: Stage Number
    const stagesMap: Record<number, {
      stageNumber: number,
      stageActiveBens: Set<string>,
      stageTotalBens: number,
      materials: Record<string, {
        issuedQty: number,
        activeBensCount: number,
        targetQty: number,
        totalBens: number,
        description: string,
        unit: string
      }>
    }> = {};

    ovSchemes.forEach(scheme => {
      const schemeBensInOvJurisdiction = ovBeneficiaries.filter(b => b.schemeId === scheme.id);
      const schemeBensCount = schemeBensInOvJurisdiction.length;
      
      if (scheme.materialStages && schemeBensCount > 0) {
        Object.entries(scheme.materialStages).forEach(([matName, stages]) => {
          (stages as any[]).forEach(stageDef => {
            const sNum = stageDef.stageNumber;
            if (!stagesMap[sNum]) {
              stagesMap[sNum] = { 
                stageNumber: sNum, 
                materials: {}, 
                stageActiveBens: new Set<string>(), 
                stageTotalBens: 0 
              };
            }

            if (!stagesMap[sNum].materials[matName]) {
              const unit = allMaterials.find(m => m.name === matName)?.unit || 'units';
              stagesMap[sNum].materials[matName] = {
                issuedQty: 0,
                activeBensCount: 0,
                targetQty: 0,
                totalBens: 0,
                description: stageDef.description,
                unit
              };
            }

            const matStageDetail = stagesMap[sNum].materials[matName];
            const stageGroup = stagesMap[sNum];
            
            const relevantIssues = ovIssues.filter(t => 
              t.schemeId === scheme.id && 
              t.material === matName && 
              t.stage === sNum
            );

            matStageDetail.issuedQty += relevantIssues.reduce((sum, t) => sum + t.quantity, 0);
            
            // Only count beneficiaries that belong to this overseer's panchayats
            relevantIssues.forEach(t => {
              if (t.beneficiaryId) {
                stageGroup.stageActiveBens.add(t.beneficiaryId);
              }
            });
            
            matStageDetail.activeBensCount += new Set(relevantIssues.map(t => t.beneficiaryId)).size;
            matStageDetail.targetQty += stageDef.quantity * schemeBensCount;
            matStageDetail.totalBens += schemeBensCount;
            
            // Add to stage total (approximate: usually all materials have same total bens for a stage)
            // But we'll just track it carefully.
          });
        });
        
        // Sum total unique beneficiaries only once per scheme for each stage
        Object.values(stagesMap).forEach(stageGroup => {
           stageGroup.stageTotalBens += schemeBensCount;
        });
      }
    });

    return Object.values(stagesMap).map(s => ({
      ...s,
      activeBensCount: s.stageActiveBens.size
    })).sort((a, b) => a.stageNumber - b.stageNumber);
  }, [activeOverseerId, transactions, schemes, beneficiaries, allMaterials, panchayats]);

  const activeOverseer = useMemo(() => 
    overseers.find(o => o.id === activeOverseerId), 
  [activeOverseerId, overseers]);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Dynamic Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-eng-blue tracking-tight uppercase">Audit Control Center</h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
            System Operational <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 premium-shadow">
          <div className="flex items-center gap-2 px-3 border-r border-slate-100">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input 
              type="date" 
              className="text-[11px] font-black uppercase text-slate-600 bg-transparent outline-none"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2 px-3">
             <input 
              type="date" 
              className="text-[11px] font-black uppercase text-slate-600 bg-transparent outline-none"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 1. Material Balance Ledger - 7 cols */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 premium-shadow overflow-hidden">
            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-eng-blue text-white rounded-2xl shadow-lg shadow-eng-blue/20">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-xl uppercase tracking-tight">Material Balance Ledger</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Live Stock Audit</p>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black border-b border-slate-100">
                    <th className="px-10 py-5">Material Specification</th>
                    <th className="px-6 py-5 text-right">Opening</th>
                    <th className="px-6 py-5 text-right">Receipts</th>
                    <th className="px-6 py-5 text-right">Issues</th>
                    <th className="px-10 py-5 text-right">Net Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {materialSummary.map(item => (
                    <tr key={item.name} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 group-hover:text-eng-blue transition-colors text-base">{item.name}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.unit}</span>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-right font-bold text-slate-500 tabular-nums">{item.opening.toLocaleString()}</td>
                      <td className="px-6 py-6 text-right font-black text-emerald-600 tabular-nums">+{item.received.toLocaleString()}</td>
                      <td className="px-6 py-6 text-right font-black text-rose-500 tabular-nums">-{item.issued.toLocaleString()}</td>
                      <td className="px-10 py-6 text-right">
                        <span className={`inline-block px-5 py-2 rounded-2xl font-black text-sm tabular-nums shadow-sm ${item.closing > 0 ? 'bg-eng-blue/10 text-eng-blue' : 'bg-rose-50 text-rose-700'}`}>
                          {item.closing.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 2. Overseer Tracking - 5 cols */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 premium-shadow p-8">
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                 <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20">
                   <Users className="w-6 h-6" />
                 </div>
                 <div>
                   <h3 className="font-black text-slate-900 text-xl uppercase tracking-tight">Overseer Tracking</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Field Resource Monitoring</p>
                 </div>
               </div>
            </div>

            <div className="space-y-3">
              {overseerPerformance.map((ov) => (
                <button 
                  key={ov.id}
                  onClick={() => setActiveOverseerId(activeOverseerId === ov.id ? null : ov.id)}
                  className={`w-full group p-4 rounded-2xl border-2 transition-all flex items-center justify-between text-left ${activeOverseerId === ov.id ? 'border-eng-blue bg-eng-blue/5' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-colors ${activeOverseerId === ov.id ? 'bg-eng-blue text-white' : 'bg-white text-slate-500 shadow-sm'}`}>
                      {ov.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 group-hover:text-eng-blue transition-colors">{ov.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Impact: Stage {ov.leadingStage}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-sm ${activeOverseerId === ov.id ? 'text-eng-blue' : 'text-slate-600'}`}>{ov.issueCount}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Issues</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Drill-down Detail Panel */}
          <AnimatePresence mode="wait">
            {activeOverseerId && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10">
                   <Users className="w-32 h-32 text-white" />
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                     <div>
                       <h3 className="font-black text-xs uppercase tracking-[0.3em] text-blue-400">Dispatch Details</h3>
                       <p className="text-[10px] font-bold text-white uppercase mt-1">{activeOverseer?.name}</p>
                     </div>
                     <button onClick={() => setActiveOverseerId(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <AlertCircle className="w-4 h-4 text-slate-500" />
                     </button>
                  </div>

                    <div className="space-y-8">
                      {(overseerStageDetails as any[])?.map((stage) => (
                        <div key={stage.stageNumber} className="space-y-4">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-eng-blue text-white flex items-center justify-center font-black text-xs">
                                {stage.stageNumber}
                              </div>
                              <div>
                                <h4 className="font-black text-xs uppercase tracking-widest text-slate-300">Stage Progress</h4>
                                <p className="text-[8px] text-slate-500 font-bold uppercase">Consolidated Metrics</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black text-slate-500 uppercase">Active Reach</p>
                              <p className="text-xs font-black text-emerald-400">
                                {stage.activeBensCount} 
                                <span className="text-slate-500 ml-1">/ {stage.stageTotalBens} Total Beneficiaries</span>
                              </p>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                          {Object.entries(stage.materials).map(([matName, st]: [string, any], idx) => (
                            <div key={idx} className="bg-white/5 rounded-2xl p-4 border border-white/10 group hover:border-white/20 transition-all">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                  <p className="text-[9px] font-black text-eng-blue uppercase tracking-[0.2em]">{matName}</p>
                                  <p className="text-[11px] font-bold text-slate-300 mt-0.5">{st.description}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-slate-500 uppercase">Beneficiaries</p>
                                  <p className="text-xs font-black text-white">{st.activeBensCount} <span className="text-slate-500">/ {st.totalBens}</span></p>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex justify-between text-[9px] font-black uppercase text-slate-500">
                                  <span>Quantity Issued</span>
                                  <span>{st.targetQty > 0 ? ((st.issuedQty / st.targetQty) * 100).toFixed(1) : '0'}%</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(st.targetQty > 0 ? (st.issuedQty / st.targetQty) * 100 : 0, 100)}%` }}
                                    className={`h-full rounded-full ${st.issuedQty >= st.targetQty && st.targetQty > 0 ? 'bg-emerald-500' : 'bg-eng-blue'}`}
                                  />
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-bold mb-3">
                                  <span className="text-white">{st.issuedQty.toLocaleString()} <span className="text-slate-500 text-[8px] uppercase">{st.unit}</span></span>
                                  <span className="text-slate-500">Target Sum: {st.targetQty.toLocaleString()}</span>
                                </div>
                                
                                {/* Beneficiary List Detail */}
                                {st.activeBensCount > 0 && (
                                  <div className="pt-3 border-t border-white/5">
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Field Dispatch Detail</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {Array.from(stage.stageActiveBens as Set<string>).map(bId => (
                                        <span key={bId} className="px-2 py-0.5 bg-white/5 rounded text-[8px] text-slate-400 font-bold border border-white/5">
                                          {beneficiaries.find(b => b.id === bId)?.name || 'Unknown'}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Recent Transactions Footer for Drill-down */}
                    {activeOverseer && (
                      <div className="mt-12 pt-8 border-t border-white/10">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                          <Activity className="w-3 h-3" /> Recent Movement Log
                        </h4>
                        <div className="space-y-2">
                          {Storage.sortTransactions(transactions.filter(t => 
                            t.panchayatId && 
                            panchayats.filter(p => p.overseerId === activeOverseerId).map(p => p.id).includes(t.panchayatId)
                          )).reverse().slice(0, 5).map(t => (
                            <div key={t.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl text-[10px]">
                              <div className="flex flex-col">
                                <span className="font-black text-white/80 uppercase">{t.material}</span>
                                <span className="text-[8px] text-slate-500 font-bold">{format(new Date(t.timestamp), 'dd MMM, HH:mm')}</span>
                              </div>
                              <div className="text-right">
                                <span className={`font-black ${t.type === 'RECEIPT' ? 'text-emerald-400' : 'text-blue-400'}`}>
                                  {t.type === 'RECEIPT' ? '+' : '-'}{t.quantity}
                                </span>
                                <p className="text-[8px] text-slate-600 font-bold">{t.beneficiaryId ? 'Dispatch' : 'Yard'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {(!overseerStageDetails || overseerStageDetails.length === 0) && (
                      <div className="py-12 text-center">
                        <Clock className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">No stage data defined for this overseer</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

