const { sendWhatsAppMessage, sendWhatsAppMessageNoDelay } = require("./messageService");
const db = require("../data/database");

const galonSchedule = [
  { nama: "Adzka", nomor: "whatsapp:+6289519240711" },
  { nama: "Fillah", nomor: "whatsapp:+6285179813641" },
  { nama: "Fatu", nomor: "whatsapp:+6289880266355" },
  { nama: "Max", nomor: "whatsapp:+6281528976578" },
  { nama: "Farel", nomor: "whatsapp:+6285156820515" },
  { nama: "Rizky", nomor: "whatsapp:+6281396986145" },
];

let state = {
  currentIndex: 0,
  isGalonEmpty: { atas: false, bawah: false },
  activeReminders: {},
};

async function initialize() {
  try {
    const dbState = await db.getGalonState();
    state = { ...state, ...dbState };
    console.log("Galon state initialized:", state);
  } catch (error) {
    console.error("Error initializing galon state:", error);
    throw error;
  }
}

async function getNextPerson() {
  try {
    const recentPurchases = await db.getRecentPurchases();

    if (recentPurchases.length === galonSchedule.length) {
      state.currentIndex = 0;
    } else {
      while (recentPurchases.includes(galonSchedule[state.currentIndex].nomor)) {
        state.currentIndex = (state.currentIndex + 1) % galonSchedule.length;
      }
    }

    await db.updateGalonState(state);
    return galonSchedule[state.currentIndex];
  } catch (error) {
    console.error("Error getting next person:", error);
    throw error;
  }
}

async function sendGalonReminder(location) {
  try {
    const currentPerson = galonSchedule[state.currentIndex];
    const allNumbers = galonSchedule.map((p) => p.nomor);
    const recentPurchases = await db.getRecentPurchases();

    const statusList = galonSchedule
      .map((person) => {
        const hasBought = recentPurchases.includes(person.nomor);
        return `${hasBought ? "✅" : "⭕"} ${person.nama}`;
      })
      .join("\n");

    for (const number of allNumbers) {
      await sendWhatsAppMessageNoDelay(
        number,
        `🚰 PENGINGAT GALON ${location.toUpperCase()}!\n\n` +
          `Galon ${location} habis dan saatnya ${currentPerson.nama} untuk membeli galon baru.\n\n` +
          `Status pembelian galon:\n${statusList}\n\n` +
          `Jika sudah membeli, silakan balas dengan "sudah beli galon"`
      );
    }
  } catch (error) {
    console.error("Error sending galon reminder:", error);
    throw error;
  }
}

async function startGalonReminder(location) {
  try {
    if (state.activeReminders[location]) {
      clearInterval(state.activeReminders[location]);
    }

    state.activeReminders[location] = setInterval(async () => {
      try {
        if (!state.isGalonEmpty[location]) {
          clearInterval(state.activeReminders[location]);
          return;
        }
        await sendGalonReminder(location);
      } catch (error) {
        console.error(`Error in galon reminder interval for ${location}:`, error);
      }
    }, 3 * 60 * 60 * 1000);

    await db.updateGalonState(state);
  } catch (error) {
    console.error("Error starting galon reminder:", error);
    throw error;
  }
}

async function getGalonStatusMessage() {
  try {
    const currentPerson = galonSchedule[state.currentIndex];
    const recentPurchases = await db.getRecentPurchases();

    const statusList = galonSchedule
      .map((person) => {
        const hasBought = recentPurchases.includes(person.nomor);
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
  } catch (error) {
    console.error("Error getting galon status:", error);
    throw error;
  }
}

async function handleGalonCommand(message, sender) {
  try {
    message = message.toLowerCase().trim();

    if (message === "/cekgalon") {
      const statusMessage = await getGalonStatusMessage();
      await sendWhatsAppMessageNoDelay(sender, statusMessage);
      return true;
    }

    if (message === "galon atas habis" || message === "galon bawah habis") {
      const location = message.includes("atas") ? "atas" : "bawah";
      state.isGalonEmpty[location] = true;
      await db.updateGalonState(state);

      const currentPerson = await getNextPerson();
      await sendGalonReminder(location);
      await startGalonReminder(location);
      return true;
    }

    if (message === "sudah beli galon") {
      const senderIndex = galonSchedule.findIndex((p) => p.nomor === sender);
      if (senderIndex === state.currentIndex) {
        await db.recordGalonPurchase(sender);
        state.currentIndex = (state.currentIndex + 1) % galonSchedule.length;

        Object.keys(state.isGalonEmpty).forEach((location) => {
          if (state.isGalonEmpty[location]) {
            state.isGalonEmpty[location] = false;
            if (state.activeReminders[location]) {
              clearInterval(state.activeReminders[location]);
              delete state.activeReminders[location];
            }
          }
        });

        await db.updateGalonState(state);

        const allNumbers = galonSchedule.map((p) => p.nomor);
        for (const number of allNumbers) {
          await sendWhatsAppMessageNoDelay(number, `✅ ${galonSchedule[senderIndex].nama} telah membeli galon baru!\n\n` + `Terima kasih sudah menjaga ketersediaan air minum! 💧`);
        }
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error handling galon command:", error);
    throw error;
  }
}

module.exports = {
  initialize,
  handleGalonCommand,
  getGalonStatusMessage,
};
