
import { createClient } from '@libsql/client';

/**
 * World Class Email Dispatcher
 * Menangani pengiriman email asli menggunakan Provider yang dikonfigurasi Admin.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  if (!TURSO_URL) return res.status(500).json({ message: 'DB Config missing' });
  const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  const { to, subject, html } = req.body;

  try {
    // 1. Ambil Pengaturan Email dari DB
    const settingsRes = await db.execute("SELECT data FROM email_settings WHERE id = 'global'");
    if (settingsRes.rows.length === 0) {
      return res.status(500).json({ message: 'Email service is not configured by admin' });
    }

    const settings = JSON.parse(settingsRes.rows[0].data as string);
    
    // Fallback ke Environment Variable jika API Key kosong di DB (untuk keamanan Vercel)
    const apiKey = settings.apiKey || process.env.RESEND_API_KEY;

    if (settings.provider === 'none' || !apiKey) {
      console.log("[EMAIL_SERVICE] Provider disabled or API Key missing. Skipping real email.");
      return res.status(200).json({ status: 'skipped', reason: 'disabled' });
    }

    // 2. Pilih Logic berdasarkan Provider (Mendukung Resend saat ini, SMTP di masa depan)
    if (settings.provider === 'resend') {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `${settings.senderName} <${settings.fromEmail}>`,
          to: [to],
          subject: subject,
          html: html
        })
      });

      const result = await resendRes.json();
      if (!resendRes.ok) throw new Error(result.message || 'Resend API Error');

      return res.status(200).json({ status: 'sent', provider: 'resend', id: result.id });
    }

    // 3. Placeholder untuk SMTP (Bisa menggunakan library nodemailer jika di lingkungan Node murni)
    if (settings.provider === 'smtp') {
      // NOTE: Di lingkungan Edge/Serverless Vercel, pengiriman SMTP murni seringkali butuh library khusus (seperti SMTJS) 
      // atau layanan HTTP relay. Disarankan tetap menggunakan provider berbasis API seperti Resend/SendGrid.
      return res.status(501).json({ message: 'SMTP provider logic not yet implemented in edge function' });
    }

    return res.status(400).json({ message: 'Invalid email provider' });
  } catch (error: any) {
    console.error("[EMAIL_DISPATCH_ERROR]", error);
    return res.status(500).json({ message: error.message });
  }
}
