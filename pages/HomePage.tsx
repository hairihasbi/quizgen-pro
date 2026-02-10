
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { Quiz } from '../types';
import LegalModal from '../components/LegalModal';

interface HomePageProps {
  onLoginClick: () => void;
  onGalleryClick: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onLoginClick, onGalleryClick }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [legalType, setLegalType] = useState<'privacy' | 'terms' | 'cookie' | null>(null);

  useEffect(() => {
    StorageService.getQuizzes().then(all => {
      setQuizzes(all.filter(q => q.isPublished).slice(0, 6));
      setLoading(false);
    });
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white animate-in fade-in duration-1000 scroll-smooth">
      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-orange-100 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          <div className="w-10 h-10 orange-gradient rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-orange-200">Q</div>
          <span className="text-2xl font-black tracking-tighter text-gray-800">QuizGen<span className="text-orange-500">Pro</span></span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-bold text-gray-600">
          <button onClick={onGalleryClick} className="hover:text-orange-500 transition-colors uppercase tracking-widest text-[10px]">Bank Soal</button>
          <button onClick={() => scrollToSection('tentang')} className="hover:text-orange-500 transition-colors uppercase tracking-widest text-[10px]">Tentang Kami</button>
          <button onClick={() => scrollToSection('layanan')} className="hover:text-orange-500 transition-colors uppercase tracking-widest text-[10px]">Layanan</button>
          <button onClick={onLoginClick} className="px-8 py-3 orange-gradient text-white rounded-2xl shadow-xl shadow-orange-200 hover:scale-105 transition-all text-xs uppercase font-black">Portal Guru</button>
        </div>
        <button onClick={onLoginClick} className="md:hidden w-10 h-10 orange-gradient text-white rounded-xl flex items-center justify-center shadow-lg">👤</button>
      </nav>

      {/* Hero Section */}
      <header className="pt-48 pb-28 px-6 text-center overflow-hidden relative">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-orange-100/40 blur-[150px] rounded-full -z-10 animate-pulse"></div>
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-orange-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            <span>Powered by Gemini 3 Pro AI Engine</span>
          </div>
          <h1 className="text-6xl md:text-9xl font-black text-gray-900 tracking-[-0.05em] leading-[0.85]">
            Generate Soal <br /> <span className="text-orange-500 italic drop-shadow-xl">Masa Depan.</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-500 font-medium max-w-3xl mx-auto leading-relaxed">
            Platform kurasi soal kurikulum merdeka tercanggih. Mendukung eksakta, bahasa asing, hingga ilustrasi visual otomatis.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 pt-6">
            <button onClick={onLoginClick} className="w-full md:w-auto px-12 py-6 orange-gradient text-white font-black text-xl rounded-[2.5rem] shadow-2xl shadow-orange-300 hover:scale-105 active:scale-95 transition-all uppercase">
              Mulai Buat Soal AI ➜
            </button>
            <button onClick={onGalleryClick} className="w-full md:w-auto px-12 py-6 bg-white border-4 border-orange-100 text-orange-600 font-black text-xl rounded-[2.5rem] hover:bg-orange-50 transition-all uppercase">
              Jelajahi Bank Soal
            </button>
          </div>
        </div>
      </header>

      {/* Tentang Kami Section */}
      <section id="tentang" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-8">
              <div className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-lg text-[10px] font-black uppercase tracking-widest">Tentang Kami</div>
              <h2 className="text-5xl font-black text-gray-900 leading-tight">Revolusi Digital Untuk <span className="text-orange-500">Pendidik Modern.</span></h2>
              <p className="text-gray-500 text-lg leading-relaxed">
                GenZ QuizGen Pro lahir dari kebutuhan mendesak akan efisiensi dalam dunia pendidikan. Kami menggabungkan kekuatan <b>Google Gemini AI</b> dengan struktur <b>Kurikulum Merdeka</b> untuk membantu guru menciptakan evaluasi berkualitas hanya dalam hitungan detik.
              </p>
              <div className="grid grid-cols-2 gap-8 pt-4">
                <div className="p-6 bg-orange-50 rounded-3xl border border-orange-100">
                  <div className="text-3xl font-black text-orange-600 mb-1">99%</div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Akurasi Kurikulum</div>
                </div>
                <div className="p-6 bg-orange-50 rounded-3xl border border-orange-100">
                  <div className="text-3xl font-black text-orange-600 mb-1">10k+</div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Soal Tergenerate</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square orange-gradient rounded-[4rem] rotate-3 absolute inset-0 opacity-10"></div>
              <div className="relative bg-white p-10 rounded-[4rem] border border-orange-100 shadow-2xl space-y-6">
                <div className="flex gap-4 items-center p-6 bg-orange-50/50 rounded-3xl">
                   <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">🎯</div>
                   <div>
                     <div className="font-black text-gray-800 text-sm uppercase">Visi Inovatif</div>
                     <div className="text-xs text-gray-500">Menciptakan ekosistem bank soal paling presisi di Indonesia.</div>
                   </div>
                </div>
                <div className="flex gap-4 items-center p-6 bg-white border border-gray-100 rounded-3xl shadow-sm">
                   <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-2xl shadow-sm">⚡</div>
                   <div>
                     <div className="font-black text-gray-800 text-sm uppercase">Kecepatan AI</div>
                     <div className="text-xs text-gray-500">Proses generate 10x lebih cepat dibanding menyusun manual.</div>
                   </div>
                </div>
                <div className="flex gap-4 items-center p-6 bg-orange-50/30 rounded-3xl">
                   <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">🧠</div>
                   <div>
                     <div className="font-black text-gray-800 text-sm uppercase">HOTS Oriented</div>
                     <div className="text-xs text-gray-500">Mendukung pembuatan soal level C1 hingga C6 (Mencipta).</div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Layanan Section */}
      <section id="layanan" className="py-32 bg-gray-50 px-6">
        <div className="max-w-7xl mx-auto text-center space-y-16">
          <div className="space-y-4">
            <div className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-lg text-[10px] font-black uppercase tracking-widest">Layanan Utama</div>
            <h2 className="text-5xl font-black text-gray-900 tracking-tight">Solusi End-to-End <br/> <span className="text-orange-500">Penyusunan Evaluasi.</span></h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: '🤖', title: 'Smart AI Generator', desc: 'Generate berbagai tipe soal (PG, Kompleks, Essay) secara otomatis berbasis topik.' },
              { icon: '📐', title: 'Eksakta Ready', desc: 'Dukungan penuh rumus Matematika & Sains menggunakan rendering MathJax 3 yang rapi.' },
              { icon: '🌍', title: 'Multi-Language', desc: 'Mendukung Bahasa Arab, Jepang, Korea, Mandarin, hingga Jerman dengan font khusus.' },
              { icon: '🎨', title: 'Visual AI Stimulus', desc: 'Otomatis menyertakan gambar atau diagram pendukung soal menggunakan Gemini Image.' }
            ].map((s, i) => (
              <div key={i} className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-500 text-left space-y-6">
                <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-4xl shadow-inner">{s.icon}</div>
                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter leading-tight">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bank Soal Preview */}
      <section id="bank-soal" className="py-32 bg-white px-6">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8">
            <div className="space-y-2">
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">Galeri Bank Soal</h2>
              <p className="text-gray-500 font-medium text-lg">Koleksi kurasi terbaik dari para pendidik se-Indonesia.</p>
            </div>
            <button onClick={onGalleryClick} className="px-8 py-4 bg-gray-900 text-white font-black rounded-2xl flex items-center gap-4 hover:bg-orange-600 transition-all uppercase text-xs tracking-widest shadow-2xl">
              Lihat Semua Bank Soal ➜
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-96 bg-gray-200/50 rounded-[4rem] animate-pulse"></div>)
            ) : quizzes.length > 0 ? (
              quizzes.map((quiz, idx) => (
                <div 
                  key={quiz.id} 
                  className="group bg-white p-12 rounded-[4rem] border border-orange-50 shadow-sm hover:shadow-2xl hover:shadow-orange-200/40 transition-all duration-500 flex flex-col h-full animate-in slide-in-from-bottom-10"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="flex justify-between items-start mb-10">
                    <span className="px-5 py-2 bg-orange-50 text-orange-600 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-orange-100">{quiz.subject}</span>
                    <span className="text-gray-200 font-black text-2xl group-hover:text-orange-200 transition-colors">#0{idx+1}</span>
                  </div>
                  <h3 className="text-3xl font-black text-gray-800 group-hover:text-orange-500 transition-colors line-clamp-2 leading-tight mb-6">{quiz.title}</h3>
                  <div className="text-gray-400 text-sm font-medium mb-10 flex-1 flex flex-col gap-2">
                     <div className="flex items-center gap-2"><span>🏷️</span> {quiz.topic}</div>
                     <div className="flex items-center gap-2"><span>📊</span> {quiz.difficulty} • {quiz.questions.length} Soal</div>
                  </div>
                  <div className="flex items-center justify-between pt-8 border-t border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl orange-gradient flex items-center justify-center text-white font-black text-lg shadow-xl">{quiz.authorName?.[0] || 'U'}</div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-800">{quiz.authorName || 'Teacher'}</span>
                        <span className="text-[9px] text-orange-500 font-bold uppercase tracking-widest">Verified Guru</span>
                      </div>
                    </div>
                    <button onClick={onGalleryClick} className="w-14 h-14 bg-gray-50 rounded-[1.5rem] flex items-center justify-center text-gray-400 group-hover:bg-orange-500 group-hover:text-white group-hover:scale-110 transition-all shadow-sm">➜</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-32 text-center text-gray-300 font-black uppercase tracking-[0.3em] italic">No Public Assets Available</div>
            )}
          </div>
        </div>
      </section>

      {/* Hubungi Kami CTA */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto orange-gradient p-16 rounded-[4rem] text-center text-white shadow-3xl shadow-orange-500/20 relative overflow-hidden">
           <div className="relative z-10 space-y-8">
              <h2 className="text-5xl font-black tracking-tighter">Butuh Bantuan Teknis?</h2>
              <p className="text-white/80 font-medium text-xl max-w-2xl mx-auto">Tim support kami siap membantu Anda 24/7 melalui jalur komunikasi prioritas WhatsApp.</p>
              <a href="https://wa.me/085248481527" target="_blank" className="inline-flex items-center gap-4 px-12 py-6 bg-white text-orange-600 font-black rounded-[2.5rem] hover:scale-110 active:scale-95 transition-all shadow-2xl text-xl uppercase">
                <span className="text-3xl">💬</span> Hubungi Admin WA
              </a>
           </div>
           <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        </div>
      </section>

      {/* Modern Footer */}
      <footer className="bg-gray-950 text-white pt-32 pb-16 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-20 relative z-10">
          <div className="col-span-1 md:col-span-2 space-y-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 orange-gradient rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl">Q</div>
              <span className="text-3xl font-black tracking-tighter">QuizGen<span className="text-orange-500">Pro</span></span>
            </div>
            <p className="text-gray-400 font-medium text-lg max-w-md leading-relaxed">
              Membantu ribuan pendidik menciptakan pengalaman belajar masa depan yang presisi, kreatif, dan inklusif.
            </p>
            <div className="flex gap-6">
               <button className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-orange-500 transition-all border border-white/10 text-[10px] font-black uppercase">FB</button>
               <button className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-orange-500 transition-all border border-white/10 text-[10px] font-black uppercase">IG</button>
               <button className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-orange-500 transition-all border border-white/10 text-[10px] font-black uppercase">TW</button>
            </div>
          </div>
          <div className="space-y-8">
            <h4 className="font-black text-xs uppercase tracking-[0.3em] text-orange-500">Navigasi</h4>
            <ul className="space-y-5 text-gray-400 font-bold text-sm">
              <li><button onClick={() => scrollToSection('top')} className="hover:text-white transition-colors uppercase tracking-widest text-[10px]">Beranda Utama</button></li>
              <li><button onClick={onGalleryClick} className="hover:text-white transition-colors uppercase tracking-widest text-[10px]">Bank Soal AI</button></li>
              <li><button onClick={() => scrollToSection('tentang')} className="hover:text-white transition-colors uppercase tracking-widest text-[10px]">Visi & Misi</button></li>
              <li><button onClick={() => scrollToSection('layanan')} className="hover:text-white transition-colors uppercase tracking-widest text-[10px]">Fitur Engine</button></li>
            </ul>
          </div>
          <div className="space-y-8">
            <h4 className="font-black text-xs uppercase tracking-[0.3em] text-orange-500">Legal & Support</h4>
            <div className="space-y-6">
              <ul className="space-y-5 text-gray-400 font-bold text-sm">
                <li><button onClick={() => setLegalType('privacy')} className="hover:text-white transition-colors uppercase tracking-widest text-[10px]">Privacy Policy</button></li>
                <li><button onClick={() => setLegalType('terms')} className="hover:text-white transition-colors uppercase tracking-widest text-[10px]">Terms of Service</button></li>
                <li><button onClick={() => setLegalType('cookie')} className="hover:text-white transition-colors uppercase tracking-widest text-[10px]">Cookie Policy</button></li>
              </ul>
              <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest pt-6 border-t border-white/5">
                © 2024 GenZ QuizGen Pro. <br/> Built with Gemini & Turso.
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-32 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em]">
            MADE BY GENZ EDU-TECH COLLECTIVE
          </p>
          <div className="flex gap-6 text-[10px] font-black text-gray-600 uppercase tracking-widest">
             <span>v3.1 STABLE</span>
             <span>Region: ASIA/ID</span>
          </div>
        </div>
      </footer>

      {legalType && <LegalModal type={legalType} onClose={() => setLegalType(null)} />}
    </div>
  );
};

export default HomePage;
