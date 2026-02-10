
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
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if ((window as any).observeMathItems) {
        (window as any).observeMathItems('quiz-print-area');
      }
    }, 150);
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
    if ((window as any).MathJax && (window as any).MathJax.typesetPromise) {
        await (window as any).MathJax.typesetPromise();
    }
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('quiz-print-area');
    const scrollContainer = document.querySelector('.print-scroll-container');
    if (!element) return;

    setIsDownloading(true);

    try {
      // 1. Pastikan area render terlihat sepenuhnya di viewport untuk snapshot yang stabil
      if (scrollContainer) scrollContainer.scrollTop = 0;

      // 2. Sinkronisasi paksa MathJax dengan Typeset Promise
      if ((window as any).MathJax && (window as any).MathJax.typesetPromise) {
        await (window as any).MathJax.typesetPromise([element]);
      }

      // 3. Delay tambahan untuk sinkronisasi paint browser (Chrome/Edge rendering lag)
      // Menggunakan double requestAnimationFrame + setTimeout untuk kepastian render formula
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 1500); // 1.5 detik delay untuk rendering formula kompleks
          });
        });
      });

      // 4. Konfigurasi Presisi A4 untuk html2pdf
      const opt = {
        margin: [10, 10, 10, 10], // Margin 10mm di PDF
        filename: `Quiz_${quiz.title.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          letterRendering: true,
          // Lebar window disesuaikan agar aspek rasio A4 (210mm) konsisten
          windowWidth: 794, 
          scrollY: 0,
          scrollX: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.pdf-block', 'tr', 'h1', 'h2', 'h3', '.identitas-box'] }
      };

      // 5. Eksekusi Download
      const worker = (window as any).html2pdf().from(element).set(opt);
      await worker.save();
    } catch (err) {
      console.error("PDF Download Error:", err);
      alert("Gagal mengunduh PDF. Pastikan koneksi stabil dan formula matematika sudah ter-render.");
    } finally {
      setIsDownloading(false);
    }
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
      
      <header className="flex flex-col lg:flex-row justify-between items-center bg-white p-5 rounded-[2.5rem] shadow-xl shadow-orange-100/50 mb-6 border border-orange-100 gap-4 no-print">
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
          
          <button onClick={handleDownloadPdf} disabled={isDownloading} className="px-6 py-3 bg-gray-800 text-white rounded-2xl text-[10px] font-black shadow-xl uppercase transition-all hover:scale-105 flex items-center gap-2">
            {isDownloading ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : '📥'} PDF
          </button>

          <button onClick={handleNativePrint} className="px-6 py-3 orange-gradient text-white rounded-2xl text-[10px] font-black shadow-xl uppercase transition-all hover:scale-105">🖨️ Cetak</button>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-orange-300 hover:text-red-500 bg-orange-100/50 rounded-full transition-colors">✕</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-0 md:p-10 flex justify-center custom-scrollbar print-scroll-container">
        <div id="quiz-print-area" className="print-container bg-white shadow-2xl text-gray-900 w-[210mm] min-h-screen py-[15mm] px-[20mm] box-border print:py-0 print:px-0">
          
          {/* HEADER / KOP SOAL */}
          <div className="border-b-[4px] border-double border-gray-900 pb-3 mb-6 text-center w-full box-border">
             <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900 leading-tight">{quiz.title}</h1>
             <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 mt-1">
                {quiz.subject} | {quiz.level} {quiz.grade}
             </div>
          </div>

          {/* DATA SISWA - Menggunakan width 100% dan box-sizing border-box agar tidak terpotong margin kanan */}
          <div className="identitas-box grid grid-cols-2 gap-x-8 gap-y-4 p-5 border-[3px] border-gray-900 rounded-xl mb-8 w-full box-border mx-auto">
             <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 font-black text-[10px] text-gray-600 uppercase">NAMA</span>
                <span className="font-black text-gray-900">:</span>
                <div className="flex-1 border-b-2 border-dotted border-gray-400 h-4"></div>
             </div>
             <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 font-black text-[10px] text-gray-600 uppercase">HARI / TGL</span>
                <span className="font-black text-gray-900">:</span>
                <div className="flex-1 border-b-2 border-dotted border-gray-400 h-4"></div>
             </div>
             <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 font-black text-[10px] text-gray-600 uppercase">KELAS</span>
                <span className="font-black text-gray-900">:</span>
                <div className="flex-1 border-b-2 border-dotted border-gray-400 h-4"></div>
             </div>
             <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 font-black text-[10px] text-gray-600 uppercase">NO. ABSEN</span>
                <span className="font-black text-gray-900">:</span>
                <div className="flex-1 border-b-2 border-dotted border-gray-400 h-4"></div>
             </div>
          </div>

          {/* AREA KONTEN */}
          <div className="w-full box-border overflow-visible">
            {(exportMode === 'soal' || exportMode === 'lengkap') && (
              <div className="space-y-0">
                {quiz.questions.map((q, i) => {
                  const isNewPassage = q.passage && (i === 0 || quiz.questions[i-1].passage !== q.passage);
                  const isNewType = i === 0 || quiz.questions[i-1].type !== q.type;
                  
                  return (
                    <div key={q.id} className="pdf-block py-3 w-full box-border">
                        {isNewType && (
                          <div className="mb-4 mt-2">
                            <h3 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.15em] border-l-4 border-gray-900 pl-3">
                              BAGIAN: {q.type.toUpperCase()}
                            </h3>
                          </div>
                        )}
                        {isNewPassage && (
                          <div className="mb-4 bg-gray-50 rounded-xl border-l-4 border-orange-400 p-4 italic text-gray-700 text-[12px] text-justify print:bg-white print:border-gray-300" dangerouslySetInnerHTML={{ __html: sanitizeHTML(q.passage!) }}></div>
                        )}
                        <div className="flex gap-4 items-start w-full box-border">
                          <span className="font-black text-gray-900 text-[13px] mt-0.5 w-6 shrink-0">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <div className={`mjx-item text-gray-900 font-bold leading-relaxed text-[13px] text-justify pb-2 w-full break-words ${getFontClass(quiz.subject)}`} dangerouslySetInnerHTML={{ __html: sanitizeHTML(q.text) }}></div>
                            {q.options && (
                              <div className="options-grid w-full">
                                {q.options.map(opt => (
                                  <div key={opt.label} className="flex gap-2 items-start w-full overflow-hidden">
                                    <span className="font-black text-gray-900 w-6 h-6 flex items-center justify-center rounded-lg border border-gray-400 text-[10px] shrink-0">{opt.label}</span>
                                    <div className={`mjx-item font-semibold text-gray-800 text-[12px] pt-0.5 flex-1 min-w-0 ${getFontClass(quiz.subject)}`} dangerouslySetInnerHTML={{ __html: sanitizeHTML(opt.text) }}></div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {showAnswer && (
                              <div className="mt-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100 print:bg-white print:border-gray-300">
                                <div className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-1">Kunci: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</div>
                                <div className={`text-[11px] text-gray-600 italic ${getFontClass(quiz.subject)}`} dangerouslySetInnerHTML={{ __html: sanitizeHTML(q.explanation) }}></div>
                              </div>
                            )}
                          </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TABEL KISI-KISI - Diperbaiki lebarnya agar tidak terpotong (table-fixed dengan px lebar kolom yang aman) */}
            {exportMode === 'kisi-kisi' && (
              <div className="mt-8 w-full box-border overflow-visible">
                <h3 className="text-lg font-black text-gray-900 uppercase border-b-2 border-gray-900 mb-6 pb-2 text-center">Kisi-kisi Instrumen Penilaian</h3>
                <table className="w-full border-collapse border-[2.5px] border-gray-900 text-[9px] table-fixed">
                  <thead>
                    <tr className="bg-gray-100 print:bg-gray-50">
                      <th className="border-2 border-gray-900 p-1 w-[35px] text-center font-black uppercase">No</th>
                      <th className="border-2 border-gray-900 p-1 text-center w-[110px] font-black uppercase">KD / TP</th>
                      <th className="border-2 border-gray-900 p-1 text-center w-[90px] font-black uppercase">Materi</th>
                      <th className="border-2 border-gray-900 p-1 text-center font-black uppercase">Indikator</th>
                      <th className="border-2 border-gray-900 p-1 w-[45px] text-center font-black uppercase">Level</th>
                      <th className="border-2 border-gray-900 p-1 w-[65px] text-center font-black uppercase">Bentuk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quiz.questions.map((q, i) => (
                      <tr key={q.id} className="pdf-block">
                        <td className="border-2 border-gray-900 p-2 text-center font-bold">{i + 1}</td>
                        <td className="border-2 border-gray-900 p-2 text-justify leading-tight">{q.competency || "-"}</td>
                        <td className="border-2 border-gray-900 p-2 text-center leading-tight">{q.topic || "-"}</td>
                        <td className="border-2 border-gray-900 p-2 text-justify leading-relaxed break-words overflow-visible">
                          <div className="mjx-item">{q.indicator}</div>
                        </td>
                        <td className="border-2 border-gray-900 p-2 text-center whitespace-nowrap">{getCognitiveLevelMapping(q.cognitiveLevel)}</td>
                        <td className="border-2 border-gray-900 p-2 text-center">{q.type}</td>
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
