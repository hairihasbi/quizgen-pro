
import { EmailNotification, User } from '../types';
import { StorageService } from './storageService';

export const EmailService = {
  fetchNotifications: async (userId: string, page: number = 1, limit: number = 10): Promise<{ emails: EmailNotification[], hasMore: boolean }> => {
    try {
      const users = await StorageService.getUsers();
      const user = users.find(u => u.id === userId);
      if (!user) return { emails: [], hasMore: false };

      const userEmail = user.email || `${user.username}@quizgen.pro`;
      
      if (!StorageService.isLocal()) {
        try {
          const response = await fetch(`/api/notifications?userId=${userId}&page=${page}&limit=${limit}`);
          if (response.ok) {
            return await response.json();
          }
        } catch (e) {
          console.warn("API Notification failed, falling back to StorageService cache.");
        }
      }

      return await StorageService.getEmailsPaged(userEmail, page, limit);
    } catch (e) {
      console.error("Fetch Inbox Error:", e);
      return { emails: [], hasMore: false };
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      await StorageService.markEmailAsRead(notificationId);
      if (!StorageService.isLocal()) {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: notificationId })
        });
      }
    } catch (e) {
      console.error("Mark Read Error:", e);
    }
  },

  /**
   * Mengirim notifikasi. 
   * @param forceRealEmail Jika true, akan dikirim ke Resend. Jika false (default), hanya masuk Inbox Internal.
   */
  send: async (toEmail: string, type: 'success' | 'error' | 'warning' | 'info', subject: string, message: string, forceRealEmail: boolean = false) => {
    try {
      const newNotif: EmailNotification = {
        id: crypto.randomUUID(),
        to: toEmail,
        subject,
        body: message,
        type,
        timestamp: new Date().toISOString(),
        isRead: false
      };

      // 1. Simpan ke Database (Internal Inbox) - SELALU DILAKUKAN
      await StorageService.addEmail(newNotif);

      // 2. Kirim ke API Email Asli (Resend) - HANYA JIKA DIPAKSA (Misal: Pembayaran / Approval Akun)
      if (!StorageService.isLocal() && forceRealEmail) {
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            to: toEmail, 
            subject: subject, 
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #eee; border-radius: 20px;">
                <h2 style="color: #ff8c00;">GenZ QuizGen Pro</h2>
                <h3 style="color: #333;">${subject}</h3>
                <p style="color: #666; font-size: 16px; line-height: 1.6;">${message}</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
                <p style="color: #999; font-size: 12px; text-align: center;">Dibuat otomatis oleh Sistem Notifikasi Real-time QuizGen Pro.</p>
              </div>
            `
          })
        }).catch(err => console.error("Real email dispatch skipped/failed:", err));
      } else {
        console.log(`[NOTIF] Message "${subject}" handled INTERNALLY to save Resend quota.`);
      }
    } catch (e) {
      console.error("Send Notif Error:", e);
    }
  },

  notifyQuizSuccess: async (user: User, quizTitle: string) => {
    const email = user.email || `${user.username}@quizgen.pro`;
    // Kita set forceRealEmail = false agar hemat kuota Resend
    await EmailService.send(
      email, 
      'success', 
      '✅ Quiz Berhasil Diterbitkan!', 
      `Halo ${user.username}, Quiz "${quizTitle}" telah berhasil disusun oleh Gemini AI Engine dan siap digunakan.`,
      false 
    );
  },

  notifyUserApproval: async (user: User) => {
    const email = user.email || `${user.username}@quizgen.pro`;
    // Gunakan forceRealEmail = true agar guru tahu akunnya sudah aktif lewat email asli
    await EmailService.send(
      email,
      'success',
      '🎉 Selamat! Akun QuizGen Pro Anda Telah Aktif',
      `Halo ${user.fullName || user.username},\n\nPendaftaran Anda telah disetujui oleh tim Admin. Anda sekarang dapat masuk ke portal guru untuk mulai membuat soal otomatis menggunakan Gemini 3 Pro AI Engine.\n\nSebagai bonus awal, kami telah menambahkan 2 Kredit Gratis ke akun Anda.\n\nSelamat berkarya!`,
      true
    );
  }
};
