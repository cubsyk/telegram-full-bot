const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');
const crypto = require("crypto");

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// ==========================
// DATABASE CONNECTION
// ==========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const botUsername = "mediasendaljepit_bot"; // TANPA @
const OWNER_ID = 1388479642; // ADMIN UTAMA (tidak bisa dihapus)

// ==========================
// GENERATE RANDOM CODE
// ==========================
function generateCode() {
  return crypto.randomBytes(24).toString("base64url");
}

// ==========================
// CREATE TABLE IF NOT EXISTS
// ==========================
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS videos (
      id SERIAL PRIMARY KEY,
      kode TEXT UNIQUE,
      file_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id BIGINT PRIMARY KEY
    );
  `);

  // Masukkan owner sebagai admin otomatis
  await pool.query(
    "INSERT INTO admins (id) VALUES ($1) ON CONFLICT DO NOTHING",
    [OWNER_ID]
  );

  console.log("✅ Database ready");
})();

// ==========================
// CEK ADMIN FUNCTION
// ==========================
async function isAdmin(userId) {
  const result = await pool.query(
    "SELECT id FROM admins WHERE id = $1",
    [userId]
  );
  return result.rows.length > 0;
}

// ==========================
// TAMBAH ADMIN (OWNER ONLY)
// ==========================
bot.onText(/\/addadmin (\d+)/, async (msg, match) => {

  if (msg.chat.id !== OWNER_ID) {
    return bot.sendMessage(msg.chat.id, "❌ Hanya owner yang bisa menambah admin.");
  }

  const newAdminId = match[1];

  await pool.query(
    "INSERT INTO admins (id) VALUES ($1) ON CONFLICT DO NOTHING",
    [newAdminId]
  );

  bot.sendMessage(msg.chat.id, "✅ Admin berhasil ditambahkan.");
});

// ==========================
// LIST ADMIN (OWNER ONLY)
// ==========================
bot.onText(/\/listadmin/, async (msg) => {

  if (msg.chat.id !== OWNER_ID) {
    return bot.sendMessage(msg.chat.id, "❌ Hanya owner yang bisa melihat daftar admin.");
  }

  const result = await pool.query("SELECT id FROM admins ORDER BY id ASC");

  if (result.rows.length === 0) {
    return bot.sendMessage(msg.chat.id, "Tidak ada admin.");
  }

  let text = "📋 Daftar Admin:\n\n";

  result.rows.forEach((row, index) => {
    if (row.id == OWNER_ID) {
      text += `${index + 1}. ${row.id} (OWNER)\n`;
    } else {
      text += `${index + 1}. ${row.id}\n`;
    }
  });

  bot.sendMessage(msg.chat.id, text);
});

// ==========================
// REMOVE ADMIN (OWNER ONLY)
// ==========================
bot.onText(/\/removeadmin (\d+)/, async (msg, match) => {

  if (msg.chat.id !== OWNER_ID) {
    return bot.sendMessage(msg.chat.id, "❌ Hanya owner yang bisa menghapus admin.");
  }

  const removeId = parseInt(match[1]);

  if (removeId === OWNER_ID) {
    return bot.sendMessage(msg.chat.id, "❌ Owner tidak bisa dihapus.");
  }

  const result = await pool.query(
    "DELETE FROM admins WHERE id = $1 RETURNING id",
    [removeId]
  );

  if (result.rowCount === 0) {
    return bot.sendMessage(msg.chat.id, "❌ ID tersebut bukan admin.");
  }

  bot.sendMessage(msg.chat.id, "✅ Admin berhasil dihapus.");
});

// ==========================
// CEK ID SENDIRI
// ==========================
bot.onText(/\/myid/, (msg) => {
  bot.sendMessage(msg.chat.id, `🆔 ID kamu: ${msg.chat.id}`);
});

// ==========================
// ADMIN UPLOAD VIDEO
// ==========================
bot.on('message', async (msg) => {

  if (!msg.video) return;

  const adminCheck = await isAdmin(msg.chat.id);
  if (!adminCheck) return;

  const file_id = msg.video.file_id;
  const kode = generateCode();

  try {
    await pool.query(
      "INSERT INTO videos (kode, file_id) VALUES ($1, $2)",
      [kode, file_id]
    );

    const link = `https://t.me/${botUsername}?start=${kode}`;

    bot.sendMessage(msg.chat.id,
      `✅ Video berhasil disimpan!\n\n🔗 Link:\n${link}`
    );

  } catch (error) {
    console.log(error);
    bot.sendMessage(msg.chat.id, "❌ Gagal menyimpan video.");
  }
});

// ==========================
// HANDLE DEEP LINK
// ==========================
bot.onText(/\/start (.+)/, async (msg, match) => {

  const chatId = msg.chat.id;
  const kode = match[1];

  try {
    const result = await pool.query(
      "SELECT file_id FROM videos WHERE kode = $1",
      [kode]
    );

    if (result.rows.length === 0) {
      return bot.sendMessage(chatId, "❌ Video tidak ditemukan.");
    }

    const file_id = result.rows[0].file_id;

    bot.sendVideo(chatId, file_id);

  } catch (error) {
    console.log(error);
    bot.sendMessage(chatId, "❌ Terjadi kesalahan.");
  }
});

// ==========================
// START TANPA PARAMETER
// ==========================
bot.onText(/\/start$/, async (msg) => {

  const adminCheck = await isAdmin(msg.chat.id);

  if (adminCheck) {
    bot.sendMessage(msg.chat.id, "📤 Silakan upload video untuk mendapatkan link.");
  } else {
    bot.sendMessage(msg.chat.id, "👋 Silakan klik link dari channel/grup untuk melihat konten.");
  }
});