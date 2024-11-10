require("dotenv").config();
const twilio = require("twilio");
const appConfig = require("../config/config");

const client = twilio(appConfig.twilio.accountSid, appConfig.twilio.authToken);

async function sendWhatsAppMessageNoDelay(to, message) {
  try {
    // Basic message configuration without statusCallback
    const messageConfig = {
      from: appConfig.twilio.phoneNumber,
      to: to,
      body: message,
    };

    const response = await client.messages.create(messageConfig);
    console.log(`✅ Message sent to ${to}:`, response.sid);
    return true;
  } catch (error) {
    // Handle specific Twilio errors
    if (error.code === 21609) {
      console.warn(`⚠️ StatusCallback warning for ${to}, retrying without callback...`);
      try {
        const response = await client.messages.create({
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

    // Log detailed error information
    console.error(`❌ Error sending message to ${to}:`, {
      code: error.code,
      message: error.message,
      details: error.details || "No details available",
    });
    return false;
  }
}

async function sendWhatsAppMessage(to, message) {
  try {
    // Basic message configuration without statusCallback
    const messageConfig = {
      from: appConfig.twilio.phoneNumber,
      to: to,
      body: message,
    };

    const response = await client.messages.create(messageConfig);
    console.log(`✅ Message sent to ${to}:`, response.sid);

    // Add delay after successful send
    await new Promise((resolve) => setTimeout(resolve, appConfig.schedule.messageDelay));

    return true;
  } catch (error) {
    // Handle specific Twilio errors
    if (error.code === 21609) {
      console.warn(`⚠️ StatusCallback warning for ${to}, retrying without callback...`);
      try {
        const response = await client.messages.create({
          from: appConfig.twilio.phoneNumber,
          to: to,
          body: message,
        });
        console.log(`✅ Message sent to ${to} (retry):`, response.sid);

        // Add delay after successful retry
        await new Promise((resolve) => setTimeout(resolve, appConfig.schedule.messageDelay));

        return true;
      } catch (retryError) {
        console.error(`❌ Error sending message to ${to} (retry):`, retryError.message);
        return false;
      }
    }

    // Log detailed error information
    console.error(`❌ Error sending message to ${to}:`, {
      code: error.code,
      message: error.message,
      details: error.details || "No details available",
    });
    return false;
  }
}

// Helper function to validate WhatsApp number format
function isValidWhatsAppNumber(number) {
  return number.startsWith("whatsapp:+") && number.length > 10;
}

// Helper function to format message for better readability
function formatMessage(message) {
  if (!message) return "";
  return message.trim();
}

module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppMessageNoDelay,
  // Export helper functions in case they're needed elsewhere
  isValidWhatsAppNumber,
  formatMessage,
};
