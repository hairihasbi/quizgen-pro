
import React, { useState, useRef, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { EmailService } from '../services/emailService';
import { GoogleFormsService } from '../services/googleFormsService';
import { SUBJECT_DATA, LEVEL_CONFIG, COGNITIVE_LEVELS } from '../constants';
import { QuestionType, Quiz, Question, LogCategory, AIProgressEvent, UserRole } from '../types';
import HumanError from '../components/HumanError';
import { realtimeService } from '../services/realtimeService';
import { CheckCircle2, ChevronLeft, Sparkles, BrainCircuit } from 'lucide-react';

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
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [referenceText, setReferenceText] = useState('');
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [workbenchData, setWorkbenchData] = useState<{questions: Question[], grid: string, tags: string[]} | null>(null);

  useEffect(() => {
    const categories = Object.keys(SUBJECT_DATA[formData.level] || {});
    if (categories.length > 0) {
        const firstCategory = categories[0];
        const defaultSubject = SUBJECT_DATA[formData.level][firstCategory][0];
        const defaultGrade = LEVEL_CONFIG[formData.level].grades[0];
        setFormData(prev => ({ ...prev, grade: defaultGrade, subject: defaultSubject }));
    }
  }, [formData.level]);

  useEffect(() => {
    let timer: any;
    if (isGenerating && remainingSeconds > 0) {
      timer = setInterval(() => setRemainingSeconds(prev => Math.max(0, prev - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [isGenerating, remainingSeconds]);

  const startGeneration = async () => {
    const sanitizedTitle = StorageService.sanitizeInput(formData.title.trim());
    const sanitizedTopic = StorageService.sanitizeInput(formData.topic.trim());
    if (!sanitizedTitle || !sanitizedTopic) return alert('Judul dan Topik wajib diisi!');
    if (user.role !== UserRole.ADMIN && user.credits < 1) return alert('Kredit AI Anda habis.');

    setRemainingSeconds(formData.count * 10);
    setIsGenerating(true);
    setErrorMsg(null);
    
    realtimeService.connect(crypto.randomUUID().substring(0,8), (event: AIProgressEvent) => {
      setProgress(event.percentage);
      setStatusMsg(event.message);
    });

    try {
      const gemini = new GeminiService();
      const retrievedContext = await StorageService.findRelatedQuestions(formData.subject, sanitizedTopic);
      const result = await gemini.generateQuiz({ ...formData, title: sanitizedTitle, topic: sanitizedTopic, referenceText }, undefined, retrievedContext);
      
      if (!result || !result.questions) throw new Error("AI Gagal merespons draf soal.");

      const processedQuestions = await Promise.all(result.questions.map(async (q: any, idx: number) => {
        let imageUrl = '';
        if (formData.imageQuestionsCount > idx) {
          try { imageUrl = await gemini.generateVisual(q.indicator || q.text); } catch(err) {}
        }
        return { ...q, id: crypto.randomUUID(), image: imageUrl };
      }));

      setWorkbenchData({ questions: processedQuestions, grid: result.grid || '', tags: result.tags || [] });
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsGenerating(false);
      realtimeService.disconnect();
    }
  };

  const saveToDatabase = async () => {
    if (!workbenchData || isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);

    const newQuiz: Quiz = {
      id: crypto.randomUUID(),
      title: StorageService.sanitizeInput(formData.title.trim()),
      subject: formData.subject,
      level: formData.level,
      grade: formData.grade,
      topic: StorageService.sanitizeInput(formData.topic.trim()),
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
      // PROSES SIMPAN: Sangat krusial agar gambar tidak hilang
      await StorageService.saveQuizzes([newQuiz]);
      
      if (user.role !== UserRole.ADMIN) {
        await StorageService.updateUserCredits(user.id, -1);
      }

      await StorageService.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        category: LogCategory.CONTENT,
        action: 'CREATE_QUIZ_SUCCESS',
        details: `Tersimpan: ${newQuiz.title} dengan ${newQuiz.questions.length} butir soal.`,
        status: 'success',
        userId: user.id
      });

      onSuccess();
    } catch (e: any) {
      console.error("[SAVE_FAIL]", e);
      setErrorMsg("Koneksi Database Terputus. Pastikan internet Anda stabil untuk mengunggah data soal & gambar.");
    } finally {
      setIsSaving(false);
    }
  };

  if (workbenchData) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 animate-in zoom-in-95 duration-500 pb-20">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-orange-100">
           <div className="flex flex-col md:flex-row justify-between items-center mb-10 border-b pb-8 gap-6 no-print">
              <div className="flex items-center gap-5">
                 <div className="w-16 h-16 orange-gradient rounded-3xl flex items-center justify-center text-white text-3xl shadow-xl">✅</div>
                 <div>
                    <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Preview Soal Orisinal</h2>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                       <CheckCircle2 size={12} /> Data Siap Diarsipkan ke Cloud
                    </p>
                 </div>
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setWorkbenchData(null)} disabled={isSaving} className="px-8 py-4 bg-gray-100 text-gray-400 font-black rounded-2xl text-[10px] uppercase hover:bg-gray-200 transition-all flex items-center gap-2">
                    <ChevronLeft size={16} /> Kembali
                 </button>
                 <button onClick={saveToDatabase} disabled={isSaving} className="px-12 py-4 orange-gradient text-white font-black rounded-2xl shadow-xl text-[10px] uppercase hover:scale-105 transition-all relative overflow-hidden group disabled:opacity-50">
                    <div className="flex items-center gap-2 relative z-10">
                       {isSaving ? (
                         <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                       ) : (
                         <Sparkles size={16} />
                       )}
                       {isSaving ? "MENYIMPAN DATA..." : "KONFIRMASI & SIMPAN"}
                    </div>
                 </button>
              </div>
           </div>

           <div className="space-y-12">
              {workbenchData.questions.map((q, idx) => (
                <div key={q.id} className="p-10 bg-gray-50/40 rounded-[3.5rem] border-2 border-gray-100 hover:border-orange-200 transition-all">
                  <div className="flex justify-between items-center mb-8">
                     <div className="flex items-center gap-4">
                        <span className="w-12 h-12 orange-gradient text-white rounded-2xl flex items-center justify-center font-black shadow-lg">#{idx + 1}</span>
                        <span className="bg-white px-5 py-2 rounded-xl border border-orange-100 text-[10px] font-black uppercase text-orange-600 shadow-sm">{q.type}</span>
                     </div>
                     <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Confidence: 100%</span>
                  </div>
                  <div className="space-y-8">
                    <div className="text-xl font-bold text-gray-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: q.text }}></div>
                    
                    {q.image && (
                      <div className="flex justify-center bg-white p-6 rounded-[2.5rem] border-2 border-dashed border-gray-100 shadow-inner">
                        <img src={q.image} className="max-w-full md:max-w-md rounded-2xl shadow-2xl border-4 border-white" alt="Ilustrasi Soal" />
                      </div>
                    )}

                    {q.options && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options.map(opt => (
                          <div key={opt.label} className="p-6 rounded-[2rem] bg-white border-2 border-transparent hover:border-orange-200 shadow-sm transition-all flex items-center gap-5">
                            <span className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center font-black shrink-0 shadow-sm">{opt.label}</span>
                            <span className="font-bold text-gray-700 text-sm" dangerouslySetInnerHTML={{ __html: opt.text }}></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-orange-100 flex flex-col md:flex-row gap-8 items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 orange-gradient rounded-[2.5rem] flex items-center justify-center text-white text-4xl shadow-2xl">
             <BrainCircuit size={42} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Quiz <span className="text-orange-500">Generator</span></h2>
              <span className="bg-orange-50 text-orange-600 text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">Neural v3.1</span>
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Smart Curriculum & Visual Stimulus Engine</p>
          </div>
        </div>
        <div className="bg-orange-50/50 px-8 py-5 rounded-[2rem] border border-orange-100 shadow-inner">
            <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1 text-center">Kredit AI Tersedia</p>
            <p className="text-3xl font-black text-orange-600 tracking-tighter">{user.role === UserRole.ADMIN ? '∞' : user.credits} 🪙</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-orange-50 space-y-10">
              {errorMsg ? (
                <HumanError message={errorMsg} onRetry={startGeneration} onClose={() => setErrorMsg(null)} />
              ) : (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-widest">Judul Dokumen Ujian</label>
                    <input type="text" className="w-full px-8 py-6 rounded-[2rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none font-bold text-gray-800 transition-all shadow-inner" placeholder="E.g. Ulangan Harian Bab 1 Ekosistem" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-widest">Jenjang</label>
                       <select className="w-full px-8 py-6 rounded-[2rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 font-bold outline-none shadow-inner" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})}>
                          {Object.keys(LEVEL_CONFIG).map(l => <option key={l} value={l}>{l}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-widest">Kelas</label>
                       <select className="w-full px-8 py-6 rounded-[2rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 font-bold outline-none shadow-inner" value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value})}>
                          {LEVEL_CONFIG[formData.level].grades.map(g => <option key={g} value={g}>{g}</option>)}
                       </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-widest">Topik Pembelajaran Utama</label>
                    <input type="text" className="w-full px-8 py-6 rounded-[2rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 font-bold outline-none shadow-inner transition-all" placeholder="E.g. Teori Relativitas atau Fotosintesis" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} />
                  </div>

                  <div className="p-10 bg-orange-50/50 rounded-[3rem] border-2 border-dashed border-orange-200 space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                       <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">🖼️</div>
                          <div>
                             <label className="text-[11px] font-black text-orange-600 uppercase tracking-widest">Target Stimulus Visual</label>
                             <p className="text-[9px] text-gray-400 font-bold">Otomatis generate gambar diagram/ilustrasi</p>
                          </div>
                       </div>
                       <input type="number" min="0" max={formData.count} className="w-24 px-6 py-4 rounded-2xl bg-white border-2 border-orange-200 text-center font-black text-orange-600 focus:border-orange-500 outline-none shadow-sm" value={formData.imageQuestionsCount} onChange={e => setFormData({...formData, imageQuestionsCount: Math.min(formData.count, parseInt(e.target.value) || 0)})} />
                    </div>
                  </div>

                  <button onClick={startGeneration} disabled={isGenerating} className="w-full py-8 orange-gradient text-white font-black rounded-[2.5rem] text-xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-tighter flex items-center justify-center gap-4 group disabled:opacity-50">
                    {isGenerating ? (
                       <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                    ) : (
                       <Sparkles className="group-hover:rotate-12 transition-transform" />
                    )}
                    {isGenerating ? "SYNTESIZING..." : "GENERATE NASKAH SOAL ➜"}
                  </button>
                </div>
              )}
           </div>
        </div>

        <div className="bg-white p-10 rounded-[3.5rem] border border-gray-100 shadow-sm h-fit space-y-10">
           <div className="text-center">
              <h3 className="text-[11px] font-black text-orange-500 uppercase tracking-[0.2em]">Parameter Engine</h3>
              <div className="h-1 w-12 bg-orange-500 mx-auto mt-2 rounded-full opacity-30"></div>
           </div>
           
           <div className="space-y-8">
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-widest">Total Butir Soal</label>
                 <div className="relative group">
                    <input type="number" className="w-full px-8 py-5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 font-black outline-none shadow-inner" value={formData.count} onChange={e => setFormData({...formData, count: Math.min(50, parseInt(e.target.value) || 1)})} />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300">MAX 50</span>
                 </div>
              </div>

              <div className="space-y-3">
                 <label className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-widest">Level Kesulitan</label>
                 <select className="w-full px-8 py-5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 font-black outline-none shadow-inner" value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: e.target.value})}>
                    <option value="Mudah">Mudah</option>
                    <option value="Sedang">Sedang (Prioritas)</option>
                    <option value="Sulit">Sulit (HOTS)</option>
                 </select>
              </div>

              <div className="space-y-3">
                 <label className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-widest">Intelligence Model</label>
                 <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100 rounded-2xl border shadow-inner">
                    <button onClick={() => setFormData({...formData, model: 'gemini-3-flash-preview'})} className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${formData.model.includes('flash') ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400'}`}>⚡ Flash</button>
                    <button onClick={() => setFormData({...formData, model: 'gemini-3-pro-preview'})} className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${formData.model.includes('pro') ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400'}`}>🧠 Pro</button>
                 </div>
              </div>
           </div>

           <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
              <p className="text-[9px] text-gray-400 font-bold leading-relaxed text-justify uppercase">
                 Engine v3.1 menggunakan logika pemrosesan batch untuk memastikan stabilitas rendering MathJax dan data gambar Stimulus di database Turso.
              </p>
           </div>
        </div>
      </div>

      {isGenerating && (
        <div className="fixed inset-0 bg-gray-950/95 backdrop-blur-3xl z-[600] flex items-center justify-center p-6 animate-in fade-in duration-500">
           <div className="bg-white w-full max-w-lg rounded-[4rem] p-16 text-center space-y-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gray-100">
                 <div className="h-full orange-gradient transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="w-28 h-28 orange-gradient rounded-[2.5rem] mx-auto flex items-center justify-center text-white text-5xl animate-bounce shadow-2xl">🤖</div>
              <div className="space-y-3">
                 <h4 className="text-5xl font-black text-gray-900 tracking-tighter">{progress}%</h4>
                 <div className="text-orange-500 font-black uppercase text-[10px] tracking-[0.3em] animate-pulse">{statusMsg}</div>
              </div>
              <div className="bg-orange-50 p-6 rounded-[2rem] border border-orange-100">
                 <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Sisa Waktu: {remainingSeconds} Detik</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CreateQuiz;
