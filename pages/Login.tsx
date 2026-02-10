
import React, { useState } from 'react';
import { StorageService } from '../services/storageService';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  onRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [showCloudSettings, setShowCloudSettings] = useState(false);
  
  const initialConfig = StorageService.getStoredConfig();
  const [cloudUrl, setCloudUrl] = useState(initialConfig.url);
  const [cloudToken, setCloudToken] = useState(initialConfig.token);
  const [testStatus, setTestStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSyncMessage('Menghubungkan ke Turso Engine...');

    const sanitizedUser = StorageService.sanitizeInput(username.trim().toLowerCase());
    const sanitizedPass = password.trim();
    
    try {
      await StorageService.init();
      setSyncMessage('Sinkronisasi data antar device...');
      await new Promise(r => setTimeout(r, 800)); 
      
      const users = await StorageService.getUsers();
      const foundUser = users.find(u => u.username === sanitizedUser);
      
      if (!foundUser) {
        throw new Error('Username tidak ditemukan!');
      }

      const isValid = await StorageService.verifyPassword(sanitizedPass, foundUser.password || '');
      if (!isValid) {
        throw new Error('Password salah!');
      }

      if (foundUser.status === 'pending') {
        throw new Error('Akun Anda masih dalam antrean persetujuan Admin. Harap tunggu.');
      }

      if (foundUser.status === 'rejected') {
        throw new Error('Maaf, pendaftaran akun Anda ditolak oleh Admin.');
      }

      if (!foundUser.isActive) {
        throw new Error('Akun Anda dinonaktifkan. Hubungi admin.');
      }

      setSyncMessage(`Mempersiapkan Sesi Secure JWT...`);
      // handleLogin sekarang asinkron di App.tsx karena ada proses JWT
      await onLogin(foundUser);

    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveCloudConfig = async () => {
    setTestStatus('saving');
    const sanitizedUrl = StorageService.sanitizeInput(cloudUrl.trim());
    const sanitizedToken = StorageService.sanitizeInput(cloudToken.trim());
    
    try {
      StorageService.setCloudConfig(sanitizedUrl, sanitizedToken);
      const isOk = await StorageService.init();
      setTestStatus(isOk ? 'success' : 'error');
      if (isOk) alert("Cloud Database Berhasil Dihubungkan!");
    } catch (e) {
      setTestStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#fffaf0] relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-80 h-80 orange-gradient rounded-full blur-[120px] opacity-20 animate-pulse" aria-hidden="true"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-orange-300 rounded-full blur-[120px] opacity-20" aria-hidden="true"></div>

      <div className="w-full max-w-md space-y-8 animate-in fade-in duration-1000">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 orange-gradient rounded-[2.5rem] mx-auto flex items-center justify-center text-white text-5xl font-black shadow-2xl shadow-orange-200 rotate-6 hover:rotate-0 transition-transform duration-500" aria-hidden="true">Q</div>
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-gray-900 tracking-tighter">GenZ <span className="text-orange-500">QuizGen</span> Pro</h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]" role="status">
              {StorageService.isLocal() ? 'Offline Mode' : 'Cloud Sync Enabled'} • v2.5
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="bg-white/70 backdrop-blur-xl p-10 rounded-[3rem] border border-white shadow-2xl space-y-8 relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-4 animate-in fade-in" role="alert" aria-busy="true">
              <div className="w-12 h-12 border-4 border-orange-100 border-t-orange-500 rounded-full animate-spin"></div>
              <p className="text-xs font-black text-orange-600 uppercase tracking-widest animate-pulse">{syncMessage}</p>
            </div>
          )}

          <div className="space-y-5">
            <div className="space-y-1">
              <label htmlFor="username" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Username</label>
              <input 
                id="username"
                type="text" 
                required
                className="w-full px-6 py-4 rounded-2xl border-2 border-transparent bg-gray-100/50 focus:bg-white focus:border-orange-500 outline-none transition-all font-bold text-gray-800"
                placeholder="hairi / guru123"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="password" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Password</label>
              <input 
                id="password"
                type="password" 
                required
                className="w-full px-6 py-4 rounded-2xl border-2 border-transparent bg-gray-100/50 focus:bg-white focus:border-orange-500 outline-none transition-all font-bold text-gray-800"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-5 rounded-[2rem] orange-gradient text-white font-black text-lg shadow-2xl shadow-orange-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 outline-none focus:ring-4 focus:ring-orange-300"
            >
              MASUK SISTEM ➜
            </button>
            <button 
              type="button"
              onClick={onRegister}
              className="w-full py-2 text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-600 transition-colors"
            >
              GURU BARU? DAFTAR AKUN DISINI
            </button>
          </div>

          <div className="pt-4 border-t border-dashed border-gray-200">
             <button 
               type="button"
               onClick={() => setShowCloudSettings(!showCloudSettings)}
               className="w-full py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-orange-600 transition-colors flex items-center justify-center gap-2 outline-none focus:ring-2 focus:ring-orange-100"
             >
               {showCloudSettings ? '✕ TUTUP SETTING' : '⚙️ LINK CLOUD DATABASE (ADVANCED)'}
             </button>

             {showCloudSettings && (
               <div className="mt-6 space-y-4 bg-orange-50/50 p-6 rounded-[2rem] border border-orange-100 animate-in slide-in-from-top-4 duration-500">
                  <div className="space-y-1">
                    <label htmlFor="turso-url" className="text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1">Turso URL</label>
                    <input 
                      id="turso-url"
                      type="text" 
                      className="w-full px-4 py-3 rounded-xl border bg-white text-[11px] font-mono outline-none focus:border-orange-500" 
                      placeholder="libsql://your-db.turso.io"
                      value={cloudUrl}
                      onChange={e => setCloudUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="turso-token" className="text-[9px] font-black text-orange-400 uppercase tracking-widest ml-1">Auth Token</label>
                    <input 
                      id="turso-token"
                      type="password" 
                      className="w-full px-4 py-3 rounded-xl border bg-white text-[11px] font-mono outline-none focus:border-orange-500" 
                      placeholder="Enter Turso Token"
                      value={cloudToken}
                      onChange={e => setCloudToken(e.target.value)}
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={saveCloudConfig}
                    className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all outline-none ${
                      testStatus === 'success' ? 'bg-emerald-500 text-white' :
                      testStatus === 'error' ? 'bg-rose-500 text-white' :
                      'bg-gray-900 text-white hover:bg-orange-600'
                    }`}
                  >
                    {testStatus === 'saving' ? 'Processing...' : 
                     testStatus === 'success' ? '✓ Connected' :
                     testStatus === 'error' ? '✕ Failed' :
                     'Link Database Now'}
                  </button>
               </div>
             )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
