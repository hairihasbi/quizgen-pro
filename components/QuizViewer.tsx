
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
  const [isClientExporting, setIsClientExporting] = useState(false);

  // Fungsi pembantu untuk merender ulang rumus
  const triggerMathJax = async (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el && (window as any).MathJax && (window as any).MathJax.typesetPromise) {
      try {
        await (window as any).MathJax.typesetPromise([el]);
        // Beri jeda paint kecil agar browser menggambar SVG ke layer bitmap
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.warn("MathJax typeset failed", err);
      }
    }
  };

  useEffect(() => {
    // Jalankan typesetting setiap kali mode atau data berubah
    const timer = setTimeout(() => {
      triggerMathJax('quiz-print-area');
    }, 300);
    return () => clearTimeout(timer);
  }, [quiz, showAnswer, exportMode]);

  const handleExportPdfClient = async () => {
    const element = document.getElementById('quiz-print-area');
    if (!element || !(window as any).html2pdf) {
      alert("Library PDF belum siap, silakan tunggu sebentar.");
      return;
    }

    // 1. Tampilkan state loading (ini memicu re-render React)
    setIsClientExporting(true);

    // 2. TUNGGU React selesai rendering (penting!)
    // Tanpa jeda ini, MathJax akan mencoba merender DOM yang sedang diupdate React
    await new Promise(r => setTimeout(r, 600));

    // 3. Paksa MathJax render ulang teks mentah yang mungkin muncul akibat re-render di step 1
    await triggerMathJax('quiz-print-area');
    
    const opt = {
      margin: 10,
      filename: `Quiz_${quiz.title.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        letterRendering: true,
        logging: false,
        // Pastikan font-font khusus tetap terjaga
        fontFamily: 'Plus Jakarta Sans, Noto Serif, Arial'
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // 4. Jalankan konversi ke PDF
    try {
      await (window as any).html2pdf().set(opt).from(element).save();
    } catch (err: any) {
      console.error(err);
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
          quiz, 
          showAnswer: exportMode === 'lengkap' || showAnswer 
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Gagal generate PDF.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quiz_${quiz.title.replace(/\s+/g, '_')}_SSR.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Error Server: " + err.message);
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
            <div className="text-[9px] font-black text-orange-500 uppercase mt-1 tracking-widest">PREVIEW: {exportMode.toUpperCase()}</div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex gap-1 bg-orange-50 p-1.5 rounded-2xl border border-orange-100">
             <button onClick={() => { setExportMode('soal'); setShowAnswer(false); }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'soal' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>SOAL</button>
             <button onClick={() => { setExportMode('kisi-kisi'); setShowAnswer(false); }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'kisi-kisi' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>KISI-KISI</button>
             <button onClick={() => { setExportMode('lengkap'); setShowAnswer(true); }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'lengkap' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>KUNCI JAWABAN</button>
          </div>
          
          <button 
            onClick={handleExportPdfClient} 
            disabled={isClientExporting} 
            className="px-8 py-4 bg-orange-600 text-white rounded-2xl text-[10px] font-black shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3 disabled:opacity-50"
          >
            {isClientExporting ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              <><span>📥</span><span>Export PDF</span></>
            )}
          </button>

          <button 
            onClick={handleDownloadPdfSSR} 
            disabled={isDownloading} 
            className="px-8 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3 disabled:opacity-50"
          >
            {isDownloading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              <><span>☁️</span><span>PDF (Server)</span></>
            )}
          </button>

          <button onClick={() => window.print()} className="px-8 py-4 orange-gradient text-white rounded-2xl text-[10px] font-black shadow-xl hover:scale-105 transition-all">🖨️ Cetak</button>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center text-orange-300 hover:text-red-500 bg-orange-100/50 rounded-full transition-colors font-bold">✕</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-0 md:p-12 flex justify-center custom-scrollbar print-scroll-container">
        <div id="quiz-print-area" className="print-container bg-white text-gray-900 shadow-none border-none">
          
          {/* Header Identitas */}
          <div className="text-center mb-1">
            <h1 className="text-xl font-black m-0" style={{fontFamily: 'Plus Jakarta Sans'}}>BANK SOAL KURIKULUM MERDEKA</h1>
            <h2 className="text-lg font-bold m-0" style={{fontFamily: 'Plus Jakarta Sans'}}>{quiz.subject.toUpperCase()} - {quiz.grade.toUpperCase()}</h2>
            <div className="text-[9pt] font-medium tracking-widest text-gray-500 uppercase mt-1">Evaluasi Capaian Pembelajaran 2024/2025</div>
          </div>
          
          <div className="border-t-[3px] border-b border-black h-[5px] mb-6"></div>

          <table className="w-full mb-8 text-[10.5pt] font-bold border-collapse">
            <tbody>
              <tr>
                <td className="w-32 py-1">Mata Pelajaran</td><td className="w-4 py-1 text-center">:</td><td className="py-1">{quiz.subject}</td>
                <td className="w-32 py-1 text-right">Waktu</td><td className="w-4 py-1 text-center">:</td><td className="w-32 py-1">90 Menit</td>
              </tr>
              <tr>
                <td className="py-1">Jenjang / Kelas</td><td className="py-1 text-center">:</td><td className="py-1">{quiz.level} / {quiz.grade}</td>
                <td className="py-1 text-right">Target</td><td className="py-1 text-center">:</td><td className="py-1">{quiz.questions.length} Butir Soal</td>
              </tr>
              <tr>
                <td className="py-1">Topik Pembelajaran</td><td className="py-1 text-center">:</td><td className="py-1" colSpan={4}>{quiz.topic}</td>
              </tr>
            </tbody>
          </table>

          <div className="text-[11pt] font-black underline uppercase mb-6 text-center" style={{fontFamily: 'Plus Jakarta Sans'}}>
            {exportMode === 'kisi-kisi' ? 'KISI-KISI PENULISAN SOAL EVALUASI' : 'URAIAN BUTIR SOAL'}
          </div>

          <div className="space-y-8">
            {exportMode === 'kisi-kisi' ? (
              <table className="w-full border-collapse border-2 border-black text-[8.5pt]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border-2 border-black p-2 w-8 text-center uppercase">No</th>
                    <th className="border-2 border-black p-2 w-44 text-left uppercase">Lingkup Materi</th>
                    <th className="border-2 border-black p-2 text-left uppercase">Indikator Pencapaian Soal</th>
                    <th className="border-2 border-black p-2 w-16 text-center uppercase">Level</th>
                    <th className="border-2 border-black p-2 w-24 text-center uppercase">Bentuk</th>
                    <th className="border-2 border-black p-2 w-12 text-center uppercase">No Soal</th>
                    <th className="border-2 border-black p-2 w-16 text-center uppercase">Kunci</th>
                  </tr>
                </thead>
                <tbody>
                  {quiz.questions.map((q, i) => (
                    <tr key={q.id}>
                      <td className="border-2 border-black p-2 text-center font-bold">{i + 1}</td>
                      <td className="border-2 border-black p-2 align-top">
                        <div className="font-bold text-gray-800">{q.topic || quiz.topic}</div>
                      </td>
                      <td className="border-2 border-black p-2 align-top text-justify">
                        <div dangerouslySetInnerHTML={{ __html: q.indicator }}></div>
                      </td>
                      <td className="border-2 border-black p-2 text-center font-bold uppercase">{q.cognitiveLevel?.split(' - ')[0] || q.cognitiveLevel}</td>
                      <td className="border-2 border-black p-2 text-center text-[8pt] uppercase">{q.type}</td>
                      <td className="border-2 border-black p-2 text-center font-bold">{i + 1}</td>
                      <td className="border-2 border-black p-2 text-center font-bold uppercase text-orange-600">
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
                  <div key={q.id} className="pdf-block" style={{ pageBreakInside: 'avoid' }}>
                    {isNewPassage && (
                      <div className="bg-gray-50 border-2 border-black p-5 mb-6 italic text-[10.5pt] text-justify leading-relaxed relative">
                        <div className="absolute top-0 left-4 -translate-y-1/2 bg-white px-2 text-[8pt] font-black uppercase border border-black tracking-widest">STIMULUS WACANA</div>
                        <div dangerouslySetInnerHTML={{ __html: q.passage! }}></div>
                      </div>
                    )}
                    <div className="flex gap-4 text-[11.5pt] leading-relaxed">
                      <div className="font-bold w-6 shrink-0 text-right">{i + 1}.</div>
                      <div className="flex-1">
                        <div className="mb-4 text-justify" dangerouslySetInnerHTML={{ __html: q.text }}></div>
                        
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-1 gap-2 mb-6 ml-1">
                            {q.options.map(opt => (
                              <div key={opt.label} className="flex gap-3 items-start">
                                <span className="font-bold w-5 shrink-0">{opt.label}.</span>
                                <span dangerouslySetInnerHTML={{ __html: opt.text }}></span>
                              </div>
                            ))}
                          </div>
                        )}

                        {(exportMode === 'lengkap' || showAnswer) && (
                          <div className="bg-emerald-50 border-2 border-emerald-200 p-5 rounded-3xl text-[9.5pt] italic mt-4 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                               <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[8pt] font-black not-italic uppercase tracking-widest">KUNCI: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</span>
                            </div>
                            <div className="text-emerald-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: q.explanation }}></div>
                          </div>
                        )}
                        
                        {exportMode === 'soal' && !showAnswer && (
                          <div className="border-b-2 border-dotted border-gray-300 h-1 w-full opacity-30 mt-6"></div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="mt-16 pt-4 border-t border-gray-100 text-[8pt] text-gray-400 italic flex justify-between no-print">
            <span>GenZ QuizGen Pro - AI Powered Academic Engine v3.1.0</span>
            <span>Doc ID: {quiz.id.substring(0,8).toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizViewer;
