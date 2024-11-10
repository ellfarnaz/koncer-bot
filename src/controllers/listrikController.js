const listrikService = require("../services/listrikService");

class ListrikController {
  async handleCommand(message, sender) {
    try {
      const command = message.toLowerCase().trim();

      switch (command) {
        case "/ceklistrik":
          return await listrikService.getListrikStatusMessage();

        case "listrik habis":
          return await listrikService.handleListrikEmpty(sender);

        case "sudah bayar listrik":
          return "Gunakan format: sudah bayar listrik <nominal>\nContoh: sudah bayar listrik 250000";

        default:
          // Check if message matches payment pattern
          const paymentMatch = message.match(/^sudah bayar listrik (\d+)$/);
          if (paymentMatch) {
            const amount = parseInt(paymentMatch[1]);
            return await listrikService.handleListrikPayment(sender, amount);
          }
          return null;
      }
    } catch (error) {
      console.error("Error in ListrikController:", error);
      return "❌ Terjadi kesalahan saat memproses perintah listrik";
    }
  }
}

module.exports = new ListrikController();
