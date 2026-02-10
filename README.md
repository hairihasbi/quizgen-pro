# 🚀 Panduan Deployment GenZ QuizGen Pro

Aplikasi ini adalah platform pembuat soal berbasis AI yang menggunakan **Google Gemini**, **Turso (SQLite)**, **Doku (Payment)**, dan **Resend (Email)**. Ikuti langkah-langkah di bawah ini untuk melakukan deployment ke **Vercel**.

## 📋 Persyaratan Akun
Sebelum memulai, pastikan Anda memiliki akun di layanan berikut:
1. [Vercel](https://vercel.com/) (Hosting & Serverless)
2. [Turso](https://turso.tech/) (Database SQLite Cloud)
3. [Google AI Studio](https://aistudio.google.com/) (API Gemini)
4. [Google Cloud Console](https://console.cloud.google.com/) (Ekspor Forms/Docs)
5. [Doku Sandbox/Production](https://doku.com/) (Pembayaran)
6. [Resend](https://resend.com/) (Notifikasi Email)

---

## 🛠️ Langkah 1: Persiapan Database (Turso)
1. Buat database baru di Turso (misal: `quizgen-db`).
2. Dapatkan **Database URL** (contoh: `libsql://db-name-user.turso.io`).
3. Dapatkan **Auth Token**.
4. Simpan kedua nilai ini untuk dimasukkan ke Environment Variables Vercel nanti.

## 🧠 Langkah 2: Persiapan AI (Google Gemini)
1. Buka Google AI Studio.
2. Buat API Key baru.
3. Kunci ini akan digunakan sebagai `API_KEY`.

## 📄 Langkah 3: Persiapan Google Integration (Forms & Docs)
1. Buka Google Cloud Console.
2. Buat Project baru.
3. Aktifkan API berikut: **Google Forms API** dan **Google Docs API**.
4. Konfigurasi **OAuth Consent Screen** (Internal/External).
5. Buat **OAuth 2.0 Client ID** (Tipe: Web Application).
6. Tambahkan URL aplikasi Anda (contoh: `https://app-anda.vercel.app`) ke dalam:
   - **Authorized JavaScript Origins**
   - **Authorized Redirect URIs**
7. Catat **Client ID**-nya.

## 💳 Langkah 4: Persiapan Pembayaran (Doku)
1. Login ke Dashboard Doku (Sandbox untuk testing).
2. Ambil **Client ID** dan **Secret Key** dari menu konfigurasi API.
3. Set **Notification URL** ke: `https://app-anda.vercel.app/api/webhook`.

## 📧 Langkah 5: Persiapan Email (Resend)
1. Buat API Key di Resend.
2. Verifikasi domain Anda di Resend agar email tidak masuk ke folder spam.

---

## 🚀 Langkah 6: Deployment ke Vercel

### 1. Hubungkan ke GitHub
Push kode Anda ke repository GitHub, lalu import ke Vercel.

### 2. Konfigurasi Environment Variables
Di Dashboard Vercel, masuk ke **Settings > Environment Variables** dan tambahkan variabel berikut:

| Key | Value (Contoh/Sumber) |
|---|---|
| `TURSO_DB_URL` | `libsql://nama-db.turso.io` |
| `TURSO_AUTH_TOKEN` | (Token dari Turso) |
| `API_KEY` | (API Key dari Google AI Studio) |
| `GOOGLE_CLIENT_ID` | (Client ID dari Google Cloud Console) |
| `DOKU_CLIENT_ID` | (Client ID dari Doku) |
| `DOKU_SECRET_KEY` | (Secret Key dari Doku) |
| `RESEND_API_KEY` | `re_123456789` (dari Resend) |
| `CRON_SECRET` | `qzgen_live_secure_v3_8d2f5a1e9c7b4d6e1f0a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d` |

### 3. Deploy
Klik tombol **Deploy**. Vercel akan memproses build dan menjalankan fungsi API secara otomatis.

---

## ⏰ Langkah 7: Aktivasi Cron Job (Opsional tapi Disarankan)
Vercel akan mendeteksi file `vercel.json` dan folder `api/cron.ts`. Untuk mengaktifkan jadwal pembersihan database otomatis:
1. Di Dashboard Vercel, buka tab **Settings**.
2. Pilih menu **Cron Jobs**.
3. Pastikan endpoint `/api/cron` terdaftar (terjadi otomatis jika menggunakan `vercel.json`).
4. Sistem akan membersihkan log lama setiap jam secara otomatis.

---

## 🧪 Langkah 8: Inisialisasi Admin
Setelah aplikasi live:
1. Buka URL aplikasi Anda.
2. Login pertama kali menggunakan akun default:
   - **Username**: `hairi`
   - **Password**: `Midorima88@@`
3. Segera ganti password Anda di menu manajemen user (jika tersedia) atau melalui database untuk keamanan.
4. Pastikan untuk menambahkan API Key Gemini melalui menu **API Keys** di dalam aplikasi agar fitur generator berfungsi.

## 🆘 Troubleshooting
- **Gagal Generate**: Cek apakah API Key Gemini aktif dan tidak terkena limit (Quota).
- **Email Tidak Terkirim**: Pastikan `RESEND_API_KEY` benar dan domain sudah diverifikasi di dashboard Resend.
- **Ekspor Google Gagal**: Pastikan URL domain Anda sudah terdaftar di **Authorized JavaScript Origins** pada Google Cloud Console.

---
*Dibuat dengan ❤️ oleh GenZ QuizGen Collective.*
