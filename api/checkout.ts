
import { createClient } from '@libsql/client';
import crypto from 'crypto';

/**
 * Handler Checkout DOKU v1 - Fixed for 500 Internal Server Error
 * Perbaikan: Penambahan ID item, sinkronisasi Digest, dan validasi tipe data amount.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  if (!TURSO_URL) return res.status(500).json({ message: 'Database configuration error' });
  const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  const { user, packageInfo } = req.body;

  try {
    // 1. Ambil Konfigurasi dari Database (Fallback ke ENV)
    const resPayment = await db.execute("SELECT data FROM payment_settings WHERE id = 'global'");
    let dbSettings = resPayment.rows.length > 0 ? JSON.parse(resPayment.rows[0].data as string) : {};

    const CLIENT_ID = process.env.DOKU_CLIENT_ID || dbSettings.clientId;
    const SECRET_KEY = process.env.DOKU_SECRET_KEY || dbSettings.secretKey;

    if (!CLIENT_ID || !SECRET_KEY) {
      return res.status(500).json({ message: 'Konfigurasi DOKU belum lengkap di Dashboard Admin maupun ENV' });
    }

    const invoiceId = `INV-${Date.now()}-${user.id.substring(0, 4)}`;
    const requestId = crypto.randomUUID();
    // Format timestamp DOKU: YYYY-MM-DDTHH:mm:ssZ
    const timestamp = new Date().toISOString().split('.')[0] + 'Z';
    const targetPath = '/checkout/v1/payment';
    
    // 2. Persiapkan Payload (Strict Structure)
    const cleanName = (user.fullName || user.username || 'Teacher').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 32);
    const cleanEmail = (user.email || `${user.username}@quizgen.pro`).trim();

    const payload = {
      order: {
        amount: Number(packageInfo.amount), // Harus Number
        invoice_number: invoiceId,
        currency: "IDR",
        callback_url: "https://genquiz.my.id/history", // Gunakan URL tetap atau ENV yang valid
        line_items: [{ 
          id: `PKG-${packageInfo.credits}`, // WAJIB ADA: DOKU 500 jika ID absen
          name: (packageInfo.name || 'Topup Kredit').substring(0, 50), 
          price: Number(packageInfo.amount), 
          quantity: 1 
        }]
      },
      customer: {
        name: cleanName,
        email: cleanEmail
      }
    };

    // 3. Kalkulasi Digest (Harus dari string yang sama persis dengan body)
    const bodyString = JSON.stringify(payload);
    const digest = crypto.createHash('sha256').update(bodyString).digest('base64');

    // 4. Kalkulasi Signature
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

    // 5. Simpan transaksi ke database sebelum hit API
    await db.execute({
      sql: "INSERT INTO transactions (id, userId, amount, credits, status, externalId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), user.id, packageInfo.amount, packageInfo.credits, 'PENDING', invoiceId, new Date().toISOString()]
    });

    const dokuBaseUrl = (dbSettings.mode === 'production' || process.env.NODE_ENV === 'production')
      ? 'https://api.doku.com' 
      : 'https://api-sandbox.doku.com';

    // 6. Eksekusi ke DOKU
    const response = await fetch(`${dokuBaseUrl}${targetPath}`, {
      method: 'POST',
      headers: {
        'Client-Id': CLIENT_ID,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        'Signature': `HMACSHA256=${signature}`,
        'Digest': digest,
        'Content-Type': 'application/json'
      },
      body: bodyString
    });

    const data = await response.json();
    
    if (response.ok && data.response?.payment?.url) {
      return res.status(200).json(data);
    } else {
      console.error("[DOKU_REJECTION_DETAIL]", JSON.stringify(data));
      // Jika DOKU menolak, berikan pesan error yang informatif
      const errorMessage = data.error?.message || data.message || "DOKU API Rejecting Request";
      return res.status(400).json({ 
        message: `DOKU API Error: ${errorMessage}`,
        details: data
      });
    }
  } catch (error: any) {
    console.error("[INTERNAL_CHECKOUT_CRASH]", error);
    return res.status(500).json({ message: `Sistem Error: ${error.message}` });
  }
}
