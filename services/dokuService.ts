
import { User, Transaction } from '../types';
import { StorageService } from './storageService';

export const DokuService = {
  /**
   * Mengambil link pembayaran langsung tanpa memanggil backend API
   */
  async getPaymentLink(user: User, packageInfo: { amount: number, credits: number, name: string }): Promise<string> {
    try {
      const settings = await StorageService.getPaymentSettings();
      // Cari paket yang sesuai dengan harga atau nama
      const pkg = settings.packages.find(p => p.credits === packageInfo.credits && p.isActive);
      
      if (pkg && pkg.paymentLink) {
        return pkg.paymentLink;
      }
      
      throw new Error("Link pembayaran untuk paket ini belum dikonfigurasi oleh Admin.");
    } catch (error: any) {
      console.error("Payment Service Error:", error.message);
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
