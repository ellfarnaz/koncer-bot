const messageService = require("./messageService");
const piketService = require("./piketService");
const config = require("../config/config");

class ReminderService {
  constructor() {
    this.activeReminders = {};
  }

  async sendReminder(jadwal) {
    const today = new Date().toISOString().split("T")[0];
    if (!(await piketService.isTaskCompleted(jadwal.nomor))) {
      await messageService.sendWhatsAppMessage(
        jadwal.nomor,
        `🔔 PENGINGAT PIKET ${config.kontrakanName}!\n\n` +
          `Hai ${jadwal.nama}, kamu belum konfirmasi piket hari ini.\n` +
          `Pesan ini akan terus dikirim setiap menit sampai kamu konfirmasi.\n\n` +
          `Balas "sudah piket" untuk menghentikan pengingat ini 🧹`
      );
      return true;
    }
    return false;
  }

  startRemindersForPerson(jadwal) {
    if (!this.activeReminders[jadwal.nomor]) {
      console.log(`Starting reminders for ${jadwal.nama}`);
      messageService.sendWhatsAppMessageNoDelay(
        jadwal.nomor,
        `🧹 Hai ${jadwal.nama}, hari ini adalah jadwal piket kamu di ${config.kontrakanName}.\n\n` +
          `Jika sudah selesai piket, mohon balas dengan pesan "sudah piket".\n\n` +
          `Kamu akan menerima pengingat setiap menit sampai konfirmasi diterima! 💪`
      );

      this.activeReminders[jadwal.nomor] = setInterval(() => {
        this.sendReminder(jadwal);
      }, config.reminderInterval);
    }
  }

  stopReminder(phoneNumber) {
    if (this.activeReminders[phoneNumber]) {
      clearInterval(this.activeReminders[phoneNumber]);
      delete this.activeReminders[phoneNumber];
    }
  }
}

module.exports = new ReminderService();
