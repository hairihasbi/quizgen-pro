
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { Quiz } from '../types';
import QuizViewer from '../components/QuizViewer';

interface HistoryProps {
  user: any;
}

const History: React.FC<HistoryProps> = ({ user }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    fetchQuizzes();
  }, [user.id]);

  const fetchQuizzes = async () => {
    const data = await StorageService.getQuizzes(user);
    setQuizzes(data);
  };

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Hapus soal "${title}" dari arsip selamanya?`)) {
      await StorageService.deleteQuiz(id);
      await fetchQuizzes();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
        <div className="p-8 border-b flex justify-between items-center bg-gray-50/30">
          <h3 className="text-xl font-black text-gray-800">Arsip & Riwayat Quiz</h3>
          <div className="flex gap-2">
            <span 
              className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2"
              role="status"
              aria-label="Sinkronisasi Cloud Aktif"
            >
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Secure Cloud Sync
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b">
                <th className="px-8 py-5 text-left">Status</th>
                <th className="px-8 py-5 text-left">Judul Soal</th>
                <th className="px-8 py-5 text-left">Mapel / Jenjang</th>
                <th className="px-8 py-5 text-right">Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {quizzes.map(quiz => (
                <tr key={quiz.id} className="hover:bg-orange-50/10 transition-all group">
                  <td className="px-8 py-6">
                    <span 
                      className={`w-3 h-3 rounded-full inline-block ${quiz.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`}
                      aria-label={`Status: ${quiz.status}`}
                    ></span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="font-bold text-gray-800 group-hover:text-orange-500 transition-colors">{quiz.title}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">{new Date(quiz.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-xs font-black text-gray-600">{quiz.subject}</div>
                    <div className="text-[9px] text-orange-400 font-bold uppercase">{quiz.level} {"\u2022"} {quiz.grade}</div>
                  </td>
                  <td className="px-8 py-6 text-right space-x-2">
                    <button 
                      onClick={() => setSelectedQuiz(quiz)} 
                      aria-label={`Lihat detail quiz ${quiz.title}`}
                      title="View" 
                      className="p-3 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-500 hover:text-white transition-all focus:ring-2 focus:ring-orange-500 outline-none"
                    >👁️</button>
                    <button 
                      onClick={() => handleDelete(quiz.id, quiz.title)} 
                      aria-label={`Hapus quiz ${quiz.title}`}
                      title="Delete" 
                      className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all focus:ring-2 focus:ring-red-500 outline-none"
                    >🗑️</button>
                  </td>
                </tr>
              ))}
              {quizzes.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-gray-300 font-black uppercase italic tracking-widest">Arsip Kosong</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedQuiz && <QuizViewer quiz={selectedQuiz} onClose={() => setSelectedQuiz(null)} />}
    </div>
  );
};

export default History;
