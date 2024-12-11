const { readJSON, writeJSON, encrypt, decrypt } = require("../utils");
const path = require("path");
const connectionsFile = path.resolve(__dirname, "../../data/connections.json");
const { Client } = require("pg");
// Fungsi untuk menambahkan koneksi
const addConnection = (bot, chatId) => {
  bot.sendMessage(chatId, "Masukkan detail koneksi Anda (format: db_user,db_host,db_password,db_name,db_port):", {
    reply_markup: {
      inline_keyboard: [[{ text: "<<Cancel>>", callback_data: "menu_connection" }]], // Tombol untuk batal
    },
  });

  const messageListener = (msg) => {
    const input = msg.text.trim();
    const [db_user, db_host, db_password, db_name, db_port] = input.split(",");

    if (!db_user || !db_host || !db_password || !db_port) {
      bot.sendMessage(chatId, "Format tidak valid. Mohon masukkan detail koneksi dalam format yang benar.");
      return;
    }

    // Menentukan nama koneksi berdasarkan db_host dan db_name
    const connectionName = db_name ? `${db_host}_${db_name}` : db_host;

    const connectionDetails = { db_user, db_host, db_password, db_name, db_port };
    const encryptedConnection = encrypt(JSON.stringify(connectionDetails));
    
    const connections = readJSON(connectionsFile);
    connections[connectionName] = encryptedConnection; // Menggunakan connectionName sebagai key
    writeJSON(connectionsFile, connections);

    bot.sendMessage(chatId, `Koneksi ke host "${db_host}" dengan nama "${connectionName}" berhasil ditambahkan.`);
    handleConnectionMenu(bot, chatId, "menu_connection");
  };

  bot.once("message", messageListener);

  bot.once("callback_query", (query) => {
    if (query.data === "menu_connection") {
      bot.removeListener("message", messageListener);
      handleConnectionMenu(bot, chatId, "menu_connection");
    }
  });
};


// Fungsi untuk menampilkan daftar koneksi
const listConnections = (bot, chatId, messageId) => {
  const connections = readJSON(connectionsFile);

  if (Object.keys(connections).length === 0) {
    return bot.editMessageText("Belum ada koneksi yang ditambahkan.", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [[{ text: "<<Back>>", callback_data: "menu_connection" }]],
      },
    });
  }

  const keyboard = Object.keys(connections).map((host) => [
    { text: host, callback_data: `connection_menu_${host}` },
  ]);
  keyboard.push([{ text: "<<Back>>", callback_data: "menu_connection" }]);

  bot.editMessageText("Pilih koneksi:", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: keyboard },
  });
};


// Menampilkan informasi koneksi dengan opsi
const showConnectionDetails = (bot, chatId, messageId, host) => {
  const connections = readJSON(connectionsFile);
  const encryptedConnection = connections[host];

  if (!encryptedConnection) {
    return bot.editMessageText("Koneksi tidak ditemukan.", {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  const decryptedConnection = JSON.parse(decrypt(encryptedConnection));
  const { db_user, db_host, db_password, db_name, db_port } = decryptedConnection;

  const infoMessage = `Host: ${db_host}\nPort: ${db_port}\nDB: ${db_name}\nUser: ${db_user}\nPassword: ********`;

  bot.editMessageText(infoMessage, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: {
      inline_keyboard: [
        [{ text: "Test Connection", callback_data: `test_connection_${host}` }],
        [{ text: "Update", callback_data: `update_connection_${host}` }],
        [{ text: "Delete", callback_data: `delete_connection_${host}` }],
        [{ text: "<<Back>>", callback_data: "list_connection" }],
      ],
    },
  });
};


const testConnection = (bot, chatId, host) => {
  const connections = readJSON(connectionsFile);
  const encryptedConnection = connections[host];

  if (!encryptedConnection) {
    return bot.sendMessage(chatId, "Koneksi tidak ditemukan.");
  }

  const decryptedConnection = JSON.parse(decrypt(encryptedConnection));
  const { db_user, db_host, db_password, db_name, db_port } = decryptedConnection;

  const client = new Client({
    user: db_user,
    host: db_host,
    database: db_name,
    password: db_password,
    port: db_port,
  });

  client.connect((err) => {
    if (err) {
      bot.sendMessage(chatId, `Gagal menghubungkan ke host ${db_host}: ${err.message}`);
    } else {
      bot.sendMessage(chatId, `Koneksi ke host "${db_host}" berhasil.`);
    }
    client.end();
  });
};

// Fungsi untuk memperbarui koneksi
const updateConnection = (bot, chatId, host) => {
  const connections = readJSON(connectionsFile);
  const encryptedConnection = connections[host];

  if (!encryptedConnection) {
    return bot.sendMessage(chatId, "Koneksi tidak ditemukan.");
  }

  const decryptedConnection = JSON.parse(decrypt(encryptedConnection));
  const { db_user, db_host, db_password, db_name, db_port } = decryptedConnection;

  bot.sendMessage(chatId, `Masukkan detail baru untuk koneksi "${db_host}" (format: db_user,db_host,db_password,db_name,db_port):`, {
    reply_markup: {
      inline_keyboard: [[{ text: "<<Cancel>>", callback_data: "menu_connection" }]],
    },
  });

  const messageListener = (msg) => {
    const input = msg.text.trim();
    const [new_db_user, new_db_host, new_db_password, new_db_name, new_db_port] = input.split(",");
    if (!new_db_user || !new_db_host || !new_db_password || !new_db_port) {
      bot.sendMessage(chatId, "Format tidak valid. Mohon masukkan detail koneksi dalam format yang benar.");
      return;
    }

    const newConnectionDetails = { db_user: new_db_user, db_host: new_db_host, db_password: new_db_password, db_name: new_db_name, db_port: new_db_port };
    const newEncryptedConnection = encrypt(JSON.stringify(newConnectionDetails));
    connections[host] = newEncryptedConnection;
    writeJSON(connectionsFile, connections);
    bot.sendMessage(chatId, `Koneksi ke host "${new_db_host}" berhasil diperbarui.`);
    handleConnectionMenu(bot, chatId, "menu_connection");
  };

  bot.once("message", messageListener);

  bot.once("callback_query", (query) => {
    if (query.data === "menu_connection") {
      bot.removeListener("message", messageListener);
      handleConnectionMenu(bot, chatId, "menu_connection");
    }
  });
};

// Fungsi untuk menghapus koneksi
const deleteConnection = (bot, chatId, host) => {
  const connections = readJSON(connectionsFile);
  if (!connections[host]) {
    return bot.sendMessage(chatId, "Koneksi tidak ditemukan.");
  }

  delete connections[host];
  writeJSON(connectionsFile, connections);
  bot.sendMessage(chatId, `Koneksi ke host "${host}" berhasil dihapus.`);
  listConnections(bot, chatId);
};
// Menu utama untuk Connection
const handleConnectionMenu = (bot, chatId, messageId, data) => {
  bot.editMessageText("Menu Connection:", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: {
      inline_keyboard: [
        [{ text: "Add Connection", callback_data: "add_connection" }],
        [{ text: "List Connection", callback_data: "list_connection" }],
        [{ text: "<<Back>>", callback_data: "main_menu_back" }],
      ],
    },
  });
};


// Menangani aksi di menu Connection
const handleConnectionActions = (bot, chatId, messageId, data) => {
  console.log(data);
  if (data === "add_connection") {
    addConnection(bot, chatId, messageId);
  } else if (data === "list_connection") {
    listConnections(bot, chatId, messageId);
  } else if (data.startsWith("connection_menu_")) {
    const host = data.replace("connection_menu_", "");
    showConnectionDetails(bot, chatId, messageId, host);
  } else if (data.startsWith("test_connection_")) {
    const host = data.replace("test_connection_", "");
    testConnection(bot, chatId, messageId, host);
  } else if (data.startsWith("update_connection_")) {
    const host = data.replace("update_connection_", "");
    updateConnection(bot, chatId, messageId, host);
  } else if (data.startsWith("delete_connection_")) {
    const host = data.replace("delete_connection_", "");
    deleteConnection(bot, chatId, messageId, host);
  }
};


module.exports = { handleConnectionMenu, handleConnectionActions };
