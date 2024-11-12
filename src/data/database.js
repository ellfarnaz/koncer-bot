const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const cron = require("node-cron");

// Tambahkan konfigurasi koneksi yang lebih aman
const dbConfig = {
  filename: process.env.DB_PATH || "./database.sqlite",
  mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  cached: true, // Caching untuk performa
  verbose: process.env.NODE_ENV === "development" ? console.log : null,
};

// Implementasi connection pooling sederhana
class DatabaseConnectionPool {
  constructor(maxConnections = 10) {
    this.pool = [];
    this.maxConnections = maxConnections;
  }

  async getConnection() {
    if (this.pool.length < this.maxConnections) {
      const newConnection = await createNewConnection();
      this.pool.push(newConnection);
      return newConnection;
    }

    // Jika pool penuh, tunggu koneksi tersedia
    return new Promise((resolve, reject) => {
      const checkAvailability = setInterval(() => {
        if (this.pool.length < this.maxConnections) {
          clearInterval(checkAvailability);
          const newConnection = createNewConnection();
          this.pool.push(newConnection);
          resolve(newConnection);
        }
      }, 100);
    });
  }

  releaseConnection(connection) {
    // Kembalikan koneksi ke pool
    const index = this.pool.indexOf(connection);
    if (index > -1) {
      this.pool.splice(index, 1);
    }
  }
}

const db = new sqlite3.Database(path.join(__dirname, "bot.db"));

// Helper function untuk memastikan data piket lengkap
async function ensurePiketData() {
  const piketData = [
    {
      date: new Date("2024-11-04").toISOString().split("T")[0],
      phoneNumber: "whatsapp:+6289519240711",
      completed: 1,
      nama: "Adzka",
    },
    {
      date: new Date("2024-11-05").toISOString().split("T")[0],
      phoneNumber: "whatsapp:+6289880266355",
      completed: 1,
      nama: "Fatu",
    },
    {
      date: new Date("2024-11-06").toISOString().split("T")[0],
      phoneNumber: "whatsapp:+6281396986145",
      completed: 1,
      nama: "Rizky",
    },
    {
      date: new Date("2024-11-07").toISOString().split("T")[0],
      phoneNumber: "whatsapp:+6285156820515",
      completed: 1,
      nama: "Farel",
    },
    {
      date: new Date("2024-11-08").toISOString().split("T")[0],
      phoneNumber: "whatsapp:+6281528976578",
      completed: 0,
      nama: "Max",
    },
    {
      date: new Date("2024-11-09").toISOString().split("T")[0],
      phoneNumber: "whatsapp:+6285179813641",
      completed: 1,
      nama: "Fillah",
    },
  ];

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      try {
        piketData.forEach((data) => {
          db.run(
            `INSERT OR REPLACE INTO piket_tasks (date, phone_number, completed, created_at)
             VALUES (?, ?, ?, datetime(?))`,
            [data.date, data.phoneNumber, data.completed, data.date + " 07:00:00"]
          );
        });
        db.run("COMMIT");
        resolve();
      } catch (error) {
        db.run("ROLLBACK");
        reject(error);
      }
    });
  });
}

// Helper function untuk inisialisasi MAX
async function initializeMaxData() {
  const maxDate = new Date("2024-11-08").toISOString().split("T")[0];
  const maxData = {
    phoneNumber: "whatsapp:+6281528976578",
    amount: 10000,
  };

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      try {
        // Insert incomplete piket task
        db.run(
          `INSERT OR REPLACE INTO piket_tasks 
           (date, phone_number, completed, created_at) 
           VALUES (?, ?, 0, datetime(?))`,
          [maxDate, maxData.phoneNumber, maxDate + " 07:00:00"]
        );

        // Insert denda record
        db.run(
          `INSERT OR IGNORE INTO denda 
           (phone_number, date, amount, created_at) 
           VALUES (?, ?, ?, datetime(?))`,
          [maxData.phoneNumber, maxDate, maxData.amount, maxDate + " 20:00:00"]
        );

        // Insert negative tabungan record
        db.run(
          `INSERT OR IGNORE INTO tabungan 
           (amount, description, date, created_at) 
           VALUES (?, ?, ?, datetime(?))`,
          [-maxData.amount, `Denda piket Max (Belum dibayar) - ${maxDate}`, maxDate, maxDate + " 20:00:00"]
        );

        db.run("COMMIT", (err) => {
          if (err) {
            console.error("Error in MAX data transaction:", err);
            reject(err);
          } else {
            console.log("✅ MAX data initialized successfully");
            resolve();
          }
        });
      } catch (error) {
        console.error("Error initializing MAX data:", error);
        db.run("ROLLBACK");
        reject(error);
      }
    });
  });
}

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    console.log("Starting database initialization...");

    // Fungsi untuk membuat tabel
    const createTables = () => {
      console.log("Creating tables if not exists...");

      // Buat semua tabel yang diperlukan
      const tables = [
        `CREATE TABLE IF NOT EXISTS piket_tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT,
          phone_number TEXT,
          completed INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(date, phone_number)
        )`,
        `CREATE TABLE IF NOT EXISTS galon_state (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          current_index INTEGER DEFAULT 0,
          galon_atas_empty INTEGER DEFAULT 0,
          galon_bawah_empty INTEGER DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS galon_purchases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone_number TEXT,
          purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS listrik_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          current_index INTEGER DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS listrik_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone_number TEXT NOT NULL,
          amount INTEGER NOT NULL,
          payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS denda (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone_number TEXT,
          date TEXT,
          amount INTEGER,
          paid INTEGER DEFAULT 0,
          paid_date TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(phone_number, date)
        )`,
        `CREATE TABLE IF NOT EXISTS tabungan (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount INTEGER,
          description TEXT,
          date TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(description, date)
        )`,
        `CREATE TABLE IF NOT EXISTS rekening (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone_number TEXT,
          bank_name TEXT,
          account_number TEXT,
          account_name TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
      ];

      return new Promise((resolve, reject) => {
        db.serialize(() => {
          tables.forEach((sql) => {
            db.run(sql, (err) => {
              if (err) reject(err);
            });
          });
          resolve();
        });
      });
    };

    // Fungsi untuk inisialisasi data awal
    const initializeData = async () => {
      console.log("Initializing data...");

      // Inisialisasi listrik state
      await new Promise((resolve, reject) => {
        console.log("Checking listrik state...");
        db.get("SELECT * FROM listrik_state WHERE id = 1", (err, row) => {
          if (err) reject(err);
          if (!row) {
            db.run("INSERT INTO listrik_state (id, current_index) VALUES (1, 5)", (err) => {
              if (err) reject(err);
              console.log("✅ Initialized listrik state with Farel as next person");
              resolve();
            });
          } else {
            console.log("Listrik state already initialized");
            resolve();
          }
        });
      });

      // Inisialisasi galon state
      await new Promise((resolve, reject) => {
        console.log("Checking galon state...");
        db.get("SELECT * FROM galon_state LIMIT 1", (err, row) => {
          if (err) reject(err);
          if (!row) {
            db.run("INSERT INTO galon_state (current_index) VALUES (0)", (err) => {
              if (err) reject(err);
              console.log("✅ Initialized galon state");
              resolve();
            });
          } else {
            console.log("Galon state already initialized");
            resolve();
          }
        });
      });

      // Inisialisasi data piket
      await ensurePiketData();

      // Inisialisasi data MAX
      await initializeMaxData();
    };

    // Eksekusi semua inisialisasi secara berurutan
    createTables()
      .then(() => initializeData())
      .then(() => {
        console.log("✨ Database initialization completed successfully!");
        console.log("-----------------------------------");
        console.log("Summary:");
        console.log("• Created all necessary tables");
        console.log("• Initialized piket completion records");
        console.log("• Initialized MAX's data");
        console.log("• Initialized listrik state");
        console.log("• Initialized galon state");
        console.log("-----------------------------------");
        resolve();
      })
      .catch((error) => {
        console.error("❌ Error during database initialization:", error);
        reject(error);
      });
  });
}

// Piket-related functions
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

function getLastWeekDates() {
  const today = new Date();
  const lastWeekStart = new Date(today);
  lastWeekStart.setDate(today.getDate() - 7);
  const lastWeekEnd = new Date(today);
  lastWeekEnd.setDate(today.getDate() - 1);

  return {
    start: lastWeekStart.toISOString().split("T")[0],
    end: lastWeekEnd.toISOString().split("T")[0],
  };
}

function getLastWeekPiketTasks() {
  return new Promise((resolve, reject) => {
    const today = new Date();
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(today.getDate() - 7);
    const lastWeekEnd = new Date(today);
    lastWeekEnd.setDate(today.getDate() - 1);

    const start = lastWeekStart.toISOString().split("T")[0];
    const end = lastWeekEnd.toISOString().split("T")[0];

    db.all(
      `SELECT 
        pt.*,
        d.paid as denda_paid,
        d.amount as denda_amount,
        d.paid_date as denda_paid_date,
        COALESCE(pt.completed, 0) as completed
       FROM piket_tasks pt
       LEFT JOIN denda d ON pt.date = d.date AND pt.phone_number = d.phone_number
       WHERE pt.date BETWEEN ? AND ?
       ORDER BY pt.date ASC`,
      [start, end],
      (err, rows) => {
        if (err) {
          console.error("Error getting last week piket tasks:", err);
          reject(err);
        } else {
          // Log untuk debugging
          console.log("Retrieved piket tasks:", rows);
          resolve(rows);
        }
      }
    );
  });
}

// Galon-related functions
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

// Denda-related functions
function getDendaList() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT d.*, p.completed
       FROM denda d
       LEFT JOIN piket_tasks p ON d.date = p.date AND d.phone_number = d.phone_number
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
       LEFT JOIN piket_tasks p ON d.date = d.date AND d.phone_number = d.phone_number
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

// Rekening-related functions
function addRekening(phoneNumber, bankName, accountNumber, accountName) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO rekening (phone_number, bank_name, account_number, account_name) 
       VALUES (?, ?, ?, ?)`,
      [phoneNumber, bankName, accountNumber, accountName],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getRekeningList() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM rekening ORDER BY phone_number, bank_name`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getRekeningByPhone(phoneNumber) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM rekening WHERE phone_number = ? ORDER BY bank_name`, [phoneNumber], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function editRekening(phoneNumber, oldBankName, newBankName, newAccountNumber, newAccountName) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE rekening 
       SET bank_name = ?, 
           account_number = ?, 
           account_name = ?,
           created_at = CURRENT_TIMESTAMP
       WHERE phone_number = ? AND bank_name = ?`,
      [newBankName, newAccountNumber, newAccountName, phoneNumber, oldBankName],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// Listrik-related functions
function getListrikState() {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM listrik_state WHERE id = 1", (err, row) => {
      if (err) {
        console.error("Error getting listrik state:", err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function updateListrikState(currentIndex) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE listrik_state 
       SET current_index = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = 1`,
      [currentIndex],
      (err) => {
        if (err) {
          console.error("Error updating listrik state:", err);
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

function recordListrikPayment(phoneNumber, amount) {
  return new Promise((resolve, reject) => {
    db.run("INSERT INTO listrik_payments (phone_number, amount) VALUES (?, ?)", [phoneNumber, amount], (err) => {
      if (err) {
        console.error("Error recording listrik payment:", err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function getLastListrikPayment() {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM listrik_payments ORDER BY payment_date DESC LIMIT 1", (err, row) => {
      if (err) {
        console.error("Error getting last listrik payment:", err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// MAX-related functions
function getMaxStatus() {
  return new Promise((resolve, reject) => {
    const maxDate = new Date("2024-11-08").toISOString().split("T")[0];
    db.get(
      `SELECT pt.*, d.paid as denda_paid, d.amount as denda_amount,
              d.paid_date as denda_paid_date
       FROM piket_tasks pt
       LEFT JOIN denda d ON pt.date = d.date AND pt.phone_number = d.phone_number
       WHERE pt.phone_number = ? AND pt.date = ?`,
      ["whatsapp:+6281528976578", maxDate],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function markMaxDendaPaid() {
  return new Promise((resolve, reject) => {
    const currentDate = new Date().toISOString().split("T")[0];
    const maxDate = new Date("2024-11-08").toISOString().split("T")[0];
    const maxData = {
      phoneNumber: "whatsapp:+6281528976578",
      amount: 10000,
    };

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      try {
        // Update denda status
        db.run(
          `UPDATE denda 
           SET paid = 1, paid_date = ? 
           WHERE phone_number = ? AND date = ?`,
          [currentDate, maxData.phoneNumber, maxDate]
        );

        // Add positive transaction to tabungan
        db.run(
          `INSERT INTO tabungan 
           (amount, description, date) 
           VALUES (?, ?, ?)`,
          [maxData.amount, `Pembayaran denda piket Max - ${currentDate}`, currentDate]
        );

        db.run("COMMIT", (err) => {
          if (err) {
            console.error("Error in MAX denda payment transaction:", err);
            reject(err);
          } else {
            console.log("✅ MAX denda payment recorded successfully");
            resolve();
          }
        });
      } catch (error) {
        console.error("Error marking MAX denda as paid:", error);
        db.run("ROLLBACK");
        reject(error);
      }
    });
  });
}

// Tambahkan fungsi helper untuk penanganan error
async function handleDatabaseError(operation, error) {
  console.error(`Database error during ${operation}:`, error);

  const errorTypes = {
    CONNECTION_ERROR: "Gagal terhubung ke database",
    QUERY_ERROR: "Kesalahan dalam eksekusi query",
    CONSTRAINT_ERROR: "Pelanggaran constraint database",
    UNKNOWN_ERROR: "Kesalahan tidak dikenal",
  };

  const shouldRetry = ["SQLITE_BUSY", "SQLITE_LOCKED"].includes(error.code);

  if (shouldRetry) {
    return retryDatabaseOperation(operation, error);
  }

  throw new Error(`Gagal ${operation}: ${errorTypes[error.type] || error.message}`);
}

async function retryDatabaseOperation(operation, originalError, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      return await operation();
    } catch (retryError) {
      if (attempt === maxRetries) {
        throw originalError;
      }
    }
  }
}

async function getPiketTask(phoneNumber, date) {
  return new Promise((resolve, reject) => {
    try {
      const formattedDate = new Date(date).toISOString().split("T")[0];
      db.get("SELECT * FROM piket_tasks WHERE phone_number = ? AND date = ?", [phoneNumber, formattedDate], (err, row) => {
        if (err) {
          console.error("Error getting piket task:", err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    } catch (error) {
      return handleDatabaseError("mengambil data piket", error);
    }
  });
}

// Tambahkan mekanisme transaksi yang lebih robust
async function safeTransaction(operations) {
  const db = await getConnection(); // Asumsi ada fungsi untuk mendapatkan koneksi

  try {
    await db.run("BEGIN TRANSACTION");

    // Validasi input sebelum transaksi
    const validationResults = await Promise.all(operations.map((op) => validateOperation(op)));

    if (validationResults.some((result) => !result)) {
      throw new Error("Validasi operasi gagal");
    }

    // Eksekusi operasi
    const results = await Promise.all(operations.map((op) => op()));

    await db.run("COMMIT");
    return results;
  } catch (error) {
    await db.run("ROLLBACK");

    // Log error ke sistem monitoring
    logErrorToMonitoring(error);

    throw error;
  } finally {
    await db.close();
  }
}

// Fungsi validasi operasi
async function validateOperation(operation) {
  // Implementasi validasi spesifik
  try {
    // Contoh: Validasi input, cek constraint
    return true;
  } catch (error) {
    return false;
  }
}

// Tambahkan mekanisme migrasi database
async function runMigrations() {
  const migrations = [
    {
      version: 1,
      up: async (db) => {
        await db.run(`
          CREATE TABLE IF NOT EXISTS migrations (
            version INTEGER PRIMARY KEY,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
      },
    },
    {
      version: 2,
      up: async (db) => {
        // Contoh migrasi: tambah kolom baru
        await db.run(`
          ALTER TABLE piket_tasks 
          ADD COLUMN denda_reason TEXT
        `);
      },
    },
  ];

  for (const migration of migrations) {
    const existingMigration = await checkMigrationApplied(migration.version);

    if (!existingMigration) {
      try {
        await migration.up(db);
        await recordMigration(migration.version);
      } catch (error) {
        console.error(`Migrasi versi ${migration.version} gagal:`, error);
        throw error;
      }
    }
  }
}

// Export all functions
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
  getDendaPaidList,
  markDendaPaid,
  addDendaRecord,
  updateTabungan,
  addRekening,
  getRekeningList,
  getRekeningByPhone,
  editRekening,
  getListrikState,
  updateListrikState,
  recordListrikPayment,
  getLastListrikPayment,
  getLastWeekDates,
  getLastWeekPiketTasks,
  getMaxStatus,
  initializeMaxData,
  markMaxDendaPaid,
  ensurePiketData,
  getPiketTask,
};
