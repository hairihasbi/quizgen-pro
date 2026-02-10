
import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storageService';
import { EmailSettings } from '../../types';

const EmailSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isEnvManaged, setIsEnvManaged] = useState(false);

  useEffect(() => {
    loadSettings();
    checkEnvStatus();
  }, []);

  const checkEnvStatus = async () => {
    try {
      const res = await fetch('/api/notifications?action=sys-info');
      if (res.ok) {
        const data = await res.json();
        setIsEnvManaged(data.resendEnvFound);
      }
    } catch (e) {
      console.warn("Failed to check server ENV status");
    }
  };

  const loadSettings = async () => {
    const data = await StorageService.getEmailSettings();
    setSettings(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await StorageService.saveEmailSettings(settings);
      alert("Konfigurasi Email Berhasil Diperbarui di Cloud Turso!");
      loadSettings();
    } catch (e) {
      alert("Gagal menyimpan konfigurasi.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !settings) return (
    <div className="p-20 text-center animate-pulse text-orange-500 font-black uppercase text-[10px] tracking-widest">
      Synchronizing Email Services...
    </div>
  );

  const isMasked = settings.apiKey.includes('•');

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="bg-white rounded-[3rem] border shadow-sm p-10 space-y-12">
        <header className="flex flex-col md:flex-row justify-between items-center border-b pb-8 gap-6">
           <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl shadow-inner">✉️</div>
              <div>
                 <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Email System Integration</h2>
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Provider: {settings.provider.toUpperCase()}</p>
              </div>
           </div>
           <button 
             onClick={handleSave}
             disabled={isSaving}
             className="px-10 py-4 orange-gradient text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all uppercase text-xs tracking-widest disabled:opacity-50"
           >
             {isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
           </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
           <div className="space-y-8">
              <div className="space-y-4">
                 <h3 className="text-xs font-black text-orange-500 uppercase tracking-widest border-l-4 border-orange-500 pl-4">Service Provider</h3>
                 <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-2xl">
                    <button 
                      onClick={() => setSettings({...settings, provider: 'none'})}
                      className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${settings.provider === 'none' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                    >Disabled</button>
                    <button 
                      onClick={() => setSettings({...settings, provider: 'resend'})}
                      className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${settings.provider === 'resend' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400'}`}
                    >Resend API</button>
                    <button 
                      onClick={() => setSettings({...settings, provider: 'smtp'})}
                      className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${settings.provider === 'smtp' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400'}`}
                    >Real SMTP</button>
                 </div>
              </div>

              <div className="space-y-4">
                 <h3 className="text-xs font-black text-orange-500 uppercase tracking-widest border-l-4 border-orange-500 pl-4">Sender Details</h3>
                 <div className="space-y-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Display Name</label>
                       <input 
                         type="text"
                         className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm"
                         value={settings.senderName}
                         onChange={e => setSettings({...settings, senderName: e.target.value})}
                         placeholder="E.g. GenZ QuizGen Notifikasi"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-gray-400 uppercase ml-2">From Email Address</label>
                       <input 
                         type="email"
                         className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm"
                         value={settings.fromEmail}
                         onChange={e => setSettings({...settings, fromEmail: e.target.value})}
                         placeholder="notifications@yourdomain.com"
                       />
                    </div>
                 </div>
              </div>
           </div>

           <div className="space-y-8 bg-gray-50/50 p-8 rounded-[2.5rem] border border-gray-100">
              {settings.provider === 'resend' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                   <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-lg shadow-sm">🚀</div>
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-600">Resend API Configuration</h4>
                      </div>
                      {isEnvManaged ? (
                        <span className="bg-amber-100 text-amber-600 text-[8px] font-black px-2 py-1 rounded-full uppercase flex items-center gap-1 shadow-sm border border-amber-200">
                           🛡️ ENV MANAGED
                        </span>
                      ) : isMasked && (
                        <span className="bg-emerald-100 text-emerald-600 text-[8px] font-black px-2 py-1 rounded-full uppercase">🛡️ Encrypted</span>
                      )}
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase ml-2">API Secret Key</label>
                      <div className="relative">
                         <input 
                           type={showKey ? 'text' : 'password'}
                           disabled={isEnvManaged}
                           className={`w-full px-5 py-4 rounded-xl border font-mono text-[10px] outline-none focus:border-orange-500 shadow-sm transition-all ${
                             isEnvManaged ? 'bg-amber-50 text-amber-700 italic border-amber-200 cursor-not-allowed' : 
                             isMasked ? 'bg-emerald-50/50 text-emerald-700' : 'bg-white'
                           }`}
                           value={isEnvManaged ? 'managed_by_system_environment_variables' : settings.apiKey}
                           onChange={e => setSettings({...settings, apiKey: e.target.value})}
                           placeholder="re_xxxxxxxxxxxxxxx"
                         />
                         {!isEnvManaged && (
                            <button 
                              onClick={() => setShowKey(!showKey)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 p-2"
                            >{showKey ? '🔒' : '👁️'}</button>
                         )}
                      </div>
                      <p className="text-[8px] text-gray-400 font-bold uppercase mt-2 px-2 leading-relaxed">
                        {isEnvManaged 
                          ? "✓ Sistem mendeteksi RESEND_API_KEY di Vercel/Server. Pengaturan manual dinonaktifkan demi keamanan."
                          : isMasked 
                          ? "✓ Kunci disamarkan untuk keamanan. Masukkan kunci baru untuk menimpa." 
                          : "Dapatkan kunci di resend.com/api-keys"}
                      </p>
                   </div>
                   {isEnvManaged && (
                     <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[9px] text-amber-700 font-bold leading-relaxed flex gap-3 items-center">
                        <span className="text-xl">💡</span>
                        <span>Anda telah mengatur kunci API melalui dashboard host (Environment Variables). Ini adalah cara paling aman yang kami rekomendasikan.</span>
                     </div>
                   )}
                   {!isEnvManaged && (
                      <div className="p-4 bg-orange-100/50 border border-orange-200 rounded-2xl text-[9px] text-orange-600 font-bold leading-relaxed">
                         Catatan: Pastikan domain email pengirim telah diverifikasi (DNS Records) di dashboard Resend Anda agar pengiriman lancar.
                      </div>
                   )}
                </div>
              )}

              {settings.provider === 'smtp' && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-lg shadow-sm">⚡</div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-600">Standard SMTP Setup</h4>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[9px] font-black text-gray-400 uppercase">Host</label>
                         <input type="text" className="w-full px-4 py-3 rounded-xl border bg-white text-xs font-bold" value={settings.smtpHost || ''} onChange={e => setSettings({...settings, smtpHost: e.target.value})} placeholder="smtp.mailtrap.io" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[9px] font-black text-gray-400 uppercase">Port</label>
                         <input type="number" className="w-full px-4 py-3 rounded-xl border bg-white text-xs font-bold" value={settings.smtpPort || 587} onChange={e => setSettings({...settings, smtpPort: parseInt(e.target.value)})} />
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">User / Auth</label>
                      <input type="text" className="w-full px-4 py-3 rounded-xl border bg-white text-xs font-bold" value={settings.smtpUser || ''} onChange={e => setSettings({...settings, smtpUser: e.target.value})} />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Password</label>
                      <input type="password" className="w-full px-4 py-3 rounded-xl border bg-white text-xs font-bold" value={settings.smtpPass || ''} onChange={e => setSettings({...settings, smtpPass: e.target.value})} />
                   </div>
                </div>
              )}

              {settings.provider === 'none' && (
                <div className="h-full flex flex-col items-center justify-center py-10 opacity-40 text-center space-y-4">
                   <div className="text-5xl">🔇</div>
                   <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Email Service Disabled.<br/>Pesan hanya akan masuk ke Inbox internal.</p>
                </div>
              )}
           </div>
        </div>

        <div className="bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100 flex items-center gap-6">
           <div className="text-3xl">🛡️</div>
           <div>
              <h4 className="font-black text-emerald-800 uppercase text-xs">Arsitektur Keamanan Lapis Tiga</h4>
              <p className="text-[9px] text-emerald-600 font-medium uppercase tracking-widest mt-1 leading-relaxed">
                1. Kunci diprioritaskan dari Environment Variables (ENV).<br/>
                2. Kunci cadangan di Cloud Database disimpan dengan Redaksi UI (Masking).<br/>
                3. Eksekusi pengiriman hanya terjadi di sisi Serverless Backend (Tersandbox).
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default EmailSettingsPanel;
