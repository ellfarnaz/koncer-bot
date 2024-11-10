const rekeningService = require("../services/rekeningService");

class RekeningController {
  async handleCommand(message, sender) {
    try {
      const command = message.toLowerCase().trim();

      switch (command) {
        case "/help":
          return await piketService.getHelpMessage();

        case "/rekening":
          return await rekeningService.getRekeningList();

        case "/rekeningku":
          return await rekeningService.getRekeningByPhone(sender);

        default:
          // Check for add rekening command
          if (command.startsWith("tambah rekening ")) {
            const data = command.replace("tambah rekening ", "").split("/");
            if (data.length !== 3) {
              return "❌ Format salah. Contoh: tambah rekening BCA/1234567890/John Doe";
            }
            const [bankName, accountNumber, accountName] = data.map((s) => s.trim());
            return await rekeningService.addRekening(sender, bankName, accountNumber, accountName);
          }

          // Check for edit rekening command
          if (command.startsWith("edit rekening ")) {
            const data = command.replace("edit rekening ", "").split("/");
            if (data.length !== 4) {
              return "❌ Format salah. Contoh: edit rekening BCA/BNI/1234567890/John Doe";
            }
            const [oldBank, newBank, newNumber, newName] = data.map((s) => s.trim());
            return await rekeningService.editRekening(sender, oldBank, newBank, newNumber, newName);
          }

          return null; // Let other controllers handle unknown commands
      }
    } catch (error) {
      console.error("Error in RekeningController:", error);
      return "❌ Terjadi kesalahan saat memproses perintah rekening";
    }
  }
}

module.exports = new RekeningController();
