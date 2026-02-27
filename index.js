const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const botUsername = "tesjk2_bot"; // TANPA @
const channelUsername = "@alfamartjk2"; // PAKE @
const ADMIN_ID = 1388479642;

// Generate kode random
function generateCode() {
  return "vid" + Math.floor(100000 + Math.random() * 900000);
}

// ==========================
// BUAT TABEL JIKA BELUM ADA
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

  console.log("Database ready");
})();

// ==========================
// UPLOAD VIDEO (ADMIN ONLY)
// ==========================
bot.on('message', async (msg) => {

  if (msg.video && msg.chat.id === ADMIN_ID) {

    const file_id = msg.video.file_id;
    const kode = generateCode();

    await pool.query(
      "INSERT INTO videos (kode, file_id) VALUES ($1, $2)",
      [kode, file_id]
    );

    const link = `https://t.me/${botUsername}?start=${kode}`;

    bot.sendMessage(msg.chat.id,
      `✅ Video berhasil disimpan!\n\n🔗 Link:\n${link}`
    );
  }
});

// ==========================
// HANDLE DEEP LINK
// ==========================
bot.onText(/\/start (.+)/, async (msg, match) => {

  const chatId = msg.chat.id;
  const kode = match[1];

  const result = await pool.query(
    "SELECT file_id FROM videos WHERE kode = $1",
    [kode]
  );

  if (result.rows.length === 0) {
    return bot.sendMessage(chatId, "❌ Video tidak ditemukan.");
  }

  const file_id = result.rows[0].file_id;

  try {
    const member = await bot.getChatMember(channelUsername, chatId);

    if (member.status === "left") {
      return bot.sendMessage(chatId,
        "🚫 Kamu harus join channel dulu untuk mendapatkan video.",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Gabung Channel",
                  url: `https://t.me/${channelUsername.replace("@","")}`
                }
              ],
              [
                {
                  text: "Coba Lagi",
                  callback_data: `check_${kode}`
                }
              ]
            ]
          }
        }
      );
    }

    bot.sendVideo(chatId, file_id);

  } catch (error) {
    bot.sendMessage(chatId, "Terjadi kesalahan.");
  }
});

// ==========================
// START BIASA
// ==========================
bot.onText(/\/start$/, (msg) => {

  if (msg.chat.id === ADMIN_ID) {
    bot.sendMessage(msg.chat.id, "Upload video untuk mendapatkan link.");
  } else {
    bot.sendMessage(msg.chat.id, "Silakan klik link dari channel/grup.");
  }
});

// ==========================
// HANDLE TOMBOL COBA LAGI
// ==========================
bot.on("callback_query", async (query) => {

  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith("check_")) {

    const kode = data.split("_")[1];

    const result = await pool.query(
      "SELECT file_id FROM videos WHERE kode = $1",
      [kode]
    );

    if (result.rows.length === 0) {
      return bot.answerCallbackQuery(query.id, {
        text: "Video tidak ditemukan.",
        show_alert: true
      });
    }

    const file_id = result.rows[0].file_id;

    try {
      const member = await bot.getChatMember(channelUsername, chatId);

      if (member.status === "left") {
        return bot.answerCallbackQuery(query.id, {
          text: "Kamu belum join channel!",
          show_alert: true
        });
      }

      bot.sendVideo(chatId, file_id);
      bot.answerCallbackQuery(query.id);

    } catch (error) {
      bot.answerCallbackQuery(query.id, {
        text: "Terjadi kesalahan.",
        show_alert: true
      });
    }
  }
});