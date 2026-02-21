
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
  const [isSaving, setIsSaving] = useState(false);
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
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (!workbenchData && !isGenerating) {
      const draft = { formData, referenceText, fileName };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  }, [formData, referenceText, fileName, workbenchData, isGenerating]);

  useEffect(() => {
    if (workbenchData && !isGenerating) {
      const timer = setTimeout(() => {
        if ((window as any).observeMathItems) {
          (window as any).observeMathItems('quiz-preview-content');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [workbenchData, isGenerating]);

  useEffect(() => {
    const categories = Object.keys(SUBJECT_DATA[formData.level] || {});
    if (categories.length > 0) {
        const firstCategory = categories[0];
        const defaultSubject = SUBJECT_DATA[formData.level][firstCategory][0];
        const defaultGrade = LEVEL_CONFIG[formData.level].grades[0];
        
        setFormData(prev => {
          const isSubjectValid = Object.values(SUBJECT_DATA[formData.level]).some(list => list.includes(prev.subject));
          if (!isSubjectValid || !prev.subject) {
            return { ...prev, grade: defaultGrade, subject: defaultSubject };
          }
          return prev;
        });
    }
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

  const startGeneration = async () => {
    const sanitizedTitle = StorageService.sanitizeInput(formData.title.trim());
    const sanitizedTopic = StorageService.sanitizeInput(formData.topic.trim());
    if (!sanitizedTitle || !sanitizedTopic) return alert('Judul dan Topik wajib diisi!');
    if (user.role !== UserRole.ADMIN && user.credits < 1) return alert('Kredit AI Anda habis.');

    const est = formData.count * 6;
    setRemainingSeconds(est);
    setIsGenerating(true);
    setErrorMsg(null);
    
    realtimeService.connect(crypto.randomUUID().substring(0,8), (event: AIProgressEvent) => {
      setProgress(event.percentage);
      setStatusMsg(event.message);
    });

    try {
      const gemini = new GeminiService();
      const retrievedContext = await StorageService.findRelatedQuestions(formData.subject, sanitizedTopic);
      const result = await gemini.generateQuiz({ ...formData, title: sanitizedTitle, topic: sanitizedTopic, referenceText: referenceText }, undefined, retrievedContext);
      
      if (!result || !result.questions) throw new Error("Gagal menyusun soal.");

      const processedQuestions = await Promise.all(result.questions.map(async (q: any, idx: number) => {
        let imageUrl = '';
        if (formData.imageQuestionsCount > idx) {
          try { imageUrl = await gemini.generateVisual(q.imagePrompt || q.text); } catch(err) {}
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
      await StorageService.saveQuizzes([newQuiz]);
      if (user.role !== UserRole.ADMIN) await StorageService.updateUserCredits(user.id, -1);
      await StorageService.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        category: LogCategory.CONTENT,
        action: 'CREATE_QUIZ',
        details: `Berhasil membuat soal: ${newQuiz.title}`,
        status: 'success',
        userId: user.id
      });
      EmailService.notifyQuizSuccess(user, newQuiz.title);
      localStorage.removeItem(DRAFT_KEY);
      onSuccess();
    } catch (e) {
      setErrorMsg("Gagal menyimpan ke database cloud. Cek koneksi internet Anda.");
    } finally {
      setIsSaving(false);
    }
  };

  if (workbenchData) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 animate-in zoom-in-95 duration-500 pb-20">
        <div id="quiz-preview-content" className="bg-white p-10 rounded-[3rem] shadow-2xl border border-orange-100">
           <div className="flex flex-col md:flex-row justify-between items-center mb-10 border-b pb-6 gap-6 no-print">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 orange-gradient rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg">✅</div>
                 <div>
                    <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Preview Soal Orisinal</h2>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">Unique AI Content Ready</p>
                 </div>
              </div>
              <div className="flex gap-4 flex-wrap justify-center">
                 <button onClick={() => setWorkbenchData(null)} disabled={isSaving} className="px-8 py-3 bg-gray-100 text-gray-400 font-black rounded-2xl text-[10px] uppercase">Batal</button>
                 <button onClick={saveToDatabase} disabled={isSaving} className="px-12 py-3 orange-gradient text-white font-black rounded-2xl shadow-xl text-[10px] uppercase hover:scale-105 transition-all">
                    {isSaving ? "Menyimpan..." : "Simpan & Gunakan Kredit"}
                 </button>
              </div>
           </div>

           <div className="space-y-12">
              {workbenchData.questions.map((q, idx) => (
                <div key={q.id} className="p-10 bg-gray-50/30 rounded-[3.5rem] border-2 border-gray-100">
                  <div className="flex justify-between items-center mb-8">
                     <span className="w-12 h-12 orange-gradient text-white rounded-2xl flex items-center justify-center font-black shadow-lg text-lg">#{idx + 1}</span>
                     <span className="bg-white px-5 py-2 rounded-xl border-2 border-orange-100 text-[10px] font-black uppercase text-orange-600">{q.type}</span>
                  </div>
                  <div className="space-y-6">
                    <div className="text-lg font-bold text-gray-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: q.text }}></div>
                    {q.image && (
                      <div className="flex justify-center py-4">
                        <img src={q.image} className="max-w-full md:max-w-md rounded-[2rem] border-4 border-white shadow-xl" alt="Ilustrasi Soal" />
                      </div>
                    )}
                    {q.options && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options.map(opt => (
                          <div key={opt.label} className="p-5 rounded-[2rem] bg-white border-2 border-transparent hover:border-orange-200 flex items-center gap-4">
                            <span className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center font-black shrink-0">{opt.label}</span>
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
          <div className="w-20 h-20 orange-gradient rounded-[2.5rem] flex items-center justify-center text-white text-4xl shadow-2xl">✨</div>
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Quiz <span className="text-orange-500">Generator</span></h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Smart Curriculum Engine v3.1</p>
          </div>
        </div>
        <div className="bg-orange-50/50 px-8 py-4 rounded-[2rem] border border-orange-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Kredit AI</p>
            <p className="text-2xl font-black text-orange-600 tracking-tighter">{user.role === UserRole.ADMIN ? '∞' : user.credits} 🪙</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-orange-50 space-y-8">
              {errorMsg ? (
                <HumanError message={errorMsg} onRetry={startGeneration} onClose={() => setErrorMsg(null)} />
              ) : (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-4">Judul Dokumen</label>
                    <input type="text" className="w-full px-8 py-5 rounded-[2rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold" placeholder="E.g. UH Bab 1 Fisika" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <select className="px-8 py-5 rounded-[2rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 font-bold outline-none" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})}>
                        {Object.keys(LEVEL_CONFIG).map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <select className="px-8 py-5 rounded-[2rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 font-bold outline-none" value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value})}>
                        {LEVEL_CONFIG[formData.level].grades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-4">Topik Pembelajaran</label>
                    <input type="text" className="w-full px-8 py-5 rounded-[2rem] bg-gray-50 border-2 border-transparent focus:border-orange-500 font-bold outline-none" placeholder="E.g. Hukum Newton" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} />
                  </div>
                  <div className="p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100 space-y-6">
                    <div className="flex justify-between items-center">
                       <label className="text-[10px] font-black text-orange-600 uppercase">Target Soal Bergambar</label>
                       <input type="number" min="0" max={formData.count} className="w-20 px-4 py-2 rounded-xl border text-center font-black" value={formData.imageQuestionsCount} onChange={e => setFormData({...formData, imageQuestionsCount: Math.min(formData.count, parseInt(e.target.value) || 0)})} />
                    </div>
                  </div>
                  <button onClick={startGeneration} disabled={isGenerating} className="w-full py-7 orange-gradient text-white font-black rounded-[2.5rem] text-xl shadow-2xl hover:scale-[1.02] transition-all uppercase">
                    {isGenerating ? "Synthesizing..." : "GENERATE SOAL AI ➜"}
                  </button>
                </div>
              )}
           </div>
        </div>
        <div className="bg-white p-10 rounded-[3.5rem] border border-gray-100 shadow-sm h-fit">
           <h3 className="text-[10px] font-black text-orange-500 uppercase mb-6 tracking-widest text-center">Settings Soal</h3>
           <div className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Jumlah Soal</label>
                 <input type="number" className="w-full px-6 py-4 rounded-2xl bg-gray-50 font-black outline-none" value={formData.count} onChange={e => setFormData({...formData, count: parseInt(e.target.value) || 1})} />
              </div>
              <div className="space-y-2">
                 <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Tingkat Kesulitan</label>
                 <select className="w-full px-6 py-4 rounded-2xl bg-gray-50 font-black outline-none" value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: e.target.value})}>
                    <option value="Mudah">Mudah</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Sulit">Sulit</option>
                 </select>
              </div>
           </div>
        </div>
      </div>

      {isGenerating && (
        <div className="fixed inset-0 bg-gray-900/95 backdrop-blur-3xl z-[600] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-lg rounded-[4rem] p-16 text-center space-y-10 shadow-2xl">
              <div className="w-28 h-28 orange-gradient rounded-[2.5rem] mx-auto flex items-center justify-center text-white text-5xl animate-bounce">🤖</div>
              <div className="space-y-2">
                 <h4 className="text-4xl font-black text-gray-900 uppercase">{progress}%</h4>
                 <div className="text-orange-500 font-bold uppercase text-[10px] tracking-widest animate-pulse">{statusMsg}</div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CreateQuiz;
