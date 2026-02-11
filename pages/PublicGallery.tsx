
// ... existing imports
import React, { useState, useMemo, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { Quiz } from '../types';
import { SUBJECT_DATA } from '../constants';
import QuizViewer from '../components/QuizViewer';
import { QuizCardSkeleton } from '../components/Skeleton';

const PublicGallery: React.FC = () => {
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Semua');
  const [selectedDifficulty, setSelectedDifficulty] = useState('Semua');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const itemsPerPage = 6;

  const fetchPublicData = async () => {
    try {
      const response = await fetch(`/api/bank-soal?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        setAllQuizzes(data);
      } else {
        throw new Error("API Response not OK");
      }
    } catch (e) {
      const local = await StorageService.getQuizzes();
      setAllQuizzes(local.filter(q => q.isPublished));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicData();
  }, []);

  const filteredQuizzes = useMemo(() => {
    return allQuizzes.filter(q => {
      const matchSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          q.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.topic.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSubject = selectedSubject === 'Semua' || q.subject === selectedSubject;
      const matchDiff = selectedDifficulty === 'Semua' || q.difficulty === selectedDifficulty;
      return matchSearch && matchSubject && matchDiff;
    });
  }, [searchTerm, selectedSubject, selectedDifficulty, allQuizzes]);

  const currentQuizzes = useMemo(() => {
    return filteredQuizzes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredQuizzes, currentPage]);

  const totalPages = Math.ceil(filteredQuizzes.length / itemsPerPage);

  const allSubjectsList = useMemo(() => {
    const combined = new Set<string>();
    combined.add('Semua');
    allQuizzes.forEach(q => { if (q.subject) combined.add(q.subject); });
    return Array.from(combined).sort();
  }, [allQuizzes]);

  return (
    <div className="min-h-screen bg-[#fffaf0] pb-24 font-sans animate-in fade-in duration-700">
      <header className="orange-gradient text-white py-28 px-6 text-center shadow-2xl relative overflow-hidden">
        <div className="max-w-4xl mx-auto space-y-8 relative z-10">
          <div className="inline-flex items-center gap-3 px-6 py-2 bg-black/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10" role="status">📚 Bank Soal Nasional v2.5</div>
          <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.85]">Perpustakaan <br /> <span className="text-yellow-300 italic">Edukasi AI.</span></h1>
          <p className="text-lg md:text-xl opacity-90 font-medium max-w-2xl mx-auto leading-relaxed">Akses ribuan soal kurikulum merdeka yang telah diverifikasi oleh AI Engine dan dikurasi oleh pengajar profesional.</p>
        </div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
      </header>

      <div className="max-w-7xl mx-auto px-6 -mt-16 relative z-20">
        <div className="bg-white/90 backdrop-blur-2xl p-8 rounded-[3.5rem] shadow-2xl border border-white flex flex-col lg:flex-row gap-8 items-end">
          <div className="flex-1 w-full space-y-3">
            <label htmlFor="search-input" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-6">Cari Judul / Materi</label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl" aria-hidden="true">🔍</span>
              <input id="search-input" type="text" placeholder="Contoh: Trigonometri, Biologi Sel..." className="w-full pl-16 pr-8 py-5 rounded-[2.5rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none transition-all text-gray-800 font-bold shadow-inner" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
            </div>
          </div>
          <div className="w-full lg:w-72 space-y-3">
            <label htmlFor="subject-select" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-6">Mata Pelajaran</label>
            <select id="subject-select" className="w-full px-8 py-5 rounded-[2.5rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none font-bold appearance-none cursor-pointer shadow-inner" value={selectedSubject} onChange={(e) => { setSelectedSubject(e.target.value); setCurrentPage(1); }}>
              {allSubjectsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 mt-20">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {[0, 1, 2, 3, 4, 5].map(i => <QuizCardSkeleton key={i} index={i} />)}
          </div>
        ) : filteredQuizzes.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {currentQuizzes.map((quiz) => (
                <div key={quiz.id} onClick={() => setSelectedQuiz(quiz)} className="group bg-white rounded-[3.5rem] p-10 border border-orange-50 shadow-sm hover:shadow-orange-200/50 hover:shadow-2xl transition-all duration-500 hover:-translate-y-4 cursor-pointer flex flex-col h-full relative overflow-hidden outline-none focus:ring-4 focus:ring-orange-500">
                  <div className="flex justify-between items-center mb-10">
                    <span className="px-5 py-2 bg-orange-50 text-orange-600 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-orange-100">{quiz.subject}</span>
                    <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase ${quiz.difficulty === 'Sulit' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>{quiz.difficulty}</span>
                  </div>
                  <h3 className="text-2xl font-black text-gray-800 mb-4 group-hover:text-orange-500 transition-colors line-clamp-2 leading-tight">{quiz.title}</h3>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-8">{quiz.level} • {quiz.grade} • {quiz.questions?.length || 0} Soal</div>
                  <div className="flex items-center justify-between pt-8 border-t border-gray-50 mt-auto">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl orange-gradient flex items-center justify-center text-white font-black text-lg shadow-xl">{quiz.authorName?.[0] || 'T'}</div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-800">{quiz.authorName || 'Teacher'}</span>
                        <span className="text-[8px] text-orange-500 font-bold uppercase tracking-widest">Verified Assets</span>
                      </div>
                    </div>
                    <button className="w-12 h-12 bg-gray-900 text-white rounded-2xl flex items-center justify-center hover:bg-orange-500 hover:scale-110 transition-all shadow-xl">➜</button>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center mt-20 gap-4">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="px-8 py-4 bg-white border border-orange-100 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-50 disabled:opacity-30 transition-all">Prev</button>
                <div className="flex items-center px-6 bg-white rounded-2xl border border-orange-100 font-black text-[10px] text-orange-500">HALAMAN {currentPage} DARI {totalPages}</div>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="px-8 py-4 bg-white border border-orange-100 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-50 disabled:opacity-30 transition-all">Next</button>
              </div>
            )}
          </>
        ) : (
          <div className="py-40 text-center space-y-6">
            <div className="text-8xl grayscale opacity-10">📚</div>
            <h3 className="text-3xl font-black text-gray-300 uppercase tracking-tighter">Bank Soal Kosong</h3>
            <p className="text-gray-400 font-medium max-w-md mx-auto">Kami tidak menemukan soal yang sesuai dengan filter Anda. Coba reset pencarian.</p>
            <button onClick={() => { setSearchTerm(''); setSelectedSubject('Semua'); setSelectedDifficulty('Semua'); }} className="mt-8 px-8 py-4 bg-orange-100 text-orange-600 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all shadow-lg">Reset Filter</button>
          </div>
        )}
      </main>

      {selectedQuiz && <QuizViewer quiz={selectedQuiz} onClose={() => setSelectedQuiz(null)} />}
    </div>
  );
};

export default PublicGallery;
