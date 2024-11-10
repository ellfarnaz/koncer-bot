const galonService = require("../services/galonService");

class GalonController {
  async handleCommand(message, sender) {
    try {
      const command = message.toLowerCase().trim();

      switch (command) {
        case "/cekgalon":
          return await galonService.getGalonStatusMessage();

        case "galon atas habis":
          await galonService.markGalonEmpty("atas");
          await galonService.startGalonReminder("atas");
          return "❌ Status galon atas telah diupdate menjadi kosong";

        case "galon bawah habis":
          await galonService.markGalonEmpty("bawah");
          await galonService.startGalonReminder("bawah");
          return "❌ Status galon bawah telah diupdate menjadi kosong";

        case "sudah beli galon":
          return await galonService.handleGalonPurchase(sender);

        default:
          return null; // Let other controllers handle unknown commands
      }
    } catch (error) {
      console.error("Error in GalonController:", error);
      return "❌ Terjadi kesalahan saat memproses perintah galon";
    }
  }
}

module.exports = new GalonController();
