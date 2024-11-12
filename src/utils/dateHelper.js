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

function getDateForDay(date, targetDay) {
  const d = new Date(date);
  while (days[d.toLocaleDateString("en-US", { weekday: "long" })] !== targetDay) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

// Fungsi baru untuk mendapatkan tanggal minggu ini
function getCurrentWeekDates() {
  const today = new Date();
  const currentDay = today.getDay();
  const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);

  const monday = new Date(today.setDate(diff));
  const dates = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }

  return dates;
}

module.exports = {
  days,
  getIndonesianDay,
  getDateForDay,
  getCurrentWeekDates,
};
