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
  ssl: { rejectUnauthorized: false }
});

const botUsername = "seducteasemedia_bot";
const OWNER_ID = 1388479642;

// CHANNEL & GROUP WAJIB JOIN
const CHANNEL_USERNAME = "@seducteasech";
const GROUP_USERNAME = "@seductease";

// ==========================
// GENERATE RANDOM CODE
// ==========================
function generateCode() {
  return crypto.randomBytes(24).toString("base64url");
}

// ==========================
// CREATE TABLE
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

  await pool.query(
    "INSERT INTO admins (id) VALUES ($1) ON CONFLICT DO NOTHING",
    [OWNER_ID]
  );

  console.log("✅ Database ready");

})();

// ==========================
// CEK ADMIN
// ==========================
async function isAdmin(userId) {

  const result = await pool.query(
    "SELECT id FROM admins WHERE id=$1",
    [userId]
  );

  return result.rows.length > 0;

}

// ==========================
// CEK JOIN CHANNEL & GROUP
// ==========================
async function checkMembership(userId) {

  try {

    const channel = await bot.getChatMember(CHANNEL_USERNAME, userId);
    const group = await bot.getChatMember(GROUP_USERNAME, userId);

    const allowed = ["member","administrator","creator"];

    if (!allowed.includes(channel.status)) return false;
    if (!allowed.includes(group.status)) return false;

    return true;

  } catch {
    return false;
  }

}

// ==========================
// ADD ADMIN
// ==========================
bot.onText(/\/addadmin (\d+)/, async (msg,match)=>{

  if(msg.chat.id !== OWNER_ID)
  return bot.sendMessage(msg.chat.id,"❌ Hanya owner.");

  const id = match[1];

  await pool.query(
    "INSERT INTO admins (id) VALUES ($1) ON CONFLICT DO NOTHING",
    [id]
  );

  bot.sendMessage(msg.chat.id,"✅ Admin ditambahkan");

});

// ==========================
// LIST ADMIN
// ==========================
bot.onText(/\/listadmin/, async msg=>{

  if(msg.chat.id !== OWNER_ID)
  return bot.sendMessage(msg.chat.id,"❌ Hanya owner.");

  const res = await pool.query("SELECT id FROM admins");

  let text="📋 Daftar Admin\n\n";

  res.rows.forEach((r,i)=>{

    if(r.id==OWNER_ID)
    text+=`${i+1}. ${r.id} (OWNER)\n`;
    else
    text+=`${i+1}. ${r.id}\n`;

  });

  bot.sendMessage(msg.chat.id,text);

});

// ==========================
// REMOVE ADMIN
// ==========================
bot.onText(/\/removeadmin (\d+)/, async (msg,match)=>{

  if(msg.chat.id !== OWNER_ID)
  return bot.sendMessage(msg.chat.id,"❌ Hanya owner.");

  const id=parseInt(match[1]);

  if(id===OWNER_ID)
  return bot.sendMessage(msg.chat.id,"❌ Owner tidak bisa dihapus.");

  await pool.query(
    "DELETE FROM admins WHERE id=$1",
    [id]
  );

  bot.sendMessage(msg.chat.id,"✅ Admin dihapus");

});

// ==========================
// MY ID
// ==========================
bot.onText(/\/myid/, msg=>{
  bot.sendMessage(msg.chat.id,`🆔 ID kamu: ${msg.chat.id}`);
});

// ==========================
// ADMIN UPLOAD VIDEO
// ==========================
bot.on("message", async msg=>{

  if(!msg.video) return;

  const admin=await isAdmin(msg.chat.id);
  if(!admin) return;

  const file_id=msg.video.file_id;
  const kode=generateCode();

  await pool.query(
    "INSERT INTO videos (kode,file_id) VALUES ($1,$2)",
    [kode,file_id]
  );

  const link=`https://t.me/${botUsername}?start=${kode}`;

  bot.sendMessage(msg.chat.id,
`✅ Video disimpan

🔗 Link:
${link}`);

});

// ==========================
// START WITH LINK
// ==========================
bot.onText(/\/start (.+)/, async (msg,match)=>{

  const chatId=msg.chat.id;
  const kode=match[1];

  const joined=await checkMembership(chatId);

  if(!joined){

    return bot.sendMessage(chatId,
"🚫 Kamu harus join channel & grup dulu",
{
reply_markup:{
inline_keyboard:[
[
{ text:"Join Disini",
url:`https://t.me/${CHANNEL_USERNAME.replace("@","")}`}
],
[
{ text:"Join Disini",
url:`https://t.me/${GROUP_USERNAME.replace("@","")}`}
],
[
{ text:"✅ Saya sudah join",
callback_data:`check_${kode}`}
]
]
}
});

  }

  const res=await pool.query(
    "SELECT file_id FROM videos WHERE kode=$1",
    [kode]
  );

  if(res.rows.length===0)
  return bot.sendMessage(chatId,"❌ Video tidak ditemukan");

  bot.sendVideo(chatId,res.rows[0].file_id);

});

// ==========================
// CEK ULANG JOIN
// ==========================
bot.on("callback_query", async query=>{

  const chatId=query.message.chat.id;
  const data=query.data;

  if(!data.startsWith("check_")) return;

  const kode=data.split("_")[1];

  const joined=await checkMembership(chatId);

  if(!joined){

    return bot.answerCallbackQuery(query.id,{
      text:"❌ Kamu belum join",
      show_alert:true
    });

  }

  const res=await pool.query(
    "SELECT file_id FROM videos WHERE kode=$1",
    [kode]
  );

  if(res.rows.length===0){

    return bot.answerCallbackQuery(query.id,{
      text:"Video tidak ditemukan",
      show_alert:true
    });

  }

  await bot.sendVideo(chatId,res.rows[0].file_id);

  bot.answerCallbackQuery(query.id);

});

// ==========================
// START BIASA
// ==========================
bot.onText(/\/start$/, async msg=>{

  const admin=await isAdmin(msg.chat.id);

  if(admin)
  bot.sendMessage(msg.chat.id,"📤 Upload video untuk membuat link");
  else
  bot.sendMessage(msg.chat.id,"👋 Klik link video untuk melihat konten");

});