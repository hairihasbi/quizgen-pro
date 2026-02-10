
import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storageService';

const SiteSettings: React.FC = () => {
  const [settings, setSettings] = useState({
    siteName: 'GenZ QuizGen Pro',
    seoTitle: 'AI Quiz Generator Terbaik Indonesia',
    seoDesc: 'Platform pembuat soal otomatis berbasis AI tercanggih untuk Kurikulum Merdeka.',
    timezone: 'Asia/Jakarta',
    language: 'id-ID',
    tasksPerHour: 10,
    aiFactChecker: true,
    autoRotation: true,
    aiConfidenceThreshold: 85,
    autoFlagLowConfidence: true
  });

  const [googleSettings, setGoogleSettings] = useState({ clientId: '' });
  const [isEnvManaged, setIsEnvManaged] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const gs = await StorageService.getGoogleSettings();
    setGoogleSettings(gs);

    const res = await fetch('/api/google-settings');
    if (res.ok) {
      const data = await res.json();
      if (data.source === 'env') setIsEnvManaged(true);
    }
  };

  const handleSave = async () => {
    localStorage.setItem('quizgen_site_settings', JSON.stringify(settings));
    await StorageService.saveGoogleSettings(googleSettings);
    alert('Seluruh pengaturan berhasil diperbarui!');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-white rounded-[3rem] border shadow-sm p-10 space-y-12">
        <div className="flex items-center justify-between border-b pb-8">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 orange-gradient rounded-2xl flex items-center justify-center text-white text-xl">⚙️</div>
             <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Site Settings</h2>
          </div>
          <button onClick={handleSave} className="px-8 py-3 orange-gradient text-white font-black rounded-2xl shadow-xl hover:scale-105 transition-all uppercase text-xs">Simpan Perubahan</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <h3 className="text-xs font-black text-orange-500 uppercase tracking-widest border-l-4 border-orange-500 pl-3">Identitas & SEO</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nama Situs</label>
                <input type="text" className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold" value={settings.siteName} onChange={e => setSettings({...settings, siteName: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">SEO Meta Title</label>
                <input type="text" className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold" value={settings.seoTitle} onChange={e => setSettings({...settings, seoTitle: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">SEO Description</label>
                <textarea className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold h-24 resize-none" value={settings.seoDesc} onChange={e => setSettings({...settings, seoDesc: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-black text-orange-500 uppercase tracking-widest border-l-4 border-orange-500 pl-3">External Integrations</h3>
            <div className="space-y-6">
              <div className="p-6 bg-blue-50/50 border border-blue-100 rounded-[2rem] space-y-3">
                 <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Google Cloud Console</h4>
                    {isEnvManaged && <span className="text-[8px] bg-blue-600 text-white px-2 py-0.5 rounded-full">ENV ACTIVE</span>}
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Google Client ID</label>
                    <input 
                      type="text" 
                      disabled={isEnvManaged}
                      className={`w-full px-4 py-3 rounded-xl border text-[10px] font-mono outline-none ${isEnvManaged ? 'bg-blue-100 text-blue-700 italic cursor-not-allowed' : 'bg-white'}`}
                      placeholder="Enter Client ID from Google Cloud"
                      value={isEnvManaged ? 'managed_by_environment_variable' : googleSettings.clientId}
                      onChange={e => setGoogleSettings({ clientId: e.target.value })}
                    />
                 </div>
                 <p className="text-[8px] text-gray-400 font-bold leading-tight uppercase">
                    Diperlukan untuk fitur Export ke Google Forms & Docs. 
                    {isEnvManaged ? " Kunci saat ini dikunci oleh Vercel ENV." : " Masukkan Client ID di sini atau atur GOOGLE_CLIENT_ID di Vercel."}
                 </p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Zona Waktu</label>
                <select className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold" value={settings.timezone} onChange={e => setSettings({...settings, timezone: e.target.value})}>
                  <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                  <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                  <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
                </select>
              </div>

              <div className="pt-2 space-y-3">
                 <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" className="w-5 h-5 accent-orange-500" checked={settings.aiFactChecker} onChange={e => setSettings({...settings, aiFactChecker: e.target.checked})} />
                    <span className="text-[10px] font-black text-gray-600 group-hover:text-orange-500 uppercase">Aktifkan AI Fact Checker</span>
                 </label>
                 <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" className="w-5 h-5 accent-orange-500" checked={settings.autoRotation} onChange={e => setSettings({...settings, autoRotation: e.target.checked})} />
                    <span className="text-[10px] font-black text-gray-600 group-hover:text-orange-500 uppercase">Auto-Rotation API Keys</span>
                 </label>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 p-8 rounded-[2rem] border border-orange-100 flex items-center gap-6">
           <div className="text-4xl">📄</div>
           <div>
              <h4 className="font-black text-orange-800 uppercase text-xs">Sitemap & SEO Automation</h4>
              <p className="text-[10px] text-orange-600 font-medium uppercase tracking-widest mt-1">Status: Optimized for Edge Runtime</p>
           </div>
           <button className="ml-auto px-6 py-2 bg-white text-orange-600 font-black rounded-xl text-[10px] uppercase shadow-sm">Audit SEO</button>
        </div>
      </div>
    </div>
  );
};

export default SiteSettings;
