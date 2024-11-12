const database = require("../data/database");
const messageService = require("./messageService");
const { formatRupiah } = require("../utils/formatter");
const config = require("../config/config");

class ListrikService {
  constructor() {
    // Urutan pembayaran listrik
    this.urutan = [
      { nama: "Farel", nomor: "whatsapp:+6285156820515" },
      { nama: "Fillah", nomor: "whatsapp:+6285179813641" },
      { nama: "Max", nomor: "whatsapp:+6281528976578" },
      { nama: "Adzka", nomor: "whatsapp:+6289519240711" },
      { nama: "Fatu", nomor: "whatsapp:+6289880266355" },
      { nama: "Rizky", nomor: "whatsapp:+6281396986145" },
    ];

    // Initialize cache
    this.cache = {
      state: null,
      lastPayment: null,
      lastUpdate: null,
      usageHistory: [],
    };
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL
  }

  async getStateAndPayment() {
    const now = Date.now();
    if (!this.cache.lastUpdate || now - this.cache.lastUpdate > this.CACHE_TTL) {
      console.log("🔄 Cache miss, fetching from database...");
      this.cache.state = await database.getListrikState();
      this.cache.lastPayment = await database.getLastListrikPayment();
      this.cache.lastUpdate = now;
    } else {
      console.log("✅ Using cached data");
    }
    return {
      state: this.cache.state,
      lastPayment: this.cache.lastPayment,
    };
  }

  async invalidateCache() {
    console.log("🔄 Invalidating cache...");
    this.cache = {
      state: null,
      lastPayment: null,
      lastUpdate: null,
      usageHistory: [],
    };
  }

  async getNextPerson() {
    try {
      const { state, lastPayment } = await this.getStateAndPayment();
      // Jika belum ada state atau belum ada pembayaran, mulai dari Farel
      if (!state || !lastPayment) {
        return {
          ...this.urutan[0],
          index: 0,
        };
      }
      const nextIndex = (state.current_index + 1) % this.urutan.length;
      return {
        ...this.urutan[nextIndex],
        index: nextIndex,
      };
    } catch (error) {
      console.error("Error getting next person:", error);
      throw error;
    }
  }

  async getListrikStatusMessage() {
    try {
      console.log("Getting listrik status...");
      const { state, lastPayment } = await this.getStateAndPayment();

      // Jika belum ada pembayaran, Farel adalah giliran pertama
      let currentIndex = -1; // Sehingga nextIndex akan menjadi 0 (Farel)
      if (lastPayment) {
        currentIndex = state.current_index;
      }
      const nextIndex = (currentIndex + 1) % this.urutan.length;
      const afterNextIndex = (nextIndex + 1) % this.urutan.length;

      // Create rotation list
      let rotationList = "";
      this.urutan.forEach((person, index) => {
        const isNext = index === nextIndex;
        const prefix = isNext ? "👉 " : " ";
        rotationList += `${prefix}${index + 1}. ${person.nama}\n`;
      });

      if (!lastPayment) {
        return (
          `📊 Status Pembayaran Listrik\n\n` +
          `❌ Belum ada pembayaran listrik yang tercatat\n\n` +
          `Urutan Pembayaran Listrik:\n${rotationList}\n` +
          `Giliran: ${this.urutan[nextIndex].nama}\n` +
          `Selanjutnya: ${this.urutan[afterNextIndex].nama}\n\n` +
          `Ketik "listrik habis" untuk mengirim notifikasi ke semua penghuni`
        );
      }

      const totalResidents = this.urutan.length;
      const amountPerPerson = Math.ceil(lastPayment.amount / totalResidents);
      const payerName = this.urutan.find((p) => p.nomor === lastPayment.phone_number)?.nama || "Unknown";

      return (
        `📊 Status Pembayaran Listrik\n\n` +
        `Pembayaran Terakhir:\n` +
        `📅 Tanggal: ${new Date(lastPayment.payment_date).toLocaleDateString("id-ID")}\n` +
        `👤 Dibayar oleh: ${payerName}\n` +
        `💰 Total Tagihan: ${formatRupiah(lastPayment.amount)}\n` +
        `👥 Jumlah Penghuni: ${totalResidents} orang\n` +
        `💵 Pembayaran per orang: ${formatRupiah(amountPerPerson)}\n\n` +
        `Urutan Pembayaran Listrik:\n${rotationList}\n` +
        `Giliran: ${this.urutan[nextIndex].nama}\n` +
        `Selanjutnya: ${this.urutan[afterNextIndex].nama}\n\n` +
        `Ketik "listrik habis" untuk mengirim notifikasi ke semua penghuni`
      );
    } catch (error) {
      console.error("Error getting listrik status:", error);
      throw error;
    }
  }

  async handleListrikEmpty(senderPhone) {
    try {
      const nextPerson = await this.getNextPerson();

      // Get sender's name
      const sender = this.urutan.find((p) => p.nomor === senderPhone)?.nama || "Unknown";

      // Pesan untuk semua penghuni
      const groupMessage = `⚡ PERINGATAN LISTRIK HABIS!\n\n` + `Dilaporkan oleh: ${sender}\n` + `Listrik telah habis.\n` + `Giliran mengisi: ${nextPerson.nama}\n\n` + `Mohon segera isi token listrik untuk menghindari pemadaman. 🙏`;

      // Pesan khusus untuk yang dapat giliran
      const turnMessage =
        `⚡ PERINGATAN LISTRIK HABIS!\n\n` +
        `Dilaporkan oleh: ${sender}\n\n` +
        `Anda mendapat giliran untuk mengisi listrik.\n\n` +
        `Setelah mengisi, gunakan perintah:\n` +
        `sudah bayar listrik <nominal>\n` +
        `Contoh: sudah bayar listrik 250000`;

      // Array untuk menyimpan promise pengiriman pesan
      const sendPromises = [];

      // Kirim pesan ke semua penghuni kecuali pengirim dan yang dapat giliran
      this.urutan.forEach((person) => {
        if (person.nomor !== senderPhone) {
          if (person.nomor === nextPerson.nomor) {
            // Kirim pesan khusus ke yang dapat giliran
            sendPromises.push(messageService.sendWhatsAppMessageNoDelay(person.nomor, turnMessage));
          } else {
            // Kirim pesan umum ke penghuni lain
            sendPromises.push(messageService.sendWhatsAppMessageNoDelay(person.nomor, groupMessage));
          }
        }
      });

      // Tunggu semua pesan terkirim
      await Promise.all(sendPromises);

      // Siapkan pesan konfirmasi untuk pengirim
      let confirmationMessage;
      if (senderPhone === nextPerson.nomor) {
        confirmationMessage =
          `✅ Notifikasi listrik habis telah dikirim ke semua penghuni\n` +
          `Giliran mengisi: ${nextPerson.nama}\n\n` +
          `Anda mendapat giliran untuk mengisi listrik.\n` +
          `Silakan mengisi dan laporkan dengan format:\n` +
          `sudah bayar listrik <nominal>`;
      } else {
        confirmationMessage = `✅ Notifikasi listrik habis telah dikirim ke semua penghuni\n` + `Giliran mengisi: ${nextPerson.nama}\n\n` + `Mohon tunggu ${nextPerson.nama} untuk mengisi listrik.`;
      }

      // Return dengan flag notification
      return {
        message: confirmationMessage,
        isNotification: true,
      };
    } catch (error) {
      console.error("Error handling listrik empty:", error);
      throw new Error("Gagal mengirim notifikasi listrik habis: " + error.message);
    }
  }

  async isPersonsTurn(phoneNumber) {
    try {
      const { state, lastPayment } = await this.getStateAndPayment();

      // Jika belum ada pembayaran, hanya Farel (index 0) yang bisa bayar
      if (!state || !lastPayment) {
        return phoneNumber === this.urutan[0].nomor;
      }

      const nextIndex = (state.current_index + 1) % this.urutan.length;
      return phoneNumber === this.urutan[nextIndex].nomor;
    } catch (error) {
      console.error("Error checking person's turn:", error);
      throw error;
    }
  }

  async handleListrikPayment(payerPhone, totalAmount) {
    try {
      console.log(`💰 Processing listrik payment: ${totalAmount} from ${payerPhone}`);

      // Check if it's this person's turn
      const isTurn = await this.isPersonsTurn(payerPhone);
      if (!isTurn) {
        const nextPerson = await this.getNextPerson();
        throw new Error(`Bukan giliran Anda untuk membayar listrik.\nSekarang giliran: ${nextPerson.nama}`);
      }

      // Get current state and last payment in parallel
      const [state, lastPayment] = await Promise.all([database.getListrikState(), database.getLastListrikPayment()]);

      // Tentukan current_index berdasarkan kondisi
      let currentIndex = -1; // Default untuk pembayaran pertama
      if (lastPayment) {
        currentIndex = state.current_index;
      }
      const nextIndex = (currentIndex + 1) % this.urutan.length;
      const afterNextIndex = (nextIndex + 1) % this.urutan.length;

      // Get payer info and calculate amount
      const payerName = this.urutan.find((p) => p.nomor === payerPhone)?.nama || "Unknown";
      const amountPerPerson = Math.ceil(totalAmount / this.urutan.length);

      // Get rekening info in parallel with database operations
      const rekeningList = await database.getRekeningByPhone(payerPhone);

      // Prepare rekening info string
      let rekeningInfo = "";
      if (rekeningList && rekeningList.length > 0) {
        const rek = rekeningList[0];
        rekeningInfo = `\n\nTransfer ke:\n${rek.bank_name}\n${rek.account_number}\na.n ${rek.account_name}`;
      }

      // Prepare notification message
      const message =
        `💡 Informasi Tagihan Listrik\n\n` +
        `Total tagihan: ${formatRupiah(totalAmount)}\n` +
        `Pembayaran per orang: ${formatRupiah(amountPerPerson)}\n` +
        `Dibayar oleh: ${payerName}${rekeningInfo}\n\n` +
        `Giliran: ${this.urutan[nextIndex].nama}\n` +
        `Selanjutnya: ${this.urutan[afterNextIndex].nama}\n\n` +
        `Silakan transfer ke yang sudah membayar 🙏`;

      // Execute database operations in parallel
      await Promise.all([database.recordListrikPayment(payerPhone, totalAmount), database.updateListrikState(nextIndex)]);

      // Invalidate cache after successful payment
      await this.invalidateCache();

      // Send notifications to all residents except payer in parallel
      const notificationPromises = this.urutan
        .filter((person) => person.nomor !== payerPhone)
        .map((person) => {
          console.log(`📤 Sending notification to ${person.nama}`);
          return messageService.sendWhatsAppMessageNoDelay(person.nomor, message).catch((error) => {
            console.error(`❌ Failed to send notification to ${person.nama}:`, error);
            return false;
          });
        });

      // Wait for all notifications to be sent
      const results = await Promise.all(notificationPromises);

      // Count successful notifications
      const successCount = results.filter((result) => result === true).length;

      // Prepare response message
      const response =
        `✅ Pembayaran listrik sebesar ${formatRupiah(totalAmount)} telah dicatat\n` +
        `📲 Notifikasi telah dikirim ke ${successCount} penghuni\n\n` +
        `Giliran: ${this.urutan[nextIndex].nama}\n` +
        `Selanjutnya: ${this.urutan[afterNextIndex].nama}`;

      console.log(`✅ Payment processing completed for ${payerName}`);
      return response;
    } catch (error) {
      console.error("❌ Error handling listrik payment:", error);
      throw error;
    }
  }

  // Tambahkan tracking penggunaan listrik
  async recordUsage(amount, month) {
    try {
      const usage = {
        amount,
        month,
        averagePerPerson: amount / this.urutan.length,
        timestamp: new Date(),
      };

      await database.addListrikUsage(usage);
      this.updateUsageStatistics(usage);
    } catch (error) {
      console.error("Error recording listrik usage:", error);
      throw error;
    }
  }

  // Tambahkan sistem reminder otomatis
  async checkAndSendReminders() {
    try {
      const { state, lastPayment } = await this.getStateAndPayment();
      const daysSinceLastPayment = this.calculateDaysSinceLastPayment(lastPayment);

      if (daysSinceLastPayment > 25) {
        await this.sendPaymentReminders();
      }
    } catch (error) {
      console.error("Error checking listrik reminders:", error);
    }
  }
}

module.exports = new ListrikService();
