
import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storageService';
import { PaymentSettings, PaymentPackage } from '../../types';
import { Plus, Trash2, Globe, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';

const PaymentSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await StorageService.getPaymentSettings();
    setSettings(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await StorageService.savePaymentSettings(settings);
      alert('Konfigurasi Pembayaran Berhasil Disimpan!');
      loadSettings(); 
    } finally {
      setIsSaving(false);
    }
  };

  const addNewPackage = () => {
    if (!settings) return;
    
    // Animasi feedback
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 300);

    const newPkg: PaymentPackage = {
      id: crypto.randomUUID(),
      name: 'Paket Baru',
      credits: 0,
      price: 0,
      isActive: true,
      paymentLink: ''
    };
    setSettings({ ...settings, packages: [newPkg, ...settings.packages] });
  };

  const deletePackage = (id: string) => {
    if (!settings) return;
    if (confirm('Hapus paket ini dari daftar?')) {
      const newPackages = settings.packages.filter(p => p.id !== id);
      setSettings({ ...settings, packages: newPackages });
    }
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
      Synchronizing Payment Engine...
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-32">
      {/* Header Panel */}
      <div className="bg-white rounded-[3.5rem] border border-orange-50 shadow-2xl shadow-orange-100/20 p-10">
        <header className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
           <div className="flex items-center gap-6">
              <div className="w-20 h-20 orange-gradient rounded-[2rem] flex items-center justify-center text-white text-4xl shadow-2xl rotate-3">
                 <CreditCard size={36} />
              </div>
              <div>
                 <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">Product Catalog</h2>
                 <p className="text-xs font-bold text-orange-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    Live Deployment Mode
                 </p>
              </div>
           </div>
           <div className="flex gap-4">
             <button 
               onClick={addNewPackage}
               className={`px-8 py-5 bg-gray-900 text-white font-black rounded-3xl shadow-xl transition-all duration-300 flex items-center gap-3 uppercase text-[10px] tracking-widest hover:bg-orange-600 hover:-translate-y-1 active:scale-90 ${isClicked ? 'ring-4 ring-orange-200 bg-orange-500' : ''}`}
             >
               <Plus size={18} className={isClicked ? 'animate-spin-slow' : ''} />
               Tambah Paket
             </button>
             <button 
               onClick={handleSave} 
               disabled={isSaving}
               className="px-10 py-5 orange-gradient text-white font-black rounded-3xl shadow-2xl shadow-orange-200 hover:scale-105 active:scale-95 transition-all uppercase text-[10px] tracking-widest disabled:opacity-50"
             >
               {isSaving ? 'Synchronizing...' : 'Update Katalog ➜'}
             </button>
           </div>
        </header>

        {/* Info Box */}
        <div className="p-8 bg-blue-50/50 border-2 border-dashed border-blue-100 rounded-[2.5rem] flex gap-5 items-start mb-12">
           <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0">
              <Globe className="text-blue-500" size={24} />
           </div>
           <div>
              <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">Pusat Kendali Monetisasi</p>
              <p className="text-[11px] text-blue-800/70 font-bold leading-relaxed">
                 Perubahan pada katalog paket akan langsung berdampak pada menu Top Up di sisi Guru. 
                 Pastikan setiap paket memiliki <span className="text-blue-600 font-black underline">Direct Payment Link</span> yang valid untuk memfasilitasi transaksi instan.
              </p>
           </div>
        </div>

        {/* Modern List */}
        <div className="space-y-6">
           {settings.packages.map((pkg, idx) => (
             <div 
               key={pkg.id} 
               className={`p-10 bg-gray-50/30 rounded-[3rem] border-2 transition-all duration-500 hover:bg-white hover:border-orange-500/30 hover:shadow-2xl hover:shadow-orange-100 group animate-in slide-in-from-bottom-5 ${!pkg.isActive ? 'opacity-60 grayscale' : 'border-gray-100'}`}
               style={{ animationDelay: `${idx * 100}ms` }}
             >
                <div className="flex flex-col xl:flex-row gap-10">
                   {/* Left Side: Identity */}
                   <div className="flex items-start gap-6 min-w-[280px]">
                      <div className="relative">
                         <div className="w-20 h-20 bg-white rounded-[2.2rem] border-2 border-gray-100 flex items-center justify-center text-4xl shadow-sm group-hover:rotate-12 transition-transform duration-500">
                           {idx === 0 ? '🔥' : idx === 1 ? '💎' : '🌟'}
                         </div>
                         <div className="absolute -top-2 -right-2">
                            {pkg.isActive ? (
                              <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg border-4 border-white" title="Active">
                                 <CheckCircle2 size={14} />
                              </div>
                            ) : (
                              <div className="w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg border-4 border-white" title="Disabled">
                                 <AlertCircle size={14} />
                              </div>
                            )}
                         </div>
                      </div>
                      <div className="space-y-2 flex-1">
                         <input 
                           type="text" 
                           className="bg-transparent border-b-2 border-transparent focus:border-orange-500 outline-none font-black text-2xl text-gray-800 w-full tracking-tighter"
                           value={pkg.name}
                           onChange={e => updatePackage(pkg.id, 'name', e.target.value)}
                           placeholder="Nama Paket"
                         />
                         <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100 uppercase tracking-widest">
                               {pkg.credits} CREDITS
                            </span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">
                               ID: #{pkg.id.substring(0, 5)}
                            </span>
                         </div>
                      </div>
                   </div>

                   {/* Center: Config Inputs */}
                   <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Harga Jual (IDR)</label>
                         <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-gray-400 text-xs">Rp</span>
                            <input 
                              type="number" 
                              className="w-full pl-12 pr-6 py-4 rounded-2xl bg-white border border-gray-200 focus:border-orange-500 outline-none font-black text-sm shadow-sm"
                              value={pkg.price}
                              onChange={e => updatePackage(pkg.id, 'price', parseInt(e.target.value) || 0)}
                            />
                         </div>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Jumlah Kredit</label>
                         <input 
                           type="number" 
                           className="w-full px-6 py-4 rounded-2xl bg-white border border-gray-200 focus:border-orange-500 outline-none font-black text-sm shadow-sm"
                           value={pkg.credits}
                           onChange={e => updatePackage(pkg.id, 'credits', parseInt(e.target.value) || 0)}
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Visibilitas</label>
                         <button 
                           onClick={() => updatePackage(pkg.id, 'isActive', !pkg.isActive)}
                           className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border-2 ${pkg.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                         >
                           {pkg.isActive ? '✓ AKTIF DI TOKO' : '✕ DISEMBUNYIKAN'}
                         </button>
                      </div>
                   </div>

                   {/* Right: Payment Link & Delete */}
                   <div className="flex flex-col md:flex-row gap-4 xl:w-[350px]">
                      <div className="flex-1 space-y-2">
                         <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Payment URL</label>
                         <input 
                           type="url" 
                           className="w-full px-6 py-4 rounded-2xl bg-white border border-gray-200 focus:border-orange-500 outline-none font-mono text-[10px] shadow-sm text-blue-600"
                           value={pkg.paymentLink || ''}
                           onChange={e => updatePackage(pkg.id, 'paymentLink', e.target.value)}
                           placeholder="https://wa.me/..."
                         />
                      </div>
                      <div className="flex items-end">
                         <button 
                           onClick={() => deletePackage(pkg.id)}
                           className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-rose-100 group-hover:scale-105"
                           title="Hapus Paket"
                         >
                           <Trash2 size={20} />
                         </button>
                      </div>
                   </div>
                </div>
             </div>
           ))}

           {settings.packages.length === 0 && (
             <div className="py-32 text-center border-4 border-dashed border-gray-100 rounded-[4rem] flex flex-col items-center justify-center space-y-4">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-4xl grayscale">🛒</div>
                <p className="text-gray-300 font-black uppercase text-xs tracking-widest italic">Katalog paket masih kosong.</p>
                <button onClick={addNewPackage} className="text-orange-500 font-black uppercase text-[10px] tracking-widest hover:underline">+ Buat Paket Pertama</button>
             </div>
           )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 1s linear infinite;
        }
      `}} />
    </div>
  );
};

export default PaymentSettingsPanel;
