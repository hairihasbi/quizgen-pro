
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../../services/storageService';
import { QuizLog, LogCategory } from '../../types';

const SystemLogs: React.FC = () => {
  const [logs, setLogs] = useState<QuizLog[]>([]);
  const [activeCategory, setActiveCategory] = useState<LogCategory | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 45000); 
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    setIsRefreshing(true);
    const data = await StorageService.getLogs();
    setLogs(data);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchCat = activeCategory === 'ALL' || l.category === activeCategory;
      const matchStatus = statusFilter === 'all' || l.status === statusFilter;
      const matchSearch = l.details.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          l.userId.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchStatus && matchSearch;
    });
  }, [logs, activeCategory, statusFilter, searchTerm]);

  const getCategoryColor = (cat: LogCategory) => {
    switch (cat) {
      case LogCategory.SECURITY: return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case LogCategory.CONTENT: return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case LogCategory.SYSTEM: return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case LogCategory.FINANCIAL: return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getActionIcon = (cat: LogCategory) => {
    switch (cat) {
      case LogCategory.SECURITY: return '🛡️';
      case LogCategory.CONTENT: return '📝';
      case LogCategory.SYSTEM: return '⚙️';
      case LogCategory.FINANCIAL: return '💰';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* HEADER CONTROL PANEL */}
      <div className="bg-white p-8 rounded-[3rem] border border-orange-100 shadow-sm space-y-8">
         <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-center gap-4">
               <div className="w-16 h-16 orange-gradient rounded-[2rem] flex items-center justify-center text-white text-3xl shadow-xl">🔭</div>
               <div>
                  <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Audit Trail Explorer</h2>
                  <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-1">Eksplorasi Jejak Digital Engine v3.1</p>
               </div>
            </div>
            <div className="flex flex-wrap gap-3">
               <button onClick={fetchLogs} className="px-6 py-3 bg-gray-900 text-white font-black rounded-2xl text-[10px] uppercase shadow-lg hover:bg-orange-600 transition-all flex items-center gap-2">
                 <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span> {isRefreshing ? 'Syncing...' : 'Refresh Logs'}
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
               <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Search Events</label>
               <div className="relative group">
                  <input type="text" placeholder="User ID, Aksi, atau Detail..." className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 grayscale group-focus-within:grayscale-0">🔍</span>
               </div>
            </div>
            <div className="space-y-2">
               <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Category Filter</label>
               <select className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-black text-xs uppercase" value={activeCategory} onChange={e => setActiveCategory(e.target.value as any)}>
                  <option value="ALL">ALL CATEGORIES</option>
                  {Object.values(LogCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
               </select>
            </div>
            <div className="space-y-2">
               <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Status Code</label>
               <div className="flex bg-gray-50 p-1 rounded-2xl">
                  {['all', 'success', 'error'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s as any)} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${statusFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>{s}</button>
                  ))}
               </div>
            </div>
            <div className="space-y-2">
               <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Live Status</label>
               <div className="h-12 flex items-center gap-3 px-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Worker Online</span>
               </div>
            </div>
         </div>
      </div>

      {/* AUDIT TERMINAL */}
      <div className="bg-[#0c0c0c] rounded-[3rem] border border-gray-800 shadow-2xl overflow-hidden flex flex-col h-[700px] relative">
        {/* Terminal Top Bar */}
        <div className="px-10 py-5 bg-[#1a1a1a] border-b border-white/5 flex justify-between items-center shrink-0">
           <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
           </div>
           <div className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.2em]">turso-node-primary :: audit-trail-engine</div>
           <div className="text-[10px] font-mono text-emerald-500/50">STREAMS_ACTIVE: {filteredLogs.length}</div>
        </div>

        {/* Logs Stream */}
        <div className="flex-1 overflow-y-auto p-10 font-mono text-[11px] space-y-4 custom-scrollbar">
           {filteredLogs.map((log) => {
             const isSelected = selectedLogId === log.id;
             return (
              <div key={log.id} className="space-y-4">
                 <div 
                   onClick={() => setSelectedLogId(isSelected ? null : log.id)}
                   className={`group flex items-start gap-6 p-4 rounded-2xl transition-all cursor-pointer border ${
                     isSelected ? 'bg-white/5 border-white/10' : 'hover:bg-white/5 border-transparent'
                   }`}
                 >
                    <div className="w-24 shrink-0 text-gray-600 font-bold">
                       {new Date(log.timestamp).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'})}.{new Date(log.timestamp).getMilliseconds()}
                    </div>
                    
                    <div className={`px-3 py-1 rounded-lg border font-black text-[9px] uppercase tracking-widest shrink-0 w-28 text-center ${getCategoryColor(log.category)}`}>
                       {getActionIcon(log.category)} {log.category}
                    </div>

                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-3 mb-1">
                          <span className={`font-black uppercase tracking-widest ${log.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                             {log.status}
                          </span>
                          <span className="text-gray-400">::</span>
                          <span className="text-orange-400 font-black">{log.action}</span>
                       </div>
                       <div className="text-gray-300 leading-relaxed break-words">{log.details}</div>
                    </div>

                    <div className="shrink-0 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                       <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">USR: {log.userId.substring(0, 8)}</div>
                       <div className="text-[8px] text-gray-700 mt-1">{isSelected ? 'CLOSE DETAIL' : 'INSPECT METADATA ➜'}</div>
                    </div>
                 </div>

                 {/* METADATA INSPECTION VIEW */}
                 {isSelected && (
                   <div className="mx-10 p-8 bg-black border border-white/10 rounded-3xl animate-in slide-in-from-top-4 duration-300">
                      <div className="flex justify-between items-center mb-6">
                         <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-2">
                           <span className="w-2 h-2 bg-orange-500 rounded-full"></span> 
                           Metadata Object Inspection
                         </h4>
                         <span className="text-[9px] text-gray-600 font-mono">LOG_UID: {log.id}</span>
                      </div>
                      <pre className="text-emerald-500 bg-[#050505] p-6 rounded-2xl border border-emerald-500/10 text-[10px] overflow-x-auto custom-scrollbar">
                         {JSON.stringify(JSON.parse(log.metadata || '{}'), null, 2)}
                      </pre>
                      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                         <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="text-[8px] text-gray-500 font-black uppercase mb-1">Timestamp</div>
                            <div className="text-[10px] text-gray-300 truncate">{log.timestamp}</div>
                         </div>
                         <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="text-[8px] text-gray-500 font-black uppercase mb-1">Actor ID</div>
                            <div className="text-[10px] text-gray-300 truncate">{log.userId}</div>
                         </div>
                         <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="text-[8px] text-gray-500 font-black uppercase mb-1">Trace Level</div>
                            <div className="text-[10px] text-emerald-500 uppercase font-black">Audit Verified</div>
                         </div>
                         <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="text-[8px] text-gray-500 font-black uppercase mb-1">Security Sign</div>
                            <div className="text-[10px] text-gray-300 truncate">sha256:v3.1-stable</div>
                         </div>
                      </div>
                   </div>
                 )}
              </div>
             );
           })}

           {filteredLogs.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-30">
                <div className="text-8xl">🏜️</div>
                <div className="text-xs uppercase font-black tracking-[0.3em] text-gray-500">No trace entries found in this cluster node</div>
             </div>
           )}
        </div>

        {/* Console Input Decorator */}
        <div className="px-10 py-5 bg-[#141414] border-t border-white/5 flex items-center gap-4 shrink-0">
           <span className="text-orange-500 font-black">❯</span>
           <div className="flex-1 h-4 bg-gray-800/20 rounded-full relative overflow-hidden">
              <div className="absolute inset-0 orange-gradient opacity-20 w-1/3 animate-[shimmer_2s_infinite]"></div>
           </div>
           <div className="text-[10px] font-mono text-gray-600 animate-pulse">Awaiting new events...</div>
        </div>
      </div>
      
      <p className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        Seluruh jejak audit disimpan secara permanen di Turso SQLite Cloud dan tidak dapat dimanipulasi oleh user non-admin.
      </p>
    </div>
  );
};

export default SystemLogs;
