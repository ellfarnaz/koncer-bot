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
    // Log raw request untuk debugging
    console.log("🔍 Raw webhook request:", {
      body: req.body,
      headers: req.headers,
    });

    const messageData = {
      from: req.body.From || req.body.from,
      body: req.body.Body || req.body.message,
    };

    console.log("📥 Incoming webhook:", messageData);

    // Validasi pesan
    if (!messageData.body) {
      console.log("❌ Missing message body");
      return res.status(400).json({
        success: false,
        error: "Missing message body",
      });
    }

    if (!messageData.from) {
      console.log("❌ Missing sender information");
      return res.status(400).json({
        success: false,
        error: "Missing sender information",
      });
    }

    // Proses pesan melalui webhook controller
    const result = await webhookController.handleIncomingMessage(messageData);

    // Jika ada hasil pemrosesan
    if (result) {
      // Format pesan untuk logging
      const logMessage = typeof result === "object" ? result.message : result;
      console.log("📤 Sending response:", logMessage);

      // Persiapkan response untuk Twilio
      const twilioResponse = new MessagingResponse();

      // Jika result adalah object dengan flag isNotification
      if (typeof result === "object" && result.isNotification) {
        console.log("ℹ️ Notification response, skipping message send");
        return res.status(200).json({
          success: true,
          notification: true,
          message: result.message,
        });
      }

      // Tambahkan pesan ke response Twilio
      twilioResponse.message(typeof result === "object" ? result.message : result);

      // Set header content type untuk response Twilio
      res.setHeader("Content-Type", "text/xml");

      // Kirim response
      console.log("✅ Sending Twilio response");
      return res.status(200).send(twilioResponse.toString());
    }

    // Jika tidak ada hasil pemrosesan, kirim acknowledgment
    console.log("ℹ️ No response needed");
    return res.status(200).json({
      success: true,
      message: "Processed successfully",
    });
  } catch (error) {
    // Log error detail
    console.error("❌ Error in webhook route:", {
      message: error.message,
      stack: error.stack,
      details: error,
    });

    // Kirim error response
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
      timeStamp: new Date().toISOString(),
    });
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
