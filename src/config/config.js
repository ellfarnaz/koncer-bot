const config = {
  // Twilio Configuration
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    timezone: process.env.TZ || "Asia/Jakarta",
  },

  // Schedule Configuration
  schedule: {
    // Format: "MM HH * * *" (Menit Jam * * *)
    morningReminder: "0 7 * * *",
    dendaCheck: "0 0 * * *",
    reminderInterval: 90 * 60 * 1000,
    messageDelay: 15000,
  },

  // Piket Configuration
  piket: {
    kontrakanName: "Kontrakan Ceria",
    dendaAmount: 10000,
    jadwal: {
      Senin: { nama: "Adzka", nomor: "whatsapp:+6289519240711" },
      Selasa: { nama: "Fatu", nomor: "whatsapp:+6289880266355" },
      Rabu: { nama: "Rizky", nomor: "whatsapp:+6281396986145" },
      Kamis: { nama: "Farel", nomor: "whatsapp:+6285156820515" },
      Jumat: { nama: "Max", nomor: "whatsapp:+6281528976578" },
      Sabtu: { nama: "Fillah", nomor: "whatsapp:+6285179813641" },
    },
    // List semua nomor untuk broadcast
    allNumbers: [
      "whatsapp:+6289519240711",
      "whatsapp:+6289880266355",
      "whatsapp:+6281396986145",
      "whatsapp:+6285156820515",
      "whatsapp:+6281528976578",
      "whatsapp:+6285179813641",
    ],
  },
};

module.exports = config;
