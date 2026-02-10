
import { createClient } from '@libsql/client';
import crypto from 'crypto';

/**
 * Handler Checkout DOKU dengan Standar Keamanan B2B Signature
 * LOGIC: Environment Variable > Database Config
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  if (!TURSO_URL) return res.status(500).json({ message: 'Database config error' });
  const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  const { user, packageInfo } = req.body;

  try {
    // Ambil Config dari Database
    const resPayment = await db.execute("SELECT data FROM payment_settings WHERE id = 'global'");
    let dbSettings = resPayment.rows.length > 0 ? JSON.parse(resPayment.rows[0].data as string) : {};

    // KEPUTUSAN FINAL: Gunakan ENV jika ada, jika tidak ada baru gunakan DB
    const CLIENT_ID = process.env.DOKU_CLIENT_ID || dbSettings.clientId;
    const SECRET_KEY = process.env.DOKU_SECRET_KEY || dbSettings.secretKey;

    if (!CLIENT_ID || !SECRET_KEY) {
      return res.status(500).json({ message: 'Konfigurasi DOKU belum lengkap (Client ID / Secret Key Kosong)' });
    }

    const invoiceId = `INV-${Date.now()}-${user.id.substring(0, 4)}`;
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString().split('.')[0] + 'Z';

    const targetPath = '/checkout/v1/payment';
    const payload = {
      order: {
        amount: packageInfo.amount,
        invoice_number: invoiceId,
        currency: "IDR",
        callback_url: `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/history`,
        line_items: [{ name: packageInfo.name, price: packageInfo.amount, quantity: 1 }]
      },
      customer: {
        name: user.username,
        email: user.email || `${user.username}@quizgen.pro`
      }
    };

    const bodyString = JSON.stringify(payload);
    const digest = crypto.createHash('sha256').update(bodyString).digest('base64');

    const stringToSign = 
      `Client-Id:${CLIENT_ID}\n` +
      `Request-Id:${requestId}\n` +
      `Request-Timestamp:${timestamp}\n` +
      `Request-Target:${targetPath}\n` +
      `Digest:${digest}`;

    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(stringToSign)
      .digest('base64');

    // Simpan dulu ke DB agar ada record intent (Pending)
    await db.execute({
      sql: "INSERT INTO transactions (id, userId, amount, credits, status, externalId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), user.id, packageInfo.amount, packageInfo.credits, 'PENDING', invoiceId, new Date().toISOString()]
    });

    const dokuBaseUrl = dbSettings.mode === 'production' 
      ? 'https://api.doku.com' 
      : 'https://api-sandbox.doku.com';

    const response = await fetch(`${dokuBaseUrl}${targetPath}`, {
      method: 'POST',
      headers: {
        'Client-Id': CLIENT_ID,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        'Signature': `HMACSHA256=${signature}`,
        'Content-Type': 'application/json'
      },
      body: bodyString
    });

    const data = await response.json();
    
    if (data.response?.payment?.url) {
      return res.status(200).json(data);
    } else {
      // Jika DOKU menolak, teruskan pesan errornya agar tahu penyebabnya (misal: Unauthorized / Signature Error)
      const errorDetail = data.error?.message || data.message || "Gateway error";
      return res.status(400).json({ message: `DOKU API Error: ${errorDetail}` });
    }
  } catch (error: any) {
    return res.status(500).json({ message: `Internal API Error: ${error.message}` });
  }
}
