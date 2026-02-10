
import React, { useState } from 'react';
import { StorageService } from '../services/storageService';
import { User, UserRole, LogCategory } from '../types';

interface RegisterProps {
  onBack: () => void;
}

const Register: React.FC<RegisterProps> = ({ onBack }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validasi
    if (formData.password !== formData.confirmPassword) {
      return setError('Konfirmasi password tidak cocok!');
    }
    if (formData.password.length < 6) {
      return setError('Password minimal 6 karakter!');
    }

    setLoading(true);
    try {
      await StorageService.init();
      const users = await StorageService.getUsers();
      
      const sanitizedUsername = StorageService.sanitizeInput(formData.username.trim().toLowerCase());
      const sanitizedEmail = StorageService.sanitizeInput(formData.email.trim().toLowerCase());

      if (users.some(u => u.username === sanitizedUsername)) {
        throw new Error('Username sudah digunakan!');
      }
      if (users.some(u => u.email === sanitizedEmail)) {
        throw new Error('Email sudah terdaftar!');
      }

      // Hashing Password Sungguhan sebelum simpan ke DB
      const passwordHash = await StorageService.hashPassword(formData.password);

      const newUser: User = {
        id: crypto.randomUUID(),
        username: sanitizedUsername,
        fullName: StorageService.sanitizeInput(formData.fullName),
        email: sanitizedEmail,
        password: passwordHash,
        role: UserRole.TEACHER,
        credits: 0, // Belum dapat kredit sampai disetujui
        isActive: false,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await StorageService.saveUsers([...users, newUser]);

      await StorageService.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        category: LogCategory.SECURITY,
        action: 'USER_REGISTERED',
        details: `Guru baru mendaftar: ${sanitizedUsername} (${sanitizedEmail}). Menunggu persetujuan.`,
        status: 'success',
        userId: 'system'
      });

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#fffaf0]">
        <div className="w-full max-w-md bg-white p-12 rounded-[3rem] shadow-2xl text-center space-y-8 animate-in zoom-in-95 duration-500">
           <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full mx-auto flex items-center justify-center text-5xl shadow-inner">🎉</div>
           <div className="space-y-2">
              <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">Pendaftaran Terkirim!</h2>
              <p className="text-gray-500 font-medium">Terima kasih telah mendaftar. Data Anda telah dienkripsi dan dikirim ke admin untuk direview.</p>
           </div>
           <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 text-[10px] font-black text-orange-600 uppercase tracking-widest leading-relaxed">
             Anda akan mendapatkan 2 Kredit Gratis setelah admin menyetujui akun Anda. Silakan cek inbox secara berkala.
           </div>
           <button onClick={onBack} className="w-full py-5 rounded-2xl orange-gradient text-white font-black uppercase shadow-xl hover:scale-105 transition-all">Kembali Ke Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#fffaf0] relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-80 h-80 orange-gradient rounded-full blur-[120px] opacity-10 animate-pulse"></div>
      
      <div className="w-full max-w-lg space-y-8 animate-in fade-in duration-700">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 orange-gradient rounded-2xl mx-auto flex items-center justify-center text-white text-3xl font-black shadow-xl">Q</div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tighter">Daftar Akun Guru</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bergabung dengan Ekosistem QuizGen AI</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl border border-white space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-500 text-xs font-bold text-center animate-shake">
              ⚠️ {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Nama Lengkap & Gelar</label>
              <input 
                type="text" required
                className="w-full px-6 py-4 rounded-2xl bg-gray-50/50 border-2 border-transparent focus:bg-white focus:border-orange-500 outline-none font-bold text-gray-800 transition-all"
                placeholder="E.g. Hairi, S.Pd."
                value={formData.fullName}
                onChange={e => setFormData({...formData, fullName: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Username</label>
                <input 
                  type="text" required
                  className="w-full px-6 py-4 rounded-2xl bg-gray-50/50 border-2 border-transparent focus:bg-white focus:border-orange-500 outline-none font-bold text-gray-800 transition-all"
                  placeholder="guru_baru"
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Email Sekolah</label>
                <input 
                  type="email" required
                  className="w-full px-6 py-4 rounded-2xl bg-gray-50/50 border-2 border-transparent focus:bg-white focus:border-orange-500 outline-none font-bold text-gray-800 transition-all"
                  placeholder="name@school.id"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Password</label>
                <input 
                  type="password" required
                  className="w-full px-6 py-4 rounded-2xl bg-gray-50/50 border-2 border-transparent focus:bg-white focus:border-orange-500 outline-none font-bold text-gray-800 transition-all"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Konfirmasi</label>
                <input 
                  type="password" required
                  className="w-full px-6 py-4 rounded-2xl bg-gray-50/50 border-2 border-transparent focus:border-orange-500 outline-none font-bold text-gray-800 transition-all"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" disabled={loading}
            className="w-full py-5 rounded-[2rem] orange-gradient text-white font-black text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'MENYINKRONKAN DATA...' : 'DAFTAR SEKARANG ➜'}
          </button>

          <button type="button" onClick={onBack} className="w-full text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-orange-500 transition-colors">
            SUDAH PUNYA AKUN? LOGIN DISINI
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;
