
import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storageService';
import { PaymentSettings, PaymentPackage } from '../../types';

const PaymentSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [envStatus, setEnvStatus] = useState({
    clientIdManaged: false,
    secretKeyManaged: false
  });

  useEffect(() => {
    loadSettings();
    checkEnvStatus();
  }, []);

  const checkEnvStatus = async () => {
    try {
      const res = await fetch('/api/notifications?action=sys-info');
      if (res.ok) {
        const data = await res.json();
        setEnvStatus({
          clientIdManaged: data.dokuClientIdEnvFound,
          secretKeyManaged: data.dokuSecretKeyEnvFound
        });
      }
    } catch (e) {
      console.warn("Failed to check server ENV status for Payment");
    }
  };

  const loadSettings = async () => {
    const data = await StorageService.getPaymentSettings();
    // Kunci mode ke production
    setSettings({ ...data, mode: 'production' });
    setLoading(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    const finalSettings = { ...settings, mode: 'production' as const };
    await StorageService.savePaymentSettings(finalSettings);
    alert('Konfigurasi DOKU Production Berhasil Disimpan!');
    loadSettings(); 
  };

  const handleAddPackage = () => {
    if (!settings) return;
    const newPkg: PaymentPackage = {
      id: crypto.randomUUID(),
      name: 'Paket Baru',
      credits: 10,
      price: 10000,
      isActive: false
    };
    setSettings({ ...settings, packages: [...settings.packages, newPkg] });
  };

  const handleDeletePackage = (id: string) => {
    if (!settings || !window.confirm('Hapus paket harga ini?')) return;
    const newPackages = settings.packages.filter(p => p.id !== id);
    setSettings({ ...settings, packages: newPackages });
  };

  const updatePackage = (id: string, field: keyof PaymentPackage, value: any) => {
    if (!settings) return;
    const newPackages = settings.packages.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    );
    setSettings({ ...settings, packages: newPackages });
  };

  if (loading || !settings) return (
    <div className="p-20 text-center text-orange-500 font-black animate-pulse uppercase tracking-[0.2em]">
      Sinkronisasi Payment Gateway...
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="bg-white rounded-[3rem] border shadow-sm p-10 space-y-10">
        <header className="flex flex-col md:flex-row justify-between items-center border-b pb-8 gap-6">
           <div className="flex items-center gap-4">
              <div className="w-14 h-14 orange-gradient rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl">🛡️</div>
              <div>
                 <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">DOKU Payment Gateway</h2>
                    <span className="bg-emerald-100 text-emerald-600 text-[8px] font-black px-3 py-1 rounded-full uppercase flex items-center gap-1 shadow-sm border border-emerald-200">
                      PRODUCTION ONLY
                    </span>
                 </div>
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Status: Live Mode Activated</p>
              </div>
           </div>
           <button onClick={handleSave} className="px-10 py-4 orange-gradient text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all uppercase text-xs tracking-widest">
             Simpan Kredensial
           </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
           <div className="space-y-6">
              <h3 className="text-xs font-black text-orange-500 uppercase tracking-[0.2em] border-l-4 border-orange-500 pl-4">API Credentials</h3>
              <div className="space-y-4">
                 <div className="space-y-1">
                    <div className="flex justify-between items-center ml-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase">Client ID</label>
                       {envStatus.clientIdManaged && <span className="text-[8px] font-black text-amber-500 uppercase">Managed by ENV</span>}
                    </div>
                    <input 
                      type="text" 
                      disabled={envStatus.clientIdManaged}
                      className={`w-full px-6 py-4 rounded-2xl border-2 border-transparent focus:border-orange-500 font-mono text-xs outline-none shadow-inner transition-all ${
                        envStatus.clientIdManaged ? 'bg-amber-50 text-amber-700 italic cursor-not-allowed' : 'bg-gray-50 text-gray-900'
                      }`} 
                      value={envStatus.clientIdManaged ? 'managed_by_environment_variable' : settings.clientId}
                      onChange={e => setSettings({...settings, clientId: e.target.value})}
                      placeholder="Input ID Production"
                    />
                 </div>
                 <div className="space-y-1">
                    <div className="flex justify-between items-center ml-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase">Secret Key</label>
                       {envStatus.secretKeyManaged && <span className="text-[8px] font-black text-amber-500 uppercase">Managed by ENV</span>}
                    </div>
                    <div className="relative">
                      <input 
                        type={showSecret ? 'text' : 'password'} 
                        disabled={envStatus.secretKeyManaged}
                        className={`w-full px-6 py-4 rounded-2xl border-2 border-transparent focus:border-orange-500 font-mono text-xs outline-none shadow-inner transition-all ${
                          envStatus.secretKeyManaged ? 'bg-amber-50 text-amber-700 italic cursor-not-allowed' : 
                          settings.secretKey.includes('•') ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-900'
                        }`}
                        value={envStatus.secretKeyManaged ? 'managed_by_environment_variable' : settings.secretKey}
                        onChange={e => setSettings({...settings, secretKey: e.target.value})}
                        placeholder="Input Key Production"
                      />
                      {!envStatus.secretKeyManaged && (
                        <button 
                          onClick={() => setShowSecret(!showSecret)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 p-2"
                        >
                          {showSecret ? '🔒' : '👁️'}
                        </button>
                      )}
                    </div>
                    <p className="text-[8px] text-gray-400 font-bold uppercase mt-2 px-2 leading-relaxed">
                      Gunakan kredensial <strong>Production</strong> dari Dashboard DOKU. Mode Sandbox telah dihapus untuk mencegah error transaksi.
                    </p>
                 </div>
              </div>
           </div>

           <div className="space-y-6">
              <h3 className="text-xs font-black text-orange-500 uppercase tracking-[0.2em] border-l-4 border-orange-500 pl-4">Webhook & Notifications</h3>
              <div className="p-8 bg-gray-900 rounded-[2.5rem] border border-gray-800 text-white space-y-6">
                 <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-xl">🚀</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Production Webhook URL</div>
                 </div>
                 <div className="space-y-2">
                    <p className="text-[10px] text-gray-400 font-bold leading-relaxed">Copy URL ini ke "Notification URL" di Dashboard DOKU Merchant:</p>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 font-mono text-[10px] break-all select-all text-orange-300 cursor-copy" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/webhook`); alert("URL copied!"); }}>
                       {window.location.origin}/api/webhook
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border shadow-sm p-10 space-y-8">
         <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-xs font-black text-orange-500 uppercase tracking-[0.3em] border-l-4 border-orange-500 pl-4">Daftar Paket Top Up</h3>
            <button 
              onClick={handleAddPackage}
              className="px-8 py-3 bg-gray-100 text-gray-500 font-black rounded-xl text-[10px] uppercase hover:bg-orange-500 hover:text-white transition-all shadow-sm active:scale-95"
            >
              + Tambah Paket
            </button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {settings.packages.map(pkg => (
              <div key={pkg.id} className="p-8 bg-gray-50/50 rounded-[2.5rem] border border-gray-100 space-y-6 group hover:border-orange-200 transition-all hover:shadow-xl relative overflow-hidden">
                 <div className="flex justify-between items-start">
                    <div className="w-12 h-12 orange-gradient rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl">💰</div>
                    <div className="flex gap-2">
                      <button onClick={() => handleDeletePackage(pkg.id)} className="w-8 h-8 rounded-lg bg-white border border-rose-100 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100">🗑️</button>
                      <button onClick={() => updatePackage(pkg.id, 'isActive', !pkg.isActive)} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${pkg.isActive ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-white'}`}>
                        {pkg.isActive ? 'Active' : 'Draft'}
                      </button>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <div className="space-y-1">
                       <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Nama Paket</label>
                       <input type="text" className="w-full px-4 py-2.5 rounded-xl border bg-white font-bold text-sm outline-none focus:border-orange-500 shadow-sm" value={pkg.name} onChange={e => updatePackage(pkg.id, 'name', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Kredit</label>
                          <input type="number" className="w-full px-4 py-2.5 rounded-xl border bg-white font-bold text-sm outline-none focus:border-orange-500 shadow-sm" value={pkg.credits} onChange={e => updatePackage(pkg.id, 'credits', parseInt(e.target.value) || 0)} />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Harga (Rp)</label>
                          <input type="number" className="w-full px-4 py-2.5 rounded-xl border bg-white font-bold text-sm outline-none focus:border-orange-500 shadow-sm" value={pkg.price} onChange={e => updatePackage(pkg.id, 'price', parseInt(e.target.value) || 0)} />
                       </div>
                    </div>
                 </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default PaymentSettingsPanel;
