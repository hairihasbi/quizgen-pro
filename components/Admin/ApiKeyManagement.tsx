
import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../../services/storageService';
import { ApiKey } from '../../types';

const ApiKeyManagement: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    const data = await StorageService.getApiKeys();
    setKeys(data);
    setLoading(false);
  };

  const toggleVisibility = (id: string) => {
    const newSet = new Set(visibleKeys);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setVisibleKeys(newSet);
  };

  const handleAddKey = async () => {
    if (!newKey.trim()) return;
    const sanitizedKey = StorageService.sanitizeInput(newKey.trim());
    await StorageService.addApiKeys([sanitizedKey]);
    setNewKey('');
    await fetchKeys();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const text = await file.text();
      const keyLines = text.split(/\r?\n/)
        .map(line => StorageService.sanitizeInput(line.trim()))
        .filter(line => line.length > 5);
        
      if (keyLines.length > 0) {
        await StorageService.addApiKeys(keyLines);
        alert(`${keyLines.length} API Key berhasil diimpor!`);
        await fetchKeys();
      }
    } catch (err) {
      alert("Gagal membaca file.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Hapus API Key ini secara permanen?')) {
      await StorageService.deleteApiKey(id);
      await fetchKeys();
    }
  };

  const handleReset = async (id: string) => {
    await StorageService.resetApiKeyUsage(id);
    await fetchKeys();
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    await StorageService.toggleApiKeyStatus(id, !currentStatus);
    await fetchKeys();
  };

  const totalHits = keys.reduce((acc, k) => acc + k.usageCount, 0);
  const activeKeys = keys.filter(k => k.isActive).length;
  const healthScore = keys.length > 0 
    ? Math.max(0, 100 - (keys.reduce((acc, k) => acc + (k.errorCount * 5), 0) / keys.length))
    : 100;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Security Health Audit Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-orange-50 shadow-sm flex items-center gap-6">
           <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center text-3xl shadow-inner">🛡️</div>
           <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Security Health</p>
              <h4 className="text-2xl font-black text-emerald-600">{Math.round(healthScore)}%</h4>
              <p className="text-[8px] text-gray-500 font-bold uppercase mt-1">Excellent Cluster Status</p>
           </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-orange-50 shadow-sm flex items-center gap-6">
           <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center text-3xl shadow-inner">🔁</div>
           <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Rotation Node</p>
              <h4 className="text-2xl font-black text-blue-600">{activeKeys}/{keys.length}</h4>
              <p className="text-[8px] text-gray-500 font-bold uppercase mt-1">Active Cluster Pool</p>
           </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-orange-50 shadow-sm flex items-center gap-6">
           <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-3xl flex items-center justify-center text-3xl shadow-inner">⚡</div>
           <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total AI Hits</p>
              <h4 className="text-2xl font-black text-orange-600">{totalHits.toLocaleString()}</h4>
              <p className="text-[8px] text-gray-500 font-bold uppercase mt-1">System-wide Latency Low</p>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border shadow-sm p-10 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 orange-gradient rounded-2xl flex items-center justify-center text-white text-xl shadow-lg">🔑</div>
            <div>
              <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Rotating API Management</h2>
              <p className="text-xs text-orange-500 font-black uppercase mt-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                Privacy Protection Enabled
              </p>
            </div>
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="px-6 py-3 bg-gray-900 text-white font-black rounded-2xl text-[10px] uppercase shadow-xl hover:bg-orange-600 transition-all outline-none"
          >
            {isUploading ? 'Importing...' : 'Bulk Upload .TXT'}
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileUpload} />
        </div>

        <div className="flex gap-4 p-4 bg-orange-50/50 rounded-3xl border border-orange-100">
          <input 
            type="password" 
            placeholder="Input Gemini Pro API Key Baru..." 
            className="flex-1 bg-white px-6 py-4 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm shadow-sm" 
            value={newKey} 
            onChange={e => setNewKey(e.target.value)} 
          />
          <button 
            onClick={handleAddKey} 
            className="px-10 py-4 orange-gradient text-white font-black rounded-2xl uppercase text-xs shadow-lg hover:scale-105 transition-all"
          >Add to Pool</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {keys.map((k) => (
            <div key={k.id} className={`bg-white p-8 rounded-[2.5rem] border transition-all duration-300 group ${k.isActive ? 'border-orange-100' : 'opacity-60 grayscale bg-gray-50'}`}>
              <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${k.errorCount > 10 ? 'bg-rose-100 text-rose-500' : 'bg-gray-50 text-gray-400 group-hover:orange-gradient group-hover:text-white'}`}>
                  {k.errorCount > 10 ? '⚠️' : '🔑'}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all">
                   <button onClick={() => toggleVisibility(k.id)} className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-blue-500 hover:text-white" title="View Key">{visibleKeys.has(k.id) ? '🙈' : '👁️'}</button>
                   <button onClick={() => handleReset(k.id)} className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-emerald-500 hover:text-white" title="Reset Stats">🔄</button>
                   <button onClick={() => handleDelete(k.id)} className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-rose-500 hover:text-white" title="Delete">🗑️</button>
                </div>
              </div>
              
              <div className="space-y-4">
                 <div className={`font-mono text-[10px] bg-gray-100 p-3 rounded-xl border truncate font-bold ${visibleKeys.has(k.id) ? 'text-gray-900' : 'text-gray-300 blur-sm select-none'}`}>
                   {k.key}
                 </div>
                 
                 <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                       <p className="text-[7px] font-black text-gray-400 uppercase">Total Hits</p>
                       <p className="text-sm font-black text-gray-800">{k.usageCount}</p>
                    </div>
                    <div className={`bg-gray-50 p-2 rounded-xl border border-gray-100 ${k.errorCount > 0 ? 'bg-rose-50' : ''}`}>
                       <p className="text-[7px] font-black text-gray-400 uppercase">Errors</p>
                       <p className={`text-sm font-black ${k.errorCount > 0 ? 'text-rose-500' : 'text-gray-800'}`}>{k.errorCount}</p>
                    </div>
                 </div>

                 <div className="flex justify-between items-center pt-2">
                    <span className="text-[8px] text-gray-400 font-bold uppercase">Last: {k.lastUsed === '-' ? 'Never' : new Date(k.lastUsed).toLocaleTimeString()}</span>
                    <button 
                      onClick={() => handleToggleStatus(k.id, k.isActive)} 
                      className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${k.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-500'}`}
                    >
                      {k.isActive ? 'ACTIVE' : 'DISABLED'}
                    </button>
                 </div>
              </div>
            </div>
          ))}
          {keys.length === 0 && (
            <div className="col-span-full py-20 text-center border-4 border-dashed border-gray-100 rounded-[3rem]">
               <p className="text-gray-300 font-black uppercase text-xs tracking-widest italic">Pool Kosong. Tambahkan API Key Gemini Pro Anda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiKeyManagement;
