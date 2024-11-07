const {
  sendWhatsAppMessage,
  sendWhatsAppMessageNoDelay,
} = require("./messageService");

// Galon schedule configuration
const galonSchedule = [
  { nama: "Adzka", nomor: "whatsapp:+6289519240711" },
  { nama: "Fillah", nomor: "whatsapp:+6285179813641" },
  { nama: "Fatu", nomor: "whatsapp:+6289880266355" },
  { nama: "Max", nomor: "whatsapp:+6281528976578" },
  { nama: "Farel", nomor: "whatsapp:+6285156820515" },
  { nama: "Rizky", nomor: "whatsapp:+6281396986145" },
];

// State tracking
let state = {
  currentIndex: 0,
  activeReminders: {},
  completedPurchases: new Set(),
  isGalonEmpty: { atas: false, bawah: false },
};

// Helper function to get next person in rotation
function getNextPerson() {
  if (state.completedPurchases.size === galonSchedule.length) {
    state.completedPurchases.clear();
  }

  while (state.completedPurchases.has(state.currentIndex)) {
    state.currentIndex = (state.currentIndex + 1) % galonSchedule.length;
  }

  return galonSchedule[state.currentIndex];
}

// Function to send reminder to current person
async function sendGalonReminder(location) {
  const currentPerson = galonSchedule[state.currentIndex];
  const allNumbers = galonSchedule.map((p) => p.nomor);

  // Create status message showing who has bought
  const statusList = galonSchedule
    .map((person) => {
      const hasBought = state.completedPurchases.has(
        galonSchedule.findIndex((p) => p.nama === person.nama)
      );
      return `${hasBought ? "✅" : "⭕"} ${person.nama}`;
    })
    .join("\n");

  // Send to everyone
  for (const number of allNumbers) {
    await sendWhatsAppMessageNoDelay(
      number,
      `🚰 PENGINGAT GALON ${location.toUpperCase()}!\n\n` +
        `Galon ${location} habis dan saatnya ${currentPerson.nama} untuk membeli galon baru.\n\n` +
        `Status pembelian galon:\n${statusList}\n\n` +
        `Jika sudah membeli, silakan balas dengan "sudah beli galon"`
    );
  }
}

// Function to start reminder interval
function startGalonReminder(location) {
  const currentPerson = galonSchedule[state.currentIndex];

  // Clear existing reminder if any
  if (state.activeReminders[location]) {
    clearInterval(state.activeReminders[location]);
  }

  // Set reminder every 3 hours
  state.activeReminders[location] = setInterval(() => {
    if (!state.isGalonEmpty[location]) {
      clearInterval(state.activeReminders[location]);
      return;
    }
    sendGalonReminder(location);
  }, 3 * 60 * 60 * 1000); // 3 hours
}

// Add new function to get galon status message
function getGalonStatusMessage() {
  const currentPerson = galonSchedule[state.currentIndex];
  const statusList = galonSchedule
    .map((person) => {
      const hasBought = state.completedPurchases.has(
        galonSchedule.findIndex((p) => p.nama === person.nama)
      );
      return `${hasBought ? "✅" : "⭕"} ${person.nama}`;
    })
    .join("\n");

  return (
    `🚰 STATUS GALON\n\n` +
    `Giliran saat ini: ${currentPerson.nama}\n\n` +
    `Status Galon:\n` +
    `${state.isGalonEmpty.atas ? "❌" : "✅"} Galon Atas\n` +
    `${state.isGalonEmpty.bawah ? "❌" : "✅"} Galon Bawah\n\n` +
    `Status Pembelian:\n${statusList}`
  );
}

// Handle galon commands
function handleGalonCommand(message, sender) {
  message = message.toLowerCase().trim();

  if (message === "/cekgalon") {
    const statusMessage = getGalonStatusMessage();
    sendWhatsAppMessageNoDelay(sender, statusMessage);
    return true;
  }

  if (message === "galon atas habis" || message === "galon bawah habis") {
    const location = message.includes("atas") ? "atas" : "bawah";
    state.isGalonEmpty[location] = true;
    const currentPerson = getNextPerson();
    sendGalonReminder(location);
    startGalonReminder(location);
    return true;
  }

  if (message === "sudah beli galon") {
    const senderIndex = galonSchedule.findIndex((p) => p.nomor === sender);
    if (senderIndex === state.currentIndex) {
      state.completedPurchases.add(state.currentIndex);
      state.currentIndex = (state.currentIndex + 1) % galonSchedule.length;

      // Clear reminders and mark as not empty
      Object.keys(state.isGalonEmpty).forEach((location) => {
        if (state.isGalonEmpty[location]) {
          state.isGalonEmpty[location] = false;
          if (state.activeReminders[location]) {
            clearInterval(state.activeReminders[location]);
            delete state.activeReminders[location];
          }
        }
      });

      // Send confirmation to everyone
      const allNumbers = galonSchedule.map((p) => p.nomor);
      allNumbers.forEach((number) => {
        sendWhatsAppMessageNoDelay(
          number,
          `✅ ${galonSchedule[senderIndex].nama} telah membeli galon baru!\n\n` +
            `Terima kasih sudah menjaga ketersediaan air minum! 💧`
        );
      });
      return true;
    }
  }

  return false;
}

module.exports = {
  handleGalonCommand,
  getGalonState: () => state,
  getGalonStatusMessage, // Export for help command
};
