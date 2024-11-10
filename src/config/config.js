require("dotenv").config();

const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    timezone: process.env.TZ || "Asia/Jakarta",
  },

  // Schedule Configuration
  schedule: {
    morningReminder: "0 7 * * *", // Setiap hari jam 7 pagi
    dendaCheck: "0 0 * * *", // Setiap tengah malam
    reminderInterval: 90 * 60 * 1000, // 90 menit
    messageDelay: 15000, // 15 detik
  },

  // Date Format Configuration
  dateFormat: {
    locale: "id-ID",
    options: {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  },

  // Penghuni Configuration
  penghuni: {
    "whatsapp:+6285156820515": { nama: "Farel" },
    "whatsapp:+6285179813641": { nama: "Fillah" },
    "whatsapp:+6281528976578": { nama: "Max" },
    "whatsapp:+6289519240711": { nama: "Adzka" },
    "whatsapp:+6289880266355": { nama: "Fatu" },
    "whatsapp:+6281396986145": { nama: "Rizky" },
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
    allNumbers: [
      "whatsapp:+6289519240711", // Adzka
      "whatsapp:+6289880266355", // Fatu
      "whatsapp:+6281396986145", // Rizky
      "whatsapp:+6285156820515", // Farel
      "whatsapp:+6281528976578", // Max
      "whatsapp:+6285179813641", // Fillah
    ],
  },

  // Galon Configuration
  galon: {
    schedule: [
      { nama: "Adzka", nomor: "whatsapp:+6289519240711" },
      { nama: "Fillah", nomor: "whatsapp:+6285179813641" },
      { nama: "Fatu", nomor: "whatsapp:+6289880266355" },
      { nama: "Max", nomor: "whatsapp:+6281528976578" },
      { nama: "Farel", nomor: "whatsapp:+6285156820515" },
      { nama: "Rizky", nomor: "whatsapp:+6281396986145" },
    ],
    reminderInterval: 3 * 60 * 60 * 1000, // 3 jam
  },

  // Listrik Configuration
  listrik: {
    schedule: [
      { nama: "Farel", nomor: "whatsapp:+6285156820515" },
      { nama: "Fillah", nomor: "whatsapp:+6285179813641" },
      { nama: "Max", nomor: "whatsapp:+6281528976578" },
      { nama: "Adzka", nomor: "whatsapp:+6289519240711" },
      { nama: "Fatu", nomor: "whatsapp:+6289880266355" },
      { nama: "Rizky", nomor: "whatsapp:+6281396986145" },
    ],
  },

  // Twilio Configuration
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },
};

module.exports = config;
