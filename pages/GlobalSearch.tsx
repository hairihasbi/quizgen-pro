
// ... existing imports
import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storageService';
import { Quiz } from '../types';
import QuizViewer from '../components/QuizViewer';
import { QuizCardSkeleton } from '../components/Skeleton';

const GlobalSearch: React.FC = () => {
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const data = await StorageService.getQuizzes();
      setAllQuizzes(data);
      setLoading(false);
    };
    fetch();
  }, []);

  const allAvailableTags = useMemo(() => {
    const tagSet = new Set<string>();
    allQuizzes.forEach(q => { if (q.tags) q.tags.forEach(t => tagSet.add(t)); });
    return Array.from(tagSet).sort();
  }, [allQuizzes]);

  const filteredResults = useMemo(() => {
    return allQuizzes.filter(q => {
      const lowerSearch = searchTerm.toLowerCase();
      const matchesText = q.title.toLowerCase().includes(lowerSearch) || 
                          q.topic.toLowerCase().includes(lowerSearch) ||
                          q.subject.toLowerCase().includes(lowerSearch);
      const matchesTag = !selectedTag || (q.tags && q.tags.includes(selectedTag));
      return matchesText && matchesTag;
    });
  }, [searchTerm, selectedTag, allQuizzes]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="bg-white p-12 rounded-[3.5rem] border shadow-sm space-y-10">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
           <div className="space-y-2">
              <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Global Search Engine</h2>
              <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Temukan Materi Spesifik Berbasis AI Tags</p>
           </div>
           <div className="relative w-full md:w-96 group">
              <input type="text" placeholder="Cari materi, judul, atau konsep..." className="w-full pl-14 pr-6 py-5 rounded-[2.5rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none shadow-inner font-bold text-gray-800 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl grayscale group-focus-within:grayscale-0 transition-all">🔍</span>
           </div>
        </div>
        <div className="space-y-4">
           <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest ml-4">Filter Berdasarkan AI Tags</h3>
           <div className="flex flex-wrap gap-2">
              <button onClick={() => setSelectedTag(null)} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${!selectedTag ? 'orange-gradient text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>SEMUA</button>
              {allAvailableTags.map(tag => (
                <button key={tag} onClick={() => setSelectedTag(tag === selectedTag ? null : tag)} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${selectedTag === tag ? 'bg-orange-50 text-orange-600 border-orange-500 shadow-sm' : 'bg-white text-gray-400 border-gray-100 hover:border-orange-200'}`}>{tag}</button>
              ))}
           </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {[0, 1, 2, 3, 4, 5].map(i => <QuizCardSkeleton key={i} index={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {filteredResults.map(q => (
             <div key={q.id} onClick={() => setSelectedQuiz(q)} className="bg-white p-10 rounded-[3rem] border border-orange-50 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer group flex flex-col">
                <div className="flex justify-between items-start mb-8">
                   <span className="px-4 py-1.5 bg-orange-50 text-orange-600 rounded-xl text-[8px] font-black uppercase border border-orange-100">{q.subject}</span>
                   <span className="text-[9px] font-black text-gray-300 uppercase">#{q.difficulty}</span>
                </div>
                <h3 className="text-xl font-black text-gray-800 group-hover:text-orange-500 transition-colors line-clamp-2 mb-6 leading-tight">{q.title}</h3>
                <div className="flex-1 flex flex-wrap gap-1 mb-8">
                   {q.tags && q.tags.map(t => ( <span key={t} className="text-[8px] font-bold text-orange-400 bg-orange-50/30 px-2 py-0.5 rounded-full">{t}</span> ))}
                </div>
                <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                   <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{q.level} • {q.questions.length} SOAL</div>
                   <div className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center group-hover:bg-orange-500 transition-all">➜</div>
                </div>
             </div>
           ))}
           {filteredResults.length === 0 && (
             <div className="col-span-full py-40 text-center space-y-6">
                <div className="text-8xl grayscale opacity-10">🔭</div>
                <p className="text-gray-300 font-black uppercase text-xs tracking-widest">Maaf, materi tidak ditemukan dalam cluster database ini.</p>
             </div>
           )}
        </div>
      )}

      {selectedQuiz && <QuizViewer quiz={selectedQuiz} onClose={() => setSelectedQuiz(null)} />}
    </div>
  );
};

export default GlobalSearch;
