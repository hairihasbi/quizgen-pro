
import React, { useState, useMemo, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { Quiz } from '../types';
import { SUBJECT_DATA } from '../constants';
import QuizViewer from '../components/QuizViewer';
import { QuizCardSkeleton, Skeleton } from '../components/Skeleton';

const PublicGallery: React.FC = () => {
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Semua');
  const [selectedDifficulty, setSelectedDifficulty] = useState('Semua');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const itemsPerPage = 6;

  useEffect(() => {
    // MENGGUNAKAN EDGE CACHED API
    const fetchPublicData = async () => {
      try {
        const response = await fetch('/api/bank-soal');
        if (response.ok) {
          const data = await response.json();
          setAllQuizzes(data);
        } else {
          // Fallback ke local storage jika API gagal
          const local = await StorageService.getQuizzes();
          setAllQuizzes(local.filter(q => q.isPublished));
        }
      } catch (e) {
        console.warn("Cached API failed, using fallback.");
      } finally {
        setLoading(false);
      }
    };

    fetchPublicData();
  }, []);

  const filteredQuizzes = useMemo(() => {
    setCurrentPage(1);
    return allQuizzes.filter(q => {
      const matchSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          q.subject.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSubject = selectedSubject === 'Semua' || q.subject === selectedSubject;
      const matchDiff = selectedDifficulty === 'Semua' || q.difficulty === selectedDifficulty;
      return matchSearch && matchSubject && matchDiff;
    });
  }, [searchTerm, selectedSubject, selectedDifficulty, allQuizzes]);

  const currentQuizzes = filteredQuizzes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredQuizzes.length / itemsPerPage);

  const allSubjectsList = useMemo(() => {
    const combined: string[] = [];
    Object.values(SUBJECT_DATA).forEach(levelData => {
      Object.values(levelData).forEach(subjects => {
        combined.push(...subjects);
      });
    });
    return ['Semua', ...Array.from(new Set(combined))];
  }, []);

  return (
    <div className="min-h-screen bg-[#fffaf0] pb-24 font-sans animate-in fade-in duration-700">
      <header className="orange-gradient text-white py-28 px-6 text-center shadow-2xl relative overflow-hidden">
        <div className="max-w-4xl mx-auto space-y-8 relative z-10">
          <div className="inline-flex items-center gap-3 px-6 py-2 bg-black/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10" role="status">
            📚 Bank Soal Nasional v2.5
          </div>
          <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.85]">
            Perpustakaan <br /> <span className="text-yellow-300 italic">Edukasi AI.</span>
          </h1>
          <p className="text-lg md:text-xl opacity-90 font-medium max-w-2xl mx-auto leading-relaxed">
            Akses ribuan soal kurikulum merdeka yang telah diverifikasi oleh AI Engine dan dikurasi oleh pengajar profesional.
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 -mt-16 relative z-20">
        <div className="bg-white/90 backdrop-blur-2xl p-8 rounded-[3.5rem] shadow-2xl border border-white flex flex-col lg:flex-row gap-8 items-end">
          <div className="flex-1 w-full space-y-3">
            <label htmlFor="search-input" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-6">Cari Judul / Materi</label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl" aria-hidden="true">🔍</span>
              <input 
                id="search-input"
                type="text" 
                placeholder="Contoh: Trigonometri, Biologi Sel..." 
                aria-label="Cari judul atau materi quiz"
                className="w-full pl-16 pr-8 py-5 rounded-[2.5rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none transition-all text-gray-800 font-bold shadow-inner" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
          </div>
          <div className="w-full lg:w-72 space-y-3">
            <label htmlFor="subject-select" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-6">Mata Pelajaran</label>
            <select 
              id="subject-select"
              aria-label="Filter berdasarkan mata pelajaran"
              className="w-full px-8 py-5 rounded-[2.5rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none font-bold appearance-none cursor-pointer shadow-inner" 
              value={selectedSubject} 
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              {allSubjectsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 mt-20" aria-label="Galeri Soal">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {[1, 2, 3, 4, 5, 6].map(i => <QuizCardSkeleton key={i} />)}
          </div>
        ) : currentQuizzes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10" role="list">
            {currentQuizzes.map((quiz) => (
              <div 
                key={quiz.id} 
                onClick={() => setSelectedQuiz(quiz)} 
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedQuiz(quiz)}
                tabIndex={0}
                role="button"
                aria-label={`Lihat quiz: ${quiz.title}. Mapel: ${quiz.subject}. Kesulitan: ${quiz.difficulty}`}
                className="group bg-white rounded-[3.5rem] p-10 border border-orange-50 shadow-sm hover:shadow-orange-200/50 hover:shadow-2xl transition-all duration-500 hover:-translate-y-4 cursor-pointer flex flex-col h-full relative overflow-hidden outline-none focus:ring-4 focus:ring-orange-500"
              >
                <div className="flex justify-between items-center mb-10">
                  <span className="px-5 py-2 bg-orange-50 text-orange-600 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-orange-100">{quiz.subject}</span>
                  <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase ${quiz.difficulty === 'Sulit' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>{quiz.difficulty}</span>
                </div>
                <h3 className="text-2xl font-black text-gray-800 mb-4 group-hover:text-orange-500 transition-colors line-clamp-2 leading-tight">{quiz.title}</h3>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-8">{quiz.level} • {quiz.grade} • {quiz.questions.length} Soal</div>
                <div className="flex items-center justify-between pt-8 border-t border-gray-50 mt-auto">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl orange-gradient flex items-center justify-center text-white font-black text-lg shadow-xl" aria-hidden="true">{quiz.authorName?.[0] || 'U'}</div>
                    <div className="text-xs font-black text-gray-800">{quiz.authorName || 'Teacher'}</div>
                  </div>
                  <button 
                    aria-label={`Buka ${quiz.title}`}
                    className="w-12 h-12 bg-gray-900 text-white rounded-2xl flex items-center justify-center hover:bg-orange-500 hover:scale-110 transition-all shadow-xl focus:ring-2 focus:ring-orange-500"
                  >➜</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-40 text-center">
            <h3 className="text-3xl font-black text-gray-300 uppercase tracking-tighter">Bank Soal Kosong</h3>
            <button 
              onClick={() => { setSearchTerm(''); setSelectedSubject('Semua'); }} 
              aria-label="Bersihkan semua filter pencarian"
              className="mt-8 px-8 py-3 bg-orange-100 text-orange-600 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all focus:ring-2 focus:ring-orange-500"
            >Reset Filter</button>
          </div>
        )}
      </main>

      {selectedQuiz && <QuizViewer quiz={selectedQuiz} onClose={() => setSelectedQuiz(null)} />}
    </div>
  );
};

export default PublicGallery;
