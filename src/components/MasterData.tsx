import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Storage } from '../lib/storage';
import { useData } from './DataProvider';
import { Scheme, Overseer, Panchayat, Beneficiary, Material } from '../types';
import { Upload, Plus, Trash2, Edit2, FileSpreadsheet, User, ClipboardList, X, Search, Database, Users, MapPin, Building, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function MasterData({ isAdmin }: { isAdmin?: boolean }) {
  const { schemes, overseers, panchayats, beneficiaries, materials, refreshData } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [newScheme, setNewScheme] = useState({ name: '', year: new Date().getFullYear().toString() });
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const panchayatMap = React.useMemo(() => {
    return panchayats.reduce((acc, p) => {
      acc[p.id] = p.name.toLowerCase();
      return acc;
    }, {} as Record<string, string>);
  }, [panchayats]);

  const allFilteredBeneficiaries = React.useMemo(() => {
    if (!searchTerm) return beneficiaries;
    const term = searchTerm.toLowerCase();
    return beneficiaries.filter(b => 
      b.name.toLowerCase().includes(term) || 
      (panchayatMap[b.panchayatId]?.includes(term))
    );
  }, [beneficiaries, searchTerm, panchayatMap]);

  const paginatedBeneficiaries = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return allFilteredBeneficiaries.slice(start, start + itemsPerPage);
  }, [allFilteredBeneficiaries, currentPage]);

  const totalPages = Math.ceil(allFilteredBeneficiaries.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);
  const [newOverseer, setNewOverseer] = useState('');
  const [newPanchayat, setNewPanchayat] = useState({ name: '', overseerId: '' });
  const [newBeneficiary, setNewBeneficiary] = useState({ name: '', panchayatId: '', schemeId: '', year: new Date().getFullYear().toString() });
  const [newMaterial, setNewMaterial] = useState({ name: '', unit: 'Bags', minStock: 0 });
  const [targetSchemeId, setTargetSchemeId] = useState('');

  const [editingScheme, setEditingScheme] = useState<Scheme | null>(null);
  const [editingOverseer, setEditingOverseer] = useState<Overseer | null>(null);
  const [editingPanchayat, setEditingPanchayat] = useState<Panchayat | null>(null);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  const [showStageEditor, setShowStageEditor] = useState<string | null>(null); // schemeId
  const [stageInput, setStageInput] = useState<{material: string, stages: {stageNumber: number, quantity: number}[]}>({
    material: '',
    stages: [
      { stageNumber: 1, quantity: 0 },
      { stageNumber: 2, quantity: 0 },
      { stageNumber: 3, quantity: 0 },
      { stageNumber: 4, quantity: 0 }
    ]
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (materials.length > 0 && !stageInput.material) {
      setStageInput(prev => ({ ...prev, material: materials[0].name }));
    }
  }, [materials]);

  const handleAddScheme = async () => {
    if (!newScheme.name) return;
    setIsProcessing(true);
    try {
      if (editingScheme) {
        await Storage.setScheme({ ...editingScheme, ...newScheme });
        setEditingScheme(null);
      } else {
        await Storage.setScheme({ ...newScheme, id: Storage.generateId() });
      }
      await refreshData();
      setNewScheme({ name: '', year: new Date().getFullYear().toString() });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveStages = async () => {
    if (!showStageEditor) return;
    const scheme = schemes.find(s => s.id === showStageEditor);
    if (!scheme) return;

    setIsProcessing(true);
    try {
      await Storage.setScheme({
        ...scheme,
        materialStages: {
          ...(scheme.materialStages || {}),
          [stageInput.material]: stageInput.stages
        }
      });
      await refreshData();
    } finally {
      setIsProcessing(false);
      setShowStageEditor(null);
    }
  };

  const handleAddOverseer = async () => {
    if (!newOverseer) return;
    setIsProcessing(true);
    try {
      if (editingOverseer) {
        await Storage.setOverseer({ ...editingOverseer, name: newOverseer });
        setEditingOverseer(null);
      } else {
        await Storage.setOverseer({ id: Storage.generateId(), name: newOverseer });
      }
      await refreshData();
      setNewOverseer('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddPanchayat = async () => {
    if (!newPanchayat.name || !newPanchayat.overseerId) return;
    setIsProcessing(true);
    try {
      if (editingPanchayat) {
        await Storage.setPanchayat({ ...editingPanchayat, ...newPanchayat });
        setEditingPanchayat(null);
      } else {
        await Storage.setPanchayat({ id: Storage.generateId(), ...newPanchayat });
      }
      await refreshData();
      setNewPanchayat({ name: '', overseerId: '' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddMaterial = async () => {
    if (!newMaterial.name) return;
    setIsProcessing(true);
    try {
      if (editingMaterial) {
        await Storage.setMaterial({ ...editingMaterial, ...newMaterial });
        setEditingMaterial(null);
      } else {
        await Storage.setMaterial({ id: Storage.generateId(), ...newMaterial });
      }
      await refreshData();
      setNewMaterial({ name: '', unit: 'Bags', minStock: 0 });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'OVERSEER_PANCHAYAT' | 'BENEFICIARY') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataBuffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(dataBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (type === 'OVERSEER_PANCHAYAT') {
          const newOverseers: Overseer[] = [];
          const newPanchayats: Panchayat[] = [];
          const overseerMap: Record<string, string> = {};
          
          // Pre-populate with existing ones to avoid duplicates
          overseers.forEach(o => overseerMap[o.name.toLowerCase()] = o.id);

          for (const row of data as any[]) {
            const oName = (row['Overseer'] || row['overseer'])?.toString().trim();
            const pName = (row['Panchayat'] || row['panchayat'])?.toString().trim();
            
            if (oName && !overseerMap[oName.toLowerCase()]) {
              const oId = Storage.generateId();
              overseerMap[oName.toLowerCase()] = oId;
              newOverseers.push({ id: oId, name: oName });
            }
            if (pName && oName) {
              const oId = overseerMap[oName.toLowerCase()];
              // Check if panchayat already exists
              if (!panchayats.some(p => p.name.toLowerCase() === pName.toLowerCase())) {
                newPanchayats.push({
                  id: Storage.generateId(),
                  name: pName,
                  overseerId: oId
                });
              }
            }
          }

          if (newOverseers.length > 0) await Storage.setOverseersBulk(newOverseers);
          if (newPanchayats.length > 0) await Storage.setPanchayatsBulk(newPanchayats);
        } else {
          if (!targetSchemeId) {
            alert('Please select a target scheme before uploading beneficiaries.');
            return;
          }
          const beneficiariesToUpload: Beneficiary[] = [];
          const rows = data as any[];
          
          for (const row of rows) {
            const pName = (row['Panchayat'] || row['panchayat'])?.toString().trim();
            const bName = (row['Beneficiary'] || row['beneficiary'])?.toString().trim();
            const year = (row['Year'] || row['year'] || new Date().getFullYear().toString()).toString().trim();
            
            if (!bName || !pName) continue;

            const panchayat = panchayats.find(p => p.name.toLowerCase() === pName.toLowerCase());
            
            if (panchayat) {
              beneficiariesToUpload.push({
                id: Storage.generateId(),
                name: bName,
                panchayatId: panchayat.id,
                schemeId: targetSchemeId,
                year: year
              });
            }
          }

          if (beneficiariesToUpload.length > 0) {
            await Storage.setBeneficiariesBulk(beneficiariesToUpload);
          } else {
            alert('No valid beneficiaries found in the file. Ensure Panchayat names match exactly!');
          }
        }
        await refreshData();
      } catch (err) {
        console.error("Upload failed", err);
        alert("Upload failed. Please check the file format.");
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };


  return (
    <div className="p-8 space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Scheme Management */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase tracking-widest flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Plus className="w-5 h-5" /></div> Schemes
            </h2>
          </div>
          {isAdmin && (
            <div className="flex gap-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <input 
                type="text" 
                placeholder="Scheme Description" 
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                value={newScheme.name || ''}
                onChange={(e) => setNewScheme({ ...newScheme, name: e.target.value })}
              />
              <input 
                type="text" 
                placeholder={new Date().getFullYear().toString()} 
                className="w-24 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                value={newScheme.year || ''}
                onChange={(e) => setNewScheme({ ...newScheme, year: e.target.value })}
              />
              <button 
                onClick={handleAddScheme}
                className={`px-6 py-2 ${editingScheme ? 'bg-amber-600' : 'bg-blue-600'} text-white rounded-lg font-bold hover:opacity-90 transition active:scale-95 shadow-lg`}
              >
                {editingScheme ? 'Update' : 'Add'}
              </button>
              {editingScheme && (
                <button onClick={() => { setEditingScheme(null); setNewScheme({ name: '', year: new Date().getFullYear().toString() }); }} className="p-2 text-slate-400">Cancel</button>
              )}
            </div>
          )}
          <div className="max-h-[350px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {schemes.map(s => (
              <div key={s.id} className="flex justify-between items-center px-4 py-3 bg-white border border-slate-100 rounded-xl hover:border-blue-200 transition-colors group">
                <div className="flex flex-col">
                   <div className="flex items-center gap-2">
                     <span className="font-bold text-slate-800">{s.name}</span>
                     {s.materialStages && Object.keys(s.materialStages).length > 0 && (
                       <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase rounded border border-blue-100">Stage Configured</span>
                     )}
                   </div>
                   <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mt-1">Fiscal Year {s.year}</span>
                </div>
                <div className="flex items-center gap-1">
                   <button 
                    onClick={() => {
                      if (materials.length === 0) {
                        alert('Please add materials first.');
                        return;
                      }
                      setShowStageEditor(s.id);
                      const firstMat = materials[0].name;
                      const stages = s.materialStages?.[firstMat] || [
                        { stageNumber: 1, quantity: 0 },
                        { stageNumber: 2, quantity: 0 },
                        { stageNumber: 3, quantity: 0 },
                        { stageNumber: 4, quantity: 0 }
                      ];
                      setStageInput({ material: firstMat, stages });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all border border-blue-100 font-black text-[10px] uppercase tracking-widest shadow-sm"
                    title="Configure Stages"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    {isAdmin ? 'Stages' : 'View Stages'}
                  </button>
                  {isAdmin && (
                    <>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingScheme(s);
                          setNewScheme({ name: s.name, year: s.year });
                        }}
                        className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 hover:text-amber-500 p-2 hover:bg-amber-50 rounded-lg transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button 
                        type="button"
                        disabled={isProcessing}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirmDeleteId === s.id) {
                            setIsProcessing(true);
                            try {
                              await Storage.deleteScheme(s.id);
                              await refreshData();
                            } finally {
                              setIsProcessing(false);
                              setConfirmDeleteId(null);
                            }
                          } else {
                            setConfirmDeleteId(s.id);
                          }
                        }}
                        onMouseLeave={() => setConfirmDeleteId(null)}
                        className={`flex-1 flex items-center gap-1 text-[10px] font-black uppercase p-2 rounded-lg transition-all disabled:opacity-30 ${confirmDeleteId === s.id ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {confirmDeleteId === s.id ? 'Confirm?' : 'Del'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {schemes.length === 0 && <p className="text-center py-10 text-slate-400 text-sm italic">No schemes registered yet.</p>}
          </div>
        </div>

        {/* Stage Configuration Overlay */}
        {showStageEditor && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">Material Stages</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{schemes.find(s => s.id === showStageEditor)?.name}</p>
                </div>
                <button onClick={() => setShowStageEditor(null)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Select Material</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
                    value={stageInput.material || ''}
                    onChange={(e) => {
                      const matName = e.target.value;
                      const scheme = schemes.find(s => s.id === showStageEditor);
                      const stages = scheme?.materialStages?.[matName] || [
                        { stageNumber: 1, quantity: 0 },
                        { stageNumber: 2, quantity: 0 },
                        { stageNumber: 3, quantity: 0 },
                        { stageNumber: 4, quantity: 0 }
                      ];
                      setStageInput({ material: matName, stages });
                    }}
                  >
                    {materials.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Define quantities per stage</label>
                    <div className="flex gap-1">
                       <button 
                        onClick={() => {
                          const nextNum = stageInput.stages.length + 1;
                          setStageInput({ ...stageInput, stages: [...stageInput.stages, { stageNumber: nextNum, quantity: 0 }] });
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Add Stage"
                       >
                         <Plus className="w-3 h-3" />
                       </button>
                       <button 
                        onClick={() => {
                          if (stageInput.stages.length > 1) {
                            setStageInput({ ...stageInput, stages: stageInput.stages.slice(0, -1) });
                          }
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Remove Last Stage"
                       >
                         <Trash2 className="w-3 h-3" />
                       </button>
                    </div>
                  </div>
                  {stageInput.stages.map((st, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="w-20 text-xs font-bold text-slate-500 uppercase tracking-tighter">Stage {st.stageNumber}</div>
                      <input 
                        type="number" 
                        readOnly={!isAdmin}
                        value={st.quantity ?? 0}
                        onChange={(e) => {
                          const newStages = [...stageInput.stages];
                          newStages[idx].quantity = Number(e.target.value);
                          setStageInput({...stageInput, stages: newStages});
                        }}
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 text-sm font-bold disabled:bg-slate-50"
                        placeholder="Quantity"
                      />
                    </div>
                  ))}
                </div>
                {isAdmin && (
                  <button 
                    onClick={handleSaveStages}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition shadow-xl shadow-blue-900/10"
                  >
                    Save Configuration
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Excel Imports */}
        {isAdmin && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
            <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase tracking-widest flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Upload className="w-5 h-5" /></div> Asset Import
            </h2>
            
            <div className="space-y-6">
              <div className="relative group">
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50 transition-all group-hover:bg-blue-50/50 group-hover:border-blue-200">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                     <FileSpreadsheet className="w-6 h-6 text-slate-400 group-hover:text-blue-600" />
                  </div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Panchayat & Overseers</p>
                  <p className="text-[10px] text-slate-400 mb-6">XLSX: Col A (Panchayat), Col B (Overseer)</p>
                  
                  <input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    onChange={(e) => handleFileUpload(e, 'OVERSEER_PANCHAYAT')}
                    className="hidden" 
                    id="file-op" 
                  />
                  <label htmlFor="file-op" className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl cursor-pointer hover:bg-blue-700 font-bold transition shadow-lg shadow-blue-900/10 active:scale-95 text-xs">
                    Upload Master File
                  </label>
                  {overseers.length > 0 && (
                    <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 text-[10px] font-black uppercase">
                       Ready: {overseers.length} Overseers / {panchayats.length} Localities
                    </div>
                  )}
                </div>
              </div>

              <div className="relative group">
                <div className={`p-8 border-2 border-dashed rounded-2xl text-center transition-all ${panchayats.length === 0 ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-slate-50 border-slate-200 group-hover:bg-blue-50/50 group-hover:border-blue-200'}`}>
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                     <User className="w-6 h-6 text-slate-400 group-hover:text-blue-600" />
                  </div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Beneficiary Manifest</p>
                  <p className="text-[10px] text-slate-400 mb-4">XLSX: Col A (Panchayat), Col B (Beneficiary Name)</p>
                  
                  <div className="mb-4">
                    <select 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-blue-100 mb-2"
                      value={targetSchemeId || ''}
                      onChange={(e) => setTargetSchemeId(e.target.value)}
                    >
                      <option value="">-- Select Target Scheme --</option>
                      {schemes.map(s => <option key={s.id} value={s.id}>{s.name} ({s.year})</option>)}
                    </select>
                  </div>

                  <input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    onChange={(e) => handleFileUpload(e, 'BENEFICIARY')}
                    disabled={panchayats.length === 0 || !targetSchemeId}
                    className="hidden" 
                    id="file-ben" 
                  />
                  <label htmlFor="file-ben" className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition shadow-lg active:scale-95 text-xs ${panchayats.length === 0 || !targetSchemeId ? 'bg-slate-200 cursor-not-allowed text-slate-400' : 'bg-slate-900 text-white hover:bg-black cursor-pointer shadow-slate-900/10'}`}>
                     Upload Beneficiaries
                  </label>
                  {beneficiaries.length > 0 && (
                    <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-emerald-100 text-[10px] font-black uppercase">
                       Total Records: {beneficiaries.length}
                    </div>
                  )}
                  {panchayats.length === 0 && <p className="mt-3 text-[10px] text-amber-600 font-bold italic tracking-tighter">Required: Master File upload first</p>}
                  {panchayats.length > 0 && !targetSchemeId && <p className="mt-3 text-[10px] text-blue-600 font-bold italic tracking-tighter">Select a scheme before uploading</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Manual Management Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Materials Management */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center justify-between">
            Materials <Package className="w-4 h-4 text-indigo-500" />
          </h3>
          {isAdmin && (
            <div className="flex gap-2 mb-4 bg-slate-50 p-4 rounded-xl">
              <input 
                type="text" 
                placeholder="Material Name (e.g. Cement, Steel)" 
                className="flex-1 px-3 py-1.5 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100"
                value={newMaterial.name || ''}
                onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
              />
              <input 
                type="text" 
                placeholder="Unit (e.g. Bags, Kg)" 
                className="w-24 px-3 py-1.5 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100"
                value={newMaterial.unit || ''}
                onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
              />
              <input 
                type="number" 
                placeholder="Alert Level" 
                className="w-24 px-3 py-1.5 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100"
                value={newMaterial.minStock || 0}
                onChange={(e) => setNewMaterial({ ...newMaterial, minStock: Number(e.target.value) })}
              />
              <button 
                onClick={handleAddMaterial} 
                className={`p-2 px-4 shadow-lg ${editingMaterial ? 'bg-amber-600' : 'bg-indigo-600'} text-white rounded-lg hover:opacity-90 transition font-bold text-xs uppercase tracking-widest`}
              >
                {editingMaterial ? 'Update' : 'Add'}
              </button>
              {editingMaterial && (
                <button 
                  onClick={() => { setEditingMaterial(null); setNewMaterial({ name: '', unit: 'Bags', minStock: 0 }); }} 
                  className="p-2 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          <div className="flex-1 max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {materials.map(m => (
              <div key={m.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl group hover:border-indigo-200 transition-colors">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{m.name}</span>
                  <div className="flex gap-3">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Unit: {m.unit}</span>
                    {m.minStock && m.minStock > 0 && (
                      <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Min: {m.minStock}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isAdmin && (
                    <>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingMaterial(m);
                          setNewMaterial({ name: m.name, unit: m.unit, minStock: m.minStock || 0 });
                        }} className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 hover:text-amber-500 p-2 hover:bg-amber-50 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button 
                        type="button"
                        disabled={isProcessing}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirmDeleteId === m.id) {
                            setIsProcessing(true);
                            try {
                              await Storage.deleteMaterial(m.id);
                              await refreshData();
                            } finally {
                              setIsProcessing(false);
                              setConfirmDeleteId(null);
                            }
                          } else {
                            setConfirmDeleteId(m.id);
                          }
                        }}
                        onMouseLeave={() => setConfirmDeleteId(null)}
                        className={`flex items-center gap-1 text-[10px] font-black uppercase p-2 rounded-lg transition-colors disabled:opacity-30 ${confirmDeleteId === m.id ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {confirmDeleteId === m.id ? 'Confirm?' : 'Del'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {materials.length === 0 && <p className="text-center py-10 text-slate-400 text-xs italic">No materials defined.</p>}
          </div>
        </div>

        {/* Overseers */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center justify-between">
            Overseers <User className="w-4 h-4 text-blue-500" />
          </h3>
          {isAdmin && (
            <div className="flex gap-2 mb-4 bg-slate-50 p-4 rounded-xl">
              <input 
                type="text" 
                placeholder="Full Name" 
                className="flex-1 px-3 py-1.5 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-100"
                value={newOverseer || ''}
                onChange={(e) => setNewOverseer(e.target.value)}
              />
              <button 
                onClick={handleAddOverseer} 
                className={`p-2 px-4 shadow-lg ${editingOverseer ? 'bg-amber-600' : 'bg-blue-600'} text-white rounded-lg hover:opacity-90 transition font-bold text-xs uppercase tracking-widest`}
              >
                {editingOverseer ? 'Update' : 'Add'}
              </button>
              {editingOverseer && <button onClick={() => { setEditingOverseer(null); setNewOverseer(''); }} className="p-2 text-slate-400"><X className="w-4 h-4"/></button>}
            </div>
          )}
          <div className="flex-1 max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {overseers.map(o => (
              <div key={o.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl group hover:border-blue-200 transition-colors">
                <span className="text-xs font-bold text-slate-700">{o.name}</span>
                <div className="flex items-center gap-1">
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingOverseer(o);
                      setNewOverseer(o.name);
                    }} className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 hover:text-amber-500 p-2 hover:bg-amber-50 rounded-lg transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                      <button 
                        type="button"
                        disabled={isProcessing}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirmDeleteId === o.id) {
                            setIsProcessing(true);
                            try {
                              await Storage.deleteOverseer(o.id);
                              await refreshData();
                            } finally {
                              setIsProcessing(false);
                              setConfirmDeleteId(null);
                            }
                          } else {
                            setConfirmDeleteId(o.id);
                          }
                        }}
                        onMouseLeave={() => setConfirmDeleteId(null)}
                        className={`flex items-center gap-1 text-[10px] font-black uppercase p-2 rounded-lg transition-colors disabled:opacity-30 ${confirmDeleteId === o.id ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {confirmDeleteId === o.id ? 'Confirm?' : 'Del'}
                      </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Panchayats */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center justify-between">
            Panchayats <Building className="w-4 h-4 text-emerald-500" />
          </h3>
          {isAdmin && (
            <div className="space-y-2 mb-4 bg-slate-50 p-4 rounded-xl">
              <input 
                type="text" 
                placeholder="Panchayat Name" 
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-100"
                value={newPanchayat.name || ''}
                onChange={(e) => setNewPanchayat({...newPanchayat, name: e.target.value})}
              />
              <div className="flex gap-2">
                <select 
                  className="flex-1 px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-100"
                  value={newPanchayat.overseerId || ''}
                  onChange={(e) => setNewPanchayat({...newPanchayat, overseerId: e.target.value})}
                >
                  <option value="">Map to Overseer</option>
                  {overseers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <button 
                  onClick={handleAddPanchayat} 
                  className={`p-2 px-4 shadow-lg ${editingPanchayat ? 'bg-amber-600' : 'bg-emerald-600'} text-white rounded-lg hover:opacity-90 transition font-bold text-xs uppercase tracking-widest`}
                >
                  {editingPanchayat ? 'Update' : 'Add'}
                </button>
                {editingPanchayat && <button onClick={() => { setEditingPanchayat(null); setNewPanchayat({ name: '', overseerId: '' }); }} className="p-2 text-slate-400"><X className="w-4 h-4"/></button>}
              </div>
            </div>
          )}
          <div className="flex-1 max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {panchayats.map(p => (
              <div key={p.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl group hover:border-emerald-200 transition-colors">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">{p.name}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{overseers.find(o => o.id === p.overseerId)?.name || 'Unassigned'}</span>
                </div>
                <div className="flex items-center gap-1">
                  {isAdmin && (
                    <>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingPanchayat(p);
                          setNewPanchayat({ name: p.name, overseerId: p.overseerId });
                        }} className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 hover:text-amber-500 p-2 hover:bg-amber-50 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button 
                        type="button"
                        disabled={isProcessing}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirmDeleteId === p.id) {
                            setIsProcessing(true);
                            try {
                              await Storage.deletePanchayat(p.id);
                              await refreshData();
                            } finally {
                              setIsProcessing(false);
                              setConfirmDeleteId(null);
                            }
                          } else {
                            setConfirmDeleteId(p.id);
                          }
                        }}
                        onMouseLeave={() => setConfirmDeleteId(null)}
                        className={`flex items-center gap-1 text-[10px] font-black uppercase p-2 rounded-lg transition-colors disabled:opacity-30 ${confirmDeleteId === p.id ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {confirmDeleteId === p.id ? 'Confirm?' : 'Del'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Beneficiaries */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
              Beneficiaries <Users className="w-4 h-4 text-amber-500 inline ml-2" />
            </h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search name/locality..."
                className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-full text-[10px] font-bold outline-none focus:ring-2 focus:ring-amber-100 w-40"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          {isAdmin && (
            <div className="space-y-2 mb-4 bg-slate-50 p-4 rounded-xl">
              <input 
                type="text" 
                placeholder="Full Name" 
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-amber-100"
                value={newBeneficiary.name || ''}
                onChange={(e) => setNewBeneficiary({...newBeneficiary, name: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-2">
                <select 
                  className="px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-amber-100"
                  value={newBeneficiary.panchayatId || ''}
                  onChange={(e) => setNewBeneficiary({...newBeneficiary, panchayatId: e.target.value})}
                >
                  <option value="">Locality / Panchayat</option>
                  {panchayats.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select 
                  className="px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-amber-100"
                  value={newBeneficiary.schemeId || ''}
                  onChange={(e) => setNewBeneficiary({...newBeneficiary, schemeId: e.target.value})}
                >
                  <option value="">Active Scheme</option>
                  {schemes.map(s => <option key={s.id} value={s.id}>{s.name} ({s.year})</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={async () => {
                    if (!newBeneficiary.name || !newBeneficiary.panchayatId || !newBeneficiary.schemeId) return;
                    setIsProcessing(true);
                    try {
                      if (editingBeneficiary) {
                        await Storage.setBeneficiary({ ...editingBeneficiary, ...newBeneficiary });
                        setEditingBeneficiary(null);
                      } else {
                        await Storage.setBeneficiary({ id: Storage.generateId(), ...newBeneficiary });
                      }
                      await refreshData();
                      setNewBeneficiary({ name: '', panchayatId: '', schemeId: '', year: new Date().getFullYear().toString() });
                    } finally {
                      setIsProcessing(false);
                    }
                  }} 
                  disabled={isProcessing}
                  className={`flex-1 p-2 ${editingBeneficiary ? 'bg-amber-600' : 'bg-amber-600'} text-white rounded-lg hover:opacity-90 transition font-bold text-xs uppercase tracking-widest shadow-lg disabled:opacity-50`}
                >
                  {isProcessing ? 'Processing...' : (editingBeneficiary ? 'Update Beneficiary' : 'Register Beneficiary')}
                </button>
                {editingBeneficiary && <button onClick={() => { setEditingBeneficiary(null); setNewBeneficiary({ name: '', panchayatId: '', schemeId: '', year: new Date().getFullYear().toString() }); }} className="p-2 text-slate-400 border rounded-lg"><X className="w-4 h-4"/></button>}
              </div>
            </div>
          )}
          <div className="flex-1 max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {paginatedBeneficiaries.map(b => (
              <div key={b.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl group hover:border-amber-200 transition-colors">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">{b.name}</span>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{panchayats.find(p => p.id === b.panchayatId)?.name}</span>
                    <span className="text-[9px] text-blue-500 font-black uppercase tracking-tighter">{schemes.find(s => s.id === b.schemeId)?.name} ({b.year})</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isAdmin && (
                    <>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingBeneficiary(b);
                          setNewBeneficiary({ name: b.name, panchayatId: b.panchayatId, schemeId: b.schemeId, year: b.year });
                        }} className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 hover:text-amber-500 p-2 hover:bg-amber-50 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button 
                        type="button"
                        disabled={isProcessing}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirmDeleteId === b.id) {
                            setIsProcessing(true);
                            try {
                              await Storage.deleteBeneficiary(b.id);
                              await refreshData();
                            } finally {
                              setIsProcessing(false);
                              setConfirmDeleteId(null);
                            }
                          } else {
                            setConfirmDeleteId(b.id);
                          }
                        }}
                        onMouseLeave={() => setConfirmDeleteId(null)}
                        className={`flex items-center gap-1 text-[10px] font-black uppercase p-2 rounded-lg transition-colors disabled:opacity-30 ${confirmDeleteId === b.id ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {confirmDeleteId === b.id ? 'Confirm?' : 'Del'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {allFilteredBeneficiaries.length === 0 && <p className="text-center py-10 text-slate-400 text-[10px] italic">No beneficiaries found</p>}
          </div>

          {/* Beneficiary Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase">Page {currentPage} of {totalPages}</span>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 px-2 border rounded text-[10px] font-bold disabled:opacity-30"
                  >
                    Prev
                  </button>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 px-2 border rounded text-[10px] font-bold disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
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
                        className={`w-6 h-6 flex items-center justify-center text-[9px] font-black rounded ${currentPage === pageNum ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        {pageNum}
                      </button>
                    );
                 })}
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Statistical Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center gap-5 shadow-sm relative overflow-hidden group">
          <div className="p-4 bg-blue-50 rounded-2xl text-blue-600 relative z-10 transition-colors group-hover:bg-blue-600 group-hover:text-white"><User /></div>
          <div className="relative z-10">
            <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-1">Staff</p>
            <p className="text-3xl font-black text-slate-900 tracking-tighter">{overseers.length.toString().padStart(2, '0')}</p>
            <p className="text-[10px] text-slate-500 font-medium">Head Overseers</p>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-full -mr-8 -mt-8 opacity-40"></div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center gap-5 shadow-sm relative overflow-hidden group">
          <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600 relative z-10 transition-colors group-hover:bg-emerald-600 group-hover:text-white"><Plus /></div>
          <div className="relative z-10">
            <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-1">Zones</p>
            <p className="text-3xl font-black text-slate-900 tracking-tighter">{panchayats.length.toString().padStart(2, '0')}</p>
            <p className="text-[10px] text-slate-500 font-medium">Active Panchayats</p>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-full -mr-8 -mt-8 opacity-40"></div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center gap-5 shadow-sm relative overflow-hidden group">
          <div className="p-4 bg-amber-50 rounded-2xl text-amber-600 relative z-10 transition-colors group-hover:bg-amber-600 group-hover:text-white"><FileSpreadsheet /></div>
          <div className="relative z-10">
            <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-1">Data</p>
            <p className="text-3xl font-black text-slate-900 tracking-tighter">{beneficiaries.length > 999 ? '999+' : beneficiaries.length.toString().padStart(3, '0')}</p>
            <p className="text-[10px] text-slate-500 font-medium">Beneficiary List</p>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-50 rounded-full -mr-8 -mt-8 opacity-40"></div>
        </div>
      </div>
    </div>
  );
}
