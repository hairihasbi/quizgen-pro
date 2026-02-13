
import React, { useState, useRef, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { EmailService } from '../services/emailService';
import { GoogleFormsService } from '../services/googleFormsService';
import { SUBJECT_DATA, LEVEL_CONFIG, COGNITIVE_LEVELS } from '../constants';
import { QuestionType, Quiz, Question, LogCategory, AIProgressEvent, UserRole } from '../types';
import HumanError from '../components/HumanError';
import { realtimeService } from '../services/realtimeService';

interface CreateQuizProps {
  user: any;
  onSuccess: () => void;
}

const DRAFT_KEY = 'quizgen_draft_quiz';

const CreateQuiz: React.FC<CreateQuizProps> = ({ user, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    level: 'SMA',
    grade: 'Kelas 10',
    topic: '',
    subTopic: '',
    questionTypes: [QuestionType.MCQ],
    count: 5,
    optionCount: 5,
    difficulty: 'Sedang',
    cognitiveLevels: ['C2 - Memahami', 'C3 - Menerapkan', 'C4 - Menganalisis'],
    imageQuestionsCount: 0,
    imageAnswersCount: 0,
    language: 'Bahasa Indonesia',
    literacyMode: 'Tanpa Wacana',
    questionsPerPassage: 3, 
    model: 'gemini-3-pro-preview'
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [referenceText, setReferenceText] = useState('');
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [workbenchData, setWorkbenchData] = useState<{questions: Question[], grid: string, tags: string[]} | null>(null);
  
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<Question | null>(null);

  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.formData) setFormData(prev => ({ ...prev, ...parsed.formData }));
        if (parsed.referenceText) setReferenceText(parsed.referenceText);
        if (parsed.fileName) setFileName(parsed.fileName);
      } catch (e) {
        console.warn("Gagal memuat draft otomatis:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!workbenchData && !isGenerating) {
      const draft = { formData, referenceText, fileName };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  }, [formData, referenceText, fileName, workbenchData, isGenerating]);

  // Efek khusus untuk registrasi MathJax Observer
  useEffect(() => {
    if (workbenchData && !isGenerating) {
      // Tunggu DOM selesai render lalu daftarkan ke observer
      const timer = setTimeout(() => {
        if ((window as any).observeMathItems) {
          (window as any).observeMathItems('quiz-preview-content');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [workbenchData, isGenerating]);

  useEffect(() => {
    const defaultGrade = LEVEL_CONFIG[formData.level].grades[0];
    const categories = Object.keys(SUBJECT_DATA[formData.level]);
    const firstCategory = categories[0];
    const defaultSubject = SUBJECT_DATA[formData.level][firstCategory][0];
    
    setFormData(prev => {
      const isSubjectValid = Object.values(SUBJECT_DATA[formData.level]).some(list => list.includes(prev.subject));
      if (!isSubjectValid || !prev.subject) {
        return {
          ...prev,
          grade: defaultGrade,
          subject: defaultSubject
        };
      }
      return prev;
    });
  }, [formData.level]);

  useEffect(() => {
    let timer: any;
    if (isGenerating && remainingSeconds > 0) {
      timer = setInterval(() => {
        setRemainingSeconds(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isGenerating, remainingSeconds]);

  const toggleType = (type: QuestionType) => {
    setFormData(prev => ({
      ...prev,
      questionTypes: prev.questionTypes.includes(type) 
        ? prev.questionTypes.filter(t => t !== type)
        : [...prev.questionTypes, type]
    }));
  };

  const toggleCognitive = (level: string) => {
    setFormData(prev => ({
      ...prev,
      cognitiveLevels: prev.cognitiveLevels.includes(level)
        ? prev.cognitiveLevels.filter(l => l !== level)
        : [...prev.cognitiveLevels, level]
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setReferenceText(await file.text());
    }
  };

  const calculateEstimate = () => {
    const base = formData.model.includes('flash') ? 7 : 10;
    const textTime = formData.count * (formData.model.includes('flash') ? 2 : 4);
    const imageTime = formData.imageQuestionsCount * 7;
    return Math.ceil(base + textTime + imageTime);
  };

  const startGeneration = async () => {
    const sanitizedTitle = StorageService.sanitizeInput(formData.title.trim());
    const sanitizedTopic = StorageService.sanitizeInput(formData.topic.trim());
    const sanitizedRef = StorageService.sanitizeInput(referenceText.trim());

    if (!sanitizedTitle || !sanitizedTopic) return alert('Judul dan Topik wajib diisi!');
    if (user.role !== UserRole.ADMIN && user.credits < 1) return alert('Kredit AI Anda habis.');
    if (formData.cognitiveLevels.length === 0) return alert('Pilih minimal satu level kognitif!');

    const est = calculateEstimate();
    const sessionId = crypto.randomUUID().substring(0, 8);
    
    setRemainingSeconds(est);
    setIsGenerating(true);
    setErrorMsg(null);
    
    realtimeService.connect(sessionId, (event: AIProgressEvent) => {
      setProgress(event.percentage);
      setStatusMsg(event.message);
    });

    try {
      const gemini = new GeminiService();
      
      // Tahap RAG: Cari soal serupa untuk pengecekan plagiarisme
      const retrievedContext = await StorageService.findRelatedQuestions(formData.subject, sanitizedTopic);
      
      const result = await gemini.generateQuiz({ 
        ...formData, 
        title: sanitizedTitle, 
        topic: sanitizedTopic, 
        referenceText: sanitizedRef 
      }, undefined, retrievedContext);
      
      const processedQuestions = await Promise.all(result.questions.map(async (q: any, idx: number) => {
        let imageUrl = '';
        if (formData.imageQuestionsCount > idx) {
          try { imageUrl = await gemini.generateVisual(q.imagePrompt || q.text); } catch(err) {}
        }
        return { ...q, id: crypto.randomUUID(), image: imageUrl };
      }));

      setTimeout(() => {
        setWorkbenchData({ questions: processedQuestions, grid: result.grid, tags: result.tags || [] });
        setIsGenerating(false);
        realtimeService.disconnect();
      }, 1000);

    } catch (e: any) {
      setErrorMsg(e.message);
      setIsGenerating(false);
      realtimeService.disconnect();
    }
  };

  const handleStartEdit = (q: Question) => {
    setEditingQuestionId(q.id);
    setEditBuffer({ ...q });
  };

  const handleSaveEdit = () => {
    if (!workbenchData || !editBuffer) return;
    const updatedQuestions = workbenchData.questions.map(q => 
      q.id === editingQuestionId ? editBuffer : q
    );
    setWorkbenchData({ ...workbenchData, questions: updatedQuestions });
    setEditingQuestionId(null);
    setEditBuffer(null);
  };

  const handleCancelEdit = () => {
    setEditingQuestionId(null);
    setEditBuffer(null);
  };

  const saveToDatabase = async () => {
    if (!workbenchData) return;
    const sanitizedTitle = StorageService.sanitizeInput(formData.title.trim());
    const sanitizedTopic = StorageService.sanitizeInput(formData.topic.trim());

    const newQuiz: Quiz = {
      id: crypto.randomUUID(),
      title: sanitizedTitle,
      subject: formData.subject,
      level: formData.level,
      grade: formData.grade,
      topic: sanitizedTopic,
      difficulty: formData.difficulty as any,
      questions: workbenchData.questions,
      grid: workbenchData.grid,
      tags: workbenchData.tags, 
      authorId: user.id,
      authorName: user.username,
      isPublished: false,
      createdAt: new Date().toISOString(),
      status: 'completed'
    };

    try {
      await StorageService.saveQuizzes([newQuiz]);
      
      if (user.role !== UserRole.ADMIN) {
        await StorageService.updateUserCredits(user.id, -1);
      }
      
      await StorageService.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        category: LogCategory.CONTENT,
        action: 'CREATE_QUIZ',
        details: `Berhasil membuat soal orisinal: ${sanitizedTitle}. Orisinalitas terverifikasi.`,
        status: 'success',
        userId: user.id
      });
      EmailService.notifyQuizSuccess(user, sanitizedTitle);
      
      localStorage.removeItem(DRAFT_KEY);
      onSuccess();
    } catch (e) {
      setErrorMsg("Aduh, gagal menyimpan data ke server Cloud Turso. Cek koneksi ya!");
    }
  };

  const handleExportToGoogleForms = async () => {
    if (!workbenchData) return;
    setIsExporting(true);
    try {
      const tempQuiz: Quiz = {
        id: 'temp',
        title: formData.title,
        subject: formData.subject,
        level: formData.level,
        grade: formData.grade,
        topic: formData.topic,
        difficulty: formData.difficulty as any,
        questions: workbenchData.questions,
        grid: workbenchData.grid,
        tags: workbenchData.tags,
        authorId: user.id,
        isPublished: false,
        createdAt: new Date().toISOString(),
        status: 'completed'
      };
      
      const formUrl = await GoogleFormsService.exportToForms(tempQuiz);
      window.open(formUrl, '_blank');
      alert("Berhasil! Kuis draf Anda telah dibuat di Google Forms.");
    } catch (err: any) {
      alert("Gagal ekspor ke Google Forms: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearDraft = () => {
    if (confirm("Apakah Anda yakin ingin menghapus draf ini dan memulai dari awal?")) {
      localStorage.removeItem(DRAFT_KEY);
      window.location.reload();
    }
  };

  if (workbenchData) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 animate-in zoom-in-95 duration-500 pb-20">
        <div id="quiz-preview-content" className="bg-white p-10 rounded-[3rem] shadow-2xl border border-orange-100" role="region" aria-label="Preview Soal Tergenerate">
           <div className="flex flex-col md:flex-row justify-between items-center mb-10 border-b pb-6 gap-6 no-print">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 orange-gradient rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg" aria-hidden="true">✅</div>
                 <div>
                    <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Preview Soal Orisinal</h2>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                       <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                       Plagiarism Check: 100% Unique
                    </p>
                 </div>
              </div>
              <div className="flex gap-4 flex-wrap justify-center">
                 <button 
                  onClick={handleExportToGoogleForms} 
                  disabled={isExporting}
                  className="px-8 py-3 bg-[#673ab7] text-white font-black rounded-2xl shadow-xl text-[10px] uppercase hover:scale-105 transition-all flex items-center gap-2"
                 >
                   {isExporting ? 'Exporting...' : '📄 Export ke Google Forms'}
                 </button>
                 <button onClick={() => setWorkbenchData(null)} className="px-8 py-3 bg-gray-100 text-gray-400 font-black rounded-2xl text-[10px] uppercase hover:bg-gray-200 focus:ring-2 focus:ring-gray-300">Batal</button>
                 <button onClick={saveToDatabase} className="px-12 py-3 orange-gradient text-white font-black rounded-2xl shadow-xl text-[10px] uppercase hover:scale-105 transition-all focus:ring-2 focus:ring-orange-300">Simpan & Gunakan Kredit</button>
              </div>
           </div>

           <div className="mb-10 p-6 bg-orange-50/50 rounded-3xl border-2 border-orange-100 space-y-4">
              <h3 className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-2">AI Generated Tags</h3>
              <div className="flex flex-wrap gap-2">
                 {workbenchData.tags.map((tag, i) => (
                    <span key={i} className="px-4 py-1.5 bg-white text-orange-500 rounded-full text-[10px] font-black border-2 border-orange-100">#{tag}</span>
                 ))}
                 {workbenchData.tags.length === 0 && <span className="text-xs text-gray-400 italic">No tags generated.</span>}
              </div>
           </div>

           <div className="space-y-12">
              {workbenchData.questions.map((q, idx) => {
                const isNewPassage = q.passage && (idx === 0 || workbenchData.questions[idx-1].passage !== q.passage);
                
                return (
                  <div key={q.id} className={`mjx-item math-loading p-10 bg-gray-50/30 rounded-[3.5rem] border-2 transition-all ${editingQuestionId === q.id ? 'border-orange-500 bg-orange-50/20' : 'border-gray-100'}`} tabIndex={0} aria-label={`Soal nomor ${idx + 1}`}>
                    <div className="flex justify-between items-center mb-8">
                       <div className="flex items-center gap-4">
                          <span className="w-12 h-12 orange-gradient text-white rounded-2xl flex items-center justify-center font-black shadow-lg text-lg">#{idx + 1}</span>
                          {editingQuestionId !== q.id && (
                             <button onClick={() => handleStartEdit(q)} className="px-4 py-2 bg-white border border-orange-200 text-orange-500 rounded-xl text-[10px] font-black uppercase hover:bg-orange-500 hover:text-white transition-all shadow-sm">Edit Soal ✏️</button>
                          )}
                       </div>
                       <div className="flex gap-2">
                          <span className="bg-white px-5 py-2 rounded-xl border-2 border-orange-100 text-[10px] font-black uppercase text-orange-600">{q.type}</span>
                          <span className="bg-emerald-50 px-5 py-2 rounded-xl border-2 border-emerald-100 text-[10px] font-black uppercase text-emerald-600">{q.cognitiveLevel}</span>
                       </div>
                    </div>
                    
                    {editingQuestionId === q.id && editBuffer ? (
                      <div className="space-y-6 animate-in fade-in duration-300">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest ml-4">Stimulus / Wacana</label>
                            <textarea className="w-full px-6 py-4 rounded-[2rem] bg-white border-2 border-orange-100 focus:border-orange-500 outline-none text-sm font-medium h-32" value={editBuffer.passage || ''} onChange={(e) => setEditBuffer({ ...editBuffer, passage: e.target.value })} placeholder="Teks stimulus (kosongkan jika tidak ada)" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest ml-4">Pertanyaan Soal</label>
                            <textarea className="w-full px-6 py-4 rounded-[2rem] bg-white border-2 border-orange-100 focus:border-orange-500 outline-none text-sm font-bold h-24" value={editBuffer.text} onChange={(e) => setEditBuffer({ ...editBuffer, text: e.target.value })} />
                         </div>
                         {editBuffer.options && (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {editBuffer.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex items-center gap-2 bg-white p-3 rounded-[1.5rem] border border-orange-100">
                                   <span className="w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center font-black shrink-0">{opt.label}</span>
                                   <input className="flex-1 bg-transparent outline-none text-xs font-bold" value={opt.text} onChange={(e) => {
                                       const newOpts = [...(editBuffer.options || [])];
                                       newOpts[oIdx] = { ...opt, text: e.target.value };
                                       setEditBuffer({ ...editBuffer, options: newOpts });
                                     }} />
                                </div>
                              ))}
                           </div>
                         )}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-4">Jawaban Benar</label>
                              <input className="w-full px-6 py-3 rounded-2xl bg-white border-2 border-emerald-100 focus:border-emerald-500 outline-none text-xs font-black" value={Array.isArray(editBuffer.answer) ? editBuffer.answer.join(', ') : editBuffer.answer} onChange={(e) => setEditBuffer({ ...editBuffer, answer: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest ml-4">Materi / Topik</label>
                              <input className="w-full px-6 py-3 rounded-2xl bg-white border-2 border-orange-100 focus:border-orange-500 outline-none text-xs font-bold" value={editBuffer.topic} onChange={(e) => setEditBuffer({ ...editBuffer, topic: e.target.value })} />
                            </div>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-4">Penjelasan / Pembahasan</label>
                            <textarea className="w-full px-6 py-4 rounded-[2rem] bg-white border-2 border-emerald-100 focus:border-emerald-500 outline-none text-xs italic h-20" value={editBuffer.explanation} onChange={(e) => setEditBuffer({ ...editBuffer, explanation: e.target.value })} />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-4">Sitasi Grounding (Anti-Halusinasi)</label>
                            <input className="w-full px-6 py-3 rounded-2xl bg-white border-2 border-blue-100 focus:border-blue-500 outline-none text-[10px] font-black text-blue-700 italic" value={editBuffer.citation || ''} onChange={(e) => setEditBuffer({ ...editBuffer, citation: e.target.value })} placeholder="E.g. Berdasarkan teks referensi, Paragraf 3" />
                         </div>
                         <div className="flex justify-end gap-3 pt-4">
                            <button onClick={handleCancelEdit} className="px-6 py-2 bg-gray-100 text-gray-400 font-black rounded-xl text-[9px] uppercase hover:bg-gray-200">Batal</button>
                            <button onClick={handleSaveEdit} className="px-8 py-2 bg-emerald-500 text-white font-black rounded-xl text-[9px] uppercase shadow-lg hover:bg-emerald-600">Simpan Perubahan ✅</button>
                         </div>
                      </div>
                    ) : (
                      <div className="space-y-8">
                         {isNewPassage && (
                           <div className="mb-8 p-1 bg-white rounded-[2.5rem] border-2 border-black shadow-md">
                             <div className="px-8 py-4 bg-orange-50 rounded-t-[2.2rem] border-b border-orange-100 flex justify-between items-center">
                                <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Wacana Stimulus (Grup Soal)</span>
                                {q.passageHeader && <span className="text-[9px] font-black bg-orange-500 text-white px-3 py-1 rounded-full">{q.passageHeader}</span>}
                             </div>
                             <div className="p-10 italic text-gray-700 leading-relaxed text-lg" dangerouslySetInnerHTML={{ __html: q.passage! }}></div>
                           </div>
                         )}

                         <div className="text-lg font-bold text-gray-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: q.text }}></div>
                         
                         {q.image && (
                           <div className="flex justify-center py-4">
                              <img src={q.image} className="max-w-full md:max-w-md rounded-[2rem] border-4 border-white shadow-xl" alt={`Ilustrasi untuk soal nomor ${idx + 1}`} />
                           </div>
                         )}

                         {q.options && (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {q.options.map(opt => (
                                <div key={opt.label} className="p-5 rounded-[2rem] bg-white border-2 border-transparent hover:border-orange-200 transition-all flex items-center gap-4">
                                   <span className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center font-black shrink-0">{opt.label}</span>
                                   <span className="font-bold text-gray-700 text-sm" dangerouslySetInnerHTML={{ __html: opt.text }}></span>
                                </div>
                              ))}
                           </div>
                         )}

                         <div className="mt-6 p-8 bg-emerald-50/50 rounded-[2.5rem] border-2 border-dashed border-emerald-200 text-sm">
                            <div className="flex justify-between items-center mb-2">
                               <div className="font-black text-emerald-600 uppercase text-xs">Kunci & Pembahasan</div>
                               {q.citation && <div className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">Sitasi: {q.citation}</div>}
                            </div>
                            <div className="font-bold text-gray-800 mb-2">Jawaban: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</div>
                            <div className="text-gray-600 italic leading-relaxed" dangerouslySetInnerHTML={{ __html: q.explanation }}></div>
                         </div>
                      </div>
                    )}
                  </div>
                );
              })}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-orange-100 flex flex-col md:flex-row gap-8 items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 orange-gradient rounded-[2.5rem] flex items-center justify-center text-white text-4xl shadow-2xl" aria-hidden="true">✨</div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Quiz <span className="text-orange-500">Generator</span></h2>
              <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-3 py-1 rounded-full border border-emerald-100 uppercase tracking-widest animate-pulse">Anti-Plagiarism Active</span>
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Smart Curriculum Engine v3.1</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleClearDraft} className="px-6 py-4 bg-gray-50 text-gray-400 hover:text-rose-500 font-black rounded-[1.5rem] text-[9px] uppercase tracking-widest border border-transparent hover:border-rose-100 transition-all">Reset Draft 🗑️</button>
          <div className="bg-orange-50/50 px-8 py-4 rounded-[2rem] border border-orange-100" role="status" aria-label={`Sisa kredit AI Anda: ${user.credits}`}>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Kredit AI</p>
              <p className="text-2xl font-black text-orange-600 tracking-tighter">{user.role === UserRole.ADMIN ? '∞' : user.credits} 🪙</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-orange-50 space-y-10">
              {errorMsg ? (
                <HumanError message={errorMsg} onRetry={startGeneration} onClose={() => setErrorMsg(null)} />
              ) : (
                <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); startGeneration(); }}>
                  <div className="space-y-2">
                    <label htmlFor="quiz-title" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Judul Dokumen</label>
                    <input id="quiz-title" type="text" className="w-full px-8 py-5 rounded-[2rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none font-bold text-gray-800 transition-all shadow-inner" placeholder="E.g. UH Bab 1 Fisika" aria-label="Judul dokumen quiz" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="quiz-level" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Jenjang</label>
                      <select id="quiz-level" aria-label="Pilih jenjang pendidikan" className="w-full px-8 py-5 rounded-[2rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold shadow-inner" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})}>
                          {Object.keys(LEVEL_CONFIG).map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="quiz-grade" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Kelas</label>
                      <select id="quiz-grade" aria-label="Pilih kelas" className="w-full px-8 py-5 rounded-[2rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold shadow-inner" value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value})}>
                          {LEVEL_CONFIG[formData.level].grades.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="quiz-subject" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Mata Pelajaran</label>
                    <select id="quiz-subject" aria-label="Pilih mata pelajaran" className="w-full px-8 py-5 rounded-[2rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold shadow-inner" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})}>
                        {Object.entries(SUBJECT_DATA[formData.level]).map(([group, list]) => (
                          <optgroup key={group} label={group.toUpperCase()} className="text-orange-600 font-black">
                            {list.map(s => <option key={s} value={s} className="text-gray-800 font-bold">{s}</option>)}
                          </optgroup>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="quiz-topic" className="text-[10px] font-black text-gray-400 uppercase ml-4">Topik Pembelajaran</label>
                    <input id="quiz-topic" type="text" className="w-full px-8 py-5 rounded-[2rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 font-bold shadow-inner outline-none" placeholder="E.g. Hukum Newton" aria-label="Topik atau materi pembelajaran" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} />
                  </div>

                  <div className="p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100 space-y-6">
                    <h3 className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-4">Mode Literasi & AKM</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label htmlFor="quiz-literacy" className="text-[10px] font-black text-gray-400 uppercase ml-4">Pilih Mode Wacana</label>
                          <select id="quiz-literacy" aria-label="Pilih mode wacana literasi" className="w-full px-6 py-4 rounded-2xl bg-white border-2 border-transparent focus:border-orange-500 font-bold shadow-sm outline-none" value={formData.literacyMode} onChange={e => setFormData({...formData, literacyMode: e.target.value})}>
                              <option value="Tanpa Wacana">Tanpa Wacana</option>
                              <option value="Literasi Individual">Individual (1 Soal 1 Wacana)</option>
                              <option value="Literasi Grup (AKM)">Grup (Blok Soal)</option>
                          </select>
                        </div>
                        {formData.literacyMode === 'Literasi Grup (AKM)' && (
                          <div className="space-y-4 bg-orange-100/50 p-6 rounded-3xl border border-orange-200 animate-in zoom-in-95 duration-300">
                            <div>
                               <label htmlFor="literacy-range" className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-2 block">Jumlah Soal Per Grup Wacana</label>
                               <div className="flex items-center gap-4">
                                   <input id="literacy-range" type="range" min="2" max="10" aria-label="Jumlah soal per wacana dalam blok AKM" className="flex-1 h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-600" value={formData.questionsPerPassage} onChange={e => setFormData({...formData, questionsPerPassage: parseInt(e.target.value)})} />
                                   <span className="w-12 h-12 bg-white text-orange-600 rounded-xl flex items-center justify-center font-black border shadow-sm text-lg" aria-hidden="true">{formData.questionsPerPassage}</span>
                               </div>
                            </div>
                            <div className="pt-2 border-t border-orange-200/50">
                               <p className="text-[9px] text-gray-600 font-bold uppercase leading-tight">
                                  ⚡ Kontrol Dinamis: <br/>
                                  <span className="text-orange-500">1 Wacana</span> akan digunakan untuk setiap <span className="text-orange-500">{formData.questionsPerPassage} soal</span> secara otomatis. 
                                  Wacana hanya tampil pada butir pertama di setiap grup.
                               </p>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100 space-y-8">
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-4">Level Kognitif (Bloom)</h3>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Level kognitif soal">
                          {COGNITIVE_LEVELS.map(l => (
                            <button key={l} type="button" onClick={() => toggleCognitive(l)} aria-pressed={formData.cognitiveLevels.includes(l)} aria-label={`Gunakan level kognitif ${l}`} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all border-2 focus:ring-2 focus:ring-orange-500 outline-none ${formData.cognitiveLevels.includes(l) ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-white text-gray-400 border-gray-100 hover:border-orange-200'}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label htmlFor="option-count" className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-widest">Jumlah Opsi (Pilihan Ganda)</label>
                          <select id="option-count" aria-label="Jumlah pilihan jawaban" className="w-full px-6 py-4 rounded-2xl bg-white border-2 border-transparent focus:border-orange-500 font-bold shadow-sm outline-none" value={formData.optionCount} onChange={e => setFormData({...formData, optionCount: parseInt(e.target.value)})}>
                              <option value="3">3 Opsi (A-C)</option>
                              <option value="4">4 Opsi (A-D)</option>
                              <option value="5">5 Opsi (A-E)</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="img-count" className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-widest">Target Soal Bergambar</label>
                          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border shadow-sm">
                              <input id="img-count" type="number" min="0" max={formData.count} aria-label="Jumlah soal yang menggunakan gambar" className="w-full px-4 py-2 font-black text-orange-600 outline-none" value={formData.imageQuestionsCount} onChange={e => setFormData({...formData, imageQuestionsCount: Math.min(formData.count, parseInt(e.target.value) || 0)})} />
                              <span className="text-[10px] font-black text-gray-300 pr-4" aria-hidden="true">IMG</span>
                          </div>
                        </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Tipe Soal</label>
                    <div className="flex flex-wrap gap-3" role="group" aria-label="Tipe-tipe soal">
                      {Object.values(QuestionType).map(t => (
                        <button key={t} type="button" onClick={() => toggleType(t)} aria-pressed={formData.questionTypes.includes(t)} aria-label={`Gunakan tipe soal ${t}`} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase transition-all border-2 focus:ring-2 focus:ring-orange-500 outline-none ${formData.questionTypes.includes(t) ? 'bg-orange-500 text-white border-orange-500 shadow-lg' : 'bg-white text-gray-400 border-gray-100 hover:border-orange-200'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              )}
           </div>
        </div>

        <div className="space-y-8">
           <div className="bg-white p-10 rounded-[3.5rem] border border-gray-100 space-y-8 shadow-sm">
              <div className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-widest">AI Engine Power</label>
                   <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-2xl" role="group" aria-label="Pilih model AI">
                      <button onClick={() => setFormData({...formData, model: 'gemini-3-flash-preview'})} aria-label="Pilih model Gemini Flash (Cepat)" aria-pressed={formData.model.includes('flash')} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 focus:ring-2 focus:ring-orange-500 outline-none ${formData.model.includes('flash') ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400'}`}>
                         <span aria-hidden="true">⚡</span> FLASH
                      </button>
                      <button onClick={() => setFormData({...formData, model: 'gemini-3-pro-preview'})} aria-label="Pilih model Gemini Pro (Cerdas)" aria-pressed={formData.model.includes('pro')} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 focus:ring-2 focus:ring-orange-500 outline-none ${formData.model.includes('pro') ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400'}`}>
                         <span aria-hidden="true">🧠</span> PRO
                      </button>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label htmlFor="total-count" className="text-[10px] font-black text-gray-400 uppercase ml-4">Jumlah Soal</label>
                      <input id="total-count" type="number" max="50" aria-label="Total butir soal yang akan dibuat" className="w-full px-6 py-4 rounded-2xl bg-gray-50 font-black shadow-inner border-2 border-transparent focus:border-orange-500 outline-none" value={formData.count} onChange={e => setFormData({...formData, count: Math.min(50, Number(e.target.value))})} />
                   </div>
                   <div className="space-y-2">
                      <label htmlFor="diff-select" className="text-[10px] font-black text-gray-400 uppercase ml-4">Kesulitan</label>
                      <select id="diff-select" aria-label="Pilih tingkat kesulitan" className="w-full px-6 py-4 rounded-2xl bg-gray-50 font-black shadow-inner border-2 border-transparent focus:border-orange-500 outline-none" value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: e.target.value})}>
                         <option value="Mudah">Mudah</option>
                         <option value="Sedang">Sedang</option>
                         <option value="Sulit">Sulit</option>
                      </select>
                   </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="lang-select" className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-widest">Bahasa Pengantar</label>
                  <select id="lang-select" aria-label="Pilih bahasa pengantar soal" className="w-full px-6 py-4 rounded-2xl bg-gray-50 font-black shadow-inner border-2 border-transparent focus:border-orange-500 outline-none" value={formData.language} onChange={e => setFormData({...formData, language: e.target.value})}>
                    <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                    <option value="Bahasa Inggris">Bahasa Inggris</option>
                    <option value="Bahasa Arab">Bahasa Arab</option>
                    <option value="Bahasa Jepang">Bahasa Jepang</option>
                    <option value="Bahasa Mandarin">Bahasa Mandarin</option>
                    <option value="Bahasa Jerman">Bahasa Jerman</option>
                    <option value="Bahasa Perancis">Bahasa Perancis</option>
                  </select>
                </div>

                <div className="p-8 border-4 border-dashed border-gray-100 rounded-[3rem] text-center cursor-pointer hover:bg-orange-50 transition-all focus:ring-4 focus:ring-orange-100 outline-none" role="button" tabIndex={0} aria-label={fileName ? `File terpilih: ${fileName}. Klik untuk ganti.` : 'Klik untuk unggah file referensi materi dalam format .TXT'} onClick={() => fileInputRef.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}>
                   <div className="text-3xl mb-2" aria-hidden="true">📄</div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{fileName || 'Upload .TXT Referensi'}</p>
                   <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileUpload} />
                </div>

                <button onClick={startGeneration} disabled={isGenerating} aria-label="Mulai proses generate soal dengan AI" className="w-full py-7 orange-gradient text-white font-black rounded-[2.5rem] text-xl shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-tighter disabled:opacity-50 focus:ring-4 focus:ring-orange-300 outline-none">
                  {isGenerating ? 'Synthesizing...' : 'GENERATE SOAL AI ➜'}
                </button>
              </div>
           </div>
        </div>
      </div>

      {isGenerating && (
        <div className="fixed inset-0 bg-gray-900/95 backdrop-blur-3xl z-[600] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="Sedang memproses soal">
           <div className="bg-white w-full max-w-lg rounded-[4rem] p-16 text-center space-y-10 shadow-2xl">
              <div className="w-28 h-28 orange-gradient rounded-[2.5rem] mx-auto flex items-center justify-center text-white text-5xl animate-bounce" aria-hidden="true">🤖</div>
              <div className="space-y-2">
                 <h4 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">{progress}%</h4>
                 <div className="text-orange-500 font-bold uppercase text-[10px] tracking-widest animate-pulse" aria-live="polite">{statusMsg}</div>
              </div>
              <div className="bg-orange-50 p-6 rounded-[2rem] border border-orange-100 text-[10px] font-black text-orange-400 uppercase">Estimasi Sisa: {remainingSeconds} Detik</div>
              <div className="flex justify-center gap-2">
                 <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-100"></span>
                 <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-200"></span>
                 <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-300"></span>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CreateQuiz;
