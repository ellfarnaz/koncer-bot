require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cron = require("node-cron");
const config = require("../config/config");
const db = require("../data/database");
const webhookController = require("../controllers/webhookController");
const galonService = require("../services/galonService");
const reminderService = require("../services/reminderService");
const piketService = require("../services/piketService");
const { sendWhatsAppMessage } = require("../services/messageService");

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Routes
app.post("/webhook", async (req, res) => {
  try {
    console.log("📥 Incoming webhook:", {
      from: req.body.From,
      message: req.body.Body,
    });

    const result = await webhookController.handleIncomingMessage(req, res);

    // If we have a response and it's not already sent
    if (result && !res.headersSent) {
      console.log("📤 Sending response:", result);

      // Send response back via Twilio
      const sender = req.body.From;
      await sendWhatsAppMessage(sender, result);

      // Send acknowledgment to Twilio
      res.status(200).send(result);
    }
  } catch (error) {
    console.error("❌ Error in webhook route:", error);
    if (!res.headersSent) {
      res.status(500).send("Internal Server Error");
    }
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: require("../../package.json").version,
  });
});

// Schedule daily piket reminders
function setupScheduledTasks() {
  // Schedule piket reminder at 7 AM Jakarta time
  cron.schedule(
    config.schedule.morningReminder,
    async () => {
      console.log("⏰ Running daily piket reminder check...");
      const today = new Date();
      const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
      const jadwal = config.piket.jadwal[dayName];

      if (jadwal) {
        console.log(`📅 Today's schedule: ${jadwal.nama}`);
        await reminderService.startRemindersForPerson(jadwal);
      } else {
        console.log("📅 No schedule for today");
      }
    },
    {
      timezone: config.server.timezone,
    }
  );

  // Add denda check at midnight
  cron.schedule(
    config.schedule.dendaCheck,
    async () => {
      console.log("💰 Running daily denda check...");
      // Implement denda check logic here
    },
    {
      timezone: config.server.timezone,
    }
  );

  console.log("✅ Scheduled tasks setup complete");
}

// Initialize services and start server
async function startServer(port = config.server.port) {
  try {
    // Initialize database
    console.log("🔄 Initializing database...");
    await db.initializeDatabase();
    console.log("✅ Database initialized");

    // Initialize galon service
    console.log("🔄 Initializing galon service...");
    await galonService.initialize();
    console.log("✅ Galon service initialized");

    // Setup scheduled tasks
    console.log("⚙️ Setting up scheduled tasks...");
    setupScheduledTasks();

    // Start the server
    return new Promise((resolve, reject) => {
      const server = app
        .listen(port, () => {
          console.log(`\n🚀 Server is running on port ${port}`);
          console.log("📝 Webhook URL: http://localhost:" + port + "/webhook");
          console.log("🏥 Health check: http://localhost:" + port + "/health");

          // Log environment info
          console.log("\n📊 Environment Information:");
          console.log(`• Node Environment: ${process.env.NODE_ENV || "development"}`);
          console.log(`• Timezone: ${config.server.timezone}`);
          console.log(`• Version: ${require("../../package.json").version}`);

          resolve(server);
        })
        .on("error", (err) => {
          if (err.code === "EADDRINUSE") {
            console.log(`⚠️ Port ${port} is busy, trying ${port + 1}...`);
            server.close();
            startServer(port + 1)
              .then(resolve)
              .catch(reject);
          } else {
            console.error("❌ Server error:", err);
            reject(err);
          }
        });

      // Graceful shutdown handling
      const shutdown = async (signal) => {
        console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);

        try {
          // Close server first
          await new Promise((resolve) => server.close(resolve));
          console.log("✅ Server closed successfully");

          // Cleanup other resources if needed
          // Add any cleanup code here

          console.log("👋 Goodbye!");
          process.exit(0);
        } catch (error) {
          console.error("❌ Error during shutdown:", error);
          process.exit(1);
        }
      };

      // Handle various shutdown signals
      process.on("SIGTERM", () => shutdown("SIGTERM"));
      process.on("SIGINT", () => shutdown("SIGINT"));
      process.on("uncaughtException", (error) => {
        console.error("❌ Uncaught Exception:", error);
        shutdown("Uncaught Exception");
      });
      process.on("unhandledRejection", (reason, promise) => {
        console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
        shutdown("Unhandled Rejection");
      });
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    throw error;
  }
}

module.exports = {
  app,
  startServer,
};
