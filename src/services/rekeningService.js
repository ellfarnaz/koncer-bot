const db = require("../data/database");
const config = require("../config/config");

class RekeningService {
  // Helper function to format bank name
  formatBankName(bankName) {
    return bankName.toUpperCase();
  }

  // Helper function to format person name
  formatName(name) {
    return name
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  async addRekening(phoneNumber, bankName, accountNumber, accountName) {
    try {
      const formattedBank = this.formatBankName(bankName);
      const formattedName = this.formatName(accountName);
      await db.addRekening(phoneNumber, formattedBank, accountNumber, formattedName);
      return `✅ Berhasil menambahkan rekening ${formattedBank} untuk ${formattedName}`;
    } catch (error) {
      console.error("Error adding rekening:", error);
      return "❌ Gagal menambahkan rekening";
    }
  }

  async editRekening(phoneNumber, oldBankName, newBankName, newAccountNumber, newAccountName) {
    try {
      const formattedOldBank = this.formatBankName(oldBankName);
      const formattedNewBank = this.formatBankName(newBankName);
      const formattedName = this.formatName(newAccountName);
      await db.editRekening(phoneNumber, formattedOldBank, formattedNewBank, newAccountNumber, formattedName);
      return `✅ Berhasil mengubah rekening ${formattedOldBank} menjadi ${formattedNewBank}`;
    } catch (error) {
      console.error("Error editing rekening:", error);
      return "❌ Gagal mengubah rekening";
    }
  }

  async getRekeningList() {
    try {
      const rekening = await db.getRekeningList();
      if (!rekening || rekening.length === 0) {
        return "📤 Belum ada data rekening yang terdaftar";
      }

      let message = "💳 DAFTAR REKENING ANGGOTA\n\n";

      // Group by phone number (person)
      const rekeningByPerson = rekening.reduce((acc, curr) => {
        if (!acc[curr.phone_number]) {
          acc[curr.phone_number] = [];
        }
        acc[curr.phone_number].push(curr);
        return acc;
      }, {});

      // Generate message for each person
      for (const [phoneNumber, accounts] of Object.entries(rekeningByPerson)) {
        // Find person's name from config
        const person = Object.values(config.piket.jadwal).find((p) => p.nomor === phoneNumber);

        if (person) {
          message += `👤 ${this.formatName(person.nama)}\n`;
          message += `📱 ${phoneNumber.replace("whatsapp:", "")}\n`;
          accounts.forEach((acc) => {
            message += `├─ ${this.formatBankName(acc.bank_name)}\n`;
            message += `└─ ${acc.account_number}\n`;
            message += `   ${this.formatName(acc.account_name)}\n\n`;
          });
        }
      }

      return message;
    } catch (error) {
      console.error("Error getting rekening list:", error);
      return "❌ Gagal mengambil daftar rekening";
    }
  }

  async getRekeningByPhone(phoneNumber) {
    try {
      const rekening = await db.getRekeningByPhone(phoneNumber);
      if (!rekening || rekening.length === 0) {
        return "📤 Belum ada rekening yang terdaftar";
      }

      const person = Object.values(config.piket.jadwal).find((p) => p.nomor === phoneNumber);

      let message = `💳 REKENING ${person ? this.formatName(person.nama).toUpperCase() : "ANGGOTA"}\n\n`;
      message += `📱 ${phoneNumber.replace("whatsapp:", "")}\n\n`;

      rekening.forEach((acc, index) => {
        message += `${index + 1}. ${this.formatBankName(acc.bank_name)}\n`;
        message += `   ${acc.account_number}\n`;
        message += `   ${this.formatName(acc.account_name)}\n\n`;
      });

      message += "\nUntuk mengubah rekening:\n";
      message += "edit rekening [NAMA_BANK]/[BANK_BARU]/[NO_BARU]/[NAMA_BARU]";

      return message;
    } catch (error) {
      console.error("Error getting rekening by phone:", error);
      return "❌ Gagal mengambil data rekening";
    }
  }
}

module.exports = new RekeningService();
