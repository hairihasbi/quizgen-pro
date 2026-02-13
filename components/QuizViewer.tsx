
import React, { useEffect, useState, useMemo } from 'react';
import { Quiz, QuestionType, Question } from '../types';

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

  // 1. Urutkan soal berdasarkan urutan tipe standar agar penomoran tidak loncat
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

  // 2. Kelompokkan soal yang sudah diurutkan
  const groupedQuestions = useMemo(() => {
    const groups: Record<string, Question[]> = {};
    sortedQuestions.forEach(q => {
      if (!groups[q.type]) groups[q.type] = [];
      groups[q.type].push(q);
    });
    return groups;
  }, [sortedQuestions]);

  const getCognitiveLevelLabel = (level: string) => {
    if (!level) return '-';
    const l = level.toUpperCase();
    if (l.includes('C1') || l.includes('C2')) return 'L1';
    if (l.includes('C3')) return 'L2';
    if (l.includes('C4') || l.includes('C5') || l.includes('C6')) return 'L3 (HOTS)';
    return level;
  };

  const triggerMathJax = async (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el && (window as any).MathJax && (window as any).MathJax.typesetPromise) {
      try {
        await (window as any).MathJax.typesetPromise([el]);
      } catch (err) {
        console.warn("MathJax typeset failed", err);
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerMathJax('quiz-print-area');
    }, 300);
    return () => clearTimeout(timer);
  }, [quiz, showAnswer, exportMode, sortedQuestions]);

  const handleExportPdfClient = async () => {
    const element = document.getElementById('quiz-print-area');
    if (!element || !(window as any).html2pdf) {
      alert("Library PDF belum siap.");
      return;
    }

    setIsClientExporting(true);
    
    // Perbaikan: Tunggu rendering selesai
    await new Promise(r => setTimeout(r, 800));
    await triggerMathJax('quiz-print-area');
    
    const opt = {
      margin: [10, 10, 10, 10], // Atur margin agar tidak mepet
      filename: `${exportMode.toUpperCase()}_${quiz.title.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      // html2canvas diperkuat: Hilangkan blur dari capture & pastikan background putih
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true,
        backgroundColor: '#ffffff', // Paksa background putih
        logging: false,
        onclone: (clonedDoc: Document) => {
          // Hapus semua elemen modal wrapper yang punya backdrop blur di dokumen clone
          const modalWrapper = clonedDoc.querySelector('.print-modal-wrapper');
          if (modalWrapper) {
            (modalWrapper as HTMLElement).style.backdropFilter = 'none';
            (modalWrapper as HTMLElement).style.background = '#ffffff';
          }
        }
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: exportMode === 'kisi-kisi' ? 'landscape' : 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
      await (window as any).html2pdf().set(opt).from(element).save();
    } catch (err: any) {
      alert("Gagal export: " + err.message);
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
      a.download = `${exportMode.toUpperCase()}_${quiz.title.replace(/\s+/g, '_')}_Server.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Error Server: " + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  // Variable untuk melacak nomor urut global saat mapping
  let globalIndex = 0;

  return (
    <div className="fixed inset-0 bg-white md:bg-orange-50/98 backdrop-blur-3xl z-[500] flex flex-col p-4 md:p-8 animate-in zoom-in-95 duration-300 print-modal-wrapper" role="dialog">
      
      <header className="flex flex-col lg:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-2xl shadow-orange-100/50 mb-8 border border-orange-100 gap-6 no-print">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 orange-gradient rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg">📄</div>
          <div>
            <h2 className="font-black text-gray-800 uppercase text-xs tracking-tight truncate max-w-[280px]">{quiz.title}</h2>
            <div className="text-[9px] font-black text-orange-500 uppercase mt-1 tracking-widest">TAMPILAN: {exportMode.toUpperCase()}</div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex gap-1 bg-orange-50 p-1.5 rounded-2xl border border-orange-100">
             <button onClick={() => { setExportMode('soal'); setShowAnswer(false); }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'soal' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>BUTIR SOAL</button>
             <button onClick={() => { setExportMode('kisi-kisi'); setShowAnswer(false); }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'kisi-kisi' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>MATRIKS KISI-KISI</button>
             <button onClick={() => { setExportMode('lengkap'); setShowAnswer(true); }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'lengkap' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>KUNCI JAWABAN</button>
          </div>
          
          {!hideDownload && (
            <>
              <button onClick={handleExportPdfClient} disabled={isClientExporting} className="px-8 py-4 bg-orange-600 text-white rounded-2xl text-[10px] font-black shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50">
                {isClientExporting ? "⏳..." : "📥 PDF (Instan)"}
              </button>

              <button onClick={handleDownloadPdfSSR} disabled={isDownloading} className="px-8 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50">
                {isDownloading ? "☁️..." : "☁️ PDF (Engine)"}
              </button>
            </>
          )}

          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center text-orange-300 hover:text-red-500 bg-orange-100/50 rounded-full transition-colors font-bold">✕</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-0 md:p-12 flex justify-center custom-scrollbar print-scroll-container">
        {/* Konten Utama - Dibungkus white background solid agar PDF tidak hitam */}
        <div id="quiz-print-area" className={`bg-white print-container text-gray-900 shadow-none border-none ${exportMode === 'kisi-kisi' ? 'landscape-mode' : ''}`} style={{ backgroundColor: '#ffffff' }}>
          
          {/* Header Soal dibungkus div agar tidak gampang terpisah */}
          <div className="pdf-header-group" style={{ pageBreakInside: 'avoid' }}>
            <div className="text-center mb-1 relative z-10">
              <h1 className="text-xl font-black m-0 uppercase">NASKAH SOAL EVALUASI HASIL BELAJAR</h1>
              <h2 className="text-lg font-bold m-0 uppercase">{(quiz.subject || '').toUpperCase()} - {(quiz.grade || '').toUpperCase()}</h2>
              <p className="text-[9pt] font-medium text-gray-400 mt-1 uppercase tracking-widest">Kurikulum Merdeka • {quiz.level}</p>
            </div>
            
            <div className="border-t-[3px] border-b border-black h-[5px] mb-6 relative z-10"></div>

            {exportMode !== 'kisi-kisi' && (
              <div className="mb-6 relative z-10">
                <table className="w-full border-collapse text-[10.5pt]">
                  <tbody>
                    <tr>
                      <td className="w-32 py-1 font-bold">Nama Siswa</td><td className="w-4 py-1 text-center">:</td>
                      <td className="py-1 border-b border-gray-300 italic text-gray-300">......................................................................</td>
                      <td className="w-32 py-1 font-bold text-right">Hari / Tanggal</td><td className="w-4 py-1 text-center">:</td>
                      <td className="w-44 py-1 border-b border-gray-300 italic text-gray-300">..............................</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-bold">Kelas / No. Absen</td><td className="py-1 text-center">:</td>
                      <td className="py-1 border-b border-gray-300 italic text-gray-300">......................................................................</td>
                      <td className="py-1 font-bold text-right">Waktu Ujian</td><td className="py-1 text-center">:</td>
                      <td className="py-1 border-b border-gray-300 italic text-gray-300">90 Menit</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-4 relative z-10">
            {exportMode === 'kisi-kisi' ? (
              <>
                <div className="text-[11pt] font-black underline uppercase mb-6 text-center">MATRIKS KISI-KISI PENULISAN SOAL</div>
                <table className="w-full border-collapse border-2 border-black text-[8.5pt]">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border-2 border-black p-2 w-8 text-center">NO</th>
                      <th className="border-2 border-black p-2 w-48 text-left uppercase">CAPAIAN PEMBELAJARAN / KD</th>
                      <th className="border-2 border-black p-2 w-32 text-left uppercase">MATERI POKOK</th>
                      <th className="border-2 border-black p-2 text-left uppercase">INDIKATOR SOAL</th>
                      <th className="border-2 border-black p-2 w-20 text-center uppercase">LEVEL</th>
                      <th className="border-2 border-black p-2 w-24 text-center uppercase">BENTUK</th>
                      <th className="border-2 border-black p-2 w-12 text-center uppercase">NO</th>
                      <th className="border-2 border-black p-2 w-16 text-center uppercase">KUNCI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedQuestions.map((q, i) => (
                      <tr key={q.id}>
                        <td className="border-2 border-black p-2 text-center font-bold">{i + 1}</td>
                        <td className="border-2 border-black p-2 align-top text-justify">
                          {q.competency || `Menguasai standar kompetensi pada topik ${q.topic || quiz.topic}`}
                        </td>
                        <td className="border-2 border-black p-2 align-top font-bold">{q.topic || quiz.topic}</td>
                        <td className="border-2 border-black p-2 align-top text-justify">
                          <div dangerouslySetInnerHTML={{ __html: q.indicator }}></div>
                        </td>
                        <td className="border-2 border-black p-2 text-center font-bold">{getCognitiveLevelLabel(q.cognitiveLevel).split(' ')[0]}</td>
                        <td className="border-2 border-black p-2 text-center text-[8pt] uppercase">{q.type}</td>
                        <td className="border-2 border-black p-2 text-center font-bold">{i + 1}</td>
                        <td className="border-2 border-black p-2 text-center font-bold uppercase text-orange-600">
                          {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              (Object.entries(groupedQuestions) as [string, Question[]][]).map(([type, questions], gIdx) => (
                <div key={type} className="space-y-4">
                  <div className="bg-gray-100 px-6 py-1.5 border-y-2 border-black font-black text-[11pt] uppercase tracking-tighter" style={{ pageBreakInside: 'avoid' }}>
                    {String.fromCharCode(65 + gIdx)}. {type}
                  </div>
                  
                  <div className="space-y-2">
                    {questions.map((q, i) => {
                      globalIndex++; 
                      const isNewPassage = q.passage && (i === 0 || questions[i-1].passage !== q.passage);
                      
                      return (
                        <div key={q.id} className="pdf-block" style={{ pageBreakInside: 'avoid' }}>
                          {isNewPassage && (
                            <div className="bg-gray-50 border-2 border-black p-4 mb-4 italic text-[10.5pt] text-justify leading-relaxed relative" style={{ pageBreakInside: 'avoid' }}>
                              <div className="absolute top-0 left-4 -translate-y-1/2 bg-white px-2 text-[8pt] font-black uppercase border border-black tracking-widest">WACANA STIMULUS</div>
                              <div dangerouslySetInnerHTML={{ __html: q.passage! }}></div>
                            </div>
                          )}
                          <div className="flex gap-4 text-[11pt] leading-relaxed">
                            <div className="font-bold w-6 shrink-0 text-right">{globalIndex}.</div>
                            <div className="flex-1">
                              <div className="mb-1 text-justify" dangerouslySetInnerHTML={{ __html: q.text }}></div>
                              
                              {q.options && q.options.length > 0 && (
                                <div className="grid grid-cols-2 gap-x-10 gap-y-0.5 mb-2 ml-1">
                                  {q.options.map(opt => (
                                    <div key={opt.label} className="flex gap-2.5 items-start">
                                      <span className="font-bold w-4 shrink-0">{opt.label}.</span>
                                      <span className="text-justify" dangerouslySetInnerHTML={{ __html: opt.text }}></span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {(exportMode === 'lengkap' || showAnswer) && (
                                <div className="bg-emerald-50 border-2 border-emerald-200 p-4 rounded-2xl text-[9.5pt] italic mt-2 shadow-sm" style={{ pageBreakInside: 'avoid' }}>
                                  <div className="flex flex-col gap-1 mb-1">
                                     <div className="flex items-center gap-3">
                                        <span className="bg-emerald-600 text-white px-3 py-0.5 rounded-full text-[8pt] font-black not-italic uppercase tracking-widest">KUNCI: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</span>
                                        {q.citation && (
                                          <span className="bg-blue-600 text-white px-3 py-0.5 rounded-full text-[8pt] font-black not-italic uppercase tracking-widest flex items-center gap-1">
                                            🔍 Sitasi: {q.citation}
                                          </span>
                                        )}
                                     </div>
                                  </div>
                                  <div className="text-emerald-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: q.explanation }}></div>
                                </div>
                              )}
                              
                              {exportMode === 'soal' && !showAnswer && type !== 'Pilihan Ganda' && (
                                <div className="border-b border-dotted border-gray-300 h-12 w-full mt-2 opacity-30"></div>
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
          
          <div className="mt-8 pt-2 border-t border-gray-100 text-[8pt] text-gray-400 italic flex justify-between relative z-10 no-print">
            <span>GenZ QuizGen Pro - AI Powered Engine v3.1</span>
            <span className="font-bold text-gray-300 select-none">DIGITAL_FINGERPRINT: {(quiz.id || '').toUpperCase()}</span>
          </div>

          <div style={{ position: 'absolute', bottom: '2mm', left: '2mm', fontSize: '1px', color: 'rgba(0,0,0,0.01)', userSelect: 'none', pointerEvents: 'none' }}>
             Authored by {quiz.authorName} via GenZ QuizGen Pro System ID {quiz.id}. Plagiarism is strictly prohibited.
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizViewer;
