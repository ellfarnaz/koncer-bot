require("dotenv").config();
const localtunnel = require("localtunnel");
const {
  startServer,
  config,
  formatRupiah,
  startScheduler,
} = require("./piketReminder"); // Changed path
const { sendWhatsAppMessageNoDelay } = require("../services/messageService"); // Changed path

async function startLocaltunnelServer() {
  let server;
  try {
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
      for (const number of config.allNumbers) {
        await sendWhatsAppMessageNoDelay(
          number,
          "👋 Halo! Saya adalah Bot Kontrakan Ceria.\n\n" + // Changed here
            "Saya akan mengingatkan jadwal piket setiap hari pukul 07:00 WIB.\n" +
            "Untuk hari Minggu, kita akan bersama-sama menjaga kebersihan.\n\n" +
            `Denda tidak piket: ${formatRupiah(config.dendaAmount)}\n\n` +
            "Mari kita jaga kebersihan bersama! 🧹✨"
        );
      }
      console.log("✅ Pesan inisial terkirim!");

      // Start scheduler after all initial messages with delay
      console.log("Menunggu sebelum memulai sistem pengingat...");
      setTimeout(() => {
        console.log("Memulai sistem pengingat...");
        startScheduler();
      }, config.messageDelay);
    } catch (error) {
      console.error("❌ Error mengirim pesan inisial:", error.message);
    }

    tunnel.on("close", () => {
      console.log("❌ Tunnel ditutup");
      process.exit(1);
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
    if (server) server.close();
    process.exit(1);
  }

  // Handle process termination
  process.on("SIGINT", () => {
    if (server) server.close();
    process.exit(0);
  });
}

startLocaltunnelServer();
