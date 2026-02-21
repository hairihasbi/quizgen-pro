
import React, { useState, useRef, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { SUBJECT_DATA, LEVEL_CONFIG, COGNITIVE_LEVELS } from '../constants';
import { QuestionType, Quiz, Question, LogCategory, AIProgressEvent, UserRole } from '../types';
import HumanError from '../components/HumanError';
import { realtimeService } from '../services/realtimeService';
import { CheckCircle2, ChevronLeft, Sparkles, BrainCircuit, BookOpen, Layers, Target, FileText } from 'lucide-react';

interface CreateQuizProps {
  user: any;
  onSuccess: () => void;
}

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
  const [workbenchData, setWorkbenchData] = useState<{questions: Question[], grid: string, tags: string[]} | null>(null);

  // Update Mapel Saat Jenjang Berubah
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

  const toggleArrayItem = (field: 'questionTypes' | 'cognitiveLevels', value: any) => {
    setFormData(prev => {
      const current = [...prev[field]];
      const index = current.indexOf(value);
      if (index > -1) {
        if (current.length > 1) current.splice(index, 1);
      } else {
        current.push(value);
      }
      return { ...prev, [field]: current };
    });
  };

  const startGeneration = async () => {
    const sanitizedTitle = StorageService.sanitizeInput(formData.title.trim());
    const sanitizedTopic = StorageService.sanitizeInput(formData.topic.trim());
    if (!sanitizedTitle || !sanitizedTopic) return alert('Judul dan Topik wajib diisi!');
    if (user.role !== UserRole.ADMIN && user.credits < 1) return alert('Kredit AI Anda habis.');

    setRemainingSeconds(formData.count * 8);
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
    try {
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
      await StorageService.saveQuizzes([newQuiz]);
      if (user.role !== UserRole.ADMIN) await StorageService.updateUserCredits(user.id, -1);
      onSuccess();
    } catch (e) {
      setErrorMsg("Koneksi Database Terputus saat menyimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  if (workbenchData) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 animate-in zoom-in-95 duration-500 pb-20">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-orange-100">
           <div className="flex flex-col md:flex-row justify-between items-center mb-10 border-b pb-8 gap-6">
              <div className="flex items-center gap-5">
                 <div className="w-16 h-16 orange-gradient rounded-3xl flex items-center justify-center text-white text-3xl shadow-xl">✅</div>
                 <div>
                    <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Preview Soal Orisinal</h2>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">Ready for Archive</p>
                 </div>
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setWorkbenchData(null)} disabled={isSaving} className="px-8 py-4 bg-gray-100 text-gray-400 font-black rounded-2xl text-[10px] uppercase hover:bg-gray-200 transition-all flex items-center gap-2">
                    <ChevronLeft size={16} /> Kembali
                 </button>
                 <button onClick={saveToDatabase} disabled={isSaving} className="px-12 py-4 orange-gradient text-white font-black rounded-2xl shadow-xl text-[10px] uppercase hover:scale-105 transition-all">
                    {isSaving ? "Menyimpan..." : "Simpan & Gunakan Kredit"}
                 </button>
              </div>
           </div>
           <div className="space-y-12">
              {workbenchData.questions.map((q, idx) => (
                <div key={q.id} className="p-10 bg-gray-50/40 rounded-[3.5rem] border-2 border-gray-100">
                  <div className="flex justify-between items-center mb-8">
                     <span className="w-12 h-12 orange-gradient text-white rounded-2xl flex items-center justify-center font-black shadow-lg">#{idx + 1}</span>
                     <span className="bg-white px-5 py-2 rounded-xl border border-orange-100 text-[10px] font-black uppercase text-orange-600">{q.type}</span>
                  </div>
                  <div className="space-y-8">
                    <div className="text-xl font-bold text-gray-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: q.text }}></div>
                    {q.image && <div className="flex justify-center bg-white p-6 rounded-[2.5rem] border shadow-inner"><img src={q.image} className="max-w-full md:max-w-md rounded-2xl shadow-2xl" alt="Visual" /></div>}
                    {q.options && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options.map(opt => (
                          <div key={opt.label} className="p-6 rounded-[2rem] bg-white border-2 border-transparent hover:border-orange-200 shadow-sm transition-all flex items-center gap-5">
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
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header Info */}
      <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-orange-100 flex flex-col md:flex-row gap-8 items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 orange-gradient rounded-[2.5rem] flex items-center justify-center text-white text-4xl shadow-2xl"><BrainCircuit size={42} /></div>
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Quiz <span className="text-orange-500">Generator</span></h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Neural Engine v3.1 Stable</p>
          </div>
        </div>
        <div className="bg-orange-50/50 px-8 py-5 rounded-[2rem] border border-orange-100 text-center">
            <p className="text-[10px] font-black text-orange-400 uppercase mb-1">Kredit AI</p>
            <p className="text-3xl font-black text-orange-600 tracking-tighter">{user.role === UserRole.ADMIN ? '∞' : user.credits} 🪙</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Kolom Kiri: Form Utama */}
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-orange-50 space-y-10">
              {errorMsg ? (
                <HumanError message={errorMsg} onRetry={startGeneration} onClose={() => setErrorMsg(null)} />
              ) : (
                <div className="space-y-10">
                  {/* Bagian Identitas */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-l-4 border-orange-500 pl-4">
                      <FileText className="text-orange-500" size={20} />
                      <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Identitas Dokumen</h3>
                    </div>
                    <div className="space-y-4">
                      <input type="text" className="w-full px-8 py-5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none font-bold text-gray-800 transition-all" placeholder="Judul Dokumen (Contoh: Ulangan Harian Bab 1)" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                      <div className="grid grid-cols-2 gap-4">
                        <select className="w-full px-6 py-4 rounded-2xl bg-gray-50 font-bold outline-none border-2 border-transparent focus:border-orange-500" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})}>
                          {Object.keys(LEVEL_CONFIG).map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <select className="w-full px-6 py-4 rounded-2xl bg-gray-50 font-bold outline-none border-2 border-transparent focus:border-orange-500" value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value})}>
                          {LEVEL_CONFIG[formData.level].grades.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <select className="w-full px-6 py-4 rounded-2xl bg-gray-50 font-bold outline-none border-2 border-transparent focus:border-orange-500" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})}>
                          {Object.entries(SUBJECT_DATA[formData.level] || {}).map(([cat, list]) => (
                            <optgroup key={cat} label={cat}>{list.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                          ))}
                        </select>
                        <input type="text" className="w-full px-6 py-4 rounded-2xl bg-gray-50 font-bold outline-none border-2 border-transparent focus:border-orange-500" placeholder="Topik (Contoh: Fotosintesis)" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  {/* Bagian Struktur Soal */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-l-4 border-orange-500 pl-4">
                      <Layers className="text-orange-500" size={20} />
                      <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Struktur & Tipe Soal</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.values(QuestionType).map(type => (
                        <button key={type} onClick={() => toggleArrayItem('questionTypes', type)} className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${formData.questionTypes.includes(type) ? 'bg-orange-500 text-white border-orange-500 shadow-lg' : 'bg-gray-50 text-gray-400 border-transparent hover:bg-orange-50'}`}>
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bagian Level Kognitif */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-l-4 border-orange-500 pl-4">
                      <Target className="text-orange-500" size={20} />
                      <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Level Kognitif (Bloom)</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {COGNITIVE_LEVELS.map(lvl => (
                        <button key={lvl} onClick={() => toggleArrayItem('cognitiveLevels', lvl)} className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${formData.cognitiveLevels.includes(lvl) ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg' : 'bg-gray-50 text-gray-400 border-transparent hover:bg-emerald-50'}`}>
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode Literasi / Wacana */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-l-4 border-orange-500 pl-4">
                      <BookOpen className="text-orange-500" size={20} />
                      <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Stimulus & Literasi</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <select className="w-full px-6 py-4 rounded-2xl bg-gray-50 font-bold outline-none border-2 border-transparent focus:border-orange-500" value={formData.literacyMode} onChange={e => setFormData({...formData, literacyMode: e.target.value})}>
                        <option value="Tanpa Wacana">Tanpa Wacana Stimulus</option>
                        <option value="Wacana Per Soal">Setiap Soal Ada Wacana</option>
                        <option value="Wacana Per Grup">Wacana Per Grup ({formData.questionsPerPassage} Soal)</option>
                      </select>
                      <div className="flex items-center gap-3 bg-orange-50/50 p-4 rounded-2xl border-2 border-dashed border-orange-200">
                         <span className="text-[10px] font-black text-orange-600 uppercase">Stimulus Visual:</span>
                         <input type="number" min="0" max={formData.count} className="w-16 bg-white border border-orange-200 rounded-lg text-center font-black py-1" value={formData.imageQuestionsCount} onChange={e => setFormData({...formData, imageQuestionsCount: Math.min(formData.count, parseInt(e.target.value) || 0)})} />
                         <span className="text-[9px] font-bold text-gray-400">Gambar</span>
                      </div>
                    </div>
                  </div>

                  <button onClick={startGeneration} disabled={isGenerating} className="w-full py-8 orange-gradient text-white font-black rounded-[2.5rem] text-xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all uppercase flex items-center justify-center gap-4 group disabled:opacity-50">
                    {isGenerating ? <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div> : <Sparkles className="group-hover:rotate-12 transition-transform" />}
                    {isGenerating ? "SYNTESIZING..." : "GENERATE NASKAH SOAL ➜"}
                  </button>
                </div>
              )}
           </div>
        </div>

        {/* Kolom Kanan: Parameter Engine */}
        <div className="space-y-8">
           <div className="bg-white p-10 rounded-[3.5rem] border border-gray-100 shadow-sm h-fit space-y-8">
              <h3 className="text-[11px] font-black text-orange-500 uppercase tracking-[0.2em] text-center">Parameter Engine</h3>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-widest">Total Butir Soal</label>
                    <input type="number" className="w-full px-8 py-5 rounded-2xl bg-gray-50 font-black outline-none border-2 border-transparent focus:border-orange-500" value={formData.count} onChange={e => setFormData({...formData, count: Math.min(50, parseInt(e.target.value) || 1)})} />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-widest">Tingkat Kesulitan</label>
                    <select className="w-full px-8 py-5 rounded-2xl bg-gray-50 font-black outline-none border-2 border-transparent focus:border-orange-500" value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: e.target.value})}>
                       <option value="Mudah">Mudah</option>
                       <option value="Sedang">Sedang</option>
                       <option value="Sulit">Sulit (HOTS)</option>
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-4 tracking-widest">Intelligence Model</label>
                    <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100 rounded-2xl">
                       <button onClick={() => setFormData({...formData, model: 'gemini-3-flash-preview'})} className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${formData.model.includes('flash') ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400'}`}>⚡ Flash</button>
                       <button onClick={() => setFormData({...formData, model: 'gemini-3-pro-preview'})} className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${formData.model.includes('pro') ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400'}`}>🧠 Pro</button>
                    </div>
                 </div>
              </div>
           </div>
           
           <div className="p-8 bg-orange-50/30 rounded-[2.5rem] border border-orange-100 space-y-4">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">💡</div>
                 <h4 className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Tips Generate</h4>
              </div>
              <p className="text-[10px] text-orange-600/70 font-bold leading-relaxed uppercase tracking-widest">Pilih model "PRO" jika Anda memerlukan soal HOTS dengan analisis wacana yang mendalam dan akurasi materi eksakta yang tinggi.</p>
           </div>
        </div>
      </div>

      {/* Progress Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-gray-950/95 backdrop-blur-3xl z-[600] flex items-center justify-center p-6">
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
