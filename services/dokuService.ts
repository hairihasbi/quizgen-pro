
import { User, Transaction } from '../types';
import { StorageService } from './storageService';

export const DokuService = {
  /**
   * Menginisialisasi pembayaran ke DOKU via serverless function (Vercel)
   */
  async createInvoice(user: User, packageInfo: { amount: number, credits: number, name: string }): Promise<string> {
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, packageInfo })
      });

      const data = await response.json();

      if (!response.ok) {
        // Mengambil pesan error spesifik jika ada (misal: "Client ID Not Found")
        const errorMessage = data.message || "Gagal mendapatkan akses ke gateway pembayaran.";
        throw new Error(errorMessage);
      }

      if (data.response?.payment?.url) {
        return data.response.payment.url;
      }
      
      throw new Error("DOKU tidak mengembalikan URL pembayaran. Periksa konfigurasi Merchant Dashboard Anda.");
    } catch (error: any) {
      console.error("Doku Service Client Error:", error.message);
      throw error;
    }
  },

  /**
   * Cek status transaksi terbaru dari database
   */
  async checkLocalStatus(invoiceId: string): Promise<Transaction | null> {
    const transactions = await StorageService.getTransactions();
    return transactions.find(t => t.externalId === invoiceId) || null;
  }
};
