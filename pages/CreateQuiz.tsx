
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { SUBJECT_DATA, LEVEL_CONFIG, COGNITIVE_LEVELS } from '../constants';
import { QuestionType, Quiz, AIProgressEvent, LogCategory, UserRole } from '../types';
import { realtimeService } from '../services/realtimeService';
import { Sparkles, BrainCircuit, BookOpen, Layers, FileText, Loader2, Image as ImageIcon, Brain, CheckCircle2, ArrowRight, AlertCircle, RefreshCw, Archive } from 'lucide-react';

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
    cognitiveLevels: ['C2 - Memahami', 'C4 - Menganalisis'],
    imageQuestionsCount: 0,
    literacyMode: 'Tanpa Wacana',
    questionsPerPassage: 3, 
    model: 'gemini-2.5-flash'
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [workbenchData, setWorkbenchData] = useState<any>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

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
    if (!formData.title || !formData.topic) return alert('Lengkapi Judul dan Topik Soal terlebih dahulu!');
    if (!formData.subject) return alert('Silakan pilih Mata Pelajaran terlebih dahulu!');

    if (user.role !== UserRole.ADMIN && (user.credits || 0) <= 0) {
      return alert('Kredit Anda tidak mencukupi untuk membuat soal. Silakan hubungi admin atau lakukan top up.');
    }

    setIsGenerating(true);
    setGenerationError(null);
    setProgress(5);
    setStatusMsg('Menghubungkan ke Neural Engine & Cluster API...');
    
    realtimeService.connect(window.crypto.randomUUID().substring(0,8), (event: AIProgressEvent) => {
      setProgress(event.percentage);
      setStatusMsg(event.message);
    });

    try {
      const gemini = new GeminiService();
      const result = await gemini.generateQuiz(formData);
      
      if (!result || !result.questions || !Array.isArray(result.questions) || result.questions.length === 0) {
        throw new Error("AI tidak menghasilkan butir soal yang valid. Silakan periksa kembali pengaturan API Key di Admin / LiteLLM atau gunakan parameter topik yang lebih detail.");
      }

      setStatusMsg('Memproses ilustrasi & stimulus naskah...');
      const processedQuestions = await Promise.all(result.questions.map(async (q: any, idx: number) => {
        let imageUrl = '';
        if (formData.imageQuestionsCount > 0 && idx < Math.min(formData.imageQuestionsCount, 3)) {
          try {
            imageUrl = await gemini.generateVisual(q.text);
          } catch (imgErr) {
            console.warn('[IMAGE_GEN_SKIPPED]', imgErr);
          }
        }
        return { ...q, id: window.crypto.randomUUID(), image: imageUrl };
      }));

      // OTOMATIS SIMPAN KE ARSIP & RIWAYAT
      const newQuiz: Quiz = {
        id: window.crypto.randomUUID(),
        title: formData.title,
        subject: formData.subject,
        level: formData.level,
        grade: formData.grade,
        topic: formData.topic,
        difficulty: formData.difficulty as any,
        questions: processedQuestions,
        grid: result.grid || '',
        authorId: String(user.id),
        authorName: user.username || user.fullName || 'Guru',
        isPublished: false,
        createdAt: new Date().toISOString(),
        status: 'completed'
      };

      await StorageService.saveQuizzes([newQuiz]);

      // Kurangi kredit jika user adalah guru
      if (user.role !== UserRole.ADMIN) {
        const updatedCredits = Math.max(0, (user.credits || 1) - 1);
        await StorageService.updateUser(user.id, { credits: updatedCredits });
        user.credits = updatedCredits;
      }

      // Catat log
      await StorageService.addLog({
        id: window.crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        category: LogCategory.SYSTEM,
        action: 'GENERATE_QUIZ',
        details: `Quiz "${newQuiz.title}" (${newQuiz.questions.length} soal) berhasil dibuat & otomatis tersimpan di riwayat.`,
        status: 'success',
        userId: String(user.id)
      });

      realtimeService.reportCompletion("100% Selesai! Naskah berhasil disimpan di Riwayat.");
      setProgress(100);

      // Tunggu sejenak agar animasi 100% terlihat
      setTimeout(() => {
        setWorkbenchData({ ...result, questions: processedQuestions, quizId: newQuiz.id });
        setIsGenerating(false);
        realtimeService.disconnect();
      }, 500);

    } catch (e: any) {
      console.error('[GENERATION_ERROR]', e);
      realtimeService.disconnect();
      setIsGenerating(false);
      setGenerationError(e.message || 'Terjadi kesalahan saat memproses generasi soal dengan AI.');
    }
  };

  const handleReset = () => {
    setWorkbenchData(null);
    setFormData(prev => ({ ...prev, title: '', topic: '' }));
  };

  if (workbenchData) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 animate-in zoom-in-95 pb-20">
        <div className="bg-white p-8 md:p-10 rounded-[3rem] shadow-2xl border border-orange-100">
           {/* Success Banner */}
           <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-emerald-200">
                   <CheckCircle2 size={28} />
                 </div>
                 <div>
                   <h3 className="text-base font-black text-emerald-900 uppercase tracking-tight">Soal Berhasil Disintesis & Tersimpan di Riwayat!</h3>
                   <p className="text-xs font-medium text-emerald-700">Naskah telah otomatis masuk ke <b>Riwayat & Arsip</b>. Anda dapat langsung mengunduh/ekspor (PDF, DOCX, XLSX) atau membuka viewer.</p>
                 </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                 <button 
                   onClick={onSuccess} 
                   className="flex-1 md:flex-none px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 hover:scale-105 transition-all"
                 >
                   <Archive size={16} /> Buka di Riwayat ➜
                 </button>
              </div>
           </div>

           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b pb-6 gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">{formData.title || 'Naskah Evaluasi'}</h2>
                <p className="text-xs text-orange-500 font-bold uppercase tracking-wider mt-1">{formData.subject} • {formData.level} {formData.grade} • {formData.count} Butir Soal</p>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                 <button onClick={handleReset} className="flex-1 sm:flex-none px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black rounded-2xl text-[10px] uppercase transition-all flex items-center justify-center gap-2">
                   <RefreshCw size={14} /> Buat Soal Baru
                 </button>
                 <button onClick={onSuccess} className="flex-1 sm:flex-none px-8 py-3 orange-gradient text-white font-black rounded-2xl shadow-xl text-[10px] uppercase flex items-center justify-center gap-2 hover:scale-105 transition-all">
                   Lihat di Riwayat <ArrowRight size={14} />
                 </button>
              </div>
           </div>

           <div className="space-y-10">
              {workbenchData.questions.map((q: any, idx: number) => (
                <div key={q.id || idx} className="p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <div className="flex justify-between mb-4">
                     <span className="bg-orange-500 text-white px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg">Soal #{idx + 1}</span>
                     <div className="flex gap-2">
                        <span className="text-[9px] font-bold bg-blue-100 text-blue-600 px-3 py-1 rounded-lg uppercase">{q.cognitiveLevel}</span>
                        <span className="text-[9px] font-bold bg-gray-200 text-gray-600 px-3 py-1 rounded-lg uppercase">{q.type}</span>
                     </div>
                  </div>
                  {q.passage && (
                    <div className="mb-6 p-6 bg-white border-l-4 border-orange-500 italic text-sm text-gray-600 leading-relaxed shadow-sm rounded-r-2xl">
                      <div className="text-[8px] font-black uppercase text-orange-400 mb-2">Stimulus Literasi:</div>
                      {q.passage}
                    </div>
                  )}
                  <div className="text-lg font-bold text-gray-800 mb-6">{q.text}</div>
                  {q.image && <img src={q.image} className="max-w-md rounded-2xl mb-6 shadow-md border bg-white" alt="Stimulus" />}
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
                  <div className="mt-6 pt-4 border-t border-dashed flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="text-xs text-emerald-600 font-bold uppercase tracking-widest">KUNCI: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</div>
                    <div className="text-[10px] text-gray-400 font-medium italic">Indikator: {q.indicator || '-'}</div>
                  </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in pb-20">
      <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-orange-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 orange-gradient rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl shadow-orange-200"><BrainCircuit size={42} /></div>
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Quiz <span className="text-orange-500">Generator</span></h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Sintesis Soal Berbasis Bloom's Taxonomy & Kurikulum Merdeka</p>
          </div>
        </div>
        <div className="flex items-center gap-10">
            <div className="text-right">
               <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Sisa Kredit</p>
               <p className="text-3xl font-black text-orange-600 tracking-tight">{user.credits} 🪙</p>
            </div>
        </div>
      </div>

      {generationError && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-[2.5rem] p-8 flex items-start gap-4 animate-in shake">
           <div className="p-3 bg-rose-500 text-white rounded-2xl">
             <AlertCircle size={28} />
           </div>
           <div className="flex-1 space-y-2">
              <h3 className="font-black text-rose-900 text-sm uppercase tracking-wide">Gagal Menghasilkan Soal</h3>
              <p className="text-xs text-rose-700 leading-relaxed font-medium">{generationError}</p>
              <div className="pt-2 flex gap-3">
                 <button onClick={() => setGenerationError(null)} className="px-5 py-2 bg-white border border-rose-300 text-rose-700 font-bold rounded-xl text-xs hover:bg-rose-100 transition-all">
                   Tutup Pesan
                 </button>
                 <button onClick={startGeneration} className="px-5 py-2 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 transition-all">
                   Coba Lagi
                 </button>
              </div>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-orange-50 space-y-10">
              {/* Identitas Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-l-4 border-orange-500 pl-4">
                  <FileText className="text-orange-500" size={20} />
                  <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Identitas Evaluasi</h3>
                </div>
                <input type="text" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold transition-all" placeholder="Judul Dokumen (Contoh: UH-1 Eksponen & Logaritma)" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
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
                    <option value="">Pilih Mata Pelajaran</option>
                    {Object.entries(SUBJECT_DATA[formData.level] || {}).map(([cat, list]) => (
                      <optgroup key={cat} label={cat}>{list.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                    ))}
                  </select>
                  <input type="text" className="px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-orange-500 outline-none font-bold" placeholder="Topik Materi Spesifik" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} />
                </div>
              </div>

              {/* Tipe Soal Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-l-4 border-orange-500 pl-4">
                  <Layers className="text-orange-500" size={20} />
                  <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Parameter Struktur</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.values(QuestionType).map(type => (
                    <button key={type} onClick={() => toggleArrayItem('questionTypes', type)} className={`px-4 py-3 rounded-xl text-[9px] font-black uppercase transition-all border-2 ${formData.questionTypes.includes(type) ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-gray-50 text-gray-400 border-transparent hover:bg-orange-100'}`}>
                      {type}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between p-5 bg-orange-50 rounded-2xl border-2 border-dashed border-orange-200">
                   <span className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Opsi Pilihan Ganda:</span>
                   <div className="flex items-center gap-4">
                      <input type="range" min="3" max="5" step="1" className="accent-orange-600" value={formData.optionCount} onChange={e => setFormData({...formData, optionCount: parseInt(e.target.value)})} />
                      <span className="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-black text-orange-600 shadow-sm">{formData.optionCount}</span>
                   </div>
                </div>
              </div>

              {/* Level Kognitif Section */}
              <div className="space-y-6">
                 <div className="flex items-center gap-3 border-l-4 border-orange-500 pl-4">
                  <Brain className="text-orange-500" size={20} />
                  <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Level Kognitif Bloom</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                   {COGNITIVE_LEVELS.map(lvl => (
                     <button key={lvl} onClick={() => toggleArrayItem('cognitiveLevels', lvl)} className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border-2 ${formData.cognitiveLevels.includes(lvl) ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-gray-50 text-gray-400 border-transparent'}`}>
                        {lvl}
                     </button>
                   ))}
                </div>
              </div>

              {/* Literasi Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-l-4 border-orange-500 pl-4">
                  <BookOpen className="text-orange-500" size={20} />
                  <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Literasi & Visual Stimulus</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select className="px-6 py-4 rounded-2xl bg-gray-50 font-bold outline-none border-2 border-transparent focus:border-orange-500" value={formData.literacyMode} onChange={e => setFormData({...formData, literacyMode: e.target.value})}>
                    <option value="Tanpa Wacana">Tanpa Wacana</option>
                    <option value="Wacana Per Soal">Unik Per Soal (Full Literacy)</option>
                    <option value="Wacana Per Grup">Grup (Satu Wacana Banyak Soal)</option>
                  </select>
                  <div className="flex items-center gap-3 bg-orange-50 p-4 rounded-2xl border border-orange-100">
                     <ImageIcon size={18} className="text-orange-500" />
                     <span className="text-[10px] font-black uppercase text-orange-800 flex-1">Butir Bergambar (Maks 3):</span>
                     <input type="number" min="0" max="3" className="w-14 bg-white border border-orange-200 rounded-lg text-center font-black py-1.5" value={formData.imageQuestionsCount} onChange={e => setFormData({...formData, imageQuestionsCount: Math.min(3, parseInt(e.target.value) || 0)})} />
                  </div>
                </div>
              </div>

              <button onClick={startGeneration} disabled={isGenerating} className="w-full py-8 orange-gradient text-white font-black rounded-[2.5rem] text-xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all uppercase flex items-center justify-center gap-4">
                {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {isGenerating ? "MENSINTESIS SOAL..." : "GENERATE NASKAH SEKARANG ➜"}
              </button>
           </div>
        </div>

        <div className="space-y-8">
           <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm space-y-6">
              <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest text-center">Engine Parameters</h3>
              <div className="space-y-5">
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Jumlah Soal</label>
                    <input type="number" className="w-full px-6 py-4 rounded-2xl bg-gray-50 font-black outline-none border-2 border-transparent focus:border-orange-500" value={formData.count} onChange={e => setFormData({...formData, count: Math.min(50, parseInt(e.target.value) || 1)})} />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Tingkat Kesulitan Dasar</label>
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
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div className="h-full orange-gradient transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CreateQuiz;
