const piketController = require("./piketController");
const galonController = require("./galonController");
const rekeningController = require("./rekeningController");
const listrikController = require("./listrikController");
const { sendWhatsAppMessage } = require("../services/messageService");

class WebhookController {
  async handleIncomingMessage(req, res) {
    try {
      console.log("📥 Incoming webhook:", {
        from: req.body.From,
        message: req.body.Body,
      });

      // Check if message exists in request body
      if (!req.body || !req.body.Body) {
        console.log("Missing message body");
        return res.status(400).send("Message body is required");
      }

      const message = req.body.Body;
      const sender = req.body.From;

      console.log(`Processing message: "${message}" from ${sender}`);

      let response;

      // Try each controller in sequence
      try {
        // Try piket commands
        response = await piketController.handleCommand(message, sender);
        if (response) {
          console.log(`📤 Sending response: ${response}`);
          await sendWhatsAppMessage(sender, response);
          return res.status(200).json({ success: true });
        }

        // Try listrik commands
        response = await listrikController.handleCommand(message, sender);
        if (response) {
          console.log(`📤 Sending response: ${response}`);
          await sendWhatsAppMessage(sender, response);
          return res.status(200).json({ success: true });
        }

        // Try galon commands
        response = await galonController.handleCommand(message, sender);
        if (response) {
          console.log(`📤 Sending response: ${response}`);
          await sendWhatsAppMessage(sender, response);
          return res.status(200).json({ success: true });
        }

        // Try rekening commands
        response = await rekeningController.handleCommand(message, sender);
        if (response) {
          console.log(`📤 Sending response: ${response}`);
          await sendWhatsAppMessage(sender, response);
          return res.status(200).json({ success: true });
        }

        // If no controller handled the command
        console.log("Command not recognized");
        response = "❌ Perintah tidak dikenali. Ketik /help untuk bantuan.";
        await sendWhatsAppMessage(sender, response);
        return res.status(200).json({ success: true });
      } catch (error) {
        console.error("Error processing command:", error);
        response = "❌ Terjadi kesalahan saat memproses perintah";
        await sendWhatsAppMessage(sender, response);
        return res.status(200).json({ success: false, error: error.message });
      }
    } catch (error) {
      console.error("Error handling webhook:", error);
      return res.status(500).json({
        success: false,
        error: "Internal Server Error",
      });
    }
  }
}

module.exports = new WebhookController();
