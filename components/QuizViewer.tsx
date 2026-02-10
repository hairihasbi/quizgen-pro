
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

  // Efek khusus untuk registrasi MathJax Observer
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((window as any).observeMathItems) {
        (window as any).observeMathItems('quiz-print-area');
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [quiz, showAnswer, exportMode]);

  const sanitizeHTML = (html: string) => {
    if (!html || html === 'null') return "";
    return html
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "")
      .replace(/\s+on\w+\s*=\s*(['"])(.*?)\1/gmi, "")
      .replace(/href\s*=\s*(['"])javascript:.*?\1/gmi, "");
  };

  const getFontClass = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes('arab')) return 'font-arabic text-right';
    if (s.includes('jepang')) return 'font-jp';
    if (s.includes('korea')) return 'font-kr';
    if (s.includes('mandarin')) return 'font-zh';
    return '';
  };

  const getCognitiveLevelMapping = (levelStr: string) => {
    if (!levelStr) return "-";
    const l = levelStr.toUpperCase();
    if (l.includes('C1') || l.includes('C2')) return "Level 1";
    if (l.includes('C3')) return "Level 2";
    if (l.includes('C4') || l.includes('C5') || l.includes('C6')) return "Level 3";
    return levelStr;
  };

  const handleNativePrint = async () => {
    // Beri waktu sejenak agar UI benar-benar siap
    if ((window as any).MathJax && (window as any).MathJax.typesetPromise) {
        const items = document.querySelectorAll('.mjx-item');
        await (window as any).MathJax.typesetPromise(Array.from(items));
    }
    window.print();
  };

  const handleExportToGoogleForms = async () => {
    setIsExporting(true);
    try {
      const formUrl = await GoogleFormsService.exportToForms(quiz);
      window.open(formUrl, '_blank');
    } catch (err: any) {
      alert("Gagal ekspor: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportToGoogleDocs = async () => {
    setIsExportingDocs(true);
    try {
      const docUrl = await GoogleDocsService.exportToDocs(quiz);
      window.open(docUrl, '_blank');
    } catch (err: any) {
      alert("Gagal ekspor: " + err.message);
    } finally {
      setIsExportingDocs(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-orange-50/95 backdrop-blur-2xl z-[500] flex flex-col p-4 md:p-8 animate-in zoom-in-95 duration-300 print-modal-wrapper" role="dialog">
      
      {/* Tombol Kontrol (Disembunyikan saat print via .no-print) */}
      <header className="flex flex-col lg:flex-row justify-between items-center bg-white p-5 rounded-[2.5rem] shadow-xl shadow-orange-100/50 mb-6 border border-orange-100 gap-4 no-print text-gray-900">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 orange-gradient rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">📄</div>
          <div>
            <h2 className="font-black text-gray-800 uppercase text-[10px] tracking-tight truncate max-w-[220px]">{quiz.title}</h2>
            <div className="text-[8px] font-bold text-orange-500 uppercase mt-1">Preview: {exportMode}</div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex gap-1 bg-orange-50 p-1 rounded-2xl border border-orange-100">
             <button onClick={() => { setExportMode('soal'); setShowAnswer(false); }} className={`px-4 py-2 rounded-xl text-[9px] font-black transition-all ${exportMode === 'soal' ? 'bg-white text-orange-600 shadow-sm' : 'text-orange-300'}`}>SOAL</button>
             <button onClick={() => { setExportMode('kisi-kisi'); setShowAnswer(false); }} className={`px-4 py-2 rounded-xl text-[9px] font-black transition-all ${exportMode === 'kisi-kisi' ? 'bg-white text-orange-600 shadow-sm' : 'text-orange-300'}`}>KISI-KISI</button>
             <button onClick={() => { setExportMode('lengkap'); setShowAnswer(true); }} className={`px-4 py-2 rounded-xl text-[9px] font-black transition-all ${exportMode === 'lengkap' ? 'bg-white text-orange-600 shadow-sm' : 'text-orange-300'}`}>LENGKAP</button>
          </div>
          <button onClick={handleExportToGoogleDocs} disabled={isExportingDocs} className="px-6 py-3 bg-[#4285f4] text-white rounded-2xl text-[10px] font-black shadow-xl uppercase transition-all hover:scale-105">📄 Docs</button>
          <button onClick={handleExportToGoogleForms} disabled={isExporting} className="px-6 py-3 bg-[#673ab7] text-white rounded-2xl text-[10px] font-black shadow-xl uppercase transition-all hover:scale-105">📝 Forms</button>
          <button onClick={handleNativePrint} className="px-6 py-3 orange-gradient text-white rounded-2xl text-[10px] font-black shadow-xl uppercase transition-all hover:scale-105">🖨️ Cetak</button>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-orange-300 hover:text-red-500 bg-orange-100/50 rounded-full">✕</button>
        </div>
      </header>

      {/* Kontainer Scrollable yang akan dipaksa Static saat Print */}
      <div className="flex-1 overflow-y-auto p-4 md:p-10 flex justify-center custom-scrollbar bg-orange-100/20 rounded-[3rem] print-scroll-container">
        <div id="quiz-print-area" className="print-container bg-white shadow-2xl transition-all duration-500 text-gray-900 w-full md:w-[210mm] min-h-screen py-[15mm]">
          <div className="print-watermark">GENZ QUIZGEN PRO</div>

          {/* KOP SOAL */}
          <div className="pdf-block px-[20mm] border-none">
             <div className="border-b-4 border-double border-gray-900 pb-4 mb-6 text-center">
                <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900">{quiz.title}</h1>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 mt-1">
                   {quiz.subject} | {quiz.level} {quiz.grade}
                </div>
             </div>

             <div className="grid grid-cols-2 gap-x-12 gap-y-4 p-6 border-2 border-gray-900 rounded-2xl bg-gray-50/30 print:bg-white">
                <div className="flex items-center gap-3">
                   <span className="w-20 shrink-0 font-black text-[11px] text-gray-500 uppercase">NAMA</span>
                   <span className="font-black text-gray-900">:</span>
                   <div className="flex-1 border-b-2 border-dotted border-gray-300 h-5"></div>
                </div>
                <div className="flex items-center gap-3">
                   <span className="w-20 shrink-0 font-black text-[11px] text-gray-500 uppercase">HARI / TGL</span>
                   <span className="font-black text-gray-900">:</span>
                   <div className="flex-1 border-b-2 border-dotted border-gray-300 h-5"></div>
                </div>
                <div className="flex items-center gap-3">
                   <span className="w-20 shrink-0 font-black text-[11px] text-gray-500 uppercase">KELAS</span>
                   <span className="font-black text-gray-900">:</span>
                   <div className="flex-1 border-b-2 border-dotted border-gray-300 h-5"></div>
                </div>
                <div className="flex items-center gap-3">
                   <span className="w-20 shrink-0 font-black text-[11px] text-gray-500 uppercase">NO. ABSEN</span>
                   <span className="font-black text-gray-900">:</span>
                   <div className="flex-1 border-b-2 border-dotted border-gray-300 h-5"></div>
                </div>
             </div>
          </div>

          {/* DAFTAR SOAL */}
          <div className="px-[20mm]">
            {(exportMode === 'soal' || exportMode === 'lengkap') && (
              <div className="space-y-0">
                {quiz.questions.map((q, i) => {
                  const isNewPassage = q.passage && (i === 0 || quiz.questions[i-1].passage !== q.passage);
                  const isNewType = i === 0 || quiz.questions[i-1].type !== q.type;
                  
                  return (
                    <div key={q.id} className="mjx-item math-loading pdf-block py-6">
                        {isNewType && (
                          <div className="mb-6 mt-4">
                            <h3 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.15em] border-l-4 border-gray-900 pl-3">
                              BAGIAN: {q.type.toUpperCase()}
                            </h3>
                          </div>
                        )}
                        {isNewPassage && (
                          <div className="mb-4 bg-gray-50 rounded-2xl border-l-4 border-orange-400 p-5 italic text-gray-700 text-[13px] text-justify print:bg-white print:border-gray-300" dangerouslySetInnerHTML={{ __html: sanitizeHTML(q.passage!) }}></div>
                        )}
                        <div className="flex gap-4 items-start">
                          <span className="font-black text-gray-900 text-[14px] mt-0.5 w-8 shrink-0">{i + 1}.</span>
                          <div className="flex-1">
                            <div className={`text-gray-900 font-bold leading-relaxed text-[14px] text-justify pb-4 ${getFontClass(quiz.subject)}`} dangerouslySetInnerHTML={{ __html: sanitizeHTML(q.text) }}></div>
                            {q.options && (
                              <div className="options-grid">
                                {q.options.map(opt => (
                                  <div key={opt.label} className="flex gap-3 items-start">
                                    <span className="font-black text-gray-900 w-7 h-7 flex items-center justify-center rounded-lg border border-gray-400 text-[11px] shrink-0">{opt.label}</span>
                                    <div className={`font-semibold text-gray-800 text-[13px] pt-1 ${getFontClass(quiz.subject)}`} dangerouslySetInnerHTML={{ __html: sanitizeHTML(opt.text) }}></div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {showAnswer && (
                              <div className="mt-4 p-5 bg-emerald-50 rounded-2xl border border-emerald-100 print:bg-white print:border-gray-300">
                                <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Kunci: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</div>
                                <div className={`text-[12px] text-gray-600 italic ${getFontClass(quiz.subject)}`} dangerouslySetInnerHTML={{ __html: sanitizeHTML(q.explanation) }}></div>
                              </div>
                            )}
                          </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TABEL KISI-KISI */}
            {exportMode === 'kisi-kisi' && (
              <div className="pdf-block mt-8 border-none">
                <h3 className="text-lg font-black text-gray-900 uppercase border-b-2 border-gray-900 mb-6 pb-2 text-center">Kisi-kisi Instrumen Penilaian</h3>
                <table className="w-full border-collapse border-2 border-gray-900 text-[10px]">
                  <thead>
                    <tr className="bg-gray-100 print:bg-gray-50">
                      <th className="border border-gray-900 p-2 w-8 text-center font-black">No</th>
                      <th className="border border-gray-900 p-2 text-center w-40 font-black">KD / TP</th>
                      <th className="border border-gray-900 p-2 text-center w-32 font-black">Materi</th>
                      <th className="border border-gray-900 p-2 text-center font-black">Indikator</th>
                      <th className="border border-gray-900 p-2 w-16 text-center font-black">Level</th>
                      <th className="border border-gray-900 p-2 w-20 text-center font-black">Bentuk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quiz.questions.map((q, i) => (
                      <tr key={q.id}>
                        <td className="border border-gray-900 p-2 text-center font-bold">{i + 1}</td>
                        <td className="border border-gray-900 p-2 text-justify leading-tight">{q.competency || "-"}</td>
                        <td className="border border-gray-900 p-2 text-center leading-tight">{q.topic || "-"}</td>
                        <td className="mjx-item math-loading border border-gray-900 p-2 text-justify leading-relaxed">{q.indicator}</td>
                        <td className="border border-gray-900 p-2 text-center whitespace-nowrap">{getCognitiveLevelMapping(q.cognitiveLevel)}</td>
                        <td className="border border-gray-900 p-2 text-center">{q.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizViewer;
