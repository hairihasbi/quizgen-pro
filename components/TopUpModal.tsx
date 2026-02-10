
import React, { useState, useEffect } from 'react';
import { User, PaymentPackage } from '../types';
import { DokuService } from '../services/dokuService';
import { StorageService } from '../services/storageService';

interface TopUpModalProps {
  user: User;
  onClose: () => void;
  onSuccess: (url: string) => void;
}

const TopUpModal: React.FC<TopUpModalProps> = ({ user, onClose, onSuccess }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [packages, setPackages] = useState<PaymentPackage[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const loadPackages = async () => {
      const settings = await StorageService.getPaymentSettings();
      // Hanya tampilkan paket yang aktif
      setPackages(settings.packages.filter(p => p.isActive));
      setIsFetching(false);
    };
    loadPackages();
  }, []);

  const handleCheckout = async (pkg: PaymentPackage) => {
    setLoading(pkg.id);
    try {
      const url = await DokuService.createInvoice(user, { 
        amount: pkg.price, 
        credits: pkg.credits,
        name: pkg.name
      });
      onSuccess(url);
    } catch (err: any) {
      // PERBAIKAN: Tampilkan pesan error asli untuk memudahkan diagnosa (misal: "Client ID Not Found")
      alert(`Gagal memproses pembayaran: ${err.message || 'Terjadi kesalahan sistem.'}`);
    } finally {
      setLoading(null);
    }
  };

  const getPackageIcon = (index: number) => {
    const icons = ['🐣', '🚀', '👑', '💎', '🔥', '⚡'];
    return icons[index % icons.length];
  };

  const getPackageColor = (index: number) => {
    const colors = [
      'from-orange-400 to-orange-500',
      'from-orange-500 to-red-500',
      'from-purple-500 to-orange-500',
      'from-blue-500 to-emerald-500',
      'from-rose-500 to-pink-500'
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300">
        <div className="md:w-1/3 orange-gradient p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-3xl font-black leading-none mb-4 uppercase">ISI ULANG<br/>KREDIT AI</h3>
            <p className="text-white/80 font-medium text-sm">Pilih paket terbaik untuk menunjang produktivitas mengajar Anda.</p>
          </div>
          <div className="relative z-10 bg-white/10 p-6 rounded-3xl backdrop-blur-md">
             <div className="text-xs font-black uppercase tracking-widest opacity-60 mb-1">Saldo Saat Ini</div>
             <div className="text-4xl font-black">{user.credits}</div>
             <div className="text-xs font-bold mt-1 uppercase">Kredit Tersedia</div>
          </div>
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        </div>

        <div className="flex-1 p-8 md:p-12 space-y-8 bg-gray-50/50 relative">
          <button onClick={onClose} className="absolute top-8 right-8 text-gray-300 hover:text-gray-600 transition-colors text-2xl">✕</button>
          
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-xl">🛒</div>
            <h4 className="text-xl font-black text-gray-800 uppercase tracking-tight">Pilih Paket Kredit</h4>
          </div>

          {isFetching ? (
            <div className="py-20 text-center animate-pulse text-gray-300 font-black uppercase tracking-widest text-xs">
              Menghubungkan ke Store...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {packages.map((pkg, idx) => (
                <button 
                  key={pkg.id}
                  onClick={() => handleCheckout(pkg)}
                  disabled={!!loading}
                  className={`relative group bg-white p-6 rounded-[2rem] border-2 border-transparent hover:border-orange-500 hover:shadow-xl transition-all text-left overflow-hidden flex flex-col h-full`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-3xl">{getPackageIcon(idx)}</span>
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getPackageColor(idx)} opacity-20`}></div>
                  </div>
                  <div className="font-black text-gray-800 group-hover:text-orange-600 transition-colors">{pkg.name}</div>
                  <div className="text-2xl font-black text-gray-900 mt-1">
                     {pkg.credits} <span className="text-xs font-bold text-gray-400 uppercase">Kredit</span>
                  </div>
                  <div className="mt-auto pt-4 border-t flex justify-between items-center w-full">
                     <span className="text-sm font-black text-orange-500">Rp {pkg.price.toLocaleString('id-ID')}</span>
                     {loading === pkg.id ? (
                        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                     ) : (
                        <span className="text-xs font-black text-gray-300 group-hover:text-orange-500">BELI ➜</span>
                     )}
                  </div>
                </button>
              ))}
              {packages.length === 0 && (
                <div className="col-span-full py-20 text-center text-gray-300 font-black uppercase tracking-widest text-[10px] italic">
                  Maaf, belum ada paket yang tersedia.
                </div>
              )}
            </div>
          )}

          <div className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 flex items-center gap-4">
             <div className="text-2xl grayscale">🛡️</div>
             <p className="text-[10px] text-gray-400 font-bold leading-relaxed uppercase tracking-widest">
                Pembayaran Aman &amp; Terenkripsi via <span className="text-orange-500">DOKU Payment Gateway</span>. Real-time credit injection enabled.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopUpModal;
