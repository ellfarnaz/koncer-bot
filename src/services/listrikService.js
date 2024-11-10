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
      const message = `⚡ PERINGATAN LISTRIK HABIS!\n\n` + `Listrik telah habis.\n` + `Giliran mengisi: ${nextPerson.nama}\n\n` + `Mohon segera isi token listrik untuk menghindari pemadaman. 🙏`;

      // Kirim notifikasi secara parallel menggunakan Promise.all
      const sendPromises = this.urutan.filter((person) => person.nomor !== senderPhone).map((person) => messageService.sendWhatsAppMessageNoDelay(person.nomor, message));

      await Promise.all(sendPromises);

      // Return dengan flag untuk menandai bahwa ini notification
      return {
        message: `✅ Notifikasi listrik habis telah dikirim ke semua penghuni\n` + `Giliran mengisi: ${nextPerson.nama}`,
        isNotification: true,
      };
    } catch (error) {
      console.error("Error handling listrik empty:", error);
      throw error;
    }
  }

  async handleListrikPayment(payerPhone, totalAmount) {
    try {
      console.log(`💰 Processing listrik payment: ${totalAmount} from ${payerPhone}`);

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
      throw new Error(`Gagal memproses pembayaran: ${error.message}`);
    }
  }
}

module.exports = new ListrikService();
