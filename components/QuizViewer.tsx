
import React, { useEffect, useState } from 'react';
import { Quiz, QuestionType } from '../types';

interface QuizViewerProps {
  quiz: Quiz;
  onClose: () => void;
}

const QuizViewer: React.FC<QuizViewerProps> = ({ quiz, onClose }) => {
  const [showAnswer, setShowAnswer] = useState(false);
  const [exportMode, setExportMode] = useState<'soal' | 'kisi-kisi' | 'lengkap'>('soal');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    // Memberikan waktu ekstra bagi DOM untuk render soal sebelum memanggil MathJax
    const timer = setTimeout(() => {
      if ((window as any).observeMathItems) {
        (window as any).observeMathItems('quiz-print-area');
      }
    }, 500); // Penambahan delay rendering ke 500ms
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
          showAnswer: exportMode === 'lengkap' || showAnswer 
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Gagal generate PDF di server.");
      }

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

  return (
    <div className="fixed inset-0 bg-orange-50/98 backdrop-blur-3xl z-[500] flex flex-col p-4 md:p-8 animate-in zoom-in-95 duration-300 print-modal-wrapper" role="dialog">
      
      <header className="flex flex-col lg:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-2xl shadow-orange-100/50 mb-8 border border-orange-100 gap-6 no-print">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 orange-gradient rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg">📄</div>
          <div>
            <h2 className="font-black text-gray-800 uppercase text-xs tracking-tight truncate max-w-[280px]">{quiz.title}</h2>
            <div className="text-[9px] font-black text-orange-500 uppercase mt-1 tracking-widest">Preview: {exportMode.toUpperCase()}</div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex gap-1 bg-orange-50 p-1.5 rounded-2xl border border-orange-100">
             <button onClick={() => { setExportMode('soal'); setShowAnswer(false); }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'soal' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>SOAL</button>
             <button onClick={() => { setExportMode('kisi-kisi'); setShowAnswer(false); }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'kisi-kisi' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>KISI-KISI</button>
             <button onClick={() => { setExportMode('lengkap'); setShowAnswer(true); }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'lengkap' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>KUNCI JAWABAN</button>
          </div>
          
          <button 
            onClick={handleDownloadPdfSSR} 
            disabled={isDownloading} 
            className="px-8 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black shadow-xl uppercase transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
          >
            {isDownloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                <span>Generating SSR...</span>
              </>
            ) : (
              <>
                <span>📥</span>
                <span>Download PDF</span>
              </>
            )}
          </button>

          <button onClick={() => window.print()} className="px-8 py-4 orange-gradient text-white rounded-2xl text-[10px] font-black shadow-xl uppercase transition-all hover:scale-105 active:scale-95">🖨️ Cetak</button>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center text-orange-300 hover:text-red-500 bg-orange-100/50 rounded-full transition-colors font-bold">✕</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-0 md:p-12 flex justify-center custom-scrollbar print-scroll-container">
        <div id="quiz-print-area" className="print-container bg-white text-gray-900">
          
          {/* Header Bank Soal SMA - Identik dengan Screenshot */}
          <div className="text-center mb-2">
            <h1 className="text-xl font-black uppercase tracking-tight m-0" style={{fontFamily: 'Plus Jakarta Sans'}}>BANK SOAL SMA</h1>
            <h2 className="text-lg font-bold uppercase m-0" style={{fontFamily: 'Plus Jakarta Sans'}}>{quiz.subject} - {quiz.grade}</h2>
          </div>
          
          <div className="border-t-[3px] border-b border-black h-[5px] mb-4"></div>

          {/* Tabel Identitas */}
          <table className="w-full mb-6 text-[10pt] font-bold border-collapse">
            <tbody>
              <tr>
                <td className="w-20">Topik</td>
                <td className="w-4 text-center">:</td>
                <td>{quiz.topic}</td>
                <td className="w-20 text-right">Waktu</td>
                <td className="w-4 text-center">:</td>
                <td className="w-24">90 Menit</td>
              </tr>
              <tr>
                <td>Kode</td>
                <td className="text-center">:</td>
                <td>261419</td>
                <td className="text-right">Jumlah</td>
                <td className="text-center">:</td>
                <td>{quiz.questions.length} Soal</td>
              </tr>
            </tbody>
          </table>

          <div className="text-[11pt] font-black underline uppercase mb-4" style={{fontFamily: 'Plus Jakarta Sans'}}>
            {exportMode === 'kisi-kisi' ? 'KISI-KISI PENYUSUNAN SOAL' : 'URAIAN SOAL'}
          </div>

          <div className="space-y-6">
            {exportMode === 'kisi-kisi' ? (
              <table className="w-full border-collapse border-2 border-black text-[9pt]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black p-2">NO</th>
                    <th className="border border-black p-2">KOMPETENSI / INDIKATOR</th>
                    <th className="border border-black p-2">LEVEL</th>
                    <th className="border border-black p-2">KUNCI</th>
                  </tr>
                </thead>
                <tbody>
                  {quiz.questions.map((q, i) => (
                    <tr key={q.id}>
                      <td className="border border-black p-2 text-center">{i + 1}</td>
                      <td className="border border-black p-2">
                        <div className="font-bold">{q.indicator}</div>
                        <div className="italic text-gray-600">{q.competency}</div>
                      </td>
                      <td className="border border-black p-2 text-center uppercase">{q.cognitiveLevel}</td>
                      <td className="border border-black p-2 text-center font-bold">
                        {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              quiz.questions.map((q, i) => {
                const isNewPassage = q.passage && (i === 0 || quiz.questions[i-1].passage !== q.passage);
                return (
                  <div key={q.id} className="pdf-block">
                    {isNewPassage && (
                      <div className="bg-gray-50 border-l-4 border-black p-4 mb-4 italic text-[10pt] text-justify leading-relaxed">
                        <div className="font-bold uppercase mb-1 not-italic">Stimulus:</div>
                        <div dangerouslySetInnerHTML={{ __html: q.passage! }}></div>
                      </div>
                    )}
                    <div className="flex gap-3 text-[11pt] leading-relaxed">
                      <div className="font-bold w-6 shrink-0">{i + 1}.</div>
                      <div className="flex-1">
                        <div className="mb-3 text-justify" dangerouslySetInnerHTML={{ __html: q.text }}></div>
                        
                        {q.options && (
                          <div className="grid grid-cols-1 gap-2 mb-4">
                            {q.options.map(opt => (
                              <div key={opt.label} className="flex gap-2 items-start">
                                <span className="font-bold">{opt.label}.</span>
                                <span dangerouslySetInnerHTML={{ __html: opt.text }}></span>
                              </div>
                            ))}
                          </div>
                        )}

                        {(exportMode === 'lengkap' || showAnswer) && (
                          <div className="bg-emerald-50 border-2 border-emerald-100 p-4 rounded-xl text-[9pt] italic mt-2">
                            <span className="font-black not-italic text-emerald-700 uppercase">Kunci: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</span>
                            <div className="mt-1" dangerouslySetInnerHTML={{ __html: q.explanation }}></div>
                          </div>
                        )}
                        {exportMode === 'soal' && !showAnswer && (
                          <div className="border-b border-dotted border-gray-400 h-4 w-full opacity-50"></div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizViewer;
