const db = require("../data/database");
const { formatRupiah } = require("../utils/formatter");
const config = require("../config/config");
const { getDateForDay } = require("../utils/dateHelper");

class PiketService {
  async isTaskCompleted(phoneNumber, date) {
    const checkDate = date || new Date().toISOString().split("T")[0];
    return await db.isTaskCompleted(phoneNumber, checkDate);
  }

  async markTaskCompleted(phoneNumber) {
    const today = new Date().toISOString().split("T")[0];
    await db.markTaskCompleted(phoneNumber, today);
  }

  async getPiketScheduleMessage() {
    try {
      const today = new Date();
      const currentDayName = today.toLocaleDateString("en-US", { weekday: "long" });

      // Get tasks from database
      const lastWeekTasks = await db.getLastWeekPiketTasks();
      console.log("Retrieved tasks from database:", lastWeekTasks);

      // Create a Map for easy lookup of task status
      const taskMap = new Map();
      lastWeekTasks.forEach((task) => {
        taskMap.set(task.phone_number, {
          completed: task.completed === 1,
          hasDenda: task.denda_amount !== null,
          dendaPaid: task.denda_paid === 1,
          date: task.date,
        });
      });

      // Get first task date from database to determine the year
      const firstTask = lastWeekTasks[0];
      const baseDate = firstTask ? new Date(firstTask.date) : new Date();
      const year = baseDate.getFullYear();

      // Get schedule for display
      const scheduleList = [];
      for (const [hari, jadwal] of Object.entries(config.piket.jadwal)) {
        const task = taskMap.get(jadwal.nomor);

        // Last week status
        let lastWeekStatus = "";
        if (task) {
          const statusIcon = task.completed ? "✅" : task.hasDenda ? (task.dendaPaid ? "💰" : "❌") : "❌";
          const taskDate = new Date(task.date);
          lastWeekStatus = `${statusIcon} ${hari}, ${taskDate.getDate()} Nov ${year}: ${jadwal.nama}\n`;
        }

        // Next week dates
        // Use the same year as in database
        const nextWeekBase = new Date(year, 10, 1); // November (10) of the database year
        const currentDay = Object.keys(config.piket.jadwal).indexOf(hari);
        const nextWeekDate = new Date(nextWeekBase);
        nextWeekDate.setDate(nextWeekBase.getDate() + currentDay + 7); // Add 7 days for next week

        let nextWeekStatus = "";
        const englishDay = {
          Senin: "Monday",
          Selasa: "Tuesday",
          Rabu: "Wednesday",
          Kamis: "Thursday",
          Jumat: "Friday",
          Sabtu: "Saturday",
          Minggu: "Sunday",
        }[hari];

        const isToday = currentDayName === englishDay;
        const statusIcon = isToday ? "⏰" : "⭕";
        nextWeekStatus = `${statusIcon} ${hari}, ${nextWeekDate.getDate()} Nov ${year}: ${jadwal.nama}`;

        scheduleList.push({
          lastWeek: lastWeekStatus,
          nextWeek: nextWeekStatus,
          isToday: isToday,
        });
      }

      // Build message
      let message = `📅 *JADWAL PIKET ${config.piket.kontrakanName}*\n\n`;

      message += "*📅 Minggu Lalu:*\n";
      scheduleList.forEach((item) => {
        if (item.lastWeek) message += item.lastWeek;
      });

      message += "\n*📅 Minggu Depan:*\n";
      scheduleList.forEach((item) => {
        if (item.nextWeek) message += item.nextWeek + "\n";
      });

      message += "\n*Keterangan:*\n";
      message += "✅ = Sudah Selesai\n";
      message += "❌ = Belum/Tidak Piket\n";
      message += "💰 = Sudah Bayar Denda\n";
      message += "⭕ = Jadwal Minggu Depan\n";
      message += "⏰ = Jadwal Hari Ini\n\n";
      message += "*Ketik 'sudah piket' untuk konfirmasi*";

      return message;
    } catch (error) {
      console.error("Error getting piket schedule:", error);
      console.error(error.stack);
      return "❌ Error: Tidak dapat mengambil jadwal piket";
    }
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

  // Previous methods remain unchanged until getHelpMessage()

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
}

module.exports = new PiketService();
