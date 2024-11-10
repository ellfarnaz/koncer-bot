require("dotenv").config();
const localtunnel = require("localtunnel");
const { startServer } = require("./server");
const { sendWhatsAppMessageNoDelay } = require("../services/messageService");
const config = require("../config/config");
const db = require("../data/database");
const galonService = require("../services/galonService");
const { formatRupiah } = require("../utils/formatter");
const reminderService = require("../services/reminderService");
const cron = require("node-cron");

// Initialize scheduled tasks
async function initializeScheduler() {
  console.log("Initializing scheduler...");

  // Schedule piket reminder at 7 AM Jakarta time
  cron.schedule(
    config.schedule.morningReminder,
    async () => {
      console.log("Running daily piket reminder check...");
      const today = new Date();
      const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
      const jadwal = config.piket.jadwal[dayName];

      if (jadwal) {
        reminderService.startRemindersForPerson(jadwal);
      }
    },
    {
      timezone: config.server.timezone,
    }
  );

  console.log("✅ Scheduler initialized successfully!");
}

async function startLocaltunnelServer() {
  let server;
  try {
    // Initialize database
    console.log("Initializing database...");
    await db.initializeDatabase();
    console.log("✅ Database initialized successfully!");

    // Initialize galon state
    console.log("Initializing galon state...");
    await galonService.initialize();
    console.log("✅ Galon state initialized successfully!");

    // Start the main application
    server = await startServer();
    const port = server.address().port;

    console.log("\nMembuat tunnel...");
    const tunnel = await localtunnel({
      port,
      subdomain: "piket-bot",
    });

    console.log("✅ Tunnel berhasil dibuat!\n");
    console.log("-----------------------------------");
    console.log("🌍 URL Publik:", tunnel.url);
    console.log("🔗 Webhook URL:", tunnel.url + "/webhook");
    console.log("⚡ Gunakan URL ini di Twilio Console");
    console.log("-----------------------------------\n");

    // Send initial message first without delays between messages
    console.log("Mengirim pesan inisial...");
    try {
      const galonStatus = await galonService.getGalonStatusMessage();

      for (const number of config.piket.allNumbers) {
        await sendWhatsAppMessageNoDelay(
          number,
          "👋 Halo! Saya adalah Bot Kontrakan Ceria.\n\n" +
            "Saya akan mengingatkan jadwal piket setiap hari pukul 07:00 WIB.\n" +
            "Untuk hari Minggu, kita akan bersama-sama menjaga kebersihan.\n\n" +
            `${galonStatus}\n\n` +
            `Denda tidak piket: ${formatRupiah(config.piket.dendaAmount)}\n\n` +
            "Mari kita jaga kebersihan bersama! 🧹✨"
        );
        console.log(`✅ Pesan terkirim ke ${number}`);
      }
      console.log("✅ Semua pesan inisial terkirim!");

      // Initialize scheduler
      await initializeScheduler();
    } catch (error) {
      console.error("❌ Error mengirim pesan inisial:", error);
    }

    // Handle tunnel events
    tunnel.on("close", async () => {
      console.log("❌ Tunnel ditutup");
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
      process.exit(1);
    });

    tunnel.on("error", async (err) => {
      console.error("❌ Tunnel error:", err.message);
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
      process.exit(1);
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    process.exit(1);
  }

  // Handle process termination
  process.on("SIGINT", async () => {
    console.log("\nReceived SIGINT. Cleaning up...");
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log("Server closed.");
    }
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", async (err) => {
    console.error("❌ Uncaught Exception:", err);
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", async (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    process.exit(1);
  });
}

// Start the server
console.log("Starting Bot Kontrakan Ceria...");
startLocaltunnelServer().catch((error) => {
  console.error("❌ Fatal Error:", error);
  process.exit(1);
});
