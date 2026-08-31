import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../../services/storageService';
import { ApiKey, AISettings } from '../../types';
import { GeminiService } from '../../services/geminiService';

const ApiKeyManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'gemini-pool' | 'litellm-gateway'>('gemini-pool');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // LiteLLM / External AI Settings
  const [aiSettings, setAiSettings] = useState<AISettings>({
    provider: 'native',
    baseUrl: '',
    customApiKey: '',
    targetModel: 'gemini-2.5-flash',
    geminiApiKey: '',
    enableFallback: true,
    fallbackBaseUrl: 'https://api.openai.com/v1',
    fallbackApiKey: '',
    fallbackModel: 'gpt-4o-mini'
  });

  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; message: string } | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [keysData, aiConfig] = await Promise.all([
      StorageService.getApiKeys(),
      StorageService.getAISettings()
    ]);
    setKeys(keysData);
    setAiSettings(aiConfig);
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
    await fetchData();
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
        alert(`${keyLines.length} API Key berhasil diimpor ke pool!`);
        await fetchData();
      }
    } catch (err) {
      alert("Gagal membaca file.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Hapus API Key ini secara permanen dari pool?')) {
      await StorageService.deleteApiKey(id);
      await fetchData();
    }
  };

  const handleReset = async (id: string) => {
    await StorageService.resetApiKeyUsage(id);
    await fetchData();
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    await StorageService.toggleApiKeyStatus(id, !currentStatus);
    await fetchData();
  };

  const handleSaveAISettings = async () => {
    await StorageService.saveAISettings(aiSettings);
    alert('Konfigurasi Mesin AI & LiteLLM Gateway berhasil disimpan!');
  };

  const handleRunTest = async (target: 'primary' | 'fallback' | 'gemini-cluster') => {
    setTestingConnection(target);
    setTestResult(null);
    try {
      const result = await GeminiService.testConnection(aiSettings, target);
      setTestResult(result);
    } catch (e: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        message: `Gagal menjalankan test: ${e.message}`
      });
    } finally {
      setTestingConnection(null);
    }
  };

  const totalHits = keys.reduce((acc, k) => acc + k.usageCount, 0);
  const activeKeys = keys.filter(k => k.isActive).length;
  const healthScore = keys.length > 0 
    ? Math.max(0, 100 - (keys.reduce((acc, k) => acc + (k.errorCount * 5), 0) / keys.length))
    : 100;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-3xl border shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setActiveTab('gemini-pool'); setTestResult(null); }}
            className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${
              activeTab === 'gemini-pool'
                ? 'orange-gradient text-white shadow-lg'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            <span>🔑</span>
            <span>Cluster Pool Gemini ({activeKeys})</span>
          </button>

          <button
            onClick={() => { setActiveTab('litellm-gateway'); setTestResult(null); }}
            className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${
              activeTab === 'litellm-gateway'
                ? 'bg-slate-900 text-white shadow-lg'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            <span>🌐</span>
            <span>External LiteLLM & Gateway</span>
            {aiSettings.provider === 'external' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            )}
          </button>
        </div>

        <div className="px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-[10px] font-black uppercase">
          Mesin Aktif: {aiSettings.provider === 'external' ? '🌐 External LiteLLM' : '⚡ Gemini Native Cluster'}
        </div>
      </div>

      {activeTab === 'gemini-pool' && (
        <>
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
                    Automatic Multi-Key Load Balancing
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleRunTest('gemini-cluster')}
                  disabled={!!testingConnection}
                  className="px-5 py-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-black rounded-2xl text-[10px] uppercase border border-emerald-200 transition-all outline-none"
                >
                  {testingConnection === 'gemini-cluster' ? 'Testing...' : '🧪 Test Ping Node'}
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="px-6 py-3 bg-gray-900 text-white font-black rounded-2xl text-[10px] uppercase shadow-xl hover:bg-orange-600 transition-all outline-none"
                >
                  {isUploading ? 'Importing...' : 'Bulk Upload .TXT'}
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileUpload} />
              </div>
            </div>

            {testResult && (
              <div className={`p-5 rounded-2xl border flex items-center gap-4 animate-in fade-in duration-300 ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                <div className="text-2xl">{testResult.success ? '✅' : '❌'}</div>
                <div className="flex-1">
                  <h5 className="font-black text-xs uppercase">{testResult.success ? 'Koneksi Berhasil' : 'Koneksi Bermasalah'}</h5>
                  <p className="text-[11px] font-mono mt-0.5">{testResult.message}</p>
                </div>
              </div>
            )}

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
        </>
      )}

      {activeTab === 'litellm-gateway' && (
        <div className="bg-white rounded-[3rem] border shadow-sm p-10 space-y-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg">🌐</div>
              <div>
                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">External LiteLLM & AI Gateway</h2>
                <p className="text-xs text-gray-500 font-bold mt-1">Konfigurasi Gateway OpenAI-Compatible, LiteLLM Proxy, atau Model Kustom.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleRunTest('primary')}
                disabled={!!testingConnection}
                className="px-6 py-3.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-black rounded-2xl text-xs uppercase tracking-wider border border-blue-200 transition-all outline-none flex items-center gap-2"
              >
                <span>🧪</span>
                <span>{testingConnection === 'primary' ? 'Menguji Koneksi...' : 'Uji Koneksi LiteLLM'}</span>
              </button>
              <button
                onClick={handleSaveAISettings}
                className="px-8 py-3.5 orange-gradient text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-xl hover:scale-105 transition-all outline-none"
              >
                Simpan Gateway
              </button>
            </div>
          </div>

          {testResult && (
            <div className={`p-6 rounded-3xl border flex items-start gap-4 animate-in fade-in duration-300 ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
              <div className="text-3xl">{testResult.success ? '🎉' : '⚠️'}</div>
              <div className="space-y-1">
                <h4 className="font-black text-sm uppercase">{testResult.success ? 'Status: Koneksi Sukses & Siap Digunakan' : 'Status: Koneksi Gagal Terhubung'}</h4>
                <p className="text-xs font-mono">{testResult.message}</p>
                {!testResult.success && (
                  <div className="mt-3 p-4 bg-white/70 rounded-2xl border border-rose-100 text-[11px] text-gray-700 space-y-1">
                    <p className="font-bold">Tips Penanganan:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Pastikan LiteLLM Server mengizinkan header CORS: <code className="bg-gray-100 px-1 py-0.5 rounded">CORS_ALLOWED_ORIGINS="*"</code></li>
                      <li>Jika web diakses via <b>HTTPS</b>, gunakan endpoint LiteLLM dengan protokol <b>HTTPS</b> (bukan HTTP).</li>
                      <li>Pastikan path URL menyertakan prefix <code className="bg-gray-100 px-1 py-0.5 rounded">/v1</code> (contoh: <code className="bg-gray-100 px-1 py-0.5 rounded">https://litellm.domain.com/v1</code>).</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Provider Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              onClick={() => setAiSettings({ ...aiSettings, provider: 'native' })}
              className={`p-6 rounded-[2.5rem] border-2 cursor-pointer transition-all flex items-center gap-5 ${
                aiSettings.provider === 'native'
                  ? 'border-orange-500 bg-orange-50/50 shadow-md ring-4 ring-orange-100'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="w-14 h-14 orange-gradient text-white rounded-2xl flex items-center justify-center text-2xl">⚡</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm text-gray-900 uppercase">Gemini Native Cluster</h4>
                  {aiSettings.provider === 'native' && <span className="text-[10px] font-black bg-orange-500 text-white px-2.5 py-1 rounded-full uppercase">Utama</span>}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Menggunakan cluster multi-key Gemini Pro dengan rotasi otomatis dan zero-latency.</p>
              </div>
            </div>

            <div
              onClick={() => setAiSettings({ ...aiSettings, provider: 'external' })}
              className={`p-6 rounded-[2.5rem] border-2 cursor-pointer transition-all flex items-center gap-5 ${
                aiSettings.provider === 'external'
                  ? 'border-slate-900 bg-slate-50 shadow-md ring-4 ring-slate-100'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-2xl">🌐</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm text-gray-900 uppercase">External LiteLLM / OpenAI</h4>
                  {aiSettings.provider === 'external' && <span className="text-[10px] font-black bg-slate-900 text-white px-2.5 py-1 rounded-full uppercase">Utama</span>}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Mengarahkan pemanggilan pembuatan soal ke endpoint LiteLLM Proxy / OpenAI Gateway kustom Anda.</p>
              </div>
            </div>
          </div>

          {/* Primary External Config Fields */}
          <div className="p-8 bg-gray-50 rounded-[2.5rem] border space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                <span>⚙️</span>
                <span>Konfigurasi Endpoint LiteLLM Utama</span>
              </h3>
              <span className="text-[10px] text-gray-400 font-bold uppercase">OpenAI-Compatible Chat Completions</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-1">LiteLLM Base URL (Endpoint)</label>
                <input
                  type="text"
                  placeholder="https://litellm.yourdomain.com/v1"
                  className="w-full px-5 py-3.5 rounded-2xl bg-white border border-gray-200 focus:border-slate-900 outline-none font-mono text-xs font-bold"
                  value={aiSettings.baseUrl}
                  onChange={e => setAiSettings({ ...aiSettings, baseUrl: e.target.value })}
                />
                <p className="text-[9px] text-gray-400 ml-1">Contoh: https://litellm.internal.id/v1 atau https://api.openai.com/v1</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">API Key / Bearer Token</label>
                  <button
                    type="button"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    className="text-[10px] text-blue-600 font-bold hover:underline"
                  >
                    {showSecretKey ? 'Sembunyikan' : 'Tampilkan'}
                  </button>
                </div>
                <input
                  type={showSecretKey ? 'text' : 'password'}
                  placeholder="sk-litellm-xxxxxxxxx (atau token proxy Anda)"
                  className="w-full px-5 py-3.5 rounded-2xl bg-white border border-gray-200 focus:border-slate-900 outline-none font-mono text-xs font-bold"
                  value={aiSettings.customApiKey}
                  onChange={e => setAiSettings({ ...aiSettings, customApiKey: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Target Model ID</label>
                <input
                  type="text"
                  placeholder="gpt-4o-mini / claude-3-5-sonnet / deepseek-chat"
                  className="w-full px-5 py-3.5 rounded-2xl bg-white border border-gray-200 focus:border-slate-900 outline-none font-mono text-xs font-bold"
                  value={aiSettings.targetModel}
                  onChange={e => setAiSettings({ ...aiSettings, targetModel: e.target.value })}
                />
                <p className="text-[9px] text-gray-400 ml-1">Nama model yang terdaftar di konfigurasi LiteLLM config.yaml Anda.</p>
              </div>
            </div>
          </div>

          {/* Redundancy & Auto-Fallback Section */}
          <div className="p-8 bg-orange-50/50 rounded-[2.5rem] border border-orange-100 space-y-6">
            <div className="flex items-center justify-between border-b border-orange-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="text-xl">🛡️</div>
                <div>
                  <h3 className="text-xs font-black text-orange-900 uppercase tracking-widest">Auto-Fallback & High Availability</h3>
                  <p className="text-[10px] text-orange-700 font-medium">Beralih otomatis ke Gemini Key Cluster jika server LiteLLM mengalami error/CORS/timeout.</p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-orange-500"
                  checked={aiSettings.enableFallback}
                  onChange={e => setAiSettings({ ...aiSettings, enableFallback: e.target.checked })}
                />
                <span className="text-xs font-black text-gray-700 uppercase">Aktifkan Fallback</span>
              </label>
            </div>

            {aiSettings.enableFallback && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Secondary Fallback Base URL (Opsional)</label>
                  <input
                    type="text"
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-5 py-3.5 rounded-2xl bg-white border border-gray-200 focus:border-orange-500 outline-none font-mono text-xs font-bold"
                    value={aiSettings.fallbackBaseUrl || ''}
                    onChange={e => setAiSettings({ ...aiSettings, fallbackBaseUrl: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Secondary Model ID</label>
                  <input
                    type="text"
                    placeholder="gpt-4o-mini"
                    className="w-full px-5 py-3.5 rounded-2xl bg-white border border-gray-200 focus:border-orange-500 outline-none font-mono text-xs font-bold"
                    value={aiSettings.fallbackModel || 'gpt-4o-mini'}
                    onChange={e => setAiSettings({ ...aiSettings, fallbackModel: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSaveAISettings}
              className="px-10 py-4 orange-gradient text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-xl hover:scale-105 transition-all outline-none"
            >
              Simpan Seluruh Pengaturan Gateway
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeyManagement;
