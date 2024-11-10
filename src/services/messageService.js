require("dotenv").config();
const twilio = require("twilio");
const appConfig = require("../config/config");

const client = twilio(appConfig.twilio.accountSid, appConfig.twilio.authToken);

async function sendWhatsAppMessageNoDelay(to, message) {
  try {
    const response = await client.messages.create({
      from: appConfig.twilio.phoneNumber,
      to: to,
      body: message,
    });
    console.log("Message sent:", response.sid);
    return true;
  } catch (error) {
    console.error("Error sending message:", error);
    return false;
  }
}

async function sendWhatsAppMessage(to, message) {
  try {
    const response = await client.messages.create({
      from: appConfig.twilio.phoneNumber,
      to: to,
      body: message,
    });
    console.log("Message sent:", response.sid);
    await new Promise((resolve) => setTimeout(resolve, appConfig.schedule.messageDelay));
    return true;
  } catch (error) {
    console.error("Error sending message:", error);
    return false;
  }
}

module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppMessageNoDelay,
};
