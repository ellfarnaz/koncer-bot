require("dotenv").config();
const twilio = require("twilio");
const appConfig = require("../config/config");

class MessageService {
  constructor() {
    this.client = twilio(appConfig.twilio.accountSid, appConfig.twilio.authToken);
    this.messageQueue = [];
    this.retryCount = new Map();
    this.MAX_RETRIES = 3;
  }

  // Metode untuk mengirim pesan tanpa delay
  async sendWhatsAppMessageNoDelay(to, message) {
    try {
      const messageConfig = {
        from: appConfig.twilio.phoneNumber,
        to: to,
        body: message,
      };

      const response = await this.client.messages.create(messageConfig);
      console.log(`✅ Message sent to ${to}:`, response.sid);
      return true;
    } catch (error) {
      if (error.code === 21609) {
        console.warn(`⚠️ StatusCallback warning for ${to}, retrying without callback...`);
        try {
          const response = await this.client.messages.create({
            from: appConfig.twilio.phoneNumber,
            to: to,
            body: message,
          });
          console.log(`✅ Message sent to ${to} (retry):`, response.sid);
          return true;
        } catch (retryError) {
          console.error(`❌ Error sending message to ${to} (retry):`, retryError.message);
          return false;
        }
      }

      console.error(`❌ Error sending message to ${to}:`, {
        code: error.code,
        message: error.message,
        details: error.details || "No details available",
      });
      return false;
    }
  }

  // Metode untuk mengirim pesan dengan delay
  async sendWhatsAppMessage(to, message) {
    try {
      const result = await this.sendWhatsAppMessageNoDelay(to, message);
      if (result) {
        await new Promise((resolve) => setTimeout(resolve, appConfig.schedule.messageDelay));
      }
      return result;
    } catch (error) {
      console.error(`Error sending message with delay to ${to}:`, error);
      return false;
    }
  }

  // Tambahkan sistem antrian pesan
  async queueMessage(to, message, priority = "normal") {
    const queueItem = {
      to,
      message,
      priority,
      timestamp: Date.now(),
      retries: 0,
    };

    this.messageQueue.push(queueItem);
    await this.processQueue();
  }

  // Tambahkan mekanisme retry yang lebih robust
  async processQueue() {
    this.messageQueue.sort((a, b) => {
      if (a.priority === "high" && b.priority !== "high") return -1;
      if (b.priority === "high" && a.priority !== "high") return 1;
      return a.timestamp - b.timestamp;
    });

    for (const item of this.messageQueue) {
      try {
        await this.sendMessage(item);
        this.messageQueue = this.messageQueue.filter((i) => i !== item);
      } catch (error) {
        if (item.retries < this.MAX_RETRIES) {
          item.retries++;
          item.timestamp = Date.now() + item.retries * 1000; // Exponential backoff
        } else {
          console.error(`Failed to send message after ${this.MAX_RETRIES} retries:`, error);
          this.messageQueue = this.messageQueue.filter((i) => i !== item);
        }
      }
    }
  }

  async sendMessage(item) {
    try {
      // Basic message configuration without statusCallback
      const messageConfig = {
        from: appConfig.twilio.phoneNumber,
        to: item.to,
        body: item.message,
      };

      const response = await this.client.messages.create(messageConfig);
      console.log(`✅ Message sent to ${item.to}:`, response.sid);

      // Add delay after successful send
      await new Promise((resolve) => setTimeout(resolve, appConfig.schedule.messageDelay));

      return true;
    } catch (error) {
      // Handle specific Twilio errors
      if (error.code === 21609) {
        console.warn(`⚠️ StatusCallback warning for ${item.to}, retrying without callback...`);
        try {
          const response = await this.client.messages.create({
            from: appConfig.twilio.phoneNumber,
            to: item.to,
            body: item.message,
          });
          console.log(`✅ Message sent to ${item.to} (retry):`, response.sid);

          // Add delay after successful retry
          await new Promise((resolve) => setTimeout(resolve, appConfig.schedule.messageDelay));

          return true;
        } catch (retryError) {
          console.error(`❌ Error sending message to ${item.to} (retry):`, retryError.message);
          return false;
        }
      }

      // Log detailed error information
      console.error(`❌ Error sending message to ${item.to}:`, {
        code: error.code,
        message: error.message,
        details: error.details || "No details available",
      });
      return false;
    }
  }

  // Helper function to validate WhatsApp number format
  isValidWhatsAppNumber(number) {
    return number.startsWith("whatsapp:+") && number.length > 10;
  }

  // Helper function to format message for better readability
  formatMessage(message) {
    if (!message) return "";
    return message.trim();
  }
}

// Export instance dari MessageService
const messageService = new MessageService();
module.exports = messageService;
