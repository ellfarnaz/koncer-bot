# Bot Kontrakan Ceria 🏠

Bot WhatsApp untuk mengelola piket dan galon di Kontrakan Ceria menggunakan Twilio.

## 🚀 Deployment ke Railway

### Persiapan

1. Buat akun di [Railway](https://railway.app/)
2. Buat akun di [Twilio](https://www.twilio.com/)
3. Dapatkan Twilio credentials:
   - Account SID
   - Auth Token
   - WhatsApp Sandbox number

### Langkah Deployment

1. Fork repository ini ke akun GitHub Anda

2. Di Railway Dashboard:

   - Klik "New Project"
   - Pilih "Deploy from GitHub repo"
   - Pilih repository yang sudah di-fork
   - Klik "Deploy Now"

3. Setup Environment Variables di Railway:

   ```env
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=your_whatsapp_number
   TZ=Asia/Jakarta
   ```

4. Setelah deploy selesai:
   - Buka Twilio Console
   - Masuk ke WhatsApp Sandbox
   - Update Webhook URL dengan URL dari Railway + `/webhook`
   - Format: `https://your-railway-url.railway.app/webhook`

### 🔧 Environment Setup

1. Copy environment example file:

   ```bash
   cp .env.example .env
   ```

2. Edit .env file dengan credentials Twilio:

   ```env
   TWILIO_ACCOUNT_SID=your_account_sid_here
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=whatsapp:+14155238886
   PORT=3000
   TZ=Asia/Jakarta
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Running the bot:

   ```bash
   # Development with tunnel
   npm run dev

   # Production
   npm start
   ```

### 📱 Perintah Bot

1. Perintah Piket:

   - `/cekpiket` - Cek jadwal piket
   - `sudah piket` - Konfirmasi piket selesai

2. Perintah Galon:

   - `/cekgalon` - Cek status galon
   - `galon atas habis` - Laporkan galon atas habis
   - `galon bawah habis` - Laporkan galon bawah habis
   - `sudah beli galon` - Konfirmasi pembelian galon

3. Lainnya:
   - `/help` - Tampilkan bantuan

### ⚙️ Konfigurasi

Edit file `/src/config/config.js` untuk:

- Mengubah jadwal piket
- Menambah/mengurangi penghuni
- Mengubah nominal denda
- Mengatur jadwal reminder

### 🛠️ Development
