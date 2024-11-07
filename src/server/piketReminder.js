require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const cron = require("node-cron");
const appConfig = require("../config/config");
const {
  sendWhatsAppMessage,
  sendWhatsAppMessageNoDelay,
} = require("../services/messageService");
const {
  handleGalonCommand,
  getGalonStatusMessage,
} = require("../services/galonScheduler");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Simplified config object using the imported config
const config = {
  accountSid: appConfig.twilio.accountSid,
  authToken: appConfig.twilio.authToken,
  twilioNumber: appConfig.twilio.phoneNumber,
  port: appConfig.server.port,
  timezone: appConfig.server.timezone,
  cronSchedule: appConfig.schedule.morningReminder,
  jadwalPiket: appConfig.piket.jadwal,
  allNumbers: appConfig.piket.allNumbers,
  reminderInterval: appConfig.schedule.reminderInterval,
  kontrakanName: appConfig.piket.kontrakanName,
  messageDelay: appConfig.schedule.messageDelay,
  dendaAmount: appConfig.piket.dendaAmount,
};

// Add task completion tracking
let completedTasks = {
  // Will store dates as "YYYY-MM-DD": ["phone_number"]
};

// Add active reminders tracking
let activeReminders = {};

// Helper to check if task is completed
function isTaskCompleted(phoneNumber) {
  const today = new Date().toISOString().split("T")[0];
  return completedTasks[today]?.includes(phoneNumber);
}

// Helper to mark task as completed
function markTaskCompleted(phoneNumber) {
  const today = new Date().toISOString().split("T")[0];
  if (!completedTasks[today]) {
    completedTasks[today] = [];
  }
  completedTasks[today].push(phoneNumber);
}

// Move formatRupiah before any usage
function formatRupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
  }).format(amount);
}

// Move days object to global scope
const days = {
  Sunday: "Minggu",
  Monday: "Senin",
  Tuesday: "Selasa",
  Wednesday: "Rabu",
  Thursday: "Kamis",
  Friday: "Jumat",
  Saturday: "Sabtu",
};

function getIndonesianDay() {
  return days[new Date().toLocaleDateString("en-US", { weekday: "long" })];
}

// Add function to get piket schedule message
function getPiketScheduleMessage() {
  const today = getIndonesianDay();
  const scheduleList = Object.entries(config.jadwalPiket)
    .map(([hari, jadwal]) => {
      const isDone = isTaskCompleted(jadwal.nomor);
      const isToday = hari === today;
      return `${isDone ? "✅" : isToday ? "⏰" : "⭕"} ${hari}: ${jadwal.nama}`;
    })
    .join("\n");

  return `📅 JADWAL PIKET ${config.kontrakanName}\n\n${scheduleList}`;
}

// Add function to get help message
function getHelpMessage() {
  return (
    `🤖 DAFTAR PERINTAH BOT KONTRAKAN CERIA\n\n` + // Changed here
    `1. Perintah Piket:\n` +
    `   • /cekpiket - Cek jadwal piket\n` +
    `   • "sudah piket" - Konfirmasi piket selesai\n\n` +
    `2. Perintah Galon:\n` +
    `   • /cekgalon - Cek status galon\n` +
    `   • "galon atas habis" - Laporkan galon atas habis\n` +
    `   • "galon bawah habis" - Laporkan galon bawah habis\n` +
    `   • "sudah beli galon" - Konfirmasi pembelian galon\n\n` +
    `3. Lainnya:\n` +
    `   • /help - Tampilkan bantuan ini\n\n` +
    `Denda tidak piket: ${formatRupiah(config.dendaAmount)}`
  );
}

// Modified webhook to handle confirmations
app.post("/webhook", (req, res) => {
  if (!req.body?.Body || !req.body?.From) {
    return res.sendStatus(400);
  }

  const messageBody = req.body.Body.trim();
  const from = req.body.From;

  // Create TwiML response
  const twiml = new twilio.twiml.MessagingResponse();

  // Check for help command
  if (messageBody.toLowerCase() === "/help") {
    sendWhatsAppMessageNoDelay(from, getHelpMessage());
    return res.type("text/xml").send(twiml.toString());
  }

  // Check for schedule check command
  if (messageBody.toLowerCase() === "/cekpiket") {
    sendWhatsAppMessageNoDelay(from, getPiketScheduleMessage());
    return res.type("text/xml").send(twiml.toString());
  }

  // Check for galon commands
  if (handleGalonCommand(messageBody, from)) {
    return res.type("text/xml").send(twiml.toString());
  }

  // Handle piket confirmation
  if (messageBody.toLowerCase() === "sudah piket") {
    const hari = getIndonesianDay();
    const jadwal = config.jadwalPiket[hari];

    if (hari !== "Minggu" && jadwal?.nomor === from) {
      markTaskCompleted(from);
      if (activeReminders[from]) {
        clearInterval(activeReminders[from]);
        delete activeReminders[from];
      }
      twiml.message(
        `✅ Terima kasih sudah melakukan piket hari ini di ${config.kontrakanName}!\n` +
          `Pengingat telah dihentikan.`
      );
      return res.type("text/xml").send(twiml.toString());
    }
  }

  // If no valid command matched, send help message
  sendWhatsAppMessageNoDelay(
    from,
    "❌ Perintah tidak dikenali.\n" +
      "Ketik /help untuk melihat daftar perintah yang tersedia."
  );
  return res.type("text/xml").send(twiml.toString());
});

async function sendReminder(jadwal) {
  const today = new Date().toISOString().split("T")[0];
  if (!isTaskCompleted(jadwal.nomor)) {
    await sendWhatsAppMessage(
      // This one keeps the delay
      jadwal.nomor,
      `🔔 PENGINGAT PIKET ${config.kontrakanName}!\n\n` +
        `Hai ${jadwal.nama}, kamu belum konfirmasi piket hari ini.\n` +
        `Pesan ini akan terus dikirim setiap menit sampai kamu konfirmasi.\n\n` +
        `Balas "sudah piket" untuk menghentikan pengingat ini 🧹`
    );
    return true;
  }
  return false;
}

function startScheduler() {
  console.log("Initializing scheduler...");

  // Function to start reminders for a specific person
  function startRemindersForPerson(jadwal) {
    if (!activeReminders[jadwal.nomor]) {
      console.log(`Starting reminders for ${jadwal.nama}`);
      sendWhatsAppMessageNoDelay(
        // Changed to no delay for initial notification
        jadwal.nomor,
        `🧹 Hai ${jadwal.nama}, hari ini adalah jadwal piket kamu di ${config.kontrakanName}.\n\n` +
          `Jika sudah selesai piket, mohon balas dengan pesan "sudah piket".\n\n` +
          `Kamu akan menerima pengingat setiap menit sampai konfirmasi diterima! 💪`
      );

      activeReminders[jadwal.nomor] = setInterval(() => {
        sendReminder(jadwal);
      }, config.reminderInterval);
    }
  }

  // Daily reset at 00:20 AM Jakarta time with denda notification
  cron.schedule(
    appConfig.schedule.dendaCheck, // Use new config reference
    async () => {
      console.log("Running midnight check and reset (00:20 WIB)");
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = yesterdayDate.toLocaleDateString("en-US", {
        weekday: "long",
      });
      const indonesianYesterday = days[yesterday];

      // Check if someone didn't complete their task
      if (indonesianYesterday !== "Minggu") {
        const jadwal = config.jadwalPiket[indonesianYesterday];
        if (jadwal && !isTaskCompleted(jadwal.nomor)) {
          console.log(`Sending denda notification for ${jadwal.nama}`);
          for (const number of config.allNumbers) {
            await sendWhatsAppMessageNoDelay(
              // Changed to no delay for denda messages
              number,
              `⚠️ INFORMASI DENDA PIKET ${config.kontrakanName}\n\n` +
                `${jadwal.nama} tidak melakukan piket hari ini (${indonesianYesterday}).\n` +
                `Dikenakan denda sebesar ${formatRupiah(
                  config.dendaAmount
                )}.\n\n` +
                `Mari tingkatkan kedisiplinan kita! 🙏`
            );
          }
        }
      }

      console.log("Resetting tasks and reminders...");
      completedTasks = {};
      Object.values(activeReminders).forEach((interval) =>
        clearInterval(interval)
      );
      activeReminders = {};
    },
    {
      timezone: config.timezone,
    }
  );

  // Check current time and start reminders if needed
  const now = new Date();
  const jakartaTime = new Date(
    now.toLocaleString("en-US", { timeZone: config.timezone })
  );
  const currentHour = jakartaTime.getHours();
  const currentDay = getIndonesianDay();

  console.log(`Current time in Jakarta: ${jakartaTime.toLocaleString()}`);
  console.log(`Current day: ${currentDay}`);

  // Initial check
  if (currentDay !== "Minggu") {
    const jadwal = config.jadwalPiket[currentDay];
    if (jadwal && !isTaskCompleted(jadwal.nomor) && currentHour >= 7) {
      console.log(`Starting immediate reminders for ${jadwal.nama}`);
      startRemindersForPerson(jadwal);
    }
  }

  // Schedule for next day at 7 AM
  cron.schedule(
    config.cronSchedule,
    () => {
      console.log("Running 7 AM schedule check");
      const hari = getIndonesianDay();
      console.log(`Schedule check for: ${hari}`);

      if (hari === "Minggu") {
        config.allNumbers.forEach((number) => {
          sendWhatsAppMessage(
            number,
            `🧹 Hari ini adalah hari Minggu. Mari kita bersama-sama menjaga kebersihan ${config.kontrakanName}! 🌟`
          );
        });
      } else {
        const jadwal = config.jadwalPiket[hari];
        if (jadwal) {
          startRemindersForPerson(jadwal);
        }
      }
    },
    {
      timezone: config.timezone,
    }
  );

  console.log("Scheduler initialized successfully!");
}

function startServer(port = config.port) {
  return new Promise((resolve, reject) => {
    const server = app
      .listen(port)
      .on("error", (error) => {
        if (error.code === "EADDRINUSE") {
          console.log(`Port ${port} busy, trying ${port + 1}...`);
          server.close();
          startServer(port + 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(error);
        }
      })
      .on("listening", () => {
        config.port = port;
        console.log(`Server running on port ${port}`);
        // Don't start scheduler immediately
        resolve(server);
      });
  });
}

module.exports = {
  startServer,
  config,
  formatRupiah,
  startScheduler,
};
