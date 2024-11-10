const listrikService = require("../services/listrikService");

class ListrikController {
  async handleCommand(message, sender) {
    try {
      const command = message.toLowerCase().trim();

      switch (command) {
        case "/ceklistrik":
          console.log("📊 Checking listrik status...");
          return await listrikService.getListrikStatusMessage();

        case "listrik habis":
          console.log("⚡ Processing listrik habis notification...");
          return await listrikService.handleListrikEmpty(sender);

        case "sudah bayar listrik":
          console.log("ℹ️ Showing payment format guide...");
          return "Gunakan format: sudah bayar listrik <nominal>\n" + "Contoh: sudah bayar listrik 250000\n\n" + "Catatan: Pembayaran hanya bisa dilakukan saat giliran Anda";

        default:
          // Check if message matches payment pattern
          const paymentMatch = message.match(/^sudah bayar listrik (\d+)$/);
          if (paymentMatch) {
            const amount = parseInt(paymentMatch[1]);

            // Validate amount
            if (isNaN(amount) || amount <= 0) {
              console.log("❌ Invalid payment amount:", amount);
              return "❌ Nominal pembayaran tidak valid.\n" + "Gunakan format: sudah bayar listrik <nominal>\n" + "Contoh: sudah bayar listrik 250000";
            }

            // Validate maximum reasonable amount (e.g., 2 million)
            if (amount > 2000000) {
              console.log("❌ Payment amount too high:", amount);
              return "❌ Nominal pembayaran terlalu besar.\n" + "Maksimal pembayaran Rp2.000.000";
            }

            console.log(`💰 Processing payment: ${amount} from ${sender}`);
            try {
              return await listrikService.handleListrikPayment(sender, amount);
            } catch (error) {
              // Check if error is about wrong turn
              if (error.message.includes("Bukan giliran")) {
                console.log("❌ Wrong turn payment attempt:", error.message);
                return `❌ ${error.message}`;
              }

              // For other errors
              console.error("❌ Payment processing error:", error);
              return "❌ Terjadi kesalahan saat memproses pembayaran.\n" + "Silakan coba lagi nanti atau hubungi admin.";
            }
          }
          return null; // Let other controllers handle unknown commands
      }
    } catch (error) {
      console.error("Error in ListrikController:", error);
      return "❌ Terjadi kesalahan saat memproses perintah listrik.\n" + "Silakan coba lagi nanti atau hubungi admin.";
    }
  }
}

module.exports = new ListrikController();
