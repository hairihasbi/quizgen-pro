
import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storageService';
import { PaymentSettings, PaymentPackage } from '../../types';

const PaymentSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await StorageService.getPaymentSettings();
    // Pastikan kita selalu punya 3 paket utama
    let currentPackages = data.packages;
    if (currentPackages.length < 3) {
      const defaults = [
        { id: '1', name: 'Lite Pack', credits: 30, price: 30000, isActive: true, paymentLink: '' },
        { id: '2', name: 'Standard Pro', credits: 50, price: 50000, isActive: true, paymentLink: '' },
        { id: '3', name: 'Premium Guru', credits: 100, price: 100000, isActive: true, paymentLink: '' }
      ];
      currentPackages = defaults.map((d, i) => currentPackages[i] || d);
    }
    
    setSettings({ ...data, packages: currentPackages.slice(0, 3) });
    setLoading(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await StorageService.savePaymentSettings(settings);
      alert('Link Pembayaran Berhasil Disimpan!');
      loadSettings(); 
    } finally {
      setIsSaving(false);
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
      Loading Payment Configuration...
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="bg-white rounded-[3rem] border shadow-sm p-10 space-y-10">
        <header className="flex flex-col md:flex-row justify-between items-center border-b pb-8 gap-6">
           <div className="flex items-center gap-4">
              <div className="w-14 h-14 orange-gradient rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl">🔗</div>
              <div>
                 <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Manual Payment Links</h2>
                    <span className="bg-blue-100 text-blue-600 text-[8px] font-black px-3 py-1 rounded-full uppercase flex items-center gap-1 shadow-sm border border-blue-200">
                      SIMPLE MODE
                    </span>
                 </div>
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Atur link pembayaran untuk 3 paket utama</p>
              </div>
           </div>
           <button 
             onClick={handleSave} 
             disabled={isSaving}
             className="px-10 py-4 orange-gradient text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all uppercase text-xs tracking-widest disabled:opacity-50"
           >
             {isSaving ? 'Menyimpan...' : 'Simpan Semua Link'}
           </button>
        </header>

        <div className="p-8 bg-blue-50 border border-blue-100 rounded-[2.5rem] flex gap-4 items-start">
           <div className="text-2xl">💡</div>
           <div className="text-[11px] text-blue-700 font-bold uppercase leading-relaxed">
              <strong>Panduan:</strong> Masukkan URL lengkap (termasuk https://) untuk masing-masing paket. <br/>
              Contoh: Link WhatsApp (wa.me), Link Midtrans, Link Shopee, atau Link E-Wallet. 
              Sistem akan mengarahkan guru langsung ke link ini saat mereka klik "Beli".
           </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
           {settings.packages.map((pkg, idx) => (
             <div key={pkg.id} className="p-8 bg-gray-50/50 rounded-[2.5rem] border border-gray-100 space-y-6 group hover:border-orange-200 transition-all hover:shadow-md relative overflow-hidden">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 orange-gradient rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl">
                        {idx === 0 ? '🐣' : idx === 1 ? '🚀' : '👑'}
                      </div>
                      <div>
                         <h4 className="font-black text-gray-800 uppercase text-sm">{pkg.name}</h4>
                         <p className="text-[10px] text-orange-500 font-black uppercase">{pkg.credits} Credits • Rp {pkg.price.toLocaleString()}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={pkg.isActive} onChange={e => updatePackage(pkg.id, 'isActive', e.target.checked)} className="w-4 h-4 accent-orange-500" />
                        <span className="text-[9px] font-black uppercase text-gray-400">Tampilkan</span>
                      </label>
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Direct Payment Link URL</label>
                   <input 
                     type="url" 
                     className="w-full px-6 py-4 rounded-2xl border-2 border-transparent focus:border-orange-500 bg-white font-mono text-xs outline-none shadow-sm transition-all"
                     value={pkg.paymentLink || ''}
                     onChange={e => updatePackage(pkg.id, 'paymentLink', e.target.value)}
                     placeholder="https://wa.me/yournumber?text=Beli+Paket+Lite"
                   />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Nama Paket</label>
                      <input type="text" className="w-full px-4 py-2 rounded-xl border bg-white text-xs font-bold" value={pkg.name} onChange={e => updatePackage(pkg.id, 'name', e.target.value)} />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Kredit</label>
                         <input type="number" className="w-full px-4 py-2 rounded-xl border bg-white text-xs font-bold" value={pkg.credits} onChange={e => updatePackage(pkg.id, 'credits', parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Harga (IDR)</label>
                         <input type="number" className="w-full px-4 py-2 rounded-xl border bg-white text-xs font-bold" value={pkg.price} onChange={e => updatePackage(pkg.id, 'price', parseInt(e.target.value) || 0)} />
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
