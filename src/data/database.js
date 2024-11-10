const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const db = new sqlite3.Database(path.join(__dirname, "bot.db"));

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    console.log("Starting database initialization...");

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      try {
        console.log("Creating tables if not exists...");

        // Piket table
        db.run(`CREATE TABLE IF NOT EXISTS piket_tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT,
          phone_number TEXT,
          completed INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(date, phone_number)
        )`);

        // Galon table
        db.run(`CREATE TABLE IF NOT EXISTS galon_state (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          current_index INTEGER DEFAULT 0,
          galon_atas_empty INTEGER DEFAULT 0,
          galon_bawah_empty INTEGER DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Galon purchases table
        db.run(`CREATE TABLE IF NOT EXISTS galon_purchases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone_number TEXT,
          purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Denda table with unique constraint
        db.run(`CREATE TABLE IF NOT EXISTS denda (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone_number TEXT,
          date TEXT,
          amount INTEGER,
          paid INTEGER DEFAULT 0,
          paid_date TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(phone_number, date)
        )`);

        // Tabungan table with unique constraint
        db.run(`CREATE TABLE IF NOT EXISTS tabungan (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount INTEGER,
          description TEXT,
          date TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(description, date)
        )`);

        // Initialize completed piket tasks (except Max)
        console.log("Initializing piket completion data...");
        const startDate = new Date("2024-11-04"); // Senin, 4 November 2024
        const piketData = [
          {
            date: new Date("2024-11-04").toISOString().split("T")[0], // Senin
            phoneNumber: "whatsapp:+6289519240711", // Adzka
            completed: 1,
            nama: "Adzka",
          },
          {
            date: new Date("2024-11-05").toISOString().split("T")[0], // Selasa
            phoneNumber: "whatsapp:+6289880266355", // Fatu
            completed: 1,
            nama: "Fatu",
          },
          {
            date: new Date("2024-11-06").toISOString().split("T")[0], // Rabu
            phoneNumber: "whatsapp:+6281396986145", // Rizky
            completed: 1,
            nama: "Rizky",
          },
          {
            date: new Date("2024-11-07").toISOString().split("T")[0], // Kamis
            phoneNumber: "whatsapp:+6285156820515", // Farel
            completed: 1,
            nama: "Farel",
          },
          // Max's data (Jumat, 2024-11-08) is not included since he didn't complete
          {
            date: new Date("2024-11-09").toISOString().split("T")[0], // Sabtu
            phoneNumber: "whatsapp:+6285179813641", // Fillah
            completed: 1,
            nama: "Fillah",
          },
        ];

        // Insert piket completion data
        console.log("Inserting piket completion records...");
        for (const data of piketData) {
          db.run(
            `INSERT OR REPLACE INTO piket_tasks (date, phone_number, completed, created_at) 
             VALUES (?, ?, ?, datetime(?))`,
            [
              data.date,
              data.phoneNumber,
              data.completed,
              data.date + " 07:00:00", // Set creation time to 7 AM
            ],
            function (err) {
              if (err) {
                console.error(`Error inserting piket data for ${data.nama}:`, err);
                throw err;
              }
              console.log(`✅ Inserted piket completion for ${data.nama} on ${data.date}`);
            }
          );
        }

        // Check and insert Max's denda record
        console.log("Checking existing denda records...");
        const maxDendaDate = new Date("2024-11-08").toISOString().split("T")[0];
        db.get(
          `SELECT COUNT(*) as count 
           FROM denda 
           WHERE phone_number = ? AND date = ?`,
          ["whatsapp:+6281528976578", maxDendaDate],
          (err, row) => {
            if (err) throw err;

            if (row.count === 0) {
              console.log("Inserting Max's denda record...");
              const dendaData = {
                date: maxDendaDate,
                phoneNumber: "whatsapp:+6281528976578",
                amount: 10000,
                description: "Denda piket Max (Belum dibayar) - 8 November 2024",
              };

              // Insert denda record
              db.run(
                `INSERT OR IGNORE INTO denda (phone_number, date, amount, created_at) 
                 VALUES (?, ?, ?, datetime(?))`,
                [
                  dendaData.phoneNumber,
                  dendaData.date,
                  dendaData.amount,
                  dendaData.date + " 20:00:00", // Set creation time to 8 PM
                ],
                function (err) {
                  if (err) {
                    console.error("Error inserting denda record:", err);
                    throw err;
                  }
                  console.log("✅ Inserted denda record for Max");
                }
              );

              // Insert corresponding tabungan record
              db.run(
                `INSERT OR IGNORE INTO tabungan (amount, description, date, created_at) 
                 VALUES (?, ?, ?, datetime(?))`,
                [-dendaData.amount, dendaData.description, dendaData.date, dendaData.date + " 20:00:00"],
                function (err) {
                  if (err) {
                    console.error("Error inserting tabungan record:", err);
                    throw err;
                  }
                  console.log("✅ Inserted tabungan record for Max's denda");
                }
              );
            } else {
              console.log("Max's denda record already exists, skipping insertion");
            }
          }
        );

        // Insert initial galon state if not exists
        console.log("Checking galon state...");
        db.get("SELECT * FROM galon_state LIMIT 1", (err, row) => {
          if (err) throw err;
          if (!row) {
            console.log("Initializing galon state...");
            db.run("INSERT INTO galon_state (current_index, updated_at) VALUES (0, CURRENT_TIMESTAMP)", function (err) {
              if (err) {
                console.error("Error initializing galon state:", err);
                throw err;
              }
              console.log("✅ Initialized galon state");
            });
          } else {
            console.log("Galon state already initialized");
          }
        });

        db.run("COMMIT", (err) => {
          if (err) throw err;
          console.log("✨ Database initialization completed successfully!");
          console.log("-----------------------------------");
          console.log("Summary:");
          console.log("• Created all necessary tables");
          console.log("• Initialized 5 piket completion records");
          console.log("• Added Max's denda record");
          console.log("• Setup galon state");
          console.log("-----------------------------------");
        });
      } catch (error) {
        console.error("❌ Error during database initialization:", error);
        db.run("ROLLBACK");
        reject(error);
        return;
      }
    });

    resolve();
  });
}

// [All existing functions remain the same...]
function markTaskCompleted(phoneNumber, date) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO piket_tasks (date, phone_number, completed) 
       VALUES (?, ?, 1)`,
      [date, phoneNumber],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function isTaskCompleted(phoneNumber, date) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT completed FROM piket_tasks 
       WHERE date = ? AND phone_number = ? AND completed = 1`,
      [date, phoneNumber],
      (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      }
    );
  });
}

function getGalonState() {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM galon_state LIMIT 1", (err, row) => {
      if (err) reject(err);
      else
        resolve({
          currentIndex: row.current_index,
          isGalonEmpty: {
            atas: !!row.galon_atas_empty,
            bawah: !!row.galon_bawah_empty,
          },
        });
    });
  });
}

function updateGalonState(state) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE galon_state SET 
       current_index = ?,
       galon_atas_empty = ?,
       galon_bawah_empty = ?,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [state.currentIndex, state.isGalonEmpty.atas ? 1 : 0, state.isGalonEmpty.bawah ? 1 : 0],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function recordGalonPurchase(phoneNumber) {
  return new Promise((resolve, reject) => {
    db.run("INSERT INTO galon_purchases (phone_number) VALUES (?)", [phoneNumber], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getRecentPurchases() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT DISTINCT phone_number FROM galon_purchases 
       WHERE purchase_date >= date('now', '-7 days')`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map((row) => row.phone_number));
      }
    );
  });
}

function getDendaList() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT d.*, p.completed
       FROM denda d
       LEFT JOIN piket_tasks p ON d.date = p.date AND d.phone_number = p.phone_number
       WHERE d.paid = 0
       ORDER BY d.date ASC`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getTabungan() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM tabungan ORDER BY date DESC`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getDendaPaidList() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT d.*, p.completed
       FROM denda d
       LEFT JOIN piket_tasks p ON d.date = p.date AND d.phone_number = p.phone_number
       WHERE d.paid = 1
       ORDER BY d.paid_date DESC`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function markDendaPaid(phoneNumber, date) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      try {
        const currentDate = new Date().toISOString().split("T")[0];

        // Update denda status
        db.run(
          `UPDATE denda 
           SET paid = 1, paid_date = ? 
           WHERE phone_number = ? AND date = ?`,
          [currentDate, phoneNumber, date]
        );

        // Add positive transaction to tabungan
        db.run(
          `INSERT INTO tabungan (amount, description, date) 
           VALUES (?, ?, ?)`,
          [
            10000, // Positive amount for payment
            `Pembayaran denda piket - ${currentDate}`,
            currentDate,
          ]
        );

        db.run("COMMIT");
        resolve();
      } catch (error) {
        db.run("ROLLBACK");
        reject(error);
      }
    });
  });
}

function addDendaRecord(phoneNumber, date, amount) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO denda (phone_number, date, amount) 
       VALUES (?, ?, ?)`,
      [phoneNumber, date, amount],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function updateTabungan(amount, description, date) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO tabungan (amount, description, date) 
       VALUES (?, ?, ?)`,
      [amount, description, date],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

module.exports = {
  initializeDatabase,
  markTaskCompleted,
  isTaskCompleted,
  getGalonState,
  updateGalonState,
  recordGalonPurchase,
  getRecentPurchases,
  getDendaList,
  getTabungan,
  getDendaPaidList, // Tambahkan ini
  markDendaPaid,
  addDendaRecord,
  updateTabungan,
};
