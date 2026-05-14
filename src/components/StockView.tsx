import React, { useState, useEffect } from 'react';
import { Storage } from '../lib/storage';
import { useData } from './DataProvider';
import { MaterialType } from '../types';
import { Calendar, ArrowRight, ArrowLeft, ClipboardList, Printer, Info } from 'lucide-react';
import { format, subDays, addDays, parseISO } from 'date-fns';

export default function StockView() {
  const { materials: materialsData, transactions } = useData();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [balances, setBalances] = useState<any[]>([]);

  const materialNames = materialsData.map(m => m.name).join(',');

  useEffect(() => {
    const materialNamesList = materialsData.map(m => m.name);
    const allBalances = Storage.calculateAllDailyBalances(materialNamesList, date, transactions);
    
    const dailyBalances = materialNamesList.map(name => ({
      material: name,
      ...allBalances[name]
    }));
    
    setBalances(dailyBalances);
  }, [date, materialNames, transactions]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-8 space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Daily Stock Report</h2>
          <p className="text-slate-500 font-medium">Verify current inventory levels and daily movements</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 border border-slate-200 rounded-xl hover:border-blue-200 transition bg-white"
          >
            <Printer className="w-4 h-4" /> Print Document
          </button>
        </div>
        <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button 
            onClick={() => setDate(format(subDays(parseISO(date), 1), 'yyyy-MM-dd'))}
            className="p-3 bg-white hover:bg-slate-50 rounded-lg shadow-sm transition-all active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-3 px-6 py-2 font-black text-slate-800 text-sm tracking-widest uppercase">
            <Calendar className="w-4 h-4 text-blue-600" />
            {format(parseISO(date), 'MMM d, yyyy')}
          </div>
          <button 
            onClick={() => setDate(format(addDays(parseISO(date), 1), 'yyyy-MM-dd'))}
            className="p-3 bg-white hover:bg-slate-50 rounded-lg shadow-sm transition-all active:scale-95"
          >
            <ArrowRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-4">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          <span className="font-bold uppercase tracking-widest text-[10px]">Registry Protocol:</span> The opening balance is derived from the cumulative closing balance of all prior fiscal periods. Manual opening entries logged as receipts will be factored into this baseline automatically.
        </p>
      </div>

      <div className="space-y-12">
        {balances.map(b => (
          <div key={b.material} className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] inline-block bg-slate-100 px-3 py-1 rounded">
              Material: {b.material}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="text-[10px] text-slate-500 font-black mb-2 uppercase tracking-widest">Opening Balance</div>
                <div className="text-3xl font-black text-slate-900 leading-none">
                  {Math.round(b.openingBalance).toLocaleString()} <span className="text-xs font-medium text-slate-400 uppercase tracking-normal">{materialsData.find(m => m.name === b.material)?.unit || 'units'}</span>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="text-[10px] text-slate-500 font-black mb-2 uppercase tracking-widest">Receipts (Today)</div>
                <div className="text-3xl font-black text-emerald-600 leading-none relative z-10">
                  +{Math.round(b.receipts).toLocaleString()} <span className="text-xs font-medium text-slate-400 uppercase tracking-normal">{materialsData.find(m => m.name === b.material)?.unit || 'units'}</span>
                </div>
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150"></div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="text-[10px] text-slate-500 font-black mb-2 uppercase tracking-widest">Issues (Today)</div>
                <div className="text-3xl font-black text-amber-500 leading-none relative z-10">
                  {Math.round(b.issues).toLocaleString()} <span className="text-xs font-medium text-slate-400 uppercase tracking-normal">{materialsData.find(m => m.name === b.material)?.unit || 'units'}</span>
                </div>
                <div className="absolute top-0 right-0 w-16 h-16 bg-amber-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150"></div>
              </div>

              <div className="bg-slate-900 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden border border-slate-700">
                <div className="text-[10px] text-blue-400 font-black mb-2 uppercase tracking-widest">Closing Balance</div>
                <div className="text-3xl font-black leading-none">
                  {Math.round(b.closingBalance).toLocaleString()} <span className="text-xs font-medium text-slate-500 uppercase tracking-normal">{materialsData.find(m => m.name === b.material)?.unit || 'units'}</span>
                </div>
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500 rounded-full -mr-8 -mt-8 opacity-20"></div>
              </div>
            </div>

            {/* Daily Ledger Table */}
            {(b.receipts > 0 || b.issues > 0) && (
              <div className="mt-4 bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 font-black uppercase text-slate-400 tracking-widest">
                      <th className="px-4 py-2">Time/ID</th>
                      <th className="px-4 py-2">Movement</th>
                      <th className="px-4 py-2">Particulars</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(() => {
                      const dailyTxs = Storage.sortTransactions(transactions.filter(t => t.material === b.material && t.date === date && !t.isOpeningBalance));
                      let currentBalance = b.openingBalance;
                      return dailyTxs.map(tx => {
                        const prevBalance = currentBalance;
                        if (tx.type === 'RECEIPT') currentBalance += tx.quantity;
                        else currentBalance -= tx.quantity;
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2 text-slate-400">
                              {tx.timestamp ? format(new Date(tx.timestamp), 'HH:mm') : '--:--'}
                              <span className="ml-2 opacity-50">#{tx.id.slice(0, 4)}</span>
                            </td>
                            <td className="px-4 py-2">
                              {tx.type === 'RECEIPT' ? (
                                <span className="text-emerald-600 font-black flex items-center gap-1">
                                  <ArrowRight className="w-2.5 h-2.5" /> RECEIPT
                                </span>
                              ) : (
                                <span className="text-amber-600 font-black flex items-center gap-1">
                                  <ArrowLeft className="w-2.5 h-2.5" /> ISSUE
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 font-medium text-slate-600 uppercase tracking-tighter">
                              {tx.invoiceNo ? `Inv: ${tx.invoiceNo}` : (tx.isOpeningBalance ? 'Opening Balance Entry' : 'Manual Entry')}
                              {tx.stage ? ` (Stage ${tx.stage})` : ''}
                            </td>
                            <td className={`px-4 py-2 text-right font-black ${tx.type === 'RECEIPT' ? 'text-emerald-700' : 'text-slate-900'}`}>
                              {tx.type === 'RECEIPT' ? '+' : '-'}{tx.quantity.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right font-black text-slate-500">
                              {currentBalance.toLocaleString()}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {balances.length === 0 && (
        <div className="text-center py-32 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <ClipboardList className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-slate-400 font-medium">No transactions recorded for the selected date.</p>
          <button className="mt-4 text-blue-600 font-bold text-sm hover:underline">Log a transaction</button>
        </div>
      )}
    </div>
  );
}
