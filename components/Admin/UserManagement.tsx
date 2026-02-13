
import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storageService';
import { EmailService } from '../../services/emailService';
import { User, UserRole, LogCategory, UserStatus } from '../../types';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'approved' | 'pending' | 'rejected'>('approved');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [newUser, setNewUser] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    credits: 10
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await StorageService.getUsers();
      setUsers(data);
    } catch (e) {
      console.error("Gagal mengambil data user:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCredit = async (userId: string, amount: number) => {
    setActionLoading(userId);
    try {
      await StorageService.updateUserCredits(userId, amount);
      await fetchUsers();
    } catch (e) {
      alert("Gagal update kredit.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (targetUser: User) => {
    if (!confirm(`Setujui pendaftaran ${targetUser.username}? Dia akan mendapatkan 2 kredit ujicoba otomatis.`)) return;
    
    setActionLoading(targetUser.id);
    try {
      // Pembaruan Surgikal ke database cloud/local
      await StorageService.updateUser(targetUser.id, {
        status: 'approved' as UserStatus,
        isActive: true,
        credits: Number(targetUser.credits || 0) + 2
      });
      
      await StorageService.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        category: LogCategory.SECURITY,
        action: 'USER_APPROVED',
        details: `Admin menyetujui guru: ${targetUser.username}. Bonus +2 Kredit diberikan.`,
        status: 'success',
        userId: 'admin'
      });

      // KIRIM NOTIFIKASI EMAIL ASLI (Priority)
      await EmailService.notifyUserApproval(targetUser);
      
      // Update UI local secara cerdas tanpa refresh massal
      setUsers(prev => prev.map(u => 
        u.id === targetUser.id ? { ...u, status: 'approved' as UserStatus, isActive: true, credits: Number(u.credits || 0) + 2 } : u
      ));
      
      alert(`Berhasil! Akun ${targetUser.username} telah aktif dan notifikasi email telah dikirim.`);
    } catch (err) {
      alert("Gagal memproses persetujuan. Cek koneksi Turso Anda.");
      await fetchUsers();
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (targetUser: User) => {
    if (!confirm(`Tolak pendaftaran ${targetUser.username}? User ini tidak akan bisa login.`)) return;
    
    setActionLoading(targetUser.id);
    try {
      await StorageService.updateUser(targetUser.id, {
        status: 'rejected' as UserStatus,
        isActive: false
      });
      
      await StorageService.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        category: LogCategory.SECURITY,
        action: 'USER_REJECTED',
        details: `Admin menolak pendaftaran guru: ${targetUser.username}`,
        status: 'success',
        userId: 'admin'
      });

      setUsers(prev => prev.map(u => 
        u.id === targetUser.id ? { ...u, status: 'rejected' as UserStatus, isActive: false } : u
      ));
    } catch (err) {
      alert("Gagal menolak pendaftaran.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (user: User) => {
    setActionLoading(user.id);
    try {
      await StorageService.updateUser(user.id, { isActive: !user.isActive });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
    } catch (e) {
      alert("Gagal mengubah status aktif.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId: string) => {
    if (confirm('Hapus user ini selamanya dari database cloud? Data tidak dapat dikembalikan.')) {
      await StorageService.deleteUser(userId);
      fetchUsers();
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const sanitizedUsername = StorageService.sanitizeInput(newUser.username.trim().toLowerCase());
      const sanitizedEmail = StorageService.sanitizeInput(newUser.email.trim().toLowerCase());

      // Hashing Password Sungguhan oleh Admin
      const passwordHash = await StorageService.hashPassword(newUser.password);

      const userObj: User = {
        id: crypto.randomUUID(),
        username: sanitizedUsername,
        fullName: StorageService.sanitizeInput(newUser.fullName),
        email: sanitizedEmail,
        password: passwordHash,
        role: UserRole.TEACHER,
        credits: Number(newUser.credits),
        isActive: true,
        status: 'approved',
        createdAt: new Date().toISOString()
      };

      const currentUsers = await StorageService.getUsers();
      await StorageService.saveUsers([...currentUsers, userObj]);
      
      await StorageService.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        category: LogCategory.SECURITY,
        action: 'ADD_USER_BY_ADMIN',
        details: `Admin mendaftarkan guru secara manual: ${sanitizedUsername}`,
        status: 'success',
        userId: 'admin'
      });

      setShowAddModal(false);
      setNewUser({ username: '', fullName: '', email: '', password: '', credits: 10 });
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u => (u.status || 'approved') === filter && u.role !== UserRole.ADMIN);
  const pendingCount = users.filter(u => u.status === 'pending').length;

  return (
    <div className="bg-white rounded-[3rem] border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-10 border-b flex flex-col md:flex-row justify-between items-center gap-6 bg-gray-50/30">
        <div>
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Manajemen User</h2>
          <div className="flex gap-4 mt-2">
            <button 
              onClick={() => setFilter('approved')}
              className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${filter === 'approved' ? 'text-orange-600 border-orange-500' : 'text-gray-400 border-transparent'}`}
            >
              Terdaftar
            </button>
            <button 
              onClick={() => setFilter('pending')}
              className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all flex items-center gap-2 ${filter === 'pending' ? 'text-orange-600 border-orange-500' : 'text-gray-400 border-transparent'}`}
            >
              Antrean Baru {pendingCount > 0 && <span className="w-4 h-4 bg-orange-500 text-white rounded-full flex items-center justify-center text-[8px] animate-pulse">{pendingCount}</span>}
            </button>
            <button 
              onClick={() => setFilter('rejected')}
              className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${filter === 'rejected' ? 'text-orange-600 border-orange-500' : 'text-gray-400 border-transparent'}`}
            >
              Ditolak
            </button>
          </div>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="px-8 py-4 orange-gradient text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all uppercase text-[10px] tracking-widest"
        >
          + TAMBAH GURU MANUAL
        </button>
      </div>
      
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-20 text-center text-orange-500 font-black animate-pulse uppercase text-[10px] tracking-widest">Sinkronisasi Database...</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] uppercase font-black tracking-widest text-gray-400 border-b">
                <th className="px-8 py-5">Identitas Pendaftar</th>
                <th className="px-8 py-5">Tgl Daftar</th>
                <th className="px-8 py-5">{filter === 'pending' ? 'Email' : 'Kredit'}</th>
                <th className="px-8 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.map(u => (
                <tr key={u.id} className={`hover:bg-orange-50/10 transition-colors group ${actionLoading === u.id ? 'opacity-50 pointer-events-none' : ''}`}>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-black">
                        {u.username[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-gray-800">{u.fullName || u.username}</div>
                        <div className="text-[10px] text-gray-400 font-medium">@{u.username}</div>
                      </div>
                      {actionLoading === u.id && <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                     <div className="text-[10px] text-gray-400 font-bold uppercase">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</div>
                  </td>
                  <td className="px-8 py-6">
                    {filter === 'pending' ? (
                      <div className="text-xs font-bold text-gray-600">{u.email}</div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-gray-700 w-12">{u.credits}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleUpdateCredit(u.id, -5)} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 hover:bg-rose-500 hover:text-white transition-all text-xs font-bold">-5</button>
                          <button onClick={() => handleUpdateCredit(u.id, 10)} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 hover:bg-emerald-500 hover:text-white transition-all text-xs font-bold">+10</button>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-6 text-right space-x-2">
                    {filter === 'pending' ? (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleApprove(u); }} 
                          className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-emerald-600 shadow-sm"
                        >Setujui</button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleReject(u); }} 
                          className="px-4 py-2 bg-rose-100 text-rose-500 rounded-xl text-[9px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all"
                        >Tolak</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleToggleStatus(u)} className={`p-3 rounded-xl transition-all ${u.isActive ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                          {u.isActive ? '🔒' : '🔓'}
                        </button>
                        <button onClick={() => handleDelete(u.id)} className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-red-500 hover:text-white transition-all">🗑️</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-gray-300 font-black uppercase tracking-widest italic">
                    {filter === 'pending' ? 'Tidak ada pendaftar baru' : 'Data kosong'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-xl z-[600] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="p-8 orange-gradient text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight">Daftarkan Guru</h2>
                <p className="text-[9px] font-bold uppercase opacity-70 tracking-widest">Registrasi Manual Oleh Admin</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/40">✕</button>
            </header>
            
            <form onSubmit={handleAddUser} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Nama Lengkap</label>
                  <input 
                    type="text" required
                    className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm"
                    value={newUser.fullName}
                    onChange={e => setNewUser({...newUser, fullName: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Username</label>
                    <input 
                      type="text" required
                      className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm"
                      value={newUser.username}
                      onChange={e => setNewUser({...newUser, username: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Email</label>
                    <input 
                      type="email" required
                      className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm"
                      value={newUser.email}
                      onChange={e => setNewUser({...newUser, email: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Password Sementara</label>
                  <input 
                    type="password" required
                    className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm"
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Kredit Awal</label>
                  <input 
                    type="number"
                    className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm"
                    value={newUser.credits}
                    onChange={e => setNewUser({...newUser, credits: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 orange-gradient text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Mendaftarkan...' : 'DAFTARKAN GURU'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
