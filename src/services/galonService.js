const db = require("../data/database");
const messageService = require("./messageService");
const config = require("../config/config");

class GalonService {
  constructor() {
    this.state = {
      currentIndex: 0,
      isGalonEmpty: {
        atas: false,
        bawah: false,
      },
      activeReminders: {
        atas: null,
        bawah: null,
      },
    };
  }

  async initialize() {
    try {
      const dbState = await db.getGalonState();
      this.state = { ...this.state, ...dbState };
      console.log("Galon state initialized:", this.state);
    } catch (error) {
      console.error("Error initializing galon state:", error);
      throw error;
    }
  }

  async getNextPerson() {
    try {
      const recentPurchases = await db.getRecentPurchases();

      if (!config.galon || !config.galon.schedule || config.galon.schedule.length === 0) {
        throw new Error("Galon schedule is not configured");
      }

      const schedule = config.galon.schedule;

      if (recentPurchases.length === schedule.length) {
        this.state.currentIndex = 0;
      } else {
        while (recentPurchases.includes(schedule[this.state.currentIndex].nomor)) {
          this.state.currentIndex = (this.state.currentIndex + 1) % schedule.length;
        }
      }

      await db.updateGalonState(this.state);
      return schedule[this.state.currentIndex];
    } catch (error) {
      console.error("Error getting next person:", error);
      throw error;
    }
  }

  async getGalonStatusMessage() {
    try {
      if (!config.galon || !config.galon.schedule || config.galon.schedule.length === 0) {
        return "⚠️ Jadwal galon belum dikonfigurasi";
      }

      const currentPerson = config.galon.schedule[this.state.currentIndex];
      const recentPurchases = await db.getRecentPurchases();

      let message = "🚰 STATUS GALON\n\n";

      // Status galon
      message += "Status Galon:\n";
      message += `${this.state.isGalonEmpty.atas ? "❌" : "✅"} Galon Atas\n`;
      message += `${this.state.isGalonEmpty.bawah ? "❌" : "✅"} Galon Bawah\n\n`;

      // Current person
      message += `👤 Giliran saat ini: ${currentPerson.nama}\n\n`;

      // Purchase history
      message += "📋 Riwayat Pembelian:\n";
      const statusList = config.galon.schedule
        .map((person) => {
          const hasBought = recentPurchases.includes(person.nomor);
          return `${hasBought ? "✅" : "⭕"} ${person.nama}`;
        })
        .join("\n");

      message += statusList;

      // Add empty galon warning if any
      if (this.state.isGalonEmpty.atas || this.state.isGalonEmpty.bawah) {
        message += "\n\n⚠️ Peringatan:";
        if (this.state.isGalonEmpty.atas) message += "\n• Galon atas kosong!";
        if (this.state.isGalonEmpty.bawah) message += "\n• Galon bawah kosong!";
      }

      return message;
    } catch (error) {
      console.error("Error getting galon status:", error);
      return "❌ Error: Tidak dapat mengambil status galon";
    }
  }

  async handleGalonPurchase(phoneNumber) {
    try {
      await db.recordGalonPurchase(phoneNumber);

      // Reset galon empty states
      this.state.isGalonEmpty = {
        atas: false,
        bawah: false,
      };
      await db.updateGalonState(this.state);

      // Clear any active reminders
      if (this.state.activeReminders.atas) {
        clearInterval(this.state.activeReminders.atas);
        this.state.activeReminders.atas = null;
      }
      if (this.state.activeReminders.bawah) {
        clearInterval(this.state.activeReminders.bawah);
        this.state.activeReminders.bawah = null;
      }

      const nextPerson = await this.getNextPerson();
      return `✅ Pembelian galon berhasil dicatat!\nGiliran selanjutnya: ${nextPerson.nama}`;
    } catch (error) {
      console.error("Error handling galon purchase:", error);
      throw error;
    }
  }

  async markGalonEmpty(location) {
    try {
      this.state.isGalonEmpty[location] = true;
      await db.updateGalonState(this.state);
      return true;
    } catch (error) {
      console.error("Error marking galon empty:", error);
      throw error;
    }
  }

  async startGalonReminder(location) {
    try {
      if (this.state.activeReminders[location]) {
        clearInterval(this.state.activeReminders[location]);
      }

      await this.sendGalonReminder(location);

      this.state.activeReminders[location] = setInterval(async () => {
        if (!this.state.isGalonEmpty[location]) {
          clearInterval(this.state.activeReminders[location]);
          return;
        }
        await this.sendGalonReminder(location);
      }, config.galon.reminderInterval || 3 * 60 * 60 * 1000); // Default to 3 hours

      await db.updateGalonState(this.state);
    } catch (error) {
      console.error("Error starting galon reminder:", error);
      throw error;
    }
  }

  async sendGalonReminder(location) {
    try {
      if (!config.galon || !config.galon.schedule || config.galon.schedule.length === 0) {
        throw new Error("Galon schedule is not configured");
      }

      const currentPerson = config.galon.schedule[this.state.currentIndex];
      const recentPurchases = await db.getRecentPurchases();

      const message =
        `🚰 PENGINGAT GALON ${location.toUpperCase()}!\n\n` +
        `Galon ${location} habis dan saatnya ${currentPerson.nama} untuk membeli galon baru.\n\n` +
        `Status Pembelian:\n` +
        config.galon.schedule
          .map((person) => {
            const hasBought = recentPurchases.includes(person.nomor);
            return `${hasBought ? "✅" : "⭕"} ${person.nama}`;
          })
          .join("\n") +
        `\n\nJika sudah membeli, silakan balas dengan "sudah beli galon"`;

      for (const person of config.galon.schedule) {
        await messageService.sendWhatsAppMessageNoDelay(person.nomor, message);
      }
    } catch (error) {
      console.error("Error sending galon reminder:", error);
      throw error;
    }
  }
}

module.exports = new GalonService();
