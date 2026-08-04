
import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storageService';
import { AISettings } from '../../types';

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
  const [aiSettings, setAiSettings] = useState<AISettings>({
    provider: 'native',
    baseUrl: '',
    customApiKey: '',
    targetModel: 'gemini-2.5-flash',
    targetImageModel: 'gemini-2.5-flash-image',
    enableFallback: true,
    fallbackBaseUrl: 'https://api.openai.com/v1',
    fallbackApiKey: '',
    fallbackModel: 'gpt-4o-mini'
  });
  const [isEnvManaged, setIsEnvManaged] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);
  const [showFallbackKey, setShowFallbackKey] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const gs = await StorageService.getGoogleSettings();
    const as = await StorageService.getAISettings();
    setGoogleSettings(gs);
    setAiSettings(as);

    const res = await fetch('/api/google-settings');
    if (res.ok) {
      const data = await res.json();
      if (data.source === 'env') setIsEnvManaged(true);
    }

    const savedSettings = localStorage.getItem('quizgen_site_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  };

  const handleSave = async () => {
    localStorage.setItem('quizgen_site_settings', JSON.stringify(settings));
    await StorageService.saveGoogleSettings(googleSettings);
    await StorageService.saveAISettings(aiSettings);
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
          <div className="space-y-10">
            <div className="space-y-6">
              <h3 className="text-xs font-black text-orange-500 uppercase tracking-widest border-l-4 border-orange-500 pl-3">Identitas & SEO</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nama Situs</label>
                  <input type="text" className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm" value={settings.siteName} onChange={e => setSettings({...settings, siteName: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">SEO Meta Title</label>
                  <input type="text" className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm" value={settings.seoTitle} onChange={e => setSettings({...settings, seoTitle: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">SEO Description</label>
                  <textarea className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm h-24 resize-none" value={settings.seoDesc} onChange={e => setSettings({...settings, seoDesc: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xs font-black text-orange-500 uppercase tracking-widest border-l-4 border-orange-500 pl-3">General Config</h3>
              <div className="space-y-4">
                 <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Zona Waktu</label>
                  <select className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm" value={settings.timezone} onChange={e => setSettings({...settings, timezone: e.target.value})}>
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
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-10">
            <div className="space-y-6">
              <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest border-l-4 border-blue-500 pl-3">AI Engine Configuration</h3>
              <div className="p-6 bg-blue-50 border border-blue-100 rounded-[2.5rem] space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Primary AI Provider Mode</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-white/50 rounded-2xl border">
                       <button 
                         type="button"
                         onClick={() => setAiSettings({...aiSettings, provider: 'native'})}
                         className={`py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${aiSettings.provider === 'native' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white'}`}
                       >Native Gemini</button>
                       <button 
                         type="button"
                         onClick={() => setAiSettings({...aiSettings, provider: 'external'})}
                         className={`py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${aiSettings.provider === 'external' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white'}`}
                       >External / LiteLLM</button>
                    </div>
                 </div>

                 {aiSettings.provider === 'external' && (
                   <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Primary Base URL (OpenAI Compatible)</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3 rounded-xl border bg-white text-[11px] font-mono outline-none focus:border-blue-500" 
                          placeholder="https://your-litellm.com/v1"
                          value={aiSettings.baseUrl}
                          onChange={e => setAiSettings({...aiSettings, baseUrl: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Custom API Key</label>
                        <div className="relative">
                           <input 
                            type={showAiKey ? 'text' : 'password'}
                            className="w-full px-4 py-3 rounded-xl border bg-white text-[11px] font-mono outline-none focus:border-blue-500 pr-12" 
                            placeholder="sk-..."
                            value={aiSettings.customApiKey}
                            onChange={e => setAiSettings({...aiSettings, customApiKey: e.target.value})}
                          />
                          <button type="button" onClick={() => setShowAiKey(!showAiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 p-1">
                            {showAiKey ? '🔒' : '👁️'}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Text Model ID</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-3 rounded-xl border bg-white text-[11px] font-mono outline-none focus:border-blue-500" 
                            placeholder="gpt-4o-mini"
                            value={aiSettings.targetModel}
                            onChange={e => setAiSettings({...aiSettings, targetModel: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Image Model ID</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-3 rounded-xl border bg-white text-[11px] font-mono outline-none focus:border-blue-500" 
                            placeholder="dall-e-3"
                            value={aiSettings.targetImageModel || ''}
                            onChange={e => setAiSettings({...aiSettings, targetImageModel: e.target.value})}
                          />
                        </div>
                      </div>
                   </div>
                 )}

                 {/* OpenAI / LiteLLM Fallback Settings */}
                 <div className="pt-4 border-t border-blue-200/60 space-y-4">
                    <div className="flex items-center justify-between">
                       <div>
                          <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                             ⚡ Auto Fallback Engine (OpenAI / LiteLLM)
                          </h4>
                          <p className="text-[9px] text-gray-500 font-medium">Beralih otomatis jika Gemini/Primary error/quota limit.</p>
                       </div>
                       <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={aiSettings.enableFallback !== false}
                            onChange={e => setAiSettings({...aiSettings, enableFallback: e.target.checked})}
                          />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                       </label>
                    </div>

                    {aiSettings.enableFallback !== false && (
                      <div className="space-y-3 bg-white/70 p-4 rounded-2xl border border-blue-100 animate-in fade-in duration-300">
                         <div className="space-y-1">
                           <label className="text-[9px] font-black text-gray-500 uppercase ml-1">Fallback Base URL (OpenAI / LiteLLM Endpoint)</label>
                           <input 
                             type="text" 
                             className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-[10px] font-mono outline-none focus:border-blue-500" 
                             placeholder="https://api.openai.com/v1 atau http://localhost:4000/v1"
                             value={aiSettings.fallbackBaseUrl || ''}
                             onChange={e => setAiSettings({...aiSettings, fallbackBaseUrl: e.target.value})}
                           />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[9px] font-black text-gray-500 uppercase ml-1">Fallback API Key (OpenAI / LiteLLM Key)</label>
                           <div className="relative">
                              <input 
                               type={showFallbackKey ? 'text' : 'password'}
                               className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-[10px] font-mono outline-none focus:border-blue-500 pr-10" 
                               placeholder="sk-..."
                               value={aiSettings.fallbackApiKey || ''}
                               onChange={e => setAiSettings({...aiSettings, fallbackApiKey: e.target.value})}
                             />
                             <button type="button" onClick={() => setShowFallbackKey(!showFallbackKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 p-1 text-xs">
                               {showFallbackKey ? '🔒' : '👁️'}
                             </button>
                           </div>
                         </div>
                         <div className="space-y-1">
                           <label className="text-[9px] font-black text-gray-500 uppercase ml-1">Fallback Model ID</label>
                           <input 
                             type="text" 
                             className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-[10px] font-mono outline-none focus:border-blue-500" 
                             placeholder="gpt-4o-mini"
                             value={aiSettings.fallbackModel || ''}
                             onChange={e => setAiSettings({...aiSettings, fallbackModel: e.target.value})}
                           />
                         </div>
                      </div>
                    )}
                 </div>

                 <p className="text-[9px] text-gray-400 font-bold uppercase leading-relaxed text-center px-4">
                   {aiSettings.provider === 'native' 
                     ? "Sistem siap: Menggunakan Gemini Native sebagai mesin utama, dengan pemicu otomatis ke OpenAI/LiteLLM jika terjadi gangguan." 
                     : "Sistem menggunakan endpoint eksternal LiteLLM/OpenAI sebagai mesin utama, dan Gemini sebagai cadangan."}
                 </p>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest border-l-4 border-blue-500 pl-3">Google Integrations</h3>
              <div className="p-6 bg-gray-50 border border-gray-100 rounded-[2.5rem] space-y-3">
                 <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Google Cloud Identity</h4>
                    {isEnvManaged && <span className="text-[8px] bg-blue-600 text-white px-2 py-0.5 rounded-full">ENV ACTIVE</span>}
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Google Client ID</label>
                    <input 
                      type="text" 
                      disabled={isEnvManaged}
                      className={`w-full px-4 py-3 rounded-xl border text-[10px] font-mono outline-none ${isEnvManaged ? 'bg-blue-50 text-blue-700 italic cursor-not-allowed border-blue-100' : 'bg-white border-gray-200'}`}
                      placeholder="Enter Client ID from Google Cloud"
                      value={isEnvManaged ? 'managed_by_environment_variable' : googleSettings.clientId}
                      onChange={e => setGoogleSettings({ clientId: e.target.value })}
                    />
                 </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 p-8 rounded-[2rem] border border-orange-100 flex items-center gap-6">
           <div className="text-4xl">🛡️</div>
           <div>
              <h4 className="font-black text-orange-800 uppercase text-xs">Hybrid Visual Engine</h4>
              <p className="text-[10px] text-orange-600 font-medium uppercase tracking-widest mt-1">Struktur ini mengoptimalkan token & kuota dengan mencoba model teringan sebelum menggunakan model Pro.</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SiteSettings;
