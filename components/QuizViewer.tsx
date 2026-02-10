
import React, { useEffect, useState } from 'react';
import { Quiz } from '../types';
import { GoogleFormsService } from '../services/googleFormsService';
import { GoogleDocsService } from '../services/googleDocsService';

interface QuizViewerProps {
  quiz: Quiz;
  onClose: () => void;
}

const QuizViewer: React.FC<QuizViewerProps> = ({ quiz, onClose }) => {
  const [showAnswer, setShowAnswer] = useState(false);
  const [exportMode, setExportMode] = useState<'soal' | 'kisi-kisi' | 'lengkap'>('soal');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingDocs, setIsExportingDocs] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if ((window as any).observeMathItems) {
        (window as any).observeMathItems('quiz-print-area');
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [quiz, showAnswer, exportMode]);

  const sanitizeHTML = (html: string) => {
    if (!html || html === 'null') return "";
    return html
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "")
      .replace(/\s+on\w+\s*=\s*(['"])(.*?)\1/gmi, "");
  };

  const getFontClass = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes('arab')) return 'font-arabic text-right';
    if (s.includes('jepang')) return 'font-jp';
    if (s.includes('korea')) return 'font-kr';
    if (s.includes('mandarin')) return 'font-zh';
    return '';
  };

  const handleNativePrint = async () => {
    if ((window as any).MathJax && (window as any).MathJax.typesetPromise) {
        const items = document.querySelectorAll('.mjx-item');
        await (window as any).MathJax.typesetPromise(Array.from(items));
    }
    setTimeout(() => { window.print(); }, 200);
  };

  return (
    <div className="fixed inset-0 bg-orange-50/98 backdrop-blur-3xl z-[1000] flex flex-col p-0 md:p-6 print-modal-wrapper">
      
      {/* Kontrol Navigasi - Disembunyikan saat print */}
      <header className="mx-4 mt-4 md:mx-10 md:mt-6 bg-white p-5 rounded-[2.5rem] shadow-xl border border-orange-100 flex flex-col lg:flex-row justify-between items-center gap-4 no-print">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 orange-gradient rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">📄</div>
          <div className="hidden sm:block">
            <h2 className="font-black text-gray-800 uppercase text-[10px] tracking-tight truncate max-w-[200px]">{quiz.title}</h2>
            <div className="text-[8px] font-black text-orange-500 uppercase mt-0.5">Mode: {exportMode}</div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex gap-1 bg-orange-50 p-1 rounded-2xl border border-orange-100 mr-2">
             {['soal', 'kisi-kisi', 'lengkap'].map((mode) => (
               <button 
                 key={mode}
                 onClick={() => { setExportMode(mode as any); setShowAnswer(mode === 'lengkap'); }} 
                 className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${exportMode === mode ? 'bg-white text-orange-600 shadow-sm' : 'text-orange-300'}`}
               >{mode}</button>
             ))}
          </div>
          <button onClick={handleNativePrint} className="px-6 py-3 orange-gradient text-white rounded-2xl text-[10px] font-black shadow-xl uppercase transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
            <span>🖨️</span> PDF / CETAK
          </button>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-orange-300 hover:text-red-500 bg-orange-50 rounded-full transition-colors ml-2">✕</button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-10 flex justify-center custom-scrollbar print-scroll-container">
        <div id="quiz-print-area" className="print-container bg-white shadow-2xl transition-all duration-300 text-gray-900 w-full md:w-[210mm] min-h-screen">
          
          <div className="print-watermark no-print">GenZ QuizGen Pro - AI Powered Question Generator</div>

          {/* HEADER / KOP SOAL (Dibuat sangat bersih untuk print) */}
          <div className="pdf-block px-[10mm] pt-2">
             <div className="border-b-4 border-double border-gray-900 pb-5 mb-8 text-center space-y-1">
                <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900 leading-none">{quiz.title}</h1>
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-600">
                   {quiz.subject} | {quiz.level} - {quiz.grade}
                </p>
             </div>

             {/* Tabel Identitas Siswa - Menggunakan Grid Simetris */}
             <div className="grid grid-cols-2 gap-x-16 gap-y-5 p-6 border-2 border-gray-900 rounded-2xl mb-10">
                <div className="flex items-center gap-3">
                   <span className="w-20 shrink-0 font-black text-[10px] text-gray-600 uppercase tracking-widest">NAMA</span>
                   <span className="font-black">:</span>
                   <div className="flex-1 border-b border-gray-300 h-5 mt-1"></div>
                </div>
                <div className="flex items-center gap-3">
                   <span className="w-20 shrink-0 font-black text-[10px] text-gray-600 uppercase tracking-widest">HARI / TGL</span>
                   <span className="font-black">:</span>
                   <div className="flex-1 border-b border-gray-300 h-5 mt-1"></div>
                </div>
                <div className="flex items-center gap-3">
                   <span className="w-20 shrink-0 font-black text-[10px] text-gray-600 uppercase tracking-widest">KELAS</span>
                   <span className="font-black">:</span>
                   <div className="flex-1 border-b border-gray-300 h-5 mt-1"></div>
                </div>
                <div className="flex items-center gap-3">
                   <span className="w-20 shrink-0 font-black text-[10px] text-gray-600 uppercase tracking-widest">NO. ABSEN</span>
                   <span className="font-black">:</span>
                   <div className="flex-1 border-b border-gray-300 h-5 mt-1"></div>
                </div>
             </div>
          </div>

          {/* AREA SOAL */}
          <div className="px-[10mm] pb-10">
            {(exportMode === 'soal' || exportMode === 'lengkap') && (
              <div className="space-y-0">
                {quiz.questions.map((q, i) => {
                  const isNewPassage = q.passage && (i === 0 || quiz.questions[i-1].passage !== q.passage);
                  const isNewType = i === 0 || quiz.questions[i-1].type !== q.type;
                  
                  return (
                    <div key={q.id} className="pdf-block py-6 border-b border-gray-50 print:border-gray-100">
                        {isNewType && (
                          <div className="mb-6 mt-4">
                            <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] border-l-4 border-gray-900 pl-4">
                               BAGIAN: {q.type.toUpperCase()}
                            </h3>
                          </div>
                        )}
                        
                        {isNewPassage && (
                          <div className="mb-6 bg-gray-50 rounded-2xl border-l-4 border-orange-400 p-6 italic text-gray-700 text-[13px] text-justify leading-relaxed print:bg-white print:border-gray-300" 
                               dangerouslySetInnerHTML={{ __html: sanitizeHTML(q.passage!) }}></div>
                        )}

                        <div className="flex gap-5 items-start">
                          <span className="font-black text-gray-900 text-[15px] mt-0.5 w-8 shrink-0">{i + 1}.</span>
                          <div className="flex-1">
                            <div className={`mjx-item text-gray-900 font-bold leading-relaxed text-[15px] text-justify pb-4 ${getFontClass(quiz.subject)}`} 
                                 dangerouslySetInnerHTML={{ __html: sanitizeHTML(q.text) }}></div>
                            
                            {q.options && (
                              <div className="options-grid">
                                {q.options.map(opt => (
                                  <div key={opt.label} className="flex gap-4 items-start">
                                    <span className="font-black text-gray-900 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-400 text-[12px] shrink-0">{opt.label}</span>
                                    <div className={`mjx-item font-semibold text-gray-800 text-[14px] pt-1.5 ${getFontClass(quiz.subject)}`} 
                                         dangerouslySetInnerHTML={{ __html: sanitizeHTML(opt.text) }}></div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {showAnswer && (
                              <div className="mt-5 p-5 bg-emerald-50 rounded-2xl border border-emerald-100 print:bg-white print:border-gray-300">
                                <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">KUNCI JAWABAN: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</div>
                                <div className={`text-[12px] text-gray-600 italic leading-relaxed ${getFontClass(quiz.subject)}`} 
                                     dangerouslySetInnerHTML={{ __html: sanitizeHTML(q.explanation) }}></div>
                              </div>
                            )}
                          </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            )}

            {exportMode === 'kisi-kisi' && (
              <div className="pdf-block mt-8">
                <h3 className="text-lg font-black text-gray-900 uppercase border-b-2 border-gray-900 mb-8 pb-3 text-center tracking-widest">Matriks Kisi-kisi Instrumen Penilaian</h3>
                <table className="w-full border-collapse border-2 border-gray-900 text-[10px]">
                  <thead>
                    <tr className="bg-gray-100 print:bg-gray-50">
                      <th className="border border-gray-900 p-3 w-10 text-center font-black">No</th>
                      <th className="border border-gray-900 p-3 text-center font-black">Indikator Soal</th>
                      <th className="border border-gray-900 p-3 w-20 text-center font-black">Level</th>
                      <th className="border border-gray-900 p-3 w-24 text-center font-black">Bentuk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quiz.questions.map((q, i) => (
                      <tr key={q.id}>
                        <td className="border border-gray-900 p-3 text-center font-bold">{i + 1}</td>
                        <td className="mjx-item border border-gray-900 p-3 text-justify leading-relaxed">{q.indicator}</td>
                        <td className="border border-gray-900 p-3 text-center whitespace-nowrap">{q.cognitiveLevel}</td>
                        <td className="border border-gray-900 p-3 text-center">{q.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer halaman untuk dicetak */}
          <div className="hidden print:block text-center pt-20 pb-5 opacity-30 text-[9px] font-black uppercase tracking-widest border-t border-gray-100 mx-[10mm]">
             Dokumen Evaluasi Otomatis - GenZ QuizGen Pro AI Engine
          </div>

        </div>
      </div>
    </div>
  );
};

export default QuizViewer;
