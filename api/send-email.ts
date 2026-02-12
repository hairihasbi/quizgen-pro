
import { createClient } from '@libsql/client';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  if (!TURSO_URL) return res.status(500).json({ message: 'DB Config missing' });
  const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  const { to, subject, html } = req.body;

  try {
    const settingsRes = await db.execute("SELECT data FROM email_settings WHERE id = 'global'");
    if (settingsRes.rows.length === 0) {
      return res.status(500).json({ message: 'Email service is not configured' });
    }

    const settings = JSON.parse(settingsRes.rows[0].data as string);
    const apiKey = settings.apiKey;

    if (settings.provider === 'none' || (!apiKey && settings.method === 'api')) {
      return res.status(200).json({ status: 'skipped', reason: 'provider_disabled' });
    }

    // Jika metode SMTP dipilih, logic-nya tetap placeholder atau menggunakan relay
    if (settings.method === 'smtp') {
      return res.status(501).json({ message: 'SMTP relay functionality is handled via global server relay, not implemented in edge functions directly.' });
    }

    // --- MAILERSEND API LOGIC ---
    if (settings.provider === 'mailersend') {
      const msRes = await fetch('https://api.mailersend.com/v1/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          from: { email: settings.fromEmail, name: settings.senderName },
          to: [{ email: to }],
          subject: subject,
          html: html
        })
      });
      if (!msRes.ok) throw new Error(await msRes.text());
      return res.status(200).json({ status: 'sent', provider: 'mailersend' });
    }

    // --- BREVO (SENDINBLUE) API LOGIC ---
    if (settings.provider === 'brevo') {
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify({
          sender: { name: settings.senderName, email: settings.fromEmail },
          to: [{ email: to }],
          subject: subject,
          htmlContent: html
        })
      });
      if (!brevoRes.ok) throw new Error(await brevoRes.text());
      return res.status(200).json({ status: 'sent', provider: 'brevo' });
    }

    return res.status(400).json({ message: 'Invalid provider configuration' });
  } catch (error: any) {
    console.error("[EMAIL_DISPATCH_ERROR]", error);
    return res.status(500).json({ message: error.message });
  }
}
