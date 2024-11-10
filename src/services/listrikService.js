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
  }

  async getNextPerson() {
    try {
      const state = await database.getListrikState();
      // Jika belum ada state atau belum ada pembayaran, mulai dari Farel
      const lastPayment = await database.getLastListrikPayment();
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
      const lastPayment = await database.getLastListrikPayment();
      const state = await database.getListrikState();

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
        const prefix = isNext ? "👉 " : "   ";
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

      // Kirim notifikasi ke semua penghuni kecuali pengirim
      for (const person of this.urutan) {
        if (person.nomor !== senderPhone) {
          await messageService.sendWhatsAppMessage(person.nomor, message);
        }
      }

      return `✅ Notifikasi listrik habis telah dikirim ke semua penghuni\n` + `Giliran mengisi: ${nextPerson.nama}`;
    } catch (error) {
      console.error("Error handling listrik empty:", error);
      throw error;
    }
  }

  async handleListrikPayment(payerPhone, totalAmount) {
    try {
      console.log(`Processing listrik payment: ${totalAmount} from ${payerPhone}`);
      const state = await database.getListrikState();
      const lastPayment = await database.getLastListrikPayment();

      // Tentukan current_index berdasarkan kondisi
      let currentIndex = -1; // Default untuk pembayaran pertama
      if (lastPayment) {
        currentIndex = state.current_index;
      }

      const nextIndex = (currentIndex + 1) % this.urutan.length;
      const afterNextIndex = (nextIndex + 1) % this.urutan.length;

      // Record the payment
      await database.recordListrikPayment(payerPhone, totalAmount);

      // Update rotation state
      await database.updateListrikState(nextIndex);

      const amountPerPerson = Math.ceil(totalAmount / this.urutan.length);
      const payerName = this.urutan.find((p) => p.nomor === payerPhone)?.nama || "Unknown";

      // Get payer's bank account
      const rekeningList = await database.getRekeningByPhone(payerPhone);
      let rekeningInfo = "";
      if (rekeningList && rekeningList.length > 0) {
        const rek = rekeningList[0];
        rekeningInfo = `\n\nTransfer ke:\n${rek.bank_name}\n${rek.account_number}\na.n ${rek.account_name}`;
      }

      const message =
        `💡 Informasi Tagihan Listrik\n\n` +
        `Total tagihan: ${formatRupiah(totalAmount)}\n` +
        `Pembayaran per orang: ${formatRupiah(amountPerPerson)}\n` +
        `Dibayar oleh: ${payerName}${rekeningInfo}\n\n` +
        `Giliran: ${this.urutan[nextIndex].nama}\n` +
        `Selanjutnya: ${this.urutan[afterNextIndex].nama}\n\n` +
        `Silakan transfer ke yang sudah membayar 🙏`;

      // Send notification to all residents except payer
      for (const person of this.urutan) {
        if (person.nomor !== payerPhone) {
          await messageService.sendWhatsAppMessage(person.nomor, message);
        }
      }

      return (
        `✅ Pembayaran listrik sebesar ${formatRupiah(totalAmount)} telah dicatat\n` + `📲 Notifikasi telah dikirim ke semua penghuni\n\n` + `Giliran: ${this.urutan[nextIndex].nama}\n` + `Selanjutnya: ${this.urutan[afterNextIndex].nama}`
      );
    } catch (error) {
      console.error("Error handling listrik payment:", error);
      throw error;
    }
  }
}

module.exports = new ListrikService();
