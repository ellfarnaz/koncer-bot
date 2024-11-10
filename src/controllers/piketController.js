const piketService = require("../services/piketService");
const reminderService = require("../services/reminderService");

class PiketController {
  async handleCommand(message, sender) {
    try {
      const command = message.toLowerCase().trim();

      switch (command) {
        case "/help":
          return await piketService.getHelpMessage();

        case "/cekpiket":
          return await piketService.getPiketScheduleMessage();

        case "sudah piket":
          await piketService.markTaskCompleted(sender);
          reminderService.stopReminder(sender);
          return "✅ Terima kasih sudah melakukan piket hari ini!";

        case "/cekdenda":
          return await piketService.getDendaMessage();

        case "/tabungan":
          return await piketService.getTabunganMessage();

        case "sudah bayar denda":
          // Implement denda payment logic here
          return "Fitur pembayaran denda sedang dalam pengembangan";

        default:
          return null; // Let other controllers handle unknown commands
      }
    } catch (error) {
      console.error("Error in PiketController:", error);
      return "❌ Terjadi kesalahan saat memproses perintah";
    }
  }
}

module.exports = new PiketController();
