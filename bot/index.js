require('dotenv').config(); // Memuat variabel lingkungan dari file .env
const TelegramBot = require("node-telegram-bot-api");
const { handleQueryMenu } = require("./commands/query");
const { handleConnectionActions, handleConnectionMenu } = require("./commands/connection");
const { executeQuery } = require("./utils");
const { readJSON } = require("./utils"); // Untuk membaca file JSON
const { HttpsProxyAgent } = require('https-proxy-agent'); // Gunakan destructuring untuk versi terbaru

// URL proxy diambil dari .env
const proxyUrl = process.env.HTTP_PROXY;
if (!proxyUrl) {
    console.error("HTTP_PROXY tidak ditemukan di file .env. Pastikan file .env telah diatur.");
    process.exit(1);
}

// Buat agen proxy
const agent = new HttpsProxyAgent(proxyUrl);

// Token bot Telegram
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error("TELEGRAM_BOT_TOKEN tidak ditemukan di file .env. Pastikan file .env telah diatur.");
    process.exit(1);
}

// Inisialisasi bot dengan proxy
const bot = new TelegramBot(token, {
    polling: true,
    request: { agent: agent }
});

const queriesFile = require("path").resolve(__dirname, "../data/queries.json");

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
        data.startsWith("select_connection_")
    ) {
        handleQueryMenu(bot, chatId, data);
    } else if (data.startsWith("menu_connection")) {
        handleConnectionMenu(bot, chatId,messageId, data);
    } else {
        handleConnectionActions(bot, chatId,messageId, data);
    }
});

module.exports = bot;
