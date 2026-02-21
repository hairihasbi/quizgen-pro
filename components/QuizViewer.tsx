
import React, { useEffect, useState, useMemo } from 'react';
import { Quiz, QuestionType } from '../types';
import { Download, CheckCircle2, Loader2, Printer } from 'lucide-react';

interface QuizViewerProps {
  quiz: Quiz;
  onClose: () => void;
  hideDownload?: boolean;
}

const QuizViewer: React.FC<QuizViewerProps> = ({ quiz, onClose, hideDownload = false }) => {
  const [showAnswer, setShowAnswer] = useState(false);
  const [exportMode, setExportMode] = useState<'soal' | 'kisi-kisi' | 'lengkap'>('soal');
  const [isClientExporting, setIsClientExporting] = useState(false);

  useEffect(() => {
    // Force render visual (KaTeX & Images) saat mode berubah
    const timer = setTimeout(() => {
        if ((window as any).executeMath) {
            (window as any).executeMath(document.getElementById('quiz-print-area'));
        }
    }, 300);
    return () => clearTimeout(timer);
  }, [quiz, showAnswer, exportMode]);

  const sortedQuestions = useMemo(() => {
    const typeOrder = [
      QuestionType.MCQ,
      QuestionType.COMPLEX_MCQ,
      QuestionType.TRUE_FALSE,
      QuestionType.SHORT_ANSWER,
      QuestionType.ESSAY
    ];
    return [...quiz.questions].sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
  }, [quiz.questions]);

  const handleExportPdfClient = async () => {
    const element = document.getElementById('quiz-print-area');
    if (!element) return;
    setIsClientExporting(true);
    
    // Memberi waktu tambahan bagi Puppeteer/html2pdf untuk menangkap gambar base64
    await new Promise(r => setTimeout(r, 1500));

    const isLandscape = exportMode === 'kisi-kisi';
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${quiz.title.replace(/\s+/g, '_')}_GenZ.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true,
        allowTaint: true,
        logging: false
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: isLandscape ? 'landscape' : 'portrait' }
    };

    try {
      await (window as any).html2pdf().set(opt).from(element).save();
    } catch (e) {
      console.error("PDF Export Fail:", e);
    } finally {
      setIsClientExporting(false);
    }
  };

  let globalIndex = 0;

  return (
    <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-2xl z-[500] flex flex-col p-4 md:p-8 animate-in zoom-in-95 duration-300 print-modal-wrapper" role="dialog">
      <header className="flex flex-col lg:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-2xl mb-8 border border-orange-100 gap-6 no-print">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 orange-gradient rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg">📄</div>
          <div>
            <h2 className="font-black text-gray-800 uppercase text-xs tracking-tight truncate max-w-[280px]">{quiz.title}</h2>
            <div className="text-[9px] font-black text-orange-500 uppercase mt-1 tracking-widest">{exportMode} VIEW</div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-orange-50 p-1.5 rounded-2xl border border-orange-100">
             <button onClick={() => { setExportMode('soal'); setShowAnswer(false); }} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'soal' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>NASKAH</button>
             <button onClick={() => { setExportMode('kisi-kisi'); setShowAnswer(false); }} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'kisi-kisi' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>KISI-KISI</button>
             <button onClick={() => { setExportMode('lengkap'); setShowAnswer(true); }} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'lengkap' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>PEMBAHASAN</button>
          </div>
          {!hideDownload && (
            <div className="flex gap-2">
               <button onClick={() => window.print()} className="p-4 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all"><Printer size={18} /></button>
               <button onClick={handleExportPdfClient} disabled={isClientExporting} className="px-8 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black shadow-xl hover:bg-orange-600 transition-all flex items-center gap-3 disabled:opacity-50">
                {isClientExporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                CETAK PDF
               </button>
            </div>
          )}
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center text-gray-300 hover:text-rose-500 bg-gray-50 rounded-full transition-colors font-bold ml-2">✕</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto flex justify-center custom-scrollbar p-0 md:p-8">
        <div id="quiz-print-area" className={`print-container ${exportMode === 'kisi-kisi' ? 'w-[297mm]' : 'w-[210mm]'}`} style={{ backgroundColor: 'white' }}>
          <div className="text-center mb-10">
            <h1 className="text-2xl font-black uppercase underline tracking-tighter">NASKAH EVALUASI HASIL BELAJAR</h1>
            <h2 className="text-lg font-bold uppercase">{quiz.subject} - {quiz.grade}</h2>
            <div className="border-b-[3px] border-black mt-3 h-1"></div>
            <div className="border-b border-black mt-1"></div>
          </div>

          <div className="space-y-12">
            {exportMode === 'kisi-kisi' ? (
              <div className="animate-in fade-in">
                <div className="text-center font-black text-sm uppercase mb-4 underline">MATRIKS KISI-KISI DAN KUNCI JAWABAN</div>
                <table className="w-full border-collapse border-[1.5px] border-black text-[9pt]">
                   <thead>
                      <tr className="bg-gray-100">
                         <th className="border-[1.5px] border-black p-3 w-10 text-center uppercase font-black">NO</th>
                         <th className="border-[1.5px] border-black p-3 text-left uppercase font-black">INDIKATOR SOAL</th>
                         <th className="border-[1.5px] border-black p-3 w-20 text-center uppercase font-black">LEVEL</th>
                         <th className="border-[1.5px] border-black p-3 w-32 text-center uppercase font-black">BENTUK</th>
                         <th className="border-[1.5px] border-black p-3 w-20 text-center uppercase font-black">KUNCI</th>
                      </tr>
                   </thead>
                   <tbody>
                      {sortedQuestions.map((q, i) => (
                        <tr key={q.id}>
                          <td className="border-[1.5px] border-black p-3 text-center font-bold">{i+1}</td>
                          <td className="border-[1.5px] border-black p-3 italic leading-relaxed">Disajikan {q.type.toLowerCase()}, peserta didik dapat {q.indicator}</td>
                          <td className="border-[1.5px] border-black p-3 text-center font-black uppercase">{q.cognitiveLevel?.split(' ')[0] || 'L2'}</td>
                          <td className="border-[1.5px] border-black p-3 text-center font-bold uppercase">{q.type}</td>
                          <td className="border-[1.5px] border-black p-3 text-center font-black text-orange-600">
                            {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}
                          </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
              </div>
            ) : (
              sortedQuestions.map((q, i) => {
                globalIndex++;
                const isNewPassage = q.passage && (i === 0 || sortedQuestions[i-1].passage !== q.passage);
                return (
                  <div key={q.id} className="pdf-block mb-12">
                    {isNewPassage && (
                      <div className="bg-gray-50 border-[1.5px] border-black p-8 mb-8 italic text-sm text-justify leading-relaxed relative">
                        <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 font-black text-[8pt] border border-black uppercase tracking-widest">Wacana Stimulus</div>
                        <div dangerouslySetInnerHTML={{ __html: q.passage || '' }} />
                      </div>
                    )}
                    <div className="flex gap-5">
                       <div className="font-bold text-[11pt] w-6 shrink-0 text-right">{globalIndex}.</div>
                       <div className="flex-1">
                          <div className="font-bold text-justify mb-6 text-[11pt] leading-relaxed" dangerouslySetInnerHTML={{ __html: q.text }}></div>
                          {q.image && (
                             <div className="mb-8 p-4 bg-white border rounded-3xl shadow-sm inline-block">
                               <img 
                                 src={q.image} 
                                 crossOrigin="anonymous"
                                 className="max-w-md max-h-[80mm] rounded-2xl block" 
                                 alt="Stimulus Visual" 
                               />
                             </div>
                          )}
                          {q.options && (
                            <div className="grid grid-cols-2 gap-x-10 gap-y-4 ml-2">
                               {q.options.map(opt => (
                                 <div key={opt.label} className="flex gap-4 items-start group">
                                    <span className={`w-6 h-6 flex items-center justify-center border-[1.5px] border-black text-[10px] font-black shrink-0 transition-colors ${q.type === QuestionType.COMPLEX_MCQ ? 'rounded-lg bg-gray-50' : 'rounded-full'}`}>
                                       {opt.label}
                                    </span>
                                    <span className="text-[10pt] font-medium leading-snug" dangerouslySetInnerHTML={{ __html: opt.text }}></span>
                                 </div>
                               ))}
                            </div>
                          )}
                          {(showAnswer || exportMode === 'lengkap') && (
                            <div className="mt-8 p-8 bg-emerald-50 border-[1.5px] border-dashed border-emerald-300 rounded-[2.5rem] text-[10pt] italic shadow-sm">
                               <div className="font-black text-emerald-800 uppercase mb-2 flex items-center gap-2">
                                  <CheckCircle2 size={14} /> KUNCI: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}
                               </div>
                               <div className="text-emerald-700 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: q.explanation }}></div>
                            </div>
                          )}
                       </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="mt-20 pt-6 border-t border-gray-100 flex justify-between items-center no-print opacity-30">
            <div className="text-[9px] font-black uppercase tracking-[0.3em]">GenZ QuizGen Pro v3.1 Engine</div>
            <div className="text-[9px] font-black uppercase tracking-[0.3em]">Signature: {quiz.id.substring(0,8).toUpperCase()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizViewer;
