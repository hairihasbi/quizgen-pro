
import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storageService';
import { Quiz } from '../../types';

const PublicManagement: React.FC = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    const data = await StorageService.getQuizzes();
    setQuizzes(data);
    setLoading(false);
  };

  const handleToggle = async (id: string, current: boolean) => {
    await StorageService.toggleQuizPublication(id, !current);
    fetchQuizzes();
  };

  const filtered = quizzes.filter(q => 
    q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-[3rem] border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-10 border-b flex flex-col md:flex-row justify-between items-center gap-6 bg-gray-50/30">
        <div>
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Manajemen Publikasi</h2>
          <p className="text-xs text-gray-400 font-bold uppercase mt-1">Kelola Visibilitas Soal di Bank Soal Nasional</p>
        </div>
        <div className="relative w-full md:w-80">
          <input 
            type="text" 
            placeholder="Cari judul atau mapel..."
            className="w-full pl-12 pr-6 py-3.5 rounded-2xl bg-white border-2 border-transparent focus:border-orange-500 outline-none shadow-sm font-bold text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔍</span>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 text-[10px] uppercase font-black tracking-widest text-gray-400 border-b">
              <th className="px-8 py-5">Informasi Quiz</th>
              <th className="px-8 py-5 text-center">Tipe / Soal</th>
              <th className="px-8 py-5">Status Publikasi</th>
              <th className="px-8 py-5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(q => (
              <tr key={q.id} className="hover:bg-orange-50/10 transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl orange-gradient flex items-center justify-center text-white text-xl shadow-lg">📄</div>
                    <div>
                      <div className="font-bold text-gray-800 line-clamp-1">{q.title}</div>
                      <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{q.subject} • {q.level}</div>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6 text-center">
                   <div className="text-xs font-black text-gray-600">{q.difficulty}</div>
                   <div className="text-[9px] text-orange-400 font-bold uppercase">{q.questions.length} Butir Soal</div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${q.isPublished ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-300'}`}></div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${q.isPublished ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {q.isPublished ? 'Published' : 'Draft / Private'}
                    </span>
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <button 
                    onClick={() => handleToggle(q.id, q.isPublished)}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${
                      q.isPublished ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'orange-gradient text-white hover:scale-105'
                    }`}
                  >
                    {q.isPublished ? 'UNPUBLISH' : 'PUBLISH NOW'}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="py-20 text-center text-gray-300 font-black uppercase tracking-widest italic">Data Tidak Ditemukan</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PublicManagement;
