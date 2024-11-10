const piketController = require("./piketController");
const galonController = require("./galonController");
const rekeningController = require("./rekeningController");
const listrikController = require("./listrikController");
const { sendWhatsAppMessage } = require("../services/messageService");

class WebhookController {
  async handleIncomingMessage(messageData) {
    try {
      const { from, body } = messageData;

      // Check if message exists
      if (!body) {
        console.log("Missing message body");
        throw new Error("Message body is required");
      }

      console.log(`Processing message: "${body}" from ${from}`);

      let response;

      // Try each controller in sequence
      try {
        // Try piket commands
        response = await piketController.handleCommand(body, from);
        if (response) return response;

        // Try listrik commands
        response = await listrikController.handleCommand(body, from);
        if (response) return response;

        // Try galon commands
        response = await galonController.handleCommand(body, from);
        if (response) return response;

        // Try rekening commands
        response = await rekeningController.handleCommand(body, from);
        if (response) return response;

        // If no controller handled the command
        console.log("Command not recognized");
        return "❌ Perintah tidak dikenali. Ketik /help untuk bantuan.";
      } catch (error) {
        console.error("Error processing command:", error);
        return "❌ Terjadi kesalahan saat memproses perintah";
      }
    } catch (error) {
      console.error("Error handling webhook:", error);
      throw error;
    }
  }
}

module.exports = new WebhookController();
