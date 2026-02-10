
// @google/genai senior frontend engineer fixes
import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../services/storageService';
import { EmailService } from '../services/emailService';
import { UserRole, Quiz, QuizLog, User, ApiKey, Transaction, EmailNotification, AIProgressEvent } from '../types';
import TopUpModal from '../components/TopUpModal';
import { StatSkeleton, ListSkeleton } from '../components/Skeleton';
import { realtimeService } from '../services/realtimeService';

interface DashboardProps {
  user: any;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [logs, setLogs] = useState<QuizLog[]>([]);
  const [apiMetrics, setApiMetrics] = useState<ApiKey[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inbox, setInbox] = useState<EmailNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [selectedMail, setSelectedMail] = useState<EmailNotification | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const isLocal = StorageService.isLocal();
  const isAdmin = user.role === UserRole.ADMIN;

  const fetchStats = async () => {
    const [q, l, m, t, i] = await Promise.all([
      StorageService.getQuizzes(user),
      StorageService.getLogs(),
      StorageService.getApiKeys(),
      StorageService.getTransactions(isAdmin ? undefined : user.id),
      EmailService.fetchNotifications(user.id)
    ]);
    setQuizzes(q);
    setLogs(l);
    setApiMetrics(m);
    setTransactions(t);
    // Fix: fetchNotifications returns { emails: EmailNotification[], hasMore: boolean }.
    // setInbox expects EmailNotification[].
    setInbox(i.emails);
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
    
    // POLLING: Tetap aktif untuk sinkronisasi data berat (logs, trx, quiz)
    const interval = setInterval(fetchStats, 30000);

    // WEBSOCKET: Logika Notifikasi Real-time
    realtimeService.connect(`notif_${user.id}`, (event: AIProgressEvent) => {
      if (event.step === 'NOTIFICATION_RECEIVED' && event.details) {
        try {
          const newNotif: EmailNotification = JSON.parse(event.details);
          
          // 1. Hot-Update state inbox agar muncul seketika di UI
          setInbox(prev => {
            // Cek apakah notifikasi sudah ada (mencegah duplikat dari polling)
            if (prev.some(n => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });

          // 2. Play Sound Feedback (Opsional, pastikan file ada di public folder)
          if (audioRef.current) {
            audioRef.current.play().catch(() => {});
          }

          console.log("[REALTIME] New notification pushed via WebSocket:", newNotif.subject);
        } catch (e) {
          console.error("[REALTIME] Failed to parse notification details");
        }
      }
    });

    return () => {
      clearInterval(interval);
      realtimeService.disconnect();
    };
  }, [user.id, user.role]);

  const handleReadMail = async (mail: EmailNotification) => {
    setSelectedMail(mail);
    if (!mail.isRead) {
      await EmailService.markAsRead(mail.id);
      // Update instan di UI
      setInbox(prev => prev.map(m => m.id === mail.id ? { ...m, isRead: true } : m));
    }
  };

  const handleDeleteTransaction = async (id: string, externalId: string) => {
    if (!window.confirm(`Hapus catatan transaksi ${externalId} dari riwayat?`)) return;
    try {
      await StorageService.deleteTransaction(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      alert("Gagal menghapus transaksi.");
    }
  };

  const lastCron = logs.find(l => l.action === 'SYSTEM_CRON');
  const unreadCount = inbox.filter(n => !n.isRead).length;

  const stats = [
    { 
      label: isAdmin ? 'Total Quiz Sistem' : 'Quiz Saya', 
      value: quizzes.length, 
      icon: '📝', 
      desc: 'Total soal yang digenerate',
      color: 'bg-blue-50 text-blue-600' 
    },
    { 
      label: 'Inbox Baru', 
      value: unreadCount, 
      icon: '📩', 
      desc: 'Pesan sistem belum dibaca',
      color: unreadCount > 0 ? 'bg-orange-100 text-orange-600 animate-pulse' : 'bg-gray-50 text-gray-400' 
    },
    { 
      label: 'Berhasil', 
      value: quizzes.filter(q => q.status === 'completed').length, 
      icon: '✅', 
      desc: 'Siap cetak & publikasi',
      color: 'bg-emerald-50 text-emerald-600' 
    },
    { 
      label: isAdmin ? 'Total API Hit' : 'Sisa Kredit', 
      value: isAdmin ? apiMetrics.reduce((acc, m) => acc + m.usageCount, 0) : user.credits, 
      icon: isAdmin ? '⚡' : '🪙', 
      desc: isAdmin ? 'Penggunaan Gemini AI' : 'Kredit tersedia',
      color: 'bg-orange-50 text-orange-600' 
    },
  ];

  const handleTopUpSuccess = (url: string) => {
    setShowTopUp(false);
    window.open(url, '_blank');
    alert("Invoice DOKU telah dibuat! Notifikasi inbox akan muncul setelah pembayaran dikonfirmasi.");
    fetchStats();
  };

  if (loading) return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="bg-white p-10 rounded-[3rem] h-48 orange-gradient animate-pulse flex items-center justify-center" aria-hidden="true">
        <span className="text-white/50 font-black uppercase tracking-[0.3em]">Synchronizing Engine...</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <StatSkeleton key={i} />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Audio element untuk feedback notifikasi */}
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />

      <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-orange-100 flex flex-col md:flex-row justify-between items-center orange-gradient text-white overflow-hidden relative gap-8">
        <div className="relative z-10 text-center md:text-left space-y-4">
          <div>
            <h2 className="text-4xl font-black tracking-tight">Halo, {user.username}! 👋</h2>
            <p className="opacity-90 font-medium text-lg">
              {isAdmin ? 'Panel Kontrol Administrasi Utama' : `${unreadCount > 0 ? `Ada ${unreadCount} pesan baru di inbox.` : 'Tidak ada pesan baru saat ini.'}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center md:justify-start items-center">
            {user.role === UserRole.TEACHER && (
               <button 
                 onClick={() => setShowTopUp(true)}
                 className="px-8 py-3.5 bg-white text-orange-600 font-black rounded-2xl text-[10px] uppercase shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 focus:ring-4 focus:ring-white/50"
               >
                 ⚡ Top Up Kredit AI
               </button>
            )}
            {isAdmin && lastCron && (
              <div className="px-5 py-3 bg-emerald-500/20 backdrop-blur-md rounded-2xl border border-emerald-400/30 flex items-center gap-3">
                 <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
                 <span className="text-[9px] font-black uppercase tracking-widest text-emerald-100">
                   Worker Active: {new Date(lastCron.timestamp).toLocaleTimeString()}
                 </span>
              </div>
            )}
            <div 
              className="px-6 py-3 bg-black/20 backdrop-blur-md rounded-2xl text-[9px] font-bold flex items-center gap-2 border border-white/10 uppercase tracking-widest"
              role="status"
            >
              <span className={`w-2.5 h-2.5 rounded-full ${isLocal ? 'bg-yellow-400' : 'bg-green-400'} animate-pulse`}></span>
              {isLocal ? 'Offline Mode' : 'Cloud Synchronized'}
            </div>
          </div>
        </div>
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-[100px]" aria-hidden="true"></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[3rem] border border-orange-50 shadow-sm hover:shadow-2xl transition-all duration-500 group relative overflow-hidden">
            <div className="relative z-10">
              <div className={`w-14 h-14 ${stat.color} rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-inner`} aria-hidden="true">
                {stat.icon}
              </div>
              <div className="text-4xl font-black text-gray-800 tracking-tighter mb-1">{stat.value.toLocaleString()}</div>
              <div className="text-gray-900 text-sm font-black uppercase tracking-tight">{stat.label}</div>
              <div className="text-gray-400 text-[10px] font-bold uppercase mt-1">{stat.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white rounded-[3rem] border border-orange-50 shadow-sm p-10 space-y-8 flex flex-col">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">Inbox Notifikasi</h3>
            <span className="text-[9px] font-black text-gray-400">Real-time Enabled</span>
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
             {inbox.slice(0, 10).map((n) => (
               <div 
                 key={n.id} 
                 onClick={() => handleReadMail(n)} 
                 className={`p-5 rounded-2xl border transition-all cursor-pointer hover:scale-[1.02] active:scale-95 animate-in slide-in-from-top-2 duration-300 ${n.isRead ? 'bg-gray-50 border-transparent opacity-60' : 'bg-orange-50 border-orange-200 shadow-sm'}`}
               >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[8px] font-black uppercase tracking-widest text-orange-500">{n.type}</span>
                    <span className="text-[8px] text-gray-400">{new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <div className="font-black text-gray-800 text-xs mb-1">{n.subject}</div>
                  <div className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">{n.body}</div>
               </div>
             ))}
             {inbox.length === 0 && (
               <div className="py-20 text-center text-gray-300 font-bold uppercase text-[9px] tracking-widest">Inbox Kosong</div>
             )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-[3rem] border border-orange-50 shadow-sm overflow-hidden flex flex-col">
          <div className="p-10 border-b flex justify-between items-center bg-gray-50/30">
            <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs">Aktivitas Pembayaran</h3>
            <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-full uppercase">Secure Gateway</span>
          </div>
          <div className="flex-1 divide-y divide-gray-50 overflow-y-auto max-h-[400px]">
            {transactions.map((trx, i) => (
              <div key={trx.id} className="p-8 flex items-center justify-between hover:bg-orange-50/10 transition-all group">
                <div className="flex items-center gap-5">
                   <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${
                     trx.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-500' : trx.status === 'PENDING' ? 'bg-amber-50 text-amber-500' : 'bg-rose-50 text-rose-500'
                   }`}>
                     {trx.status === 'SUCCESS' ? '💵' : trx.status === 'PENDING' ? '⏳' : '⚠️'}
                   </div>
                   <div>
                      <div className="font-black text-gray-800 text-sm uppercase">{trx.externalId}</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase">{new Date(trx.createdAt).toLocaleDateString()}</div>
                   </div>
                </div>
                <div className="flex items-center gap-6">
                   <div className="text-right">
                      <div className="font-black text-gray-900 text-lg">Rp {trx.amount.toLocaleString()}</div>
                      <div className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg inline-block mt-1 ${
                        trx.status === 'SUCCESS' ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-600'
                      }`}>
                        {trx.status}
                      </div>
                   </div>
                   <button 
                     onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(trx.id, trx.externalId); }}
                     className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                     title="Hapus riwayat"
                   >
                     🗑️
                   </button>
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="py-20 text-center text-gray-300 font-bold uppercase text-[9px] tracking-widest">Belum Ada Transaksi</div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL BACA INBOX */}
      {selectedMail && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-xl z-[700] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
              <header className={`p-8 ${selectedMail.type === 'success' ? 'bg-emerald-500' : 'bg-orange-500'} text-white flex justify-between items-center`}>
                 <div>
                   <h2 className="text-xl font-black uppercase tracking-tight">{selectedMail.subject}</h2>
                   <p className="text-[10px] font-bold uppercase opacity-70">{new Date(selectedMail.timestamp).toLocaleString()}</p>
                 </div>
                 <button onClick={() => setSelectedMail(null)} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/40">✕</button>
              </header>
              <div className="p-10 text-gray-700 leading-relaxed text-sm whitespace-pre-wrap">
                 {selectedMail.body}
              </div>
              <footer className="p-8 border-t bg-gray-50 flex justify-center">
                 <button onClick={() => setSelectedMail(null)} className="px-10 py-3 bg-gray-900 text-white font-black rounded-2xl text-[10px] uppercase shadow-lg hover:bg-orange-600 transition-all">Tutup Pesan</button>
              </footer>
           </div>
        </div>
      )}

      {showTopUp && <TopUpModal user={user} onClose={() => setShowTopUp(false)} onSuccess={handleTopUpSuccess} />}
    </div>
  );
};

export default Dashboard;
