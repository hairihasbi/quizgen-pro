
import React, { useEffect, useState } from 'react';
import { Quiz } from '../types';

interface QuizViewerProps {
  quiz: Quiz;
  onClose: () => void;
}

const QuizViewer: React.FC<QuizViewerProps> = ({ quiz, onClose }) => {
  const [showAnswer, setShowAnswer] = useState(false);
  const [exportMode, setExportMode] = useState<'soal' | 'kisi-kisi' | 'lengkap'>('soal');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    // MathJax Observer untuk preview UI (Client Side)
    const timer = setTimeout(() => {
      if ((window as any).observeMathItems) {
        (window as any).observeMathItems('quiz-print-area');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [quiz, showAnswer, exportMode]);

  const handleDownloadPdfSSR = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          quiz, 
          exportMode, 
          showAnswer: exportMode === 'lengkap' || showAnswer 
        })
      });

      if (!response.ok) throw new Error("Gagal generate PDF di server.");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quiz_${quiz.title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Gagal mengunduh PDF: " + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const sanitizeHTML = (html: string) => {
    if (!html || html === 'null') return "";
    return html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "");
  };

  return (
    <div className="fixed inset-0 bg-orange-50/98 backdrop-blur-3xl z-[500] flex flex-col p-4 md:p-8 animate-in zoom-in-95 duration-300 print-modal-wrapper" role="dialog">
      
      <header className="flex flex-col lg:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-2xl shadow-orange-100/50 mb-8 border border-orange-100 gap-6 no-print">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 orange-gradient rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg">📄</div>
          <div>
            <h2 className="font-black text-gray-800 uppercase text-xs tracking-tight truncate max-w-[280px]">{quiz.title}</h2>
            <div className="text-[9px] font-black text-orange-500 uppercase mt-1 tracking-widest">Preview Mode: {exportMode}</div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex gap-1 bg-orange-50 p-1.5 rounded-2xl border border-orange-100">
             <button onClick={() => { setExportMode('soal'); setShowAnswer(false); }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'soal' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>SOAL</button>
             <button onClick={() => { setExportMode('kisi-kisi'); setShowAnswer(false); }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'kisi-kisi' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>KISI-KISI</button>
             <button onClick={() => { setExportMode('lengkap'); setShowAnswer(true); }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'lengkap' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>KUNCI JAWABAN</button>
          </div>
          
          <button onClick={handleDownloadPdfSSR} disabled={isDownloading} className="px-8 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black shadow-xl uppercase transition-all hover:scale-105 active:scale-95 flex items-center gap-3">
            {isDownloading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : '📥'} SSR PDF
          </button>

          <button onClick={() => window.print()} className="px-8 py-4 orange-gradient text-white rounded-2xl text-[10px] font-black shadow-xl uppercase transition-all hover:scale-105 active:scale-95">🖨️ Cetak</button>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center text-orange-300 hover:text-red-500 bg-orange-100/50 rounded-full transition-colors font-bold">✕</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-0 md:p-12 flex justify-center custom-scrollbar print-scroll-container">
        <div id="quiz-print-area" className="print-container bg-white text-gray-900">
          <div className="border-b-[5px] border-double border-gray-900 pb-4 mb-8 text-center w-full">
             <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900">{quiz.title}</h1>
             <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-600 mt-1">
                {quiz.subject} | {quiz.level} {quiz.grade}
             </div>
          </div>
          {/* Konten preview tetap sama untuk kenyamanan user melihat kuis sebelum unduh */}
          <div className="w-full text-center text-[10px] text-gray-400 mb-4 no-print italic">Preview hanya estimasi tampilan. Gunakan tombol SSR PDF untuk hasil cetak presisi.</div>
        </div>
      </div>
    </div>
  );
};

export default QuizViewer;
