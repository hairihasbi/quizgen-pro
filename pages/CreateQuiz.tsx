
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { SUBJECT_DATA, LEVEL_CONFIG } from '../constants';
import { QuestionType, Quiz, AIProgressEvent } from '../types';
import { realtimeService } from '../services/realtimeService';
import { Sparkles, BrainCircuit, BookOpen, Layers, FileText, Loader2, Image as ImageIcon } from 'lucide-react';

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
    questionTypes: [QuestionType.MCQ],
    count: 5,
    optionCount: 5, 
    difficulty: 'Sedang',
    cognitiveLevels: ['C2 - Memahami'],
    imageQuestionsCount: 0,
    literacyMode: 'Tanpa Wacana',
    questionsPerPassage: 3, 
    model: 'gemini-3-pro-preview'
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [workbenchData, setWorkbenchData] = useState<any>(null);

  // Otomatisasi jumlah opsi berdasarkan jenjang saat level berubah
  useEffect(() => {
    let standard = 5;
    if (formData.level === 'SD') standard = 3;
    else if (formData.level === 'SMP' || formData.level === 'MTS') standard = 4;
    setFormData(prev => ({ ...prev, optionCount: standard }));
  }, [formData.level]);

  const toggleArrayItem = (field: 'questionTypes' | 'cognitiveLevels', value: any) => {
    setFormData(prev => {
      const current = [...(prev[field] as any)];
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
    if (!formData.title || !formData.topic) return alert('Lengkapi Judul dan Topik!');
    setIsGenerating(true);
    
    realtimeService.connect(crypto.randomUUID().substring(0,8), (event: AIProgressEvent) => {
      setProgress(event.percentage);
      setStatusMsg(event.message);
    });

    try {
      const gemini = new GeminiService();
      // FIX: Hanya 1 argumen sesuai definisi terbaru di geminiService
      const result = await gemini.generateQuiz(formData);
      
      const processedQuestions = await Promise.all(result.questions.map(async (q: any, idx: number) => {
        let imageUrl = '';
        // FIX: Maksimal 3 gambar saja
        if (formData.imageQuestionsCount > 0 && idx < Math.min(formData.imageQuestionsCount, 3)) {
          imageUrl = await gemini.generateVisual(q.text);
        }
        return { ...q, id: crypto.randomUUID(), image: imageUrl };
      }));

      setWorkbenchData({ ...result, questions: processedQuestions });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsGenerating(false);
      realtimeService.disconnect();
    }
  };

  const saveToDatabase = async () => {
    const newQuiz: Quiz = {
      id: crypto.randomUUID(),
      title: formData.title,
      subject: formData.subject,
      level: formData.level,
      grade: formData.grade,
      topic: formData.topic,
      difficulty: formData.difficulty as any,
      questions: workbenchData.questions,
      grid: workbenchData.grid,
      authorId: user.id,
      authorName: user.username,
      isPublished: false,
      createdAt: new Date().toISOString(),
      status: 'completed'
    };
    await StorageService.saveQuizzes([newQuiz]);
    onSuccess();
  };

  if (workbenchData) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 animate-in zoom-in-95 pb-20">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-orange-100">
           <div className="flex justify-between items-center mb-10 border-b pb-8">
              <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Hasil Generate</h2>
              <div className="flex gap-4">
                 <button onClick={() => setWorkbenchData(null)} className="px-6 py-3 bg-gray-100 text-gray-400 font-black rounded-2xl text-[10px] uppercase">Batal</button>
                 <button onClick={saveToDatabase} className="px-10 py-4 orange-gradient text-white font-black rounded-2xl shadow-xl text-[10px] uppercase">Simpan</button>
              </div>
           </div>
           <div className="space-y-12">
              {workbenchData.questions.map((q: any, idx: number) => (
                <div key={q.id} className="p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100">
                  <div className="flex justify-between mb-4">
                     <span className="bg-orange-500 text-white px-4 py-1 rounded-full text-[9px] font-black uppercase">Soal #{idx + 1}</span>
                     <span className="text-[9px] font-bold text-gray-400 uppercase">{q.type}</span>
                  </div>
                  {q.passage && (
                    <div className="mb-6 p-6 bg-white border-l-4 border-orange-500 italic text-sm text-gray-600 leading-relaxed shadow-sm">
                      {q.passage}
                    </div>
                  )}
                  <div className="text-lg font-bold text-gray-800 mb-6">{q.text}</div>
                  {q.image && <img src={q.image} className="max-w-md rounded-2xl mb-6 shadow-md border" alt="Stimulus" />}
                  {q.options && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.options.map((opt: any) => (
                        <div key={opt.label} className="p-4 bg-white rounded-xl border flex items-center gap-4">
                           <span className={`w-8 h-8 flex items-center justify-center font-black ${q.type === QuestionType.COMPLEX_MCQ ? 'bg-orange-500 text-white rounded-lg' : 'bg-orange-50 text-orange-500 rounded-full'}`}>{opt.label}</span>
                           <span className="text-sm font-medium">{opt.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-6 pt-4 border-t border-dashed text-[10px] text-emerald-600 font-bold uppercase">KUNCI: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</div>
                </div>
              ))}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in pb-20">
      <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-orange-100 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 orange-gradient rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl"><BrainCircuit size={42} /></div>
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Quiz <span className="text-orange-500">Generator</span></h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">AI Engine v3.1</p>
          </div>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-black text-orange-400 uppercase">Kredit AI</p>
           <p className="text-3xl font-black text-orange-600">{user.credits} 🪙</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-orange-50 space-y-10">
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-l-4 border-orange-500 pl-4">
                  <FileText className="text-orange-500" size={20} />
                  <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Identitas Soal</h3>
                </div>
                <input type="text" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold transition-all" placeholder="Judul (Contoh: UH Biologi Sel)" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <select className="px-6 py-4 rounded-2xl bg-gray-50 font-bold outline-none border-2 border-transparent focus:border-orange-500" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})}>
                    {Object.keys(LEVEL_CONFIG).map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <select className="px-6 py-4 rounded-2xl bg-gray-50 font-bold outline-none border-2 border-transparent focus:border-orange-500" value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value})}>
                    {LEVEL_CONFIG[formData.level].grades.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <select className="px-6 py-4 rounded-2xl bg-gray-50 font-bold outline-none border-2 border-transparent focus:border-orange-500" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})}>
                    <option value="">Pilih Mapel</option>
                    {Object.entries(SUBJECT_DATA[formData.level] || {}).map(([cat, list]) => (
                      <optgroup key={cat} label={cat}>{list.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                    ))}
                  </select>
                  <input type="text" className="px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold" placeholder="Materi Utama" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} />
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3 border-l-4 border-orange-500 pl-4">
                  <Layers className="text-orange-500" size={20} />
                  <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Tipe Soal & Struktur</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.values(QuestionType).map(type => (
                    <button key={type} onClick={() => toggleArrayItem('questionTypes', type)} className={`px-4 py-3 rounded-xl text-[9px] font-black uppercase transition-all border-2 ${formData.questionTypes.includes(type) ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-gray-50 text-gray-400 border-transparent hover:bg-orange-100'}`}>
                      {type}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between p-5 bg-orange-50 rounded-2xl border-2 border-dashed border-orange-200">
                   <span className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Opsi Jawaban:</span>
                   <div className="flex items-center gap-4">
                      <input type="range" min="3" max="5" step="1" className="accent-orange-600" value={formData.optionCount} onChange={e => setFormData({...formData, optionCount: parseInt(e.target.value)})} />
                      <span className="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-black text-orange-600 shadow-sm">{formData.optionCount}</span>
                   </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3 border-l-4 border-orange-500 pl-4">
                  <BookOpen className="text-orange-500" size={20} />
                  <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Literasi & Visual</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select className="px-6 py-4 rounded-2xl bg-gray-50 font-bold outline-none border-2 border-transparent focus:border-orange-500" value={formData.literacyMode} onChange={e => setFormData({...formData, literacyMode: e.target.value})}>
                    <option value="Tanpa Wacana">Tanpa Wacana</option>
                    <option value="Wacana Per Soal">Literasi (Per Soal)</option>
                    <option value="Wacana Per Grup">Literasi (Grup tiap {formData.questionsPerPassage} soal)</option>
                  </select>
                  <div className="flex items-center gap-3 bg-orange-50 p-4 rounded-2xl border border-orange-100">
                     <ImageIcon size={18} className="text-orange-500" />
                     <span className="text-[10px] font-black uppercase text-orange-800 flex-1">Bergambar (Maks 3):</span>
                     <input type="number" min="0" max="3" className="w-14 bg-white border border-orange-200 rounded-lg text-center font-black py-1.5" value={formData.imageQuestionsCount} onChange={e => setFormData({...formData, imageQuestionsCount: Math.min(3, parseInt(e.target.value) || 0)})} />
                  </div>
                </div>
              </div>

              <button onClick={startGeneration} disabled={isGenerating} className="w-full py-8 orange-gradient text-white font-black rounded-[2.5rem] text-xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all uppercase flex items-center justify-center gap-4">
                {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {isGenerating ? "MENGANALISIS..." : "GENERATE SOAL AI ➜"}
              </button>
           </div>
        </div>

        <div className="space-y-8">
           <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm space-y-5">
              <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest text-center">Parameter Engine</h3>
              <div className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Total Soal</label>
                    <input type="number" className="w-full px-6 py-4 rounded-2xl bg-gray-50 font-black outline-none border-2 border-transparent focus:border-orange-500" value={formData.count} onChange={e => setFormData({...formData, count: Math.min(20, parseInt(e.target.value) || 1)})} />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Kesulitan</label>
                    <select className="w-full px-6 py-4 rounded-2xl bg-gray-50 font-black outline-none border-2 border-transparent focus:border-orange-500" value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: e.target.value})}>
                       <option value="Mudah">Mudah</option>
                       <option value="Sedang">Sedang</option>
                       <option value="Sulit">Sulit (HOTS)</option>
                    </select>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {isGenerating && (
        <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-2xl z-[600] flex items-center justify-center p-6 text-center">
           <div className="max-w-md w-full space-y-8 animate-in zoom-in-95">
              <div className="w-24 h-24 orange-gradient rounded-[2rem] mx-auto flex items-center justify-center text-white text-4xl animate-bounce shadow-2xl shadow-orange-500/20">🤖</div>
              <div className="space-y-2">
                <h4 className="text-5xl font-black text-white tracking-tighter">{progress}%</h4>
                <p className="text-orange-500 font-black uppercase tracking-[0.3em] animate-pulse text-xs">{statusMsg}</p>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="h-full orange-gradient transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CreateQuiz;
