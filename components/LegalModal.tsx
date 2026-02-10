
import React from 'react';

interface LegalModalProps {
  type: 'privacy' | 'terms' | 'cookie' | null;
  onClose: () => void;
}

const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  const content = {
    privacy: {
      title: 'Kebijakan Privasi',
      subtitle: 'Data Anda Aman Bersama Kami',
      body: `
        <p>Di GenZ QuizGen Pro, kami memprioritaskan keamanan data pendidik. Berikut adalah poin utama kebijakan privasi kami:</p>
        <h4 class="font-black text-orange-600 mt-6 uppercase text-[10px] tracking-widest">1. Pengolahan Data AI</h4>
        <p>Ringkasan materi atau file teks yang Anda unggah diproses secara temporal oleh Google Gemini AI untuk pembuatan soal. Kami tidak menyimpan konten materi asli Anda setelah proses selesai.</p>
        <h4 class="font-black text-orange-600 mt-6 uppercase text-[10px] tracking-widest">2. Penyimpanan Cloud</h4>
        <p>Data hasil generate soal, riwayat transaksi, dan profil disimpan secara aman di infrastruktur Turso SQLite Cloud dengan enkripsi tingkat lanjut.</p>
        <h4 class="font-black text-orange-600 mt-6 uppercase text-[10px] tracking-widest">3. Data Pembayaran</h4>
        <p>Kami tidak menyimpan data kartu atau kredensial perbankan Anda. Semua proses transaksi dilakukan langsung di gateway DOKU yang telah tersertifikasi PCI-DSS.</p>
      `
    },
    terms: {
      title: 'Syarat & Ketentuan',
      subtitle: 'Aturan Penggunaan Platform',
      body: `
        <p>Dengan menggunakan platform ini, Anda setuju untuk mematuhi ketentuan berikut:</p>
        <h4 class="font-black text-orange-600 mt-6 uppercase text-[10px] tracking-widest">1. Penggunaan Kredit</h4>
        <p>Setiap proses generate soal mengonsumsi 1 (satu) Kredit AI. Kredit yang sudah dibeli tidak dapat diuangkan kembali (non-refundable), namun berlaku selamanya tanpa masa hangus.</p>
        <h4 class="font-black text-orange-600 mt-6 uppercase text-[10px] tracking-widest">2. Integritas Konten</h4>
        <p>Dilarang menggunakan platform untuk membuat konten yang melanggar hukum, mengandung SARA, atau bertujuan untuk kecurangan akademik yang merugikan pihak lain.</p>
        <h4 class="font-black text-orange-600 mt-6 uppercase text-[10px] tracking-widest">3. Batasan Tanggung Jawab</h4>
        <p>Hasil generate AI mungkin memerlukan review manusia. Pengguna bertanggung jawab penuh atas validasi akhir soal sebelum didistribusikan kepada siswa.</p>
      `
    },
    cookie: {
      title: 'Kebijakan Cookie',
      subtitle: 'Pengalaman Browsing yang Personal',
      body: `
        <p>Kami menggunakan teknologi penyimpanan lokal untuk meningkatkan fungsionalitas aplikasi:</p>
        <h4 class="font-black text-orange-600 mt-6 uppercase text-[10px] tracking-widest">1. Sesi Login</h4>
        <p>Kami menyimpan token sesi di browser Anda agar Anda tidak perlu login berulang kali setiap kali membuka tab baru.</p>
        <h4 class="font-black text-orange-600 mt-6 uppercase text-[10px] tracking-widest">2. Preferensi Tema</h4>
        <p>Konfigurasi tampilan dan pengaturan Cloud Database disimpan secara lokal untuk memastikan aplikasi berjalan sesuai keinginan Anda.</p>
        <h4 class="font-black text-orange-600 mt-6 uppercase text-[10px] tracking-widest">3. Analitik Internal</h4>
        <p>Kami menggunakan data anonim untuk memantau kesehatan server dan kecepatan respons AI demi meningkatkan layanan kami.</p>
      `
    }
  };

  const active = content[type];

  return (
    <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-xl z-[999] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-500">
        <header className="p-10 orange-gradient text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-3xl font-black tracking-tighter uppercase">{active.title}</h2>
            <p className="text-white/70 font-bold text-[10px] uppercase tracking-widest mt-1">{active.subtitle}</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 bg-white/20 hover:bg-white/40 rounded-2xl flex items-center justify-center text-2xl transition-all">✕</button>
        </header>
        
        <div className="p-10 overflow-y-auto custom-scrollbar flex-1">
          <div className="prose prose-orange max-w-none text-gray-600 leading-relaxed space-y-4" dangerouslySetInnerHTML={{ __html: active.body }}></div>
        </div>

        <footer className="p-8 border-t bg-gray-50 flex justify-center shrink-0">
          <button onClick={onClose} className="px-10 py-4 bg-gray-900 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-lg hover:bg-orange-600 transition-all">SAYA MENGERTI</button>
        </footer>
      </div>
    </div>
  );
};

export default LegalModal;
