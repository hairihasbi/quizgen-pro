
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Quiz, QuestionType, HeaderConfig } from '../types';
import { Download, CheckCircle2, Loader2, Printer, Settings, Image as ImageIcon, FileText, Trash2, Upload } from 'lucide-react';

interface QuizViewerProps {
  quiz: Quiz;
  onClose: () => void;
  hideDownload?: boolean;
}

const QuizViewer: React.FC<QuizViewerProps> = ({ quiz, onClose, hideDownload = false }) => {
  const [showAnswer, setShowAnswer] = useState(false);
  const [exportMode, setExportMode] = useState<'soal' | 'kisi-kisi' | 'lengkap'>('soal');
  const [showGridAnswers, setShowGridAnswers] = useState(true);
  const [isTwoColumn, setIsTwoColumn] = useState(false);
  const [isClientExporting, setIsClientExporting] = useState(false);
  const [isHeaderSettingsOpen, setIsHeaderSettingsOpen] = useState(false);
  const [showIdentity, setShowIdentity] = useState(true);
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>({ type: 'default' });

  useEffect(() => {
    const saved = localStorage.getItem('quiz_header_config');
    if (saved) {
      try {
        setHeaderConfig(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load header config", e);
      }
    }
  }, []);

  const saveHeaderConfig = (config: HeaderConfig) => {
    setHeaderConfig(config);
    localStorage.setItem('quiz_header_config', JSON.stringify(config));
  };

  useEffect(() => {
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
    
    try {
      // 1. Render Ulang Matematika
      if ((window as any).executeMath) (window as any).executeMath(element);
      
      // 2. Pastikan Gambar Base64 Ter-decode Sempurna
      const images = Array.from(element.getElementsByTagName('img'));
      await Promise.all(images.map(img => {
        if (img.complete) return img.decode().catch(() => {});
        return new Promise((resolve) => {
          img.onload = () => img.decode().then(resolve).catch(resolve);
          img.onerror = resolve;
        });
      }));

      // Berikan jeda lebih panjang (4 detik) untuk memastikan semua aset siap
      await new Promise(r => setTimeout(r, 4000));

      const isLandscape = exportMode === 'kisi-kisi';
      
      const opt = {
        margin: 15, // Margin 1.5 cm (15mm) sesuai permintaan
        filename: `${quiz.title.replace(/\s+/g, '_')}_GenZ.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true, 
          allowTaint: false,
          letterRendering: true,
          scrollX: 0,
          scrollY: 0,
          windowWidth: isLandscape ? 1600 : 1100,
          imageTimeout: 20000,
          logging: false,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc: Document) => {
            // Reset body cloned document agar tidak ada offset
            clonedDoc.body.style.margin = '0';
            clonedDoc.body.style.padding = '0';
            
            const el = clonedDoc.getElementById('quiz-print-area');
            if (el) {
              el.style.margin = '0'; 
              // Lebar konten harus pas dengan area cetak (215mm - 30mm margin = 185mm)
              el.style.width = isLandscape ? '300mm' : '185mm'; 
              el.style.boxShadow = 'none';
              el.style.padding = '0'; 
              el.style.transform = 'none';
              el.style.position = 'relative';
              el.style.display = 'block';
              el.style.overflow = 'visible';
            }
          }
        },
        jsPDF: { 
          unit: 'mm', 
          format: [215, 330], // Ukuran kertas FOLIO
          orientation: isLandscape ? 'landscape' : 'portrait',
          compress: true 
        },
        pagebreak: { 
            mode: ['avoid-all', 'css', 'legacy'],
            before: '.page-break-before'
        }
      };

      // Jalankan Konversi
      await (window as any).html2pdf().set(opt).from(element).save();
      
    } catch (e) {
      console.error("PDF Export Fail:", e);
      alert("Gagal mengunduh. Pastikan koneksi stabil dan coba lagi.");
    } finally {
      setIsClientExporting(false);
    }
  };

  let globalIndex = 0;

  const content = (
    <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-3xl z-[500] flex flex-col p-4 md:p-8 animate-in zoom-in-95 duration-300 print-modal-wrapper" role="dialog">
      <header className="flex flex-col lg:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-2xl mb-8 border border-orange-100 gap-6 no-print">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 orange-gradient rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg">📄</div>
          <div>
            <h2 className="font-black text-gray-800 uppercase text-xs tracking-tight truncate max-w-[280px]">{quiz.title}</h2>
            <div className="text-[9px] font-black text-orange-500 uppercase mt-1 tracking-widest">{exportMode} PREVIEW</div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-orange-50 p-1.5 rounded-2xl border border-orange-100">
             <button onClick={() => { setExportMode('soal'); setShowAnswer(false); }} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'soal' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>NASKAH</button>
             <button onClick={() => { setExportMode('kisi-kisi'); setShowAnswer(false); }} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'kisi-kisi' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>KISI-KISI</button>
             <button onClick={() => { setExportMode('lengkap'); setShowAnswer(true); }} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${exportMode === 'lengkap' ? 'bg-white text-orange-600 shadow-md' : 'text-orange-300 hover:text-orange-400'}`}>PEMBAHASAN</button>
          </div>

          {exportMode === 'kisi-kisi' && (
            <div className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-2xl border border-orange-100">
               <input 
                 type="checkbox" 
                 id="toggle-grid-answers"
                 checked={showGridAnswers}
                 onChange={(e) => setShowGridAnswers(e.target.checked)}
                 className="w-4 h-4 accent-orange-500 cursor-pointer"
               />
               <label htmlFor="toggle-grid-answers" className="text-[10px] font-black text-orange-600 cursor-pointer uppercase">Tampil Kunci</label>
            </div>
          )}

          {exportMode !== 'kisi-kisi' && (
            <div className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-2xl border border-orange-100">
               <input 
                 type="checkbox" 
                 id="toggle-two-column"
                 checked={isTwoColumn}
                 onChange={(e) => setIsTwoColumn(e.target.checked)}
                 className="w-4 h-4 accent-orange-500 cursor-pointer"
               />
               <label htmlFor="toggle-two-column" className="text-[10px] font-black text-orange-600 cursor-pointer uppercase">2 Kolom</label>
            </div>
          )}

          {exportMode !== 'kisi-kisi' && (
            <div className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-2xl border border-orange-100">
               <input 
                 type="checkbox" 
                 id="toggle-identity"
                 checked={showIdentity}
                 onChange={(e) => setShowIdentity(e.target.checked)}
                 className="w-4 h-4 accent-orange-500 cursor-pointer"
               />
               <label htmlFor="toggle-identity" className="text-[10px] font-black text-orange-600 cursor-pointer uppercase">Identitas</label>
            </div>
          )}

          <button 
            onClick={() => setIsHeaderSettingsOpen(true)}
            className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-2xl border border-orange-100 text-[10px] font-black text-orange-600 hover:bg-orange-100 transition-all uppercase"
          >
            <Settings size={14} /> Atur Kop
          </button>
          
          {!hideDownload && (
            <div className="flex gap-2">
               <button onClick={() => window.print()} className="p-4 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all"><Printer size={18} /></button>
               <button onClick={handleExportPdfClient} disabled={isClientExporting} className="px-8 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black shadow-xl hover:bg-orange-600 transition-all flex items-center gap-3 disabled:opacity-50 min-w-[160px] justify-center">
                {isClientExporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                {isClientExporting ? 'SEDANG CETAK...' : 'UNDUH PDF'}
               </button>
            </div>
          )}
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center text-gray-300 hover:text-rose-500 bg-gray-50 rounded-full transition-colors font-bold ml-2">✕</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto flex justify-center custom-scrollbar p-0 md:p-8 bg-black/20 rounded-[3rem]">
        <div 
          id="quiz-print-area" 
          className={`print-container bg-white shadow-2xl relative ${exportMode === 'kisi-kisi' ? 'w-[300mm]' : 'w-[185mm]'}`} 
          style={{ color: 'black', margin: '0 auto' }}
        >
          {/* KOP SURAT PROFESIONAL */}
          {headerConfig.type === 'default' ? (
            <div className="text-center mb-10 border-b-[3.5px] border-black pb-4">
              <h1 className="text-2xl font-black uppercase tracking-tighter leading-none mb-2">NASKAH EVALUASI HASIL BELAJAR</h1>
              <h2 className="text-lg font-bold uppercase tracking-tight">{quiz.subject} - {quiz.grade}</h2>
              <div className="flex justify-between items-end mt-4 px-2">
                  <div className="text-left text-[9pt] font-bold uppercase italic">Evaluasi Hasil Belajar</div>
                  <div className="text-right text-[9pt] font-black border-2 border-black px-4 py-1 uppercase tracking-widest">UTAMA</div>
              </div>
            </div>
          ) : headerConfig.type === 'image' && headerConfig.imageUrl ? (
            <div className="mb-10">
              <img src={headerConfig.imageUrl} className="w-full block" alt="Kop Instansi" />
            </div>
          ) : headerConfig.type === 'template' && headerConfig.templateData ? (
            <div className="flex items-center gap-6 mb-8 border-b-[3.5px] border-black pb-6">
              {headerConfig.templateData.logoLeftUrl && (
                <img src={headerConfig.templateData.logoLeftUrl} className="w-24 h-24 object-contain" alt="Logo Kiri" />
              )}
              <div className="flex-1 text-center">
                <h1 className="text-xl font-black uppercase leading-tight mb-1">{headerConfig.templateData.schoolName}</h1>
                <p className="text-[10pt] font-bold leading-tight mb-1">{headerConfig.templateData.address}</p>
                <div className="flex justify-center gap-4 text-[9pt] font-medium italic">
                  {headerConfig.templateData.phone && <span>Telp: {headerConfig.templateData.phone}</span>}
                  {headerConfig.templateData.email && <span>Email: {headerConfig.templateData.email}</span>}
                  {headerConfig.templateData.website && <span>Web: {headerConfig.templateData.website}</span>}
                </div>
              </div>
              {headerConfig.templateData.logoRightUrl && (
                <img src={headerConfig.templateData.logoRightUrl} className="w-24 h-24 object-contain" alt="Logo Kanan" />
              )}
            </div>
          ) : (
             <div className="text-center mb-10 border-b-[3.5px] border-black pb-4">
              <h1 className="text-2xl font-black uppercase tracking-tighter leading-none mb-2">NASKAH EVALUASI HASIL BELAJAR</h1>
              <h2 className="text-lg font-bold uppercase tracking-tight">{quiz.subject} - {quiz.grade}</h2>
              <div className="flex justify-between items-end mt-4 px-2">
                  <div className="text-left text-[9pt] font-bold uppercase italic">Evaluasi Hasil Belajar</div>
                  <div className="text-right text-[9pt] font-black border-2 border-black px-4 py-1 uppercase tracking-widest">UTAMA</div>
              </div>
            </div>
          )}

          {/* BAGIAN IDENTITAS MURID */}
          {showIdentity && exportMode !== 'kisi-kisi' && (
            <div className="mb-10 border-b-[2px] border-black pb-6">
              <div className="grid grid-cols-2 gap-x-16 gap-y-4">
                <div className="flex items-end gap-3">
                  <span className="text-[10pt] font-bold w-28 shrink-0">Nama Murid</span>
                  <span className="text-[10pt] font-bold">:</span>
                  <div className="flex-1 border-b border-dotted border-black h-5"></div>
                </div>
                <div className="flex items-end gap-3">
                  <span className="text-[10pt] font-bold w-28 shrink-0">Mata Pelajaran</span>
                  <span className="text-[10pt] font-bold">:</span>
                  <div className="flex-1 border-b border-dotted border-black h-5 text-[10pt] font-bold px-1">{quiz.subject}</div>
                </div>
                <div className="flex items-end gap-3">
                  <span className="text-[10pt] font-bold w-28 shrink-0">Kelas</span>
                  <span className="text-[10pt] font-bold">:</span>
                  <div className="flex-1 border-b border-dotted border-black h-5 text-[10pt] font-bold px-1">{quiz.grade}</div>
                </div>
                <div className="flex items-end gap-3">
                  <span className="text-[10pt] font-bold w-28 shrink-0">Hari/ Tanggal</span>
                  <span className="text-[10pt] font-bold">:</span>
                  <div className="flex-1 border-b border-dotted border-black h-5"></div>
                </div>
              </div>
            </div>
          )}

          <div className={`space-y-12 ${isTwoColumn && exportMode !== 'kisi-kisi' ? 'columns-2' : ''}`}>
            {exportMode === 'kisi-kisi' ? (
              <div className="animate-in fade-in">
                <div className="text-center font-black text-sm uppercase mb-6 underline">MATRIKS KISI-KISI DAN KUNCI JAWABAN</div>
                <table className="w-full border-collapse border-[1.5px] border-black text-[9pt]">
                   <thead>
                      <tr className="bg-gray-100">
                         <th className="border-[1.5px] border-black p-3 w-10 text-center uppercase font-black">NO</th>
                         <th className="border-[1.5px] border-black p-3 text-left uppercase font-black">CAPAIAN PEMBELAJARAN</th>
                         <th className="border-[1.5px] border-black p-3 text-left uppercase font-black">INDIKATOR SOAL</th>
                         <th className="border-[1.5px] border-black p-3 w-20 text-center uppercase font-black">LEVEL</th>
                         <th className="border-[1.5px] border-black p-3 w-32 text-center uppercase font-black">BENTUK</th>
                         {showGridAnswers && <th className="border-[1.5px] border-black p-3 w-20 text-center uppercase font-black">KUNCI</th>}
                      </tr>
                   </thead>
                   <tbody>
                      {sortedQuestions.map((q, i) => (
                        <tr key={q.id}>
                          <td className="border-[1.5px] border-black p-3 text-center font-bold">{i+1}</td>
                          <td className="border-[1.5px] border-black p-3 text-left font-medium">{q.learningOutcome || '-'}</td>
                          <td className="border-[1.5px] border-black p-3 italic leading-relaxed">Disajikan {q.type.toLowerCase()}, peserta didik dapat {q.indicator}</td>
                          <td className="border-[1.5px] border-black p-3 text-center font-black uppercase">{q.cognitiveLevel?.split(' ')[0] || 'L2'}</td>
                          <td className="border-[1.5px] border-black p-3 text-center font-bold uppercase">{q.type}</td>
                          {showGridAnswers && (
                            <td className="border-[1.5px] border-black p-3 text-center font-black text-orange-600">
                              {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}
                            </td>
                          )}
                        </tr>
                      ))}
                   </tbody>
                </table>
              </div>
            ) : (
              sortedQuestions.map((q, i) => {
                globalIndex++;
                const normalize = (s?: string) => s?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || '';
                const isNewPassage = q.passage && (i === 0 || normalize(sortedQuestions[i-1].passage) !== normalize(q.passage));
                return (
                  <div key={q.id} className="pdf-block mb-10" style={{ pageBreakInside: 'avoid' }}>
                    {isNewPassage && (
                      <div className="bg-gray-50 border-[1.5px] border-black p-8 mb-8 italic text-[10.5pt] text-justify leading-relaxed relative">
                        <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 font-black text-[8pt] border border-black uppercase tracking-widest">Wacana Stimulus</div>
                        <div dangerouslySetInnerHTML={{ __html: q.passage || '' }} />
                      </div>
                    )}
                    <div className="flex gap-4">
                       <div className="font-bold text-[11pt] w-7 shrink-0 text-right">{globalIndex}.</div>
                       <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                             <span className="text-[7pt] font-black bg-black text-white px-2 py-0.5 rounded uppercase tracking-widest">{q.type}</span>
                             <span className="text-[7pt] font-bold text-gray-400 uppercase tracking-widest">{q.cognitiveLevel}</span>
                          </div>
                          <div className="font-bold text-justify mb-5 text-[11pt] leading-relaxed" dangerouslySetInnerHTML={{ __html: q.text }}></div>
                          
                          {q.image && (
                             <div className="mb-6 p-1 bg-white inline-block border border-gray-100 rounded-lg shadow-sm" style={{ maxWidth: '100%' }}>
                               <img 
                                 src={q.image} 
                                 crossOrigin="anonymous"
                                 className="max-w-full md:max-w-md max-h-[75mm] object-contain block" 
                                 alt="Visual Stimulus" 
                               />
                             </div>
                          )}

                          {/* Render Options based on type */}
                          {q.type === QuestionType.TRUE_FALSE ? (
                            <div className="grid grid-cols-2 gap-x-12 gap-y-3 ml-1">
                               <div className="flex gap-4 items-start">
                                  <span className="w-5 h-5 flex items-center justify-center border border-black rounded-full text-[9pt] font-black shrink-0">A</span>
                                  <span className="text-[10pt] font-medium leading-snug">Benar</span>
                               </div>
                               <div className="flex gap-4 items-start">
                                  <span className="w-5 h-5 flex items-center justify-center border border-black rounded-full text-[9pt] font-black shrink-0">B</span>
                                  <span className="text-[10pt] font-medium leading-snug">Salah</span>
                               </div>
                            </div>
                          ) : (q.type !== QuestionType.SHORT_ANSWER && q.type !== QuestionType.ESSAY && q.options) ? (
                            <div className="grid grid-cols-2 gap-x-12 gap-y-3 ml-1">
                               {q.options.map(opt => (
                                 <div key={opt.label} className="flex gap-4 items-start">
                                    <span className="w-5 h-5 flex items-center justify-center border border-black rounded-full text-[9pt] font-black shrink-0">
                                       {opt.label}
                                    </span>
                                    <span className="text-[10pt] font-medium leading-snug" dangerouslySetInnerHTML={{ __html: opt.text }}></span>
                                 </div>
                               ))}
                            </div>
                          ) : null}

                          {(showAnswer || exportMode === 'lengkap') && (
                            <div className="mt-6 p-6 bg-emerald-50 border-[1.2px] border-dashed border-emerald-400 rounded-3xl text-[10pt] italic shadow-inner" style={{ pageBreakInside: 'avoid' }}>
                               <div className="font-black text-emerald-800 uppercase mb-1 flex items-center gap-2">
                                  <CheckCircle2 size={14} /> JAWABAN: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}
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
          
          <div className="mt-24 pt-8 border-t border-gray-200 flex justify-between items-center opacity-30 no-print">
            <div className="text-[8px] font-black uppercase tracking-[0.4em]">GenZ QuizGen Pro Engine v3.1</div>
            <div className="text-[8px] font-black uppercase tracking-[0.4em]">Auth Sign: {quiz.id.substring(0,12).toUpperCase()}</div>
          </div>
        </div>
      </div>
      
      {isHeaderSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[600] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-orange-50/50">
              <div>
                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Pengaturan Kop Instansi</h3>
                <p className="text-xs text-gray-500 font-bold uppercase mt-1">Kustomisasi Header Naskah Soal</p>
              </div>
              <button onClick={() => setIsHeaderSettingsOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm hover:text-rose-500 transition-colors font-bold">✕</button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-3 gap-4">
                <button 
                  onClick={() => saveHeaderConfig({ ...headerConfig, type: 'default' })}
                  className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${headerConfig.type === 'default' ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-orange-200'}`}
                >
                  <FileText className={headerConfig.type === 'default' ? 'text-orange-500' : 'text-gray-400'} />
                  <span className="text-[10px] font-black uppercase">Default</span>
                </button>
                <button 
                  onClick={() => saveHeaderConfig({ ...headerConfig, type: 'image' })}
                  className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${headerConfig.type === 'image' ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-orange-200'}`}
                >
                  <ImageIcon className={headerConfig.type === 'image' ? 'text-orange-500' : 'text-gray-400'} />
                  <span className="text-[10px] font-black uppercase">Unggah Gambar</span>
                </button>
                <button 
                  onClick={() => saveHeaderConfig({ ...headerConfig, type: 'template' })}
                  className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${headerConfig.type === 'template' ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-orange-200'}`}
                >
                  <Settings className={headerConfig.type === 'template' ? 'text-orange-500' : 'text-gray-400'} />
                  <span className="text-[10px] font-black uppercase">Template</span>
                </button>
              </div>

              {headerConfig.type === 'image' && (
                <div className="space-y-4 animate-in slide-in-from-bottom-4">
                  <div className="border-2 border-dashed border-gray-200 rounded-3xl p-8 text-center hover:border-orange-300 transition-all relative">
                    {headerConfig.imageUrl ? (
                      <div className="space-y-4">
                        <img src={headerConfig.imageUrl} className="max-h-32 mx-auto rounded-lg shadow-md" alt="Preview Kop" />
                        <button 
                          onClick={() => saveHeaderConfig({ ...headerConfig, imageUrl: undefined })}
                          className="text-rose-500 text-[10px] font-black uppercase flex items-center gap-2 mx-auto hover:text-rose-600"
                        >
                          <Trash2 size={14} /> Hapus Gambar
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <Upload className="mx-auto text-gray-300 mb-2" size={32} />
                        <span className="text-[10px] font-black text-gray-400 uppercase">Klik untuk Unggah Kop (PNG/JPG)</span>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                saveHeaderConfig({ ...headerConfig, imageUrl: reader.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-[9px] text-gray-400 font-bold uppercase text-center italic">Disarankan menggunakan gambar dengan lebar minimal 1000px untuk hasil cetak tajam.</p>
                </div>
              )}

              {headerConfig.type === 'template' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 bg-gray-50 p-8 rounded-[2rem]">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Nama Instansi/Sekolah</label>
                      <input 
                        type="text" 
                        value={headerConfig.templateData?.schoolName || ''}
                        onChange={(e) => saveHeaderConfig({ ...headerConfig, templateData: { ...headerConfig.templateData!, schoolName: e.target.value } })}
                        placeholder="Contoh: SMA NEGERI 1 JAKARTA"
                        className="w-full px-5 py-3 rounded-2xl border border-gray-200 focus:border-orange-500 outline-none text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Telepon/Kontak</label>
                      <input 
                        type="text" 
                        value={headerConfig.templateData?.phone || ''}
                        onChange={(e) => saveHeaderConfig({ ...headerConfig, templateData: { ...headerConfig.templateData!, phone: e.target.value } })}
                        placeholder="021-xxxxxxx"
                        className="w-full px-5 py-3 rounded-2xl border border-gray-200 focus:border-orange-500 outline-none text-sm font-bold"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Alamat Lengkap</label>
                    <textarea 
                      value={headerConfig.templateData?.address || ''}
                      onChange={(e) => saveHeaderConfig({ ...headerConfig, templateData: { ...headerConfig.templateData!, address: e.target.value } })}
                      placeholder="Jl. Pendidikan No. 123, Kota..."
                      className="w-full px-5 py-3 rounded-2xl border border-gray-200 focus:border-orange-500 outline-none text-sm font-bold h-24 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Email</label>
                      <input 
                        type="text" 
                        value={headerConfig.templateData?.email || ''}
                        onChange={(e) => saveHeaderConfig({ ...headerConfig, templateData: { ...headerConfig.templateData!, email: e.target.value } })}
                        placeholder="info@sekolah.sch.id"
                        className="w-full px-5 py-3 rounded-2xl border border-gray-200 focus:border-orange-500 outline-none text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Website</label>
                      <input 
                        type="text" 
                        value={headerConfig.templateData?.website || ''}
                        onChange={(e) => saveHeaderConfig({ ...headerConfig, templateData: { ...headerConfig.templateData!, website: e.target.value } })}
                        placeholder="www.sekolah.sch.id"
                        className="w-full px-5 py-3 rounded-2xl border border-gray-200 focus:border-orange-500 outline-none text-sm font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Logo Instansi (Kiri)</label>
                      <div className="flex items-center gap-4">
                        {headerConfig.templateData?.logoLeftUrl ? (
                          <div className="relative group">
                            <img src={headerConfig.templateData.logoLeftUrl} className="w-16 h-16 rounded-xl object-contain border border-gray-200 bg-white p-1" alt="Logo Kiri" />
                            <button 
                              onClick={() => saveHeaderConfig({ ...headerConfig, templateData: { ...headerConfig.templateData!, logoLeftUrl: undefined } })}
                              className="absolute -top-2 -right-2 bg-rose-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                            >✕</button>
                          </div>
                        ) : (
                          <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-orange-400 transition-all bg-white">
                            <ImageIcon size={20} className="text-gray-300" />
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    saveHeaderConfig({ ...headerConfig, templateData: { ...headerConfig.templateData || { schoolName: '', address: '' }, logoLeftUrl: reader.result as string } });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        )}
                        <div className="text-[9px] text-gray-400 font-bold uppercase">Logo Dinas/Instansi.</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Logo Sekolah (Kanan)</label>
                      <div className="flex items-center gap-4">
                        {headerConfig.templateData?.logoRightUrl ? (
                          <div className="relative group">
                            <img src={headerConfig.templateData.logoRightUrl} className="w-16 h-16 rounded-xl object-contain border border-gray-200 bg-white p-1" alt="Logo Kanan" />
                            <button 
                              onClick={() => saveHeaderConfig({ ...headerConfig, templateData: { ...headerConfig.templateData!, logoRightUrl: undefined } })}
                              className="absolute -top-2 -right-2 bg-rose-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                            >✕</button>
                          </div>
                        ) : (
                          <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-orange-400 transition-all bg-white">
                            <ImageIcon size={20} className="text-gray-300" />
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    saveHeaderConfig({ ...headerConfig, templateData: { ...headerConfig.templateData || { schoolName: '', address: '' }, logoRightUrl: reader.result as string } });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        )}
                        <div className="text-[9px] text-gray-400 font-bold uppercase">Logo Sekolah/Unit.</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setIsHeaderSettingsOpen(false)}
                className="px-10 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black shadow-xl hover:bg-orange-600 transition-all uppercase tracking-widest"
              >Simpan & Tutup</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
            .print-container {
                padding: 10mm;
                min-height: 330mm;
            }
        }
        @media print {
          .pdf-block { break-inside: avoid !important; }
          img { max-width: 100% !important; height: auto !important; display: block !important; }
        }
        .print-container {
          box-sizing: border-box;
          font-family: 'Plus Jakarta Sans', sans-serif !important;
          background: white !important;
        }
        .columns-2 {
          column-count: 2;
          column-gap: 12mm;
          column-fill: auto;
        }
        .columns-2 > * {
          break-inside: avoid;
          display: block;
          width: 100%;
          margin-bottom: 8mm;
        }
      `}} />
    </div>
  );

  return createPortal(content, document.body);
};

export default QuizViewer;
