
import { createClient } from '@libsql/client';
import crypto from 'crypto';

/**
 * Webhook Handler DOKU - Signature Validation Fix
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const CLIENT_ID = (process.env.DOKU_CLIENT_ID || "").trim();
  const SECRET_KEY = (process.env.DOKU_SECRET_KEY || "").trim();
  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  // Ambil headers (case-insensitive)
  const incomingSignature = req.headers['signature'] || req.headers['Signature'];
  const requestId = req.headers['request-id'] || req.headers['Request-Id'];
  const timestamp = req.headers['request-timestamp'] || req.headers['Request-Timestamp'];
  const incomingDigest = req.headers['digest'] || req.headers['Digest'];
  const targetPath = '/api/webhook'; 

  if (!incomingSignature || !SECRET_KEY || !CLIENT_ID || !TURSO_URL) {
    console.error("[WEBHOOK] Unauthorized: Missing mandatory headers or keys");
    return res.status(401).send('Unauthorized');
  }

  try {
    // 1. Bersihkan Digest (Hapus prefix SHA-256= jika ada)
    const digestOnly = incomingDigest ? incomingDigest.replace('SHA-256=', '') : '';
    
    // 2. Rekonstruksi String-To-Sign
    const stringToSign = 
      `Client-Id:${CLIENT_ID}\n` +
      `Request-Id:${requestId}\n` +
      `Request-Timestamp:${timestamp}\n` +
      `Request-Target:${targetPath}\n` +
      `Digest:${digestOnly}`;

    // 3. Kalkulasi Signature Lokal
    const calculatedSignature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(stringToSign)
      .digest('base64');

    // 4. Verifikasi
    if (`HMACSHA256=${calculatedSignature}` !== incomingSignature) {
      console.error("[WEBHOOK_SIG_MISMATCH]", {
        received: incomingSignature,
        expected: `HMACSHA256=${calculatedSignature}`
      });
      return res.status(401).send('Invalid Signature');
    }

    // Parsing data pembayaran
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const invoiceId = body.order?.invoice_number;
    const paymentStatus = body.transaction?.status;

    const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
    
    const trxCheck = await db.execute({
      sql: "SELECT * FROM transactions WHERE externalId = ? AND status = 'PENDING'",
      args: [invoiceId]
    });

    if (trxCheck.rows.length === 0) {
      return res.status(200).send('OK (Already Processed)');
    }

    const localTrx = trxCheck.rows[0];
    const isSuccess = paymentStatus === 'SUCCESS' || paymentStatus === 'DONE';
    const finalStatus = isSuccess ? 'SUCCESS' : 'FAILED';

    // Update status & tambah kredit
    await db.batch([
      { sql: "UPDATE transactions SET status = ? WHERE externalId = ?", args: [finalStatus, invoiceId] },
      ...(isSuccess ? [{ 
        sql: "UPDATE users SET credits = credits + ? WHERE id = ?", 
        args: [Number(localTrx.credits), localTrx.userId] 
      }] : [])
    ], "write");

    console.log(`[WEBHOOK_SUCCESS] ${invoiceId} processed.`);
    return res.status(200).send('OK');

  } catch (error: any) {
    console.error("[WEBHOOK_ERROR]", error.message);
    return res.status(500).send('Internal Error');
  }
}
