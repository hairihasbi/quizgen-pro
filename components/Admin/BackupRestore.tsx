
import React, { useState, useRef } from 'react';
import { StorageService } from '../../services/storageService';

const BackupRestore: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setIsProcessing(true);
    try {
      await StorageService.exportFullBackup();
      setStatus({ type: 'success', msg: 'Backup sistem berhasil diunduh!' });
    } catch (e: any) {
      setStatus({ type: 'error', msg: 'Gagal membuat backup: ' + e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("PERINGATAN: Restorasi data akan menimpa database lokal dan cloud Anda (jika terhubung). Apakah Anda yakin?")) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    setStatus(null);

    try {
      const content = await file.text();
      await StorageService.importFullBackup(content);
      setStatus({ type: 'success', msg: 'Data berhasil dipulihkan! Halaman akan direfresh sebentar lagi.' });
      setTimeout(() => window.location.reload(), 2000);
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="bg-white rounded-[4rem] border border-orange-100 shadow-sm p-12 space-y-12">
        <header className="flex flex-col md:flex-row justify-between items-center gap-8 border-b pb-10 border-orange-50">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 orange-gradient rounded-[2rem] flex items-center justify-center text-white text-4xl shadow-2xl">📦</div>
            <div>
              <h2 className="text-3xl font-black text-gray-800 tracking-tighter uppercase">Disaster Recovery</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Backup & Restore System v2.0</p>
            </div>
          </div>
          <div className="flex gap-3">
             <div className="px-6 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">Safe Sync</div>
          </div>
        </header>

        {status && (
          <div className={`p-8 rounded-[2.5rem] border animate-in slide-in-from-top-4 duration-500 ${
            status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            <div className="flex items-center gap-4">
              <span className="text-2xl">{status.type === 'success' ? '✅' : '⚠️'}</span>
              <p className="font-bold text-sm uppercase tracking-tight">{status.msg}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Backup Action */}
          <div className="bg-gray-50 rounded-[3rem] p-10 border border-gray-100 hover:shadow-xl transition-all duration-500 group flex flex-col justify-between h-[400px]">
            <div className="space-y-6">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">📥</div>
              <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Export Cloud Backup</h3>
              <p className="text-gray-400 text-xs font-medium leading-relaxed">
                Unduh salinan lengkap database Anda dalam format JSON. Backup mencakup data guru, ribuan soal, log sistem, dan konfigurasi pembayaran.
              </p>
            </div>
            <button 
              onClick={handleBackup}
              disabled={isProcessing}
              className="w-full py-5 orange-gradient text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : 'Download Backup ➜'}
            </button>
          </div>

          {/* Restore Action */}
          <div className="bg-white rounded-[3rem] p-10 border-2 border-dashed border-orange-200 hover:border-orange-500 transition-all duration-500 group flex flex-col justify-between h-[400px] cursor-pointer relative overflow-hidden" onClick={() => fileInputRef.current?.click()}>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleRestore} />
            <div className="space-y-6">
              <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform text-orange-500">📤</div>
              <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Restore Database</h3>
              <p className="text-gray-400 text-xs font-medium leading-relaxed">
                Unggah file backup (.json) untuk memulihkan database ke kondisi sebelumnya. Berguna saat migrasi perangkat atau pemulihan data pasca-insiden.
              </p>
            </div>
            <div className="w-full py-5 bg-gray-900 text-white font-black rounded-2xl text-xs uppercase tracking-widest text-center shadow-xl group-hover:bg-orange-600 transition-all">
              {isProcessing ? 'Syncing...' : 'Upload Backup File'}
            </div>
            {isProcessing && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
                 <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-orange-50 p-8 rounded-[2.5rem] border border-orange-100 flex items-center gap-6">
           <div className="text-3xl">🛡️</div>
           <p className="text-[10px] text-orange-600 font-black uppercase tracking-widest leading-relaxed">
             Keamanan Data: Kami merekomendasikan melakukan backup manual setidaknya sekali seminggu. File backup berisi data sensitif, simpanlah di lokasi yang aman dan terenkripsi.
           </p>
        </div>
      </div>
    </div>
  );
};

export default BackupRestore;
