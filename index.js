const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.on('message', (msg) => {
    console.log("CHAT ID:", msg.chat.id);
});

const botUsername = "tesjk2_bot"; // TANPA @
const channelUsername = "@alfamartjk2"; // PAKE @
const ADMIN_ID = 1388479642; // NANTI GANTI CHAT ID KAMU

// Load database
let database = {};
if (fs.existsSync('database.json')) {
    database = JSON.parse(fs.readFileSync('database.json'));
}

// Generate kode random
function generateCode() {
    return "vid" + Math.floor(100000 + Math.random() * 900000);
}

// Simpan database
function saveDatabase() {
    fs.writeFileSync('database.json', JSON.stringify(database, null, 2));
}

// ==========================
// UPLOAD VIDEO (ADMIN ONLY)
// ==========================
bot.on('message', (msg) => {

    if (msg.video && msg.chat.id === ADMIN_ID) {

        const file_id = msg.video.file_id;
        const kode = generateCode();

        database[kode] = file_id;
        saveDatabase();

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

    if (!database[kode]) {
        return bot.sendMessage(chatId, "❌ Video tidak ditemukan.");
    }

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

        bot.sendVideo(chatId, database[kode]);

    } catch (error) {
        bot.sendMessage(chatId, "Terjadi kesalahan.");
    }
});

// Start biasa
bot.onText(/\/start$/, (msg) => {
    bot.sendMessage(msg.chat.id, "Upload video (admin only).");
});

bot.on("callback_query", async (query) => {

    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith("check_")) {

        const kode = data.split("_")[1];

        try {
            const member = await bot.getChatMember(channelUsername, chatId);

            if (member.status === "left") {
                return bot.answerCallbackQuery(query.id, {
                    text: "Kamu belum join channel!",
                    show_alert: true
                });
            }

            bot.sendVideo(chatId, database[kode]);
            bot.answerCallbackQuery(query.id);

        } catch (error) {
            bot.answerCallbackQuery(query.id, {
                text: "Terjadi kesalahan.",
                show_alert: true
            });
        }
    }
});