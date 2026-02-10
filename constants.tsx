
export const RELIGIONS = [
  "Pendidikan Agama Islam & Budi Pekerti",
  "Pendidikan Agama Kristen & Budi Pekerti",
  "Pendidikan Agama Katolik & Budi Pekerti",
  "Pendidikan Agama Hindu & Budi Pekerti",
  "Pendidikan Agama Budha & Budi Pekerti",
  "Pendidikan Agama Khonghucu & Budi Pekerti"
];

export const SUBJECT_DATA: Record<string, Record<string, string[]>> = {
  "SD": {
    "Pendidikan Agama": [...RELIGIONS],
    "Umum": ["Pendidikan Pancasila", "Bahasa Indonesia", "Matematika", "IPAS", "Seni Musik", "Seni Rupa", "Seni Teater", "Seni Tari", "PJOK", "Bahasa Inggris"],
    "Muatan Lokal": ["Bahasa Daerah", "Prakarya"]
  },
  "SMP": {
    "Pendidikan Agama": [...RELIGIONS],
    "Umum": ["Pendidikan Pancasila", "Bahasa Indonesia", "Matematika", "IPA", "IPS", "Bahasa Inggris", "PJOK", "Informatika", "Seni & Prakarya"],
    "Pilihan": ["Bahasa Asing Lainnya", "Bahasa Daerah"]
  },
  "MTS": {
    "Keagamaan (Kemenag)": ["Al-Qur'an Hadis", "Akidah Akhlak", "Fikih", "Sejarah Kebudayaan Islam (SKI)", "Bahasa Arab"],
    "Pendidikan Agama Lain": [...RELIGIONS.filter(r => !r.includes("Islam"))],
    "Umum": ["Pendidikan Pancasila", "Bahasa Indonesia", "Matematika", "IPA", "IPS", "Bahasa Inggris", "PJOK", "Informatika"]
  },
  "SMA": {
    "Pendidikan Agama": [...RELIGIONS],
    "Wajib Umum": ["Pendidikan Pancasila", "Bahasa Indonesia", "Matematika", "Bahasa Inggris", "Sejarah", "PJOK", "Informatika", "Seni Musik", "Seni Rupa", "Seni Teater", "Seni Tari"],
    "Peminatan IPA": ["Fisika", "Kimia", "Biologi", "Matematika Tingkat Lanjut"],
    "Peminatan IPS": ["Ekonomi", "Sosiologi", "Geografi", "Antropologi"],
    "Bahasa & Budaya": ["Bahasa & Sastra Indonesia", "Bahasa & Sastra Inggris", "Bahasa Arab", "Bahasa Mandarin", "Bahasa Jepang", "Bahasa Korea", "Bahasa Jerman", "Bahasa Perancis"]
  },
  "MA": {
    "Keagamaan (Kemenag)": ["Al-Qur'an Hadis", "Akidah Akhlak", "Fikih", "Sejarah Kebudayaan Islam (SKI)", "Bahasa Arab"],
    "Pendidikan Agama Lain": [...RELIGIONS.filter(r => !r.includes("Islam"))],
    "Umum": ["Pendidikan Pancasila", "Bahasa Indonesia", "Matematika", "Bahasa Inggris", "Sejarah", "PJOK", "Informatika"],
    "Peminatan": ["Fisika", "Kimia", "Biologi", "Ekonomi", "Sosiologi", "Geografi"]
  },
  "SMK": {
    "Pendidikan Agama": [...RELIGIONS],
    "Umum": ["Pendidikan Pancasila", "Bahasa Indonesia", "PJOK", "Sejarah", "Seni Budaya"],
    "Kejuruan Dasar": ["Matematika Kejuruan", "Bahasa Inggris Kejuruan", "Informatika", "Proyek IPAS"],
    "Konsentrasi Vokasi": ["Dasar-dasar Teknik Mesin", "Dasar-dasar Ketenagalistrikan", "Dasar-dasar Animasi", "Dasar-dasar Pemasaran", "Pengembangan Perangkat Lunak & GIM", "Akuntansi & Keuangan Lembaga"]
  },
  "SLB": {
    "Pendidikan Agama": [...RELIGIONS.map(r => r + " Inklusif")],
    "Umum Inklusif": ["PPKN Inklusif", "Bahasa Indonesia Inklusif", "Matematika Inklusif", "IPAS Inklusif", "Seni & Budaya Inklusif", "PJOK Inklusif"],
    "Keterampilan": ["Program Kebutuhan Khusus", "Keterampilan Pilihan", "Teknologi Informasi Inklusif"]
  }
};

export const LEVEL_CONFIG: Record<string, { grades: string[] }> = {
  "SD": { grades: ["Kelas 1", "Kelas 2", "Kelas 3", "Kelas 4", "Kelas 5", "Kelas 6"] },
  "SMP": { grades: ["Kelas 7", "Kelas 8", "Kelas 9"] },
  "MTS": { grades: ["Kelas 7", "Kelas 8", "Kelas 9"] },
  "SMA": { grades: ["Kelas 10", "Kelas 11", "Kelas 12"] },
  "MA": { grades: ["Kelas 10", "Kelas 11", "Kelas 12"] },
  "SMK": { grades: ["Kelas 10", "Kelas 11", "Kelas 12", "Kelas 13"] },
  "SLB": { grades: ["Kelas 1-6 (SD)", "Kelas 7-9 (SMP)", "Kelas 10-12 (SMA)"] }
};

export const COGNITIVE_LEVELS = ["C1 - Mengingat", "C2 - Memahami", "C3 - Menerapkan", "C4 - Menganalisis", "C5 - Mengevaluasi", "C6 - Mencipta"];

export const ORANGE_THEME = {
  primary: "orange-500",
  secondary: "orange-600",
  accent: "orange-400",
  light: "orange-50",
  gradient: "from-orange-500 to-red-500"
};
