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

module.exports = {
  days,
  getIndonesianDay,
  getDateForDay,
};
