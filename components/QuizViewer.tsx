
import React, { useEffect, useState, useMemo } from 'react';
import { Quiz, QuestionType, Question } from '../types';
import { Printer, Download, Cloud, X, FileText, CheckCircle2, TableProperties, Loader2 } from 'lucide-react';

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
    // Pemicu rendering KaTeX global
    if ((window as any).executeMath) {
        (window as any).executeMath('quiz-print-area');
    }
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
    
    // Pastikan matematika ter-render sebelum snapshot
    (window as any).executeMath('quiz-print-area');
    await new Promise(r => setTimeout(r, 1000));

    const isLandscape = exportMode === 'kisi-kisi';
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${quiz.title.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: isLandscape ? 'landscape' : 'portrait' }
    };

    try {
      await (window as any).html2pdf().set(opt).from(element).save();
    } finally {
      setIsClientExporting(false);
    }
  };

  let globalIndex = 0;

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-3xl z-[500] flex flex-col p-4 md:p-8 animate-in zoom-in-95 duration-300 print-modal-wrapper">
      <header className="flex flex-col lg:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-2xl mb-8 border border-gray-100 gap-6 no-print">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 orange-gradient rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg">📄</div>
          <div>
            <h2 className="font-black text-gray-800 uppercase text-xs tracking-tight truncate max-w-[280px]">{quiz.title}</h2>
            <div className="text-[9px] font-black text-orange-500 uppercase mt-1 tracking-widest">{exportMode} VIEW</div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-orange-50 p-1.5 rounded-2xl border border-orange-100">
             <button onClick={() => setExportMode('soal')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'soal' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300'}`}>NASKAH</button>
             <button onClick={() => setExportMode('kisi-kisi')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'kisi-kisi' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300'}`}>KISI-KISI</button>
             <button onClick={() => { setExportMode('lengkap'); setShowAnswer(true); }} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'lengkap' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300'}`}>PEMBAHASAN</button>
          </div>
          {!hideDownload && (
            <button onClick={handleExportPdfClient} disabled={isClientExporting} className="px-6 py-4 bg-orange-600 text-white rounded-2xl text-[10px] font-black shadow-lg flex items-center gap-2">
              {isClientExporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              PDF INSTAN
            </button>
          )}
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center text-gray-300 hover:text-red-500 bg-gray-100 rounded-full transition-colors font-bold">✕</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto flex justify-center custom-scrollbar p-0 md:p-8">
        <div id="quiz-print-area" className={`print-container ${exportMode === 'kisi-kisi' ? 'w-[297mm]' : ''}`}>
          <div className="text-center mb-8">
            <h1 className="text-xl font-black uppercase underline">NASKAH EVALUASI BELAJAR</h1>
            <h2 className="text-lg font-bold uppercase">{quiz.subject} - {quiz.grade}</h2>
            <div className="border-b-[3px] border-black mt-2"></div>
          </div>

          <div className="space-y-10">
            {exportMode === 'kisi-kisi' ? (
              <table className="w-full border-collapse border border-black text-[9pt]">
                 <thead>
                    <tr className="bg-gray-100">
                       <th className="border border-black p-2 w-10">NO</th>
                       <th className="border border-black p-2">INDIKATOR</th>
                       <th className="border border-black p-2 w-20">LEVEL</th>
                       <th className="border border-black p-2 w-32">BENTUK</th>
                       <th className="border border-black p-2 w-20">KUNCI</th>
                    </tr>
                 </thead>
                 <tbody>
                    {sortedQuestions.map((q, i) => (
                      <tr key={q.id}>
                        <td className="border border-black p-2 text-center">{i+1}</td>
                        <td className="border border-black p-2">{q.indicator}</td>
                        <td className="border border-black p-2 text-center font-bold">{q.cognitiveLevel}</td>
                        <td className="border border-black p-2 text-center">{q.type}</td>
                        <td className="border border-black p-2 text-center font-black text-orange-600">{Array.isArray(q.answer) ? q.answer.join(',') : q.answer}</td>
                      </tr>
                    ))}
                 </tbody>
              </table>
            ) : (
              sortedQuestions.map((q, i) => {
                globalIndex++;
                const isNewPassage = q.passage && (i === 0 || sortedQuestions[i-1].passage !== q.passage);
                return (
                  <div key={q.id} className="pdf-block mb-10">
                    {isNewPassage && (
                      <div className="bg-gray-50 border-2 border-black p-6 mb-6 italic text-sm text-justify leading-relaxed">
                        <span className="font-black block mb-2 underline uppercase">Wacana Stimulus:</span>
                        {q.passage}
                      </div>
                    )}
                    <div className="flex gap-4">
                       <div className="font-bold">{globalIndex}.</div>
                       <div className="flex-1">
                          <div className="font-bold text-justify mb-4">{q.text}</div>
                          {q.image && <img src={q.image} className="max-w-md rounded-xl border mb-6" alt="Stimulus" />}
                          {q.options && (
                            <div className="grid grid-cols-2 gap-4 ml-2">
                               {q.options.map(opt => (
                                 <div key={opt.label} className="flex gap-3 items-start">
                                    <span className={`w-5 h-5 flex items-center justify-center border border-black text-[9px] font-black shrink-0 ${q.type === QuestionType.COMPLEX_MCQ ? 'rounded-none' : 'rounded-full'}`}>
                                       {opt.label}
                                    </span>
                                    <span className="text-sm">{opt.text}</span>
                                 </div>
                               ))}
                            </div>
                          )}
                          {(showAnswer || exportMode === 'lengkap') && (
                            <div className="mt-6 p-6 bg-emerald-50 border-2 border-dashed border-emerald-300 rounded-3xl text-sm italic">
                               <div className="font-black text-emerald-800 uppercase mb-1">Kunci: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</div>
                               <div className="text-emerald-700">{q.explanation}</div>
                            </div>
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
