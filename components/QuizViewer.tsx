
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
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    // Memastikan MathJax me-render formula setiap kali mode preview berubah
    const timer = setTimeout(() => {
      if ((window as any).observeMathItems) {
        (window as any).observeMathItems('quiz-print-area');
      }
    }, 300);
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

  const handleDownloadPdf = async () => {
    const element = document.getElementById('quiz-print-area');
    const scrollContainer = document.querySelector('.print-scroll-container');
    if (!element) return;

    setIsDownloading(true);

    try {
      // 1. Persiapan: Tambahkan class khusus agar CSS presisi bekerja
      document.body.classList.add('exporting');
      if (scrollContainer) scrollContainer.scrollTop = 0;

      // 2. Paksa sinkronisasi MathJax untuk memastikan SVG sudah di-generate di DOM
      if ((window as any).MathJax && (window as any).MathJax.typesetPromise) {
        await (window as any).MathJax.typesetPromise([element]);
      }

      // 3. JEDA STABILISASI: Memberikan waktu bagi browser untuk Painting (Menggambar) SVG ke layar
      // Kita gunakan jeda 3 detik untuk menjamin hasil preview = hasil unduh
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 3000); 
        });
      });

      // 4. Konfigurasi Standar A4 dengan High-DPI Scale
      const opt = {
        margin: 0, // Padding sudah dikunci di CSS .print-container (22mm)
        filename: `Quiz_${quiz.title.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { 
          scale: 2, // Resolusi tinggi (300dpi ekuivalen)
          useCORS: true, 
          logging: false,
          letterRendering: true,
          scrollY: 0,
          scrollX: 0,
          // Mengunci lebar capture pada lebar A4 (794px pada 96dpi)
          windowWidth: 794, 
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.pdf-block', 'tr', 'h1', 'h2', 'h3', '.identitas-box'] }
      };

      // 5. Eksekusi proses unduh
      const worker = (window as any).html2pdf().from(element).set(opt);
      await worker.save();
    } catch (err) {
      console.error("Kesalahan Ekspor PDF:", err);
      alert("Gagal mengunduh PDF. Pastikan seluruh konten sudah muncul di layar preview.");
    } finally {
      document.body.classList.remove('exporting');
      setIsDownloading(false);
    }
  };

  const handleNativePrint = () => {
    window.print();
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
          
          <button onClick={handleDownloadPdf} disabled={isDownloading} className="px-8 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black shadow-xl uppercase transition-all hover:scale-105 active:scale-95 flex items-center gap-3">
            {isDownloading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : '📥'} PDF
          </button>

          <button onClick={handleNativePrint} className="px-8 py-4 orange-gradient text-white rounded-2xl text-[10px] font-black shadow-xl uppercase transition-all hover:scale-105 active:scale-95">🖨️ Cetak</button>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center text-orange-300 hover:text-red-500 bg-orange-100/50 rounded-full transition-colors font-bold">✕</button>
        </div>
      </header>

      {/* Container Preview Kertas - Didesain agar sama dengan hasil cetak */}
      <div className="flex-1 overflow-y-auto p-0 md:p-12 flex justify-center custom-scrollbar print-scroll-container">
        <div id="quiz-print-area" className="print-container bg-white text-gray-900">
          
          {/* HEADER / KOP SOAL */}
          <div className="border-b-[5px] border-double border-gray-900 pb-4 mb-8 text-center w-full box-border">
             <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900">{quiz.title}</h1>
             <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-gray-600 mt-1">
                {quiz.subject} | {quiz.level} {quiz.grade}
             </div>
          </div>

          {/* DATA SISWA - Menggunakan Fixed Table agar tidak meluber keluar margin */}
          <div className="identitas-box mb-10 w-full box-border">
            <table className="fixed-table border-[3px] border-gray-900 rounded-xl overflow-hidden">
              <tbody>
                <tr>
                  <td className="p-5 w-1/2 border-r-[2.5px] border-gray-900">
                    <div className="flex items-center gap-3">
                      <span className="w-20 shrink-0 font-black text-[11px] text-gray-700 uppercase">NAMA</span>
                      <span className="font-black text-gray-900">:</span>
                      <div className="flex-1 border-b-[2px] border-dotted border-gray-400 h-5"></div>
                    </div>
                  </td>
                  <td className="p-5 w-1/2">
                    <div className="flex items-center gap-3">
                      <span className="w-24 shrink-0 font-black text-[11px] text-gray-700 uppercase">HARI / TGL</span>
                      <span className="font-black text-gray-900">:</span>
                      <div className="flex-1 border-b-[2px] border-dotted border-gray-400 h-5"></div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="p-5 w-1/2 border-r-[2.5px] border-gray-900 border-t-[2.5px]">
                    <div className="flex items-center gap-3">
                      <span className="w-20 shrink-0 font-black text-[11px] text-gray-700 uppercase">KELAS</span>
                      <span className="font-black text-gray-900">:</span>
                      <div className="flex-1 border-b-[2px] border-dotted border-gray-400 h-5"></div>
                    </div>
                  </td>
                  <td className="p-5 w-1/2 border-t-[2.5px] border-gray-900">
                    <div className="flex items-center gap-3">
                      <span className="w-24 shrink-0 font-black text-[11px] text-gray-700 uppercase">NO. ABSEN</span>
                      <span className="font-black text-gray-900">:</span>
                      <div className="flex-1 border-b-[2px] border-dotted border-gray-400 h-5"></div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* AREA KONTEN SOAL */}
          <div className="w-full box-border overflow-visible">
            {(exportMode === 'soal' || exportMode === 'lengkap') && (
              <div className="space-y-0">
                {quiz.questions.map((q, i) => {
                  const isNewPassage = q.passage && (i === 0 || quiz.questions[i-1].passage !== q.passage);
                  const isNewType = i === 0 || quiz.questions[i-1].type !== q.type;
                  
                  return (
                    <div key={q.id} className="pdf-block py-4 w-full box-border">
                        {isNewType && (
                          <div className="mb-6 mt-4">
                            <h3 className="text-[12px] font-black text-gray-900 uppercase tracking-[0.2em] border-l-[6px] border-gray-900 pl-4">
                              BAGIAN: {q.type.toUpperCase()}
                            </h3>
                          </div>
                        )}
                        {isNewPassage && (
                          <div className="mb-6 bg-gray-50 rounded-[2rem] border-l-[6px] border-orange-400 p-6 italic text-gray-700 text-[13px] text-justify print:bg-white print:border-gray-400" dangerouslySetInnerHTML={{ __html: sanitizeHTML(q.passage!) }}></div>
                        )}
                        <div className="flex gap-5 items-start w-full box-border">
                          <span className="font-black text-gray-900 text-[14px] mt-0.5 w-7 shrink-0">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <div className={`mjx-item text-gray-900 font-bold leading-relaxed text-[14px] text-justify pb-3 w-full break-words ${getFontClass(quiz.subject)}`} dangerouslySetInnerHTML={{ __html: sanitizeHTML(q.text) }}></div>
                            {q.options && (
                              <div className="options-grid w-full box-border">
                                {q.options.map(opt => (
                                  <div key={opt.label} className="flex gap-3 items-start w-full overflow-hidden box-border mb-2">
                                    <span className="font-black text-gray-900 w-7 h-7 flex items-center justify-center rounded-lg border-[2px] border-gray-500 text-[11px] shrink-0">{opt.label}</span>
                                    <div className={`mjx-item font-semibold text-gray-800 text-[13px] pt-1 flex-1 min-w-0 ${getFontClass(quiz.subject)}`} dangerouslySetInnerHTML={{ __html: sanitizeHTML(opt.text) }}></div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {showAnswer && (
                              <div className="mt-4 p-5 bg-emerald-50 rounded-2xl border-[2px] border-emerald-100 print:bg-white print:border-gray-400">
                                <div className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.2em] mb-2">Kunci: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</div>
                                <div className={`text-[12px] text-gray-600 italic leading-relaxed ${getFontClass(quiz.subject)}`} dangerouslySetInnerHTML={{ __html: sanitizeHTML(q.explanation) }}></div>
                              </div>
                            )}
                          </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TABEL KISI-KISI - Presisi dengan Lebar Persentase Tetap */}
            {exportMode === 'kisi-kisi' && (
              <div className="mt-10 w-full box-border overflow-visible">
                <h3 className="text-xl font-black text-gray-900 uppercase border-b-[3px] border-gray-900 mb-8 pb-3 text-center">Kisi-kisi Instrumen Penilaian</h3>
                <table className="fixed-table border-[2.5px] border-gray-900 text-[10px]">
                  <thead>
                    <tr className="bg-gray-100 print:bg-gray-50">
                      <th className="border-[2px] border-gray-900 p-2 w-[7%] text-center font-black uppercase tracking-tight">No</th>
                      <th className="border-[2px] border-gray-900 p-2 text-center w-[25%] font-black uppercase tracking-tight">KD / TP</th>
                      <th className="border-[2px] border-gray-900 p-2 text-center w-[15%] font-black uppercase tracking-tight">Materi</th>
                      <th className="border-[2px] border-gray-900 p-2 text-center w-[30%] font-black uppercase tracking-tight">Indikator Soal</th>
                      <th className="border-[2px] border-gray-900 p-2 w-[10%] text-center font-black uppercase tracking-tight">Level</th>
                      <th className="border-[2px] border-gray-900 p-2 w-[13%] text-center font-black uppercase tracking-tight">Bentuk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quiz.questions.map((q, i) => (
                      <tr key={q.id} className="pdf-block">
                        <td className="border-[2px] border-gray-900 p-3 text-center font-bold">{i + 1}</td>
                        <td className="border-[2px] border-gray-900 p-3 text-justify leading-tight text-[9px]">{q.competency || "-"}</td>
                        <td className="border-[2px] border-gray-900 p-3 text-center leading-tight">{q.topic || "-"}</td>
                        <td className="border-[2px] border-gray-900 p-3 text-justify leading-relaxed break-words">
                          <div className="mjx-item">{q.indicator}</div>
                        </td>
                        <td className="border-[2px] border-gray-900 p-3 text-center whitespace-nowrap font-bold text-orange-600">{getCognitiveLevelMapping(q.cognitiveLevel)}</td>
                        <td className="border-[2px] border-gray-900 p-3 text-center uppercase font-black text-[8px]">{q.type}</td>
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
