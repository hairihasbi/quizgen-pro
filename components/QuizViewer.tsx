
import React, { useEffect, useState, useMemo } from 'react';
import { Quiz, QuestionType, Question } from '../types';
import { Printer, Download, Cloud, X, FileText, CheckCircle2, TableProperties } from 'lucide-react';

interface QuizViewerProps {
  quiz: Quiz;
  onClose: () => void;
  hideDownload?: boolean;
}

const QuizViewer: React.FC<QuizViewerProps> = ({ quiz, onClose, hideDownload = false }) => {
  const [showAnswer, setShowAnswer] = useState(false);
  const [exportMode, setExportMode] = useState<'soal' | 'kisi-kisi' | 'lengkap'>('soal');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isClientExporting, setIsClientExporting] = useState(false);

  const sortedQuestions = useMemo(() => {
    const typeOrder = [
      QuestionType.MCQ,
      QuestionType.COMPLEX_MCQ,
      QuestionType.TRUE_FALSE,
      QuestionType.SHORT_ANSWER,
      QuestionType.ESSAY
    ];
    return [...quiz.questions].sort((a, b) => {
      return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
    });
  }, [quiz.questions]);

  const groupedQuestions = useMemo(() => {
    const groups: Record<string, Question[]> = {};
    sortedQuestions.forEach(q => {
      if (!groups[q.type]) groups[q.type] = [];
      groups[q.type].push(q);
    });
    return groups;
  }, [sortedQuestions]);

  const triggerMathJax = async () => {
    if ((window as any).MathJax?.typesetPromise) {
      try {
        await (window as any).MathJax.typesetPromise();
      } catch (err) {
        console.warn("MathJax Typeset Failed:", err);
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerMathJax();
    }, 300);
    return () => clearTimeout(timer);
  }, [quiz, showAnswer, exportMode]);

  const handlePrintDirect = async () => {
    // Pastikan matematika dirender sebelum dialog cetak muncul
    await triggerMathJax();
    
    const isLandscape = exportMode === 'kisi-kisi';
    const style = document.createElement('style');
    style.innerHTML = `@page { size: A4 ${isLandscape ? 'landscape' : 'portrait'}; margin: 15mm; }`;
    document.head.appendChild(style);
    
    window.print();
    
    setTimeout(() => {
      if (style.parentNode) document.head.removeChild(style);
    }, 1000);
  };

  const handleExportPdfClient = async () => {
    const element = document.getElementById('quiz-print-area');
    if (!element || !(window as any).html2pdf) {
      alert("Library PDF belum siap.");
      return;
    }

    setIsClientExporting(true);
    const container = document.querySelector('.print-scroll-container');
    if (container) container.scrollTop = 0;

    // CRITICAL: Paksa render MathJax dan tunggu hasilnya selesai
    await triggerMathJax();
    
    // Beri jeda kecil untuk stabilitas DOM
    await new Promise(r => setTimeout(r, 1200));
    
    const isLandscape = exportMode === 'kisi-kisi';
    
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${quiz.title.replace(/\s+/g, '_')}_${exportMode.toUpperCase()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        letterRendering: true,
        backgroundColor: '#ffffff',
        logging: false
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: isLandscape ? 'landscape' : 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
      await (window as any).html2pdf().set(opt).from(element).save();
    } catch (err: any) {
      alert("Gagal export PDF: " + err.message);
    } finally {
      setIsClientExporting(false);
    }
  };

  const handleDownloadPdfSSR = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          quiz: { ...quiz, questions: sortedQuestions }, 
          showAnswer: exportMode === 'lengkap' || showAnswer,
          mode: exportMode
        })
      });
      if (!response.ok) throw new Error("Gagal generate PDF di server.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quiz.title.replace(/\s+/g, '_')}_HighRes_${exportMode.toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Error Engine PDF: " + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  let globalIndex = 0;

  return (
    <div className="fixed inset-0 bg-white md:bg-gray-900/60 backdrop-blur-3xl z-[500] flex flex-col p-4 md:p-8 animate-in zoom-in-95 duration-300 print-modal-wrapper" role="dialog">
      
      <header className="flex flex-col lg:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-2xl mb-8 border border-gray-100 gap-6 no-print">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 orange-gradient rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg">📄</div>
          <div>
            <h2 className="font-black text-gray-800 uppercase text-xs tracking-tight truncate max-w-[280px]">{quiz.title}</h2>
            <div className="text-[9px] font-black text-orange-500 uppercase mt-1 tracking-widest">{exportMode.toUpperCase()} VIEW</div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex gap-1 bg-orange-50 p-1.5 rounded-2xl border border-orange-100">
             <button onClick={() => { setExportMode('soal'); setShowAnswer(false); }} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${exportMode === 'soal' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>
               <FileText size={14} /> NASKAH SOAL
             </button>
             <button onClick={() => { setExportMode('kisi-kisi'); setShowAnswer(false); }} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${exportMode === 'kisi-kisi' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>
               <TableProperties size={14} /> KISI-KISI
             </button>
             <button onClick={() => { setExportMode('lengkap'); setShowAnswer(true); }} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${exportMode === 'lengkap' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>
               <CheckCircle2 size={14} /> KUNCI & PEMBAHASAN
             </button>
          </div>
          
          <div className="h-10 w-px bg-gray-100 mx-2 hidden md:block"></div>

          {!hideDownload && (
            <>
              <button onClick={handlePrintDirect} className="px-6 py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
                <Printer size={16} /> CETAK
              </button>
              <button onClick={handleExportPdfClient} disabled={isClientExporting} className="px-6 py-4 bg-orange-600 text-white rounded-2xl text-[10px] font-black shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2">
                <Download size={16} /> {isClientExporting ? "PROSES..." : "PDF INSTAN"}
              </button>
              <button onClick={handleDownloadPdfSSR} disabled={isDownloading} className="px-6 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2">
                <Cloud size={16} /> {isDownloading ? "ENGINE..." : "PDF ENGINE"}
              </button>
            </>
          )}
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center text-gray-300 hover:text-red-500 bg-gray-100 rounded-full transition-colors font-bold ml-4">✕</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-0 md:p-12 flex justify-center custom-scrollbar print-scroll-container">
        <div 
          id="quiz-print-area" 
          className={`print-container bg-white text-gray-900 ${exportMode === 'kisi-kisi' ? 'landscape-mode' : ''}`} 
          style={{ backgroundColor: '#ffffff' }}
        >
          
          {/* Header Identitas - Muncul hanya di Soal/Kunci, Sembunyikan di Kisi-kisi */}
          {exportMode !== 'kisi-kisi' ? (
            <div className="pdf-header-group mb-8">
              <div className="text-center mb-6">
                <h1 className="text-xl font-black m-0 uppercase tracking-tighter">NASKAH SOAL EVALUASI HASIL BELAJAR</h1>
                <h2 className="text-lg font-bold m-0 uppercase">{(quiz.subject || '').toUpperCase()} - {(quiz.grade || '').toUpperCase()}</h2>
                <div className="border-t-[3px] border-b border-black h-1.5 mt-4"></div>
              </div>
              
              <div className="mb-8">
                <table className="w-full border-collapse border-none text-[10pt]">
                  <tbody>
                    <tr className="border-none">
                      <td className="w-28 py-1 font-bold border-none">Nama Siswa</td><td className="w-4 py-1 text-center border-none">:</td>
                      <td className="py-1 border-b border-gray-300 italic text-gray-300 border-none">...........................................................</td>
                      <td className="w-28 py-1 font-bold text-right border-none">Hari / Tanggal</td><td className="w-4 py-1 text-center border-none">:</td>
                      <td className="w-36 py-1 border-b border-gray-300 italic text-gray-300 border-none">.........................</td>
                    </tr>
                    <tr className="border-none">
                      <td className="py-1 font-bold border-none">Kelas / No. Absen</td><td className="py-1 text-center border-none">:</td>
                      <td className="py-1 border-b border-gray-300 italic text-gray-300 border-none">...........................................................</td>
                      <td className="py-1 font-bold text-right border-none">Waktu</td><td className="py-1 text-center border-none">:</td>
                      <td className="py-1 border-b border-gray-300 italic text-gray-300 text-center border-none">90 Menit</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="pdf-header-group text-center mb-10">
              <h1 className="text-2xl font-black m-0 uppercase tracking-tighter underline">MATRIKS KISI-KISI PENULISAN SOAL</h1>
              <h2 className="text-lg font-bold m-0 mt-2 uppercase">{(quiz.subject || '').toUpperCase()} - {(quiz.grade || '').toUpperCase()}</h2>
              <div className="h-1 w-24 bg-black mx-auto mt-4"></div>
            </div>
          )}

          <div className="space-y-10">
            {exportMode === 'kisi-kisi' ? (
              <table className="w-full border-collapse border-[1.5px] border-black text-[9pt]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border-[1.5px] border-black p-3 w-10 text-center uppercase font-black">NO</th>
                    <th className="border-[1.5px] border-black p-3 w-48 text-left uppercase font-black">CP / KD / KOMPETENSI DASAR</th>
                    <th className="border-[1.5px] border-black p-3 w-40 text-left uppercase font-black">MATERI POKOK</th>
                    <th className="border-[1.5px] border-black p-3 text-left uppercase font-black">INDIKATOR SOAL</th>
                    <th className="border-[1.5px] border-black p-3 w-16 text-center uppercase font-black">LEVEL</th>
                    <th className="border-[1.5px] border-black p-3 w-28 text-center uppercase font-black">BENTUK</th>
                    <th className="border-[1.5px] border-black p-3 w-10 text-center uppercase font-black">NO</th>
                    <th className="border-[1.5px] border-black p-3 w-14 text-center uppercase font-black">KUNCI</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedQuestions.map((q, i) => (
                    <tr key={q.id}>
                      <td className="border-[1.5px] border-black p-3 text-center font-bold">{i + 1}</td>
                      <td className="border-[1.5px] border-black p-3 align-top leading-relaxed text-justify">{q.competency || '-'}</td>
                      <td className="border-[1.5px] border-black p-3 align-top font-bold uppercase">{q.topic || quiz.topic}</td>
                      <td className="border-[1.5px] border-black p-3 align-top leading-relaxed text-justify">
                        <div dangerouslySetInnerHTML={{ __html: q.indicator }}></div>
                      </td>
                      <td className="border-[1.5px] border-black p-3 text-center font-black">{q.cognitiveLevel.split(' ')[0]}</td>
                      <td className="border-[1.5px] border-black p-3 text-center text-[8pt] font-bold uppercase">{q.type}</td>
                      <td className="border-[1.5px] border-black p-3 text-center font-black">{i + 1}</td>
                      <td className="border-[1.5px] border-black p-3 text-center font-black text-orange-600 uppercase">
                        {Array.isArray(q.answer) ? q.answer.join(',') : q.answer}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              Object.entries(groupedQuestions).map(([type, questions], gIdx) => (
                <div key={type} className="space-y-6">
                  <div className="bg-gray-100 px-6 py-2 border-y-[1.5px] border-black font-black text-[11pt] uppercase tracking-tighter">
                    {String.fromCharCode(65 + gIdx)}. {type}
                  </div>
                  <div className="space-y-10">
                    {questions.map((q, i) => {
                      globalIndex++; 
                      const isNewPassage = q.passage && (i === 0 || questions[i-1].passage !== q.passage);
                      return (
                        <div key={q.id} className="pdf-block">
                          {isNewPassage && (
                            <div className="bg-gray-50 border-[1.5px] border-black p-6 mb-6 italic text-[10.5pt] text-justify leading-relaxed relative">
                              <div className="absolute top-0 left-4 -translate-y-1/2 bg-white px-3 font-black text-[8pt] border border-black uppercase tracking-widest">Wacana Stimulus</div>
                              <div dangerouslySetInnerHTML={{ __html: q.passage! }}></div>
                            </div>
                          )}
                          <div className="flex gap-4 text-[11pt] leading-relaxed">
                            <div className="font-bold w-6 shrink-0 text-right">{globalIndex}.</div>
                            <div className="flex-1">
                              <div className="mb-4 text-justify font-bold" dangerouslySetInnerHTML={{ __html: q.text }}></div>
                              
                              {/* GAMBAR STIMULUS */}
                              {q.image && (
                                <div className="my-6">
                                  <img src={q.image} className="max-w-full md:max-w-[420px] rounded-xl border-[3px] border-gray-100 shadow-md" alt="Visual Stimulus" />
                                </div>
                              )}

                              {q.options && q.options.length > 0 && (
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 ml-2">
                                  {q.options.map(opt => (
                                    <div key={opt.label} className="flex gap-3 items-start">
                                      <span className="font-black w-5 shrink-0">{opt.label}.</span>
                                      <span className="text-justify" dangerouslySetInnerHTML={{ __html: opt.text }}></span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {(exportMode === 'lengkap' || showAnswer) && (
                                <div className="bg-emerald-50 border-[1.5px] border-dashed border-emerald-300 p-6 rounded-3xl text-[9.5pt] italic mt-4 shadow-sm">
                                  <div className="font-black text-emerald-700 uppercase text-[8pt] mb-1 flex items-center gap-2">
                                    <CheckCircle2 size={12} /> KUNCI JAWABAN: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}
                                  </div>
                                  <div className="text-emerald-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: q.explanation }}></div>
                                  {q.citation && <div className="mt-2 text-[8pt] text-blue-600 font-bold uppercase tracking-widest">🔍 Ref: {q.citation}</div>}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="mt-12 pt-4 border-t border-gray-100 text-[8pt] text-gray-300 italic flex justify-between uppercase font-bold tracking-widest no-print">
            <span>GenZ QuizGen Pro v3.1 AI Neural</span>
            <span>ID: {quiz.id.substring(0,10).toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizViewer;
