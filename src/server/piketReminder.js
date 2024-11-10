require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const cron = require("node-cron");
const appConfig = require("../config/config");
const db = require("../data/database");

const { sendWhatsAppMessage, sendWhatsAppMessageNoDelay } = require("../services/messageService");
const { handleGalonCommand, getGalonStatusMessage } = require("../services/galonScheduler");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Simplified config object
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

// Task tracking
let completedTasks = {};
let activeReminders = {};

// Helper functions
async function isTaskCompleted(phoneNumber, date) {
  const checkDate = date || new Date().toISOString().split("T")[0];
  return await db.isTaskCompleted(phoneNumber, checkDate);
}

async function markTaskCompleted(phoneNumber) {
  const today = new Date().toISOString().split("T")[0];
  await db.markTaskCompleted(phoneNumber, today);
}

function formatRupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
  }).format(amount);
}

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

async function getPiketScheduleMessage() {
  try {
    const today = getIndonesianDay();

    // Tanggal untuk minggu lalu (4-9 November)
    const lastWeekStart = new Date("2024-11-04");
    const lastWeekEnd = new Date("2024-11-09");

    // Tanggal untuk minggu depan (11-16 November)
    const nextWeekStart = new Date("2024-11-11");
    const nextWeekEnd = new Date("2024-11-16");

    // Fungsi helper untuk mendapatkan tanggal dari hari
    function getDateForDay(date, targetDay) {
      const d = new Date(date);
      while (days[d.toLocaleDateString("en-US", { weekday: "long" })] !== targetDay) {
        d.setDate(d.getDate() + 1);
      }
      return d;
    }

    const scheduleList = await Promise.all(
      Object.entries(config.jadwalPiket).map(async ([hari, jadwal]) => {
        // Dapatkan tanggal untuk minggu lalu
        const lastWeekDate = getDateForDay(lastWeekStart, hari);
        const lastWeekDateStr = lastWeekDate.toISOString().split("T")[0];
        const wasCompletedLastWeek = await db.isTaskCompleted(jadwal.nomor, lastWeekDateStr);

        // Dapatkan tanggal untuk minggu depan
        const nextWeekDate = getDateForDay(nextWeekStart, hari);
        const nextWeekDateStr = nextWeekDate.toISOString().split("T")[0];

        let lastWeekStatus = "";
        if (lastWeekDate <= lastWeekEnd) {
          lastWeekStatus = `${wasCompletedLastWeek ? "✅" : "❌"} ${hari}, ${lastWeekDate.getDate()} Nov: ${jadwal.nama}\n`;
        }

        let nextWeekStatus = "";
        if (nextWeekDate <= nextWeekEnd) {
          nextWeekStatus = `⭕ ${hari}, ${nextWeekDate.getDate()} Nov: ${jadwal.nama}`;
        }

        return {
          lastWeek: lastWeekStatus,
          nextWeek: nextWeekStatus,
          hari: hari,
          date: nextWeekDate,
        };
      })
    );

    let message = `📅 JADWAL PIKET ${config.kontrakanName}\n\n`;
    message += "📅 Minggu Lalu:\n";
    scheduleList.forEach((item) => {
      if (item.lastWeek) message += item.lastWeek;
    });

    message += "\n📅 Minggu Depan:\n";
    scheduleList.forEach((item) => {
      if (item.nextWeek) message += item.nextWeek + "\n";
    });

    message += "\nKeterangan:\n";
    message += "✅ = Sudah Selesai\n";
    message += "❌ = Tidak Piket\n";
    message += "⭕ = Jadwal Minggu Depan\n";
    message += "⏰ = Jadwal Hari Ini";

    return message;
  } catch (error) {
    console.error("Error getting piket schedule:", error);
    throw error;
  }
}

function getHelpMessage() {
  return (
    `🤖 DAFTAR PERINTAH BOT KONTRAKAN CERIA\n\n` +
    `1. Perintah Piket:\n` +
    `   • /cekpiket - Cek jadwal piket\n` +
    `   • "sudah piket" - Konfirmasi piket selesai\n\n` +
    `2. Perintah Galon:\n` +
    `   • /cekgalon - Cek status galon\n` +
    `   • "galon atas habis" - Laporkan galon atas habis\n` +
    `   • "galon bawah habis" - Laporkan galon bawah habis\n` +
    `   • "sudah beli galon" - Konfirmasi pembelian galon\n\n` +
    `3. Keuangan:\n` +
    `   • /cekdenda - Cek daftar denda\n` +
    `   • /tabungan - Cek tabungan\n` +
    `   • "sudah bayar denda" - Konfirmasi pembayaran denda\n\n` +
    `4. Lainnya:\n` +
    `   • /help - Tampilkan bantuan ini\n\n` +
    `Denda tidak piket: ${formatRupiah(config.dendaAmount)}`
  );
}

async function getDendaMessage() {
  try {
    const dendaList = await db.getDendaList();
    let message = "📊 DAFTAR DENDA PIKET\n\n";

    if (dendaList.length === 0) {
      message += "✨ Tidak ada denda yang belum dibayar";
    } else {
      let totalDenda = 0;
      for (const denda of dendaList) {
        const jadwal = Object.entries(config.jadwalPiket).find(([_, j]) => j.nomor === denda.phone_number);
        const [hari, data] = jadwal;
        const date = new Date(denda.date);
        message += `${data.nama}\n`;
        message += `${hari}, ${date.toLocaleDateString(appConfig.dateFormat.locale, appConfig.dateFormat.options)}\n`;
        message += `Denda: ${formatRupiah(denda.amount)}\n\n`;
        totalDenda += denda.amount;
      }
      message += `Total Denda: ${formatRupiah(totalDenda)}`;
    }

    return message;
  } catch (error) {
    console.error("Error getting denda list:", error);
    throw error;
  }
}

async function getTabunganMessage() {
  try {
    const tabungan = await db.getTabungan();
    const dendaPaid = await db.getDendaPaidList();
    let total = 0;
    let message = "💰 TABUNGAN KONTRAKAN CERIA\n\n";

    if (tabungan.length === 0) {
      message += "Belum ada transaksi";
    } else {
      // Group transactions by date
      const transactions = [];

      // Add initial denda records
      tabungan.forEach((record) => {
        transactions.push({
          date: record.date,
          description: record.description,
          amount: record.amount,
        });
      });

      // Sort transactions by date
      transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Generate message and calculate total
      transactions.forEach((trans) => {
        const date = new Date(trans.date);
        message += `${date.toLocaleDateString(appConfig.dateFormat.locale, appConfig.dateFormat.options)}\n`;
        message += `${trans.description}\n`;
        message += `${formatRupiah(trans.amount)}\n\n`;
        total += trans.amount;
      });

      message += `Total Tabungan: ${formatRupiah(total)}`;
    }

    return message;
  } catch (error) {
    console.error("Error getting tabungan:", error);
    throw error;
  }
}

// Webhook handler
app.post("/webhook", async (req, res) => {
  try {
    if (!req.body?.Body || !req.body?.From) {
      return res.sendStatus(400);
    }

    const messageBody = req.body.Body.trim();
    const from = req.body.From;
    const twiml = new twilio.twiml.MessagingResponse();

    // Handle all commands
    switch (messageBody.toLowerCase()) {
      case "/help":
        await sendWhatsAppMessageNoDelay(from, getHelpMessage());
        break;

      case "/cekpiket":
        await sendWhatsAppMessageNoDelay(from, await getPiketScheduleMessage());
        break;

      case "/cekdenda":
        await sendWhatsAppMessageNoDelay(from, await getDendaMessage());
        break;

      case "/tabungan":
        await sendWhatsAppMessageNoDelay(from, await getTabunganMessage());
        break;

      case "sudah bayar denda":
        const dendaList = await db.getDendaList();
        const userDenda = dendaList.find((d) => d.phone_number === from);

        if (userDenda) {
          const currentDate = new Date().toISOString().split("T")[0];
          await db.markDendaPaid(from, userDenda.date);

          // Get updated tabungan total after payment
          const tabungan = await db.getTabungan();
          let totalTabungan = 0;
          tabungan.forEach((record) => {
            totalTabungan += record.amount;
          });

          // Notify everyone
          const jadwalInfo = Object.entries(config.jadwalPiket).find(([_, j]) => j.nomor === from);
          if (jadwalInfo) {
            const [_, data] = jadwalInfo;
            for (const number of config.allNumbers) {
              await sendWhatsAppMessageNoDelay(
                number,
                `✅ ${data.nama} telah membayar denda.\n\n` +
                  `Tanggal Pembayaran: ${new Date(currentDate).toLocaleDateString(appConfig.dateFormat.locale, appConfig.dateFormat.options)}\n` +
                  `Tabungan bertambah: ${formatRupiah(userDenda.amount)}\n` +
                  `Total Tabungan: ${formatRupiah(totalTabungan)}`
              );
            }
          }
        }
        break;

      default:
        // Handle galon commands
        if (await handleGalonCommand(messageBody, from)) {
          break;
        }

        // Unknown command
        await sendWhatsAppMessageNoDelay(from, "❌ Perintah tidak dikenali.\n" + "Ketik /help untuk melihat daftar perintah yang tersedia.");
    }

    return res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("Error handling webhook:", error);
    res.sendStatus(500);
  }
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
                `Dikenakan denda sebesar ${formatRupiah(config.dendaAmount)}.\n\n` +
                `Mari tingkatkan kedisiplinan kita! 🙏`
            );
          }
        }
      }

      console.log("Resetting tasks and reminders...");
      completedTasks = {};
      Object.values(activeReminders).forEach((interval) => clearInterval(interval));
      activeReminders = {};
    },
    {
      timezone: config.timezone,
    }
  );

  // Check current time and start reminders if needed
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: config.timezone }));
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
          sendWhatsAppMessage(number, `🧹 Hari ini adalah hari Minggu. Mari kita bersama-sama menjaga kebersihan ${config.kontrakanName}! 🌟`);
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
