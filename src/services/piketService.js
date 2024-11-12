const db = require("../data/database");
const { formatRupiah } = require("../utils/formatter");
const config = require("../config/config");
const { getDateForDay, getCurrentWeekDates } = require("../utils/dateHelper");

class PiketService {
  // Tambahkan state management
  constructor() {
    this.cache = {
      scheduleList: null,
      lastUpdate: null,
    };
    this.CACHE_TTL = 5 * 60 * 1000; // 5 menit
  }

  // Helper function untuk menentukan status icon
  getStatusIcon(task) {
    if (!task) return "⭕";
    return task.completed ? "✅" : task.hasDenda ? (task.dendaPaid ? "💰" : "❌") : "❌";
  }

  // Helper function untuk mendapatkan tanggal minggu depan
  getNextWeekDate(baseDate, dayIndex) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + dayIndex + 7);
    return date;
  }

  async getPiketScheduleMessage() {
    try {
      const today = new Date();
      const currentDayName = today.toLocaleDateString("en-US", { weekday: "long" });

      // Get tasks from database
      const lastWeekTasks = await db.getLastWeekPiketTasks();
      console.log("Retrieved tasks from database:", lastWeekTasks);

      // Validasi data minggu lalu
      if (!lastWeekTasks || lastWeekTasks.length === 0) {
        throw new Error("Tidak ada data piket minggu lalu");
      }

      // Create a Map for easy lookup of task status
      const taskMap = new Map(
        lastWeekTasks.map((task) => [
          task.phone_number,
          {
            completed: task.completed === 1,
            hasDenda: task.denda_amount !== null,
            dendaPaid: task.denda_paid === 1,
            date: task.date,
          },
        ])
      );

      // Get schedule for display
      const scheduleList = await Promise.all(
        Object.entries(config.piket.jadwal).map(async ([hari, jadwal]) => {
          const task = taskMap.get(jadwal.nomor);

          // Last week status
          const lastWeekStatus = task
            ? {
                date: new Date(task.date),
                status: this.getStatusIcon(task),
                nama: jadwal.nama,
              }
            : null;

          // Next week dates - menggunakan tanggal dinamis
          const nextWeekDate = this.getNextWeekDate(today, Object.keys(config.piket.jadwal).indexOf(hari));
          const nextWeekTask = await db.getPiketTask(jadwal.nomor, nextWeekDate);

          const isToday = currentDayName === this.getDayNameInEnglish(hari);
          const statusIcon = isToday ? "⏰" : this.getStatusIcon(nextWeekTask);

          return {
            hari,
            lastWeek: lastWeekStatus,
            nextWeek: {
              date: nextWeekDate,
              status: statusIcon,
              nama: jadwal.nama,
            },
            isToday,
          };
        })
      );

      return this.buildScheduleMessage(scheduleList);
    } catch (error) {
      console.error("Error getting piket schedule:", error);
      throw new Error(`Gagal mengambil jadwal piket: ${error.message}`);
    }
  }

  // Helper function untuk membangun pesan jadwal
  buildScheduleMessage(scheduleList) {
    let message = `📅 *JADWAL PIKET ${config.piket.kontrakanName}*\n\n`;

    message += "*📅 Minggu Lalu:*\n";
    scheduleList.forEach(({ lastWeek, hari }) => {
      if (lastWeek) {
        message += `${lastWeek.status} ${hari}, ${lastWeek.date.getDate()} ${lastWeek.date.toLocaleString("id-ID", { month: "short" })} ${lastWeek.date.getFullYear()}: ${lastWeek.nama}\n`;
      }
    });

    message += "\n*📅 Minggu Depan:*\n";
    scheduleList.forEach(({ nextWeek, hari }) => {
      message += `${nextWeek.status} ${hari}, ${nextWeek.date.getDate()} ${nextWeek.date.toLocaleString("id-ID", { month: "short" })} ${nextWeek.date.getFullYear()}: ${nextWeek.nama}\n`;
    });

    message += this.getLegendMessage();
    return message;
  }

  // Helper function untuk mendapatkan pesan legenda
  getLegendMessage() {
    return `
*Keterangan:*
✅ = Sudah Selesai
❌ = Belum/Tidak Piket
💰 = Sudah Bayar Denda
⭕ = Jadwal Minggu Depan
⏰ = Jadwal Hari Ini

*Ketik 'sudah piket' untuk konfirmasi*`;
  }

  // Helper function untuk konversi nama hari ke bahasa Inggris
  getDayNameInEnglish(indonesianDay) {
    const dayMapping = {
      Senin: "Monday",
      Selasa: "Tuesday",
      Rabu: "Wednesday",
      Kamis: "Thursday",
      Jumat: "Friday",
      Sabtu: "Saturday",
      Minggu: "Sunday",
    };
    return dayMapping[indonesianDay];
  }

  async isTaskCompleted(phoneNumber, date) {
    const checkDate = date || new Date().toISOString().split("T")[0];
    return await db.isTaskCompleted(phoneNumber, checkDate);
  }

  async markTaskCompleted(phoneNumber) {
    const today = new Date().toISOString().split("T")[0];
    await db.markTaskCompleted(phoneNumber, today);
  }

  async getDendaMessage() {
    try {
      const dendaList = await db.getDendaList();
      let message = "📊 DAFTAR DENDA PIKET\n\n";

      if (dendaList.length === 0) {
        message += "✨ Tidak ada denda yang belum dibayar";
      } else {
        let totalDenda = 0;
        for (const denda of dendaList) {
          const jadwal = Object.entries(config.piket.jadwal).find(([_, j]) => j.nomor === denda.phone_number);
          if (jadwal) {
            const [hari, data] = jadwal;
            const date = new Date(denda.date);
            message += `${data.nama}\n`;
            message += `${date.toLocaleDateString(config.dateFormat.locale, config.dateFormat.options)}\n`;
            message += `Denda: ${formatRupiah(denda.amount)}\n\n`;
            totalDenda += denda.amount;
          }
        }
        message += `Total Denda: ${formatRupiah(totalDenda)}`;
      }

      return message;
    } catch (error) {
      console.error("Error getting denda list:", error);
      return "❌ Error: Tidak dapat mengambil daftar denda";
    }
  }

  async getTabunganMessage() {
    try {
      const tabungan = await db.getTabungan();
      let total = 0;
      let message = "💰 TABUNGAN KONTRAKAN CERIA\n\n";

      if (tabungan.length === 0) {
        message += "Belum ada transaksi";
      } else {
        const transactions = [];

        tabungan.forEach((record) => {
          transactions.push({
            date: record.date,
            description: record.description,
            amount: record.amount,
          });
        });

        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        transactions.forEach((trans) => {
          const date = new Date(trans.date);
          message += `${date.toLocaleDateString(config.dateFormat.locale, config.dateFormat.options)}\n`;
          message += `${trans.description}\n`;
          message += `${formatRupiah(trans.amount)}\n\n`;
          total += trans.amount;
        });

        message += `Total Tabungan: ${formatRupiah(total)}`;
      }

      return message;
    } catch (error) {
      console.error("Error getting tabungan:", error);
      return "❌ Error: Tidak dapat mengambil data tabungan";
    }
  }

  getHelpMessage() {
    return `🤖 *BOT KONTRAKAN CERIA* 🏠
    
  
  📋 *PERINTAH PIKET*
  • /cekpiket
    Cek jadwal piket
  • sudah piket
    Konfirmasi piket selesai
  • /cekdenda
    Cek daftar denda
  • /tabungan
    Cek saldo tabungan
  
  💧 *PERINTAH GALON*
  • /cekgalon
    Cek status galon
  • galon atas habis
    Laporkan galon atas habis
  • galon bawah habis
    Laporkan galon bawah habis
  • sudah beli galon
    Konfirmasi pembelian galon
  
  💡 *PERINTAH LISTRIK*
  • /ceklistrik
    Cek status pembayaran listrik
  • listrik habis
    Laporkan listrik habis
  • sudah bayar listrik <nominal>
    Konfirmasi pembayaran listrik
    Contoh: sudah bayar listrik 250000
  
  💳 *PERINTAH REKENING*
  • /rekening
    Lihat daftar rekening
  • tambah rekening BANK/REK/NAMA
    Contoh: tambah rekening BCA/1234567890/Koncer
  • edit rekening LAMA/BARU/REK/NAMA
    Contoh: edit rekening BCA/BNI/1234567890/Koncer
  
  
  ℹ️ *FORMAT REKENING*
  • Gunakan / sebagai pemisah
  • Nomor rekening tanpa spasi
  • Nama bank kapital (BCA, BNI, dll)
  
  ⚠️ *PENTING*
  • Konfirmasi setelah piket
  • Bayar denda tepat waktu
  • Cek nomor rekening sebelum transfer`;
  }

  // Tambahkan validasi dan notifikasi
  async markTaskAsCompleted(phoneNumber, date) {
    try {
      const task = await db.getPiketTask(phoneNumber, date);
      if (!task) {
        throw new Error("Tugas piket tidak ditemukan");
      }

      // Validasi waktu
      const taskDate = new Date(task.date);
      const now = new Date();
      if (taskDate.toDateString() !== now.toDateString()) {
        throw new Error("Hanya bisa konfirmasi piket untuk hari ini");
      }

      await db.markPiketTaskCompleted(phoneNumber, date);

      // Notifikasi ke grup
      await this.sendGroupNotification(`✅ ${task.nama} telah menyelesaikan piket untuk ${formatDate(date)}`);

      return true;
    } catch (error) {
      console.error("Error marking task as completed:", error);
      throw error;
    }
  }

  // Tambahkan sistem backup dan recovery
  async backupPiketData() {
    try {
      const data = await db.getAllPiketTasks();
      // Implementasi backup ke cloud storage atau file sistem
    } catch (error) {
      console.error("Error backing up piket data:", error);
    }
  }
}

module.exports = new PiketService();
