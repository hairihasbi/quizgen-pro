
import React, { useState, useEffect } from 'react';
import { EmailService } from '../services/emailService';
import { StorageService } from '../services/storageService';
import { EmailNotification } from '../types';

interface InboxPageProps {
  user: any;
}

const InboxPage: React.FC<InboxPageProps> = ({ user }) => {
  const [emails, setEmails] = useState<EmailNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedMail, setSelectedMail] = useState<EmailNotification | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const limit = 10;

  const fetchEmails = async (pageToFetch: number, isInitial: boolean = false) => {
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    const result = await EmailService.fetchNotifications(user.id, pageToFetch, limit);
    
    if (isInitial) {
      setEmails(result.emails);
    } else {
      setEmails(prev => [...prev, ...result.emails]);
    }
    
    setHasMore(result.hasMore);
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    fetchEmails(1, true);
  }, [user.id]);

  const handleRead = async (mail: EmailNotification) => {
    setSelectedMail(mail);
    if (!mail.isRead) {
      await EmailService.markAsRead(mail.id);
      setEmails(prev => prev.map(m => m.id === mail.id ? { ...m, isRead: true } : m));
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchEmails(nextPage);
  };

  const handleMarkAllRead = async () => {
    const unread = emails.filter(e => !e.isRead);
    if (unread.length === 0) return;
    
    for (const mail of unread) {
      await EmailService.markAsRead(mail.id);
    }
    // Refresh current page list
    fetchEmails(1, true);
    setPage(1);
  };

  const filteredEmails = emails.filter(e => filter === 'all' || !e.isRead);
  const unreadCount = emails.filter(e => !e.isRead).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-white p-10 rounded-[3rem] border shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 orange-gradient rounded-3xl flex items-center justify-center text-white text-3xl shadow-xl">📩</div>
          <div>
            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Pusat Notifikasi</h2>
            <p className="text-xs text-gray-400 font-bold uppercase mt-1">Sistem Skalabilitas Aktif ({emails.length} Pesan Dimuat)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-gray-100 p-1.5 rounded-2xl flex">
            <button 
              onClick={() => setFilter('all')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
            >Semua</button>
            <button 
              onClick={() => setFilter('unread')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'unread' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400'}`}
            >Belum Terbaca</button>
          </div>
          <button 
            onClick={handleMarkAllRead}
            className="px-6 py-3.5 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-xl"
          >Tandai Semua Terbaca</button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border shadow-sm overflow-hidden min-h-[500px] flex flex-col">
        {loading ? (
          <div className="p-20 text-center animate-pulse text-gray-300 font-black uppercase text-xs tracking-[0.2em]">Mengunduh Pesan...</div>
        ) : filteredEmails.length > 0 ? (
          <div className="divide-y divide-gray-50 flex-1">
            {filteredEmails.map((mail) => (
              <div 
                key={mail.id}
                onClick={() => handleRead(mail)}
                className={`p-8 flex items-center gap-8 hover:bg-orange-50/10 cursor-pointer transition-all group ${!mail.isRead ? 'bg-orange-50/30' : ''}`}
              >
                <div className={`w-3 h-3 rounded-full shrink-0 ${!mail.isRead ? 'bg-orange-500 animate-pulse' : 'bg-gray-200'}`}></div>
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                  {mail.type === 'success' ? '✅' : mail.type === 'error' ? '❌' : 'ℹ️'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest">{mail.type}</span>
                    <span className="text-[10px] text-gray-400 font-bold">{new Date(mail.timestamp).toLocaleString()}</span>
                  </div>
                  <h4 className={`text-sm truncate ${!mail.isRead ? 'font-black text-gray-900' : 'font-bold text-gray-500'}`}>{mail.subject}</h4>
                  <p className="text-xs text-gray-400 truncate mt-1">{mail.body}</p>
                </div>
                <div className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">➜</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-32 text-center space-y-4">
             <div className="text-6xl grayscale opacity-20">📭</div>
             <p className="text-gray-300 font-black uppercase text-xs tracking-widest">Tidak ada pesan yang ditemukan.</p>
          </div>
        )}

        {hasMore && (
          <div className="p-10 bg-gray-50 border-t flex justify-center">
            <button 
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-12 py-4 bg-white border-2 border-orange-100 text-orange-600 font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-sm hover:border-orange-500 hover:scale-105 transition-all flex items-center gap-3 disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  Memuat...
                </>
              ) : (
                <>Muat Lebih Banyak 🔄</>
              )}
            </button>
          </div>
        )}
      </div>

      {selectedMail && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-xl z-[700] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
              <header className={`p-10 ${selectedMail.type === 'success' ? 'bg-emerald-500' : 'bg-orange-500'} text-white flex justify-between items-start`}>
                 <div className="space-y-2">
                   <div className="px-3 py-1 bg-white/20 rounded-full inline-block text-[9px] font-black uppercase tracking-widest">Sistem Notifikasi</div>
                   <h2 className="text-3xl font-black uppercase tracking-tight leading-none">{selectedMail.subject}</h2>
                   <p className="text-[10px] font-bold uppercase opacity-70 tracking-widest">{new Date(selectedMail.timestamp).toLocaleString()}</p>
                 </div>
                 <button onClick={() => setSelectedMail(null)} className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/40 text-2xl transition-all">✕</button>
              </header>
              <div className="p-12 text-gray-700 leading-relaxed text-lg whitespace-pre-wrap font-medium">
                 {selectedMail.body}
              </div>
              <footer className="p-10 border-t bg-gray-50 flex justify-end">
                 <button onClick={() => setSelectedMail(null)} className="px-12 py-4 bg-gray-900 text-white font-black rounded-2xl text-[10px] uppercase shadow-lg hover:bg-orange-600 transition-all">Selesai Membaca</button>
              </footer>
           </div>
        </div>
      )}
    </div>
  );
};

export default InboxPage;
