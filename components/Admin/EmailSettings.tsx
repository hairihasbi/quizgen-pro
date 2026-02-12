
import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storageService';
import { EmailSettings } from '../../types';

const EmailSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await StorageService.getEmailSettings();
    // Default fallback jika data lama masih 'resend' atau format berbeda
    if (!data.method) data.method = 'api';
    if (data.provider as string === 'resend') data.provider = 'none';
    setSettings(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await StorageService.saveEmailSettings(settings);
      alert("Konfigurasi Email Berhasil Diperbarui!");
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
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Provider: {settings.provider.toUpperCase()} ({settings.method.toUpperCase()})</p>
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
                      onClick={() => setSettings({...settings, provider: 'mailersend'})}
                      className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${settings.provider === 'mailersend' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400'}`}
                    >MailerSend</button>
                    <button 
                      onClick={() => setSettings({...settings, provider: 'brevo'})}
                      className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${settings.provider === 'brevo' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400'}`}
                    >Brevo</button>
                 </div>
              </div>

              {settings.provider !== 'none' && (
                <div className="space-y-4">
                   <h3 className="text-xs font-black text-orange-500 uppercase tracking-widest border-l-4 border-orange-500 pl-4">Connection Method</h3>
                   <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-2xl">
                      <button 
                        onClick={() => setSettings({...settings, method: 'api'})}
                        className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${settings.method === 'api' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                      >API Key (REST)</button>
                      <button 
                        onClick={() => setSettings({...settings, method: 'smtp'})}
                        className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${settings.method === 'smtp' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                      >Standard SMTP</button>
                   </div>
                </div>
              )}

              <div className="space-y-4">
                 <h3 className="text-xs font-black text-orange-500 uppercase tracking-widest border-l-4 border-orange-500 pl-4">Sender Identity</h3>
                 <div className="space-y-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Sender Name</label>
                       <input 
                         type="text"
                         className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm"
                         value={settings.senderName}
                         onChange={e => setSettings({...settings, senderName: e.target.value})}
                         placeholder="E.g. GenZ QuizGen Pro"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Verified Sender Email</label>
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
              {settings.provider === 'none' ? (
                <div className="h-full flex flex-col items-center justify-center py-20 opacity-40 text-center space-y-4">
                   <div className="text-6xl">🔇</div>
                   <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Email Service Disabled.<br/>Notifikasi asli tidak akan dikirim.</p>
                </div>
              ) : settings.method === 'api' ? (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">🔑</div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-600">{settings.provider.toUpperCase()} REST API</h4>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase ml-2">API Secret Token</label>
                      <div className="relative">
                         <input 
                           type={showKey ? 'text' : 'password'}
                           className={`w-full px-5 py-4 rounded-xl border font-mono text-[10px] outline-none focus:border-orange-500 shadow-sm transition-all ${isMasked ? 'bg-emerald-50/50 text-emerald-700' : 'bg-white'}`}
                           value={settings.apiKey}
                           onChange={e => setSettings({...settings, apiKey: e.target.value})}
                           placeholder={settings.provider === 'brevo' ? 'xkeysib-...' : 'mlsn.ey...'}
                         />
                         <button onClick={() => setShowKey(!showKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 p-2">{showKey ? '🔒' : '👁️'}</button>
                      </div>
                      <p className="text-[8px] text-gray-400 font-bold uppercase mt-2 px-2 leading-relaxed">
                        {settings.provider === 'brevo' ? "Dapatkan di Brevo -> API Keys" : "Dapatkan di MailerSend -> API Tokens"}
                      </p>
                   </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                   <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">⚡</div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-600">{settings.provider.toUpperCase()} SMTP Setup</h4>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[9px] font-black text-gray-400 uppercase">Host</label>
                         <input type="text" className="w-full px-4 py-3 rounded-xl border bg-white text-xs font-bold" value={settings.smtpHost || ''} onChange={e => setSettings({...settings, smtpHost: e.target.value})} placeholder={settings.provider === 'brevo' ? 'smtp-relay.brevo.com' : 'smtp.mailersend.net'} />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[9px] font-black text-gray-400 uppercase">Port</label>
                         <input type="number" className="w-full px-4 py-3 rounded-xl border bg-white text-xs font-bold" value={settings.smtpPort || 587} onChange={e => setSettings({...settings, smtpPort: parseInt(e.target.value)})} />
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">SMTP User</label>
                      <input type="text" className="w-full px-4 py-3 rounded-xl border bg-white text-xs font-bold" value={settings.smtpUser || ''} onChange={e => setSettings({...settings, smtpUser: e.target.value})} placeholder="Email login provider" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">SMTP Password</label>
                      <input type="password" className="w-full px-4 py-3 rounded-xl border bg-white text-xs font-bold" value={settings.smtpPass || ''} onChange={e => setSettings({...settings, smtpPass: e.target.value})} />
                   </div>
                </div>
              )}
           </div>
        </div>

        <div className="bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100 flex items-center gap-6">
           <div className="text-3xl">🛡️</div>
           <div>
              <h4 className="font-black text-emerald-800 uppercase text-xs">Arsitektur Hybrid Multi-Provider</h4>
              <p className="text-[9px] text-emerald-600 font-medium uppercase tracking-widest mt-1 leading-relaxed">
                Konfigurasi ini akan disimpan terenkripsi di database Turso. Sistem backend akan mendeteksi secara otomatis apakah harus menggunakan REST API SDK atau protokol SMTP untuk pengiriman notifikasi guru.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default EmailSettingsPanel;
