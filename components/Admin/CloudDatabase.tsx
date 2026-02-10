
import React, { useState } from 'react';
import { StorageService } from '../../services/storageService';

const CloudDatabase: React.FC = () => {
  const [config, setConfig] = useState({
    url: process.env.TURSO_DB_URL || '',
    token: process.env.TURSO_AUTH_TOKEN || ''
  });
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const testConnection = async () => {
    setStatus('testing');
    try {
      const isOk = await StorageService.init();
      setStatus(isOk ? 'success' : 'error');
    } catch (e) {
      setStatus('error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-[3rem] border shadow-sm p-12 space-y-10">
        <div className="text-center space-y-4">
           <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] mx-auto flex items-center justify-center text-4xl shadow-inner">☁️</div>
           <div>
             <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Cloud Database Engine</h2>
             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Turso LibSQL Synchronizer v3.1</p>
           </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Turso DB URL</label>
            <input 
              type="text" 
              className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-blue-500 outline-none font-mono text-xs" 
              placeholder="libsql://your-db-name.turso.io"
              value={config.url}
              onChange={e => setConfig({...config, url: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Auth Token</label>
            <input 
              type="password" 
              className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-blue-500 outline-none font-mono text-xs" 
              placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
              value={config.token}
              onChange={e => setConfig({...config, token: e.target.value})}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button 
            onClick={testConnection}
            disabled={status === 'testing'}
            className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl ${
              status === 'testing' ? 'bg-gray-100 text-gray-400' :
              status === 'success' ? 'bg-emerald-500 text-white shadow-emerald-200' :
              status === 'error' ? 'bg-rose-500 text-white shadow-rose-200' :
              'bg-blue-600 text-white shadow-blue-200 hover:scale-[1.02]'
            }`}
          >
            {status === 'testing' ? 'Connecting to Turso Node...' : 
             status === 'success' ? '✓ Connection Established' :
             status === 'error' ? '✕ Connection Failed' :
             'Test Cloud Connection'}
          </button>
          <p className="text-[9px] text-center text-gray-400 font-bold uppercase italic leading-relaxed px-10">
            Note: Pengaturan ini sebaiknya dilakukan melalui environment variables (.env) di platform Vercel/Netlify untuk keamanan maksimal.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CloudDatabase;
