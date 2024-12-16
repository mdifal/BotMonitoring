require('dotenv').config(); // Memuat variabel lingkungan dari file .env
const TelegramBot = require("node-telegram-bot-api");
const { handleQueryMenu } = require("./commands/query");
const { handleConnectionActions, handleConnectionMenu } = require("./commands/connection");
const { executeQuery } = require("./utils");
const { readJSON } = require("./utils"); // Untuk membaca file JSON
const { HttpsProxyAgent } = require('https-proxy-agent'); // Gunakan destructuring untuk versi terbaru
const path = require("path");
const cron = require("node-cron");   
const fs = require("fs");

// const proxyUrl = process.env.HTTP_PROXY;
// if (!proxyUrl) {
//     console.error("HTTP_PROXY tidak ditemukan di file .env. Pastikan file .env telah diatur.");
//     process.exit(1);
// }


//const agent = new HttpsProxyAgent(proxyUrl);

// Token bot Telegram
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error("TELEGRAM_BOT_TOKEN tidak ditemukan di file .env. Pastikan file .env telah diatur.");
    process.exit(1);
}


// const bot = new TelegramBot(token, {
//     polling: true,
//     request: { agent: agent }
// });
// Inisialisasi bot tanpa proxy untuk local
const bot = new TelegramBot(token, { polling: true });

// File untuk menyimpan ID grup
const groupsFile = path.resolve(__dirname, "../data/groups.json");;

// Fungsi untuk membaca dan menyimpan grup


const addGroupToJSON = (groupId, groupName) => {

    

    let groups = {};

    try {
        if (fs.existsSync(groupsFile)) {
            console.log("File groups.json ditemukan.");
            const fileContent = fs.readFileSync(groupsFile, "utf8");
            groups = JSON.parse(fileContent || "{}");
        } else {
            console.log("File groups.json tidak ditemukan. Membuat file baru...");
            fs.writeFileSync(groupsFile, JSON.stringify({}, null, 2), "utf8");
        }
    } catch (error) {
        console.error("Error saat membaca file groups.json:", error.message);
        groups = {};
    }

    // Tambahkan grup jika belum ada
    if (!groups[groupId]) {
        groups[groupId] = { name: groupName };

        try {
            fs.writeFileSync(groupsFile, JSON.stringify(groups, null, 2), "utf8");
            console.log(`Grup ${groupName} (${groupId}) ditambahkan ke daftar.`);
        } catch (writeError) {
            console.error("Error saat menyimpan file groups.json:", writeError.message);
        }
    } else {
        console.log(`Grup ${groupName} (${groupId}) sudah ada dalam daftar.`);
    }
};

bot.on("new_chat_members", (msg) => {
    const chatId = msg.chat.id;
    const groupName = msg.chat.title;

    // Tambahkan grup ke JSON
    addGroupToJSON(chatId, groupName);

    // Kirim pesan perkenalan
    bot.sendMessage(chatId, "Halo semuanya! Saya adalah bot. Senang bergabung di grup ini.");
});

const queriesFile = require("path").resolve(__dirname, "../data/queries.json");
const queries = readJSON(queriesFile);
// Fungsi untuk menampilkan menu utama
const showMainMenu = (bot, chatId) => {
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Query", callback_data: "menu_query" }],
                [{ text: "Connection", callback_data: "menu_connection" }],
            ],
        },
    };
    bot.sendMessage(chatId, "Pilih menu:", options);
};

// Menu utama
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    showMainMenu(bot, chatId);
});

// List query command
bot.onText(/\/list_query/, (msg) => {
    const chatId = msg.chat.id;
    const queries = readJSON(queriesFile);

    if (!queries || Object.keys(queries).length === 0) {
        bot.sendMessage(chatId, "Tidak ada query yang ditemukan.");
        return;
    }

    const queryList = Object.keys(queries).map((queryName) => `- ${queryName}`).join("\n");
    bot.sendMessage(chatId, `Daftar Query:\n${queryList}`);
});

// Execute query command
bot.onText(/\/execute (\S+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const queryName = match[1]; // Nama query dari perintah

    await executeQuery(bot, chatId, queryName, true); // Menjalankan query dengan screenshot
});

// Callback menu
bot.on("callback_query", (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    if (data === "main_menu_back") {
        showMainMenu(bot, chatId,messageId);
    } else if (
        data.startsWith("menu_query") ||
        data.startsWith("add_query") ||
        data.startsWith("list_query") ||
        data.startsWith("query_menu_") ||
        data.startsWith("update_query_") ||
        data.startsWith("delete_query_") ||
        data.startsWith("connect_query_") ||
        data.startsWith("select_connection_") ||data.startsWith("add_cron_")
    ) {
        handleQueryMenu(bot, chatId, data);
    } else if (data.startsWith("menu_connection")) {
        handleConnectionMenu(bot, chatId,messageId, data);
    } else {
        handleConnectionActions(bot, chatId,messageId, data);
    }
});

// Fungsi untuk menjalankan query dan mengirim hasilnya ke grup
const runScheduledQuery = async (queryName, query) => {
    const groups = readJSON(groupsFile);
    for (const groupId of Object.keys(groups)) {
        const result = await executeQuery(bot, groupId, queryName, false); // Eksekusi query
        bot.sendMessage(groupId, `**[${queryName}]**\nHasil:\n${result}`, { parse_mode: "Markdown" });
    }
};

// Jadwalkan cron job untuk setiap query
Object.entries(queries).forEach(([queryName, queryDetails]) => {
    const { sql, cronTimes } = queryDetails;
    
    // Pastikan cronTimes adalah array, jika tidak, ubah menjadi array
    const cronTimesArray = Array.isArray(cronTimes) ? cronTimes : [cronTimes];

    cronTimesArray.forEach(cronTime => {
        if (cronTime) {
            cron.schedule(cronTime, () => {
                console.log(`Menjalankan query "${queryName}" sesuai jadwal (${cronTime}).`);
                runScheduledQuery(queryName, sql);
            });
            console.log(`Query "${queryName}" dijadwalkan pada "${cronTime}".`);
        }
    });
});




module.exports = bot;
