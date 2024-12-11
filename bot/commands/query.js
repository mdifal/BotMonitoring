const { readJSON, writeJSON, extractQueryAndConnection } = require("../utils");

const path = require("path");

const queriesFile = path.resolve(__dirname, "../../data/queries.json");
const connectionsFile = path.resolve(__dirname, "../../data/connections.json");

const showMainMenu = (bot, chatId) => {
  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Add Query", callback_data: "add_query" }],
        [{ text: "List Query", callback_data: "list_query" }],
        [{ text: "<<Back>>", callback_data: "main_menu_back" }],
      ],
    },
  };
  bot.sendMessage(chatId, "Menu Query:", options);
};

const addQuery = (bot, chatId) => {
  bot.sendMessage(chatId, "Masukkan nama query:", {
    reply_markup: {
      inline_keyboard: [[{ text: "<<Cancel>>", callback_data: "menu_query" }]],
    },
  }).then(() => {
    const nameListener = (msg) => {
      const queryName = msg.text.trim();
      const queries = readJSON(queriesFile);

      if (queries[queryName]) {
        return bot.sendMessage(chatId, "Query dengan nama ini sudah ada.");
      }

      bot.sendMessage(chatId, "Masukkan SQL query:", {
        reply_markup: {
          inline_keyboard: [[{ text: "<<Cancel>>", callback_data: "menu_query" }]],
        },
      }).then(() => {
        const sqlListener = (msg) => {
          const sqlQuery = msg.text.trim();
          queries[queryName] = { sql: sqlQuery, connection: null, cronTimes: [] };
          writeJSON(queriesFile, queries);
          bot.sendMessage(chatId, `Query "${queryName}" berhasil ditambahkan.`);
        };

        bot.once("message", sqlListener);

        bot.once("callback_query", (query) => {
          if (query.data === "menu_query") {
            bot.removeListener("message", sqlListener);
            showMainMenu(bot, chatId);
          }
        });
      });
    };

    bot.once("message", nameListener);

    bot.once("callback_query", (query) => {
      if (query.data === "menu_query") {
        bot.removeListener("message", nameListener);
        showMainMenu(bot, chatId);
      }
    });
  });
};

const listQueries = (bot, chatId) => {
  const queries = readJSON(queriesFile);

  if (Object.keys(queries).length === 0) {
    return bot.sendMessage(chatId, "Belum ada query yang ditambahkan.", {
      reply_markup: {
        inline_keyboard: [[{ text: "<<Back>>", callback_data: "menu_query" }]],
      },
    });
  }

  const keyboard = Object.keys(queries).map((queryName) => [
    { text: queryName, callback_data: `query_menu_${queryName}` },
  ]);

  keyboard.push([{ text: "<<Back>>", callback_data: "menu_query" }]);

  bot.sendMessage(chatId, "Pilih query:", {
    reply_markup: { inline_keyboard: keyboard },
  });
};
const showQueryMenu = (bot, chatId, queryName) => {
  console.log(`showQueryMenu triggered for query: ${queryName}`); // Debugging step 1: Check if this is triggered
  
  const queries = readJSON(queriesFile);

  if (!queries[queryName]) {
    return bot.sendMessage(chatId, "Query tidak ditemukan.");
  }

  const { sql, connection, cronTimes } = queries[queryName];
  const infoMessage = `Nama Query: ${queryName}\nQuery: ${sql}\nConnection: ${connection || "Belum diatur"}\nCron: ${
    cronTimes.length > 0 ? cronTimes.join(", ") : "Tidak ada"
  }`;

  console.log("Sending info message..."); // Debugging step 2: Confirm sending of info message
  bot.sendMessage(chatId, infoMessage).then(() => {
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Update Query", callback_data: `update_query_${queryName}` }],
          [{ text: "Delete Query", callback_data: `delete_query_${queryName}` }],
          [{ text: "Sambungkan Koneksi", callback_data: `connect_query_${queryName}` }],
          [{ text: "<<Back>>", callback_data: "list_query" }],
        ],
      },
    };

    console.log("Sending options..."); // Debugging step 3: Confirm sending of options
    bot.sendMessage(chatId, `Menu untuk Query "${queryName}":`, options);
    console.log(`Sent options for query: ${queryName}`); // Debugging step 4: Confirm completion of sending options
  }).catch(err => {
    console.error("Error sending info message:", err); // Debugging step 5: Catch any errors
  });
};


const connectQuery = (bot, chatId, queryName) => {
  console.log("connectQuery triggered for:", queryName); // Debugging
  const queries = readJSON(queriesFile);
  const connections = readJSON(connectionsFile);

  if (!queries[queryName]) {
    return bot.sendMessage(chatId, "Query tidak ditemukan.");
  }

  if (Object.keys(connections).length === 0) {
    return bot.sendMessage(chatId, "Belum ada koneksi yang tersedia.", {
      reply_markup: {
        inline_keyboard: [[{ text: "<<Back>>", callback_data: `query_menu_${queryName}` }]],
      },
    });
  }

  const keyboard = Object.keys(connections).map((connectionName) => [
    { text: connectionName, callback_data: `select_connection_${queryName}_${connectionName}` },
  ]);

  keyboard.push([{ text: "<<Back>>", callback_data: `query_menu_${queryName}` }]);

  bot.sendMessage(chatId, "Pilih koneksi untuk query ini:", {
    reply_markup: { inline_keyboard: keyboard },
  });
};

const setConnectionForQuery = (bot, chatId, queryName, connectionName) => {
  const queries = readJSON(queriesFile);
  const connections = readJSON(connectionsFile);

  if (!queries[queryName]) {
    return bot.sendMessage(chatId, "Query tidak ditemukan.");
  }

  if (!connections[connectionName]) {
    return bot.sendMessage(chatId, "Koneksi tidak ditemukan.");
  }

  queries[queryName].connection = connectionName;
  writeJSON(queriesFile, queries);
  bot.sendMessage(chatId, `Koneksi "${connectionName}" berhasil disambungkan ke query "${queryName}".`);
  showQueryMenu(bot, chatId, queryName);
};

const updateQuery = (bot, chatId, queryName) => {
  bot.sendMessage(chatId, "Masukkan SQL query baru:", {
    reply_markup: {
      inline_keyboard: [[{ text: "<<Cancel>>", callback_data: `query_menu_${queryName}` }]],
    },
  }).then(() => {
    const sqlListener = (msg) => {
      const sqlQuery = msg.text.trim();
      const queries = readJSON(queriesFile);
      if (!queries[queryName]) {
        return bot.sendMessage(chatId, "Query tidak ditemukan.");
      }

      queries[queryName].sql = sqlQuery;
      writeJSON(queriesFile, queries);
      bot.sendMessage(chatId, `Query "${queryName}" berhasil diupdate.`);
      showQueryMenu(bot, chatId, queryName);
    };

    bot.once("message", sqlListener);

    bot.once("callback_query", (query) => {
      if (query.data === `query_menu_${queryName}`) {
        bot.removeListener("message", sqlListener);
        showQueryMenu(bot, chatId, queryName);
      }
    });
  });
};

const deleteQuery = (bot, chatId, queryName) => {
  const queries = readJSON(queriesFile);

  if (!queries[queryName]) {
    return bot.sendMessage(chatId, "Query tidak ditemukan.");
  }

  delete queries[queryName];
  writeJSON(queriesFile, queries);
  bot.sendMessage(chatId, `Query "${queryName}" berhasil dihapus.`);
  listQueries(bot, chatId);
};

const handleQueryMenu = (bot, chatId, data) => {
  console.log("handleQueryMenu triggered with data:", data); // Debugging

  if (data === "menu_query") {
    showMainMenu(bot, chatId);
  } else if (data === "add_query") {
    addQuery(bot, chatId);
  } else if (data === "list_query") {
    listQueries(bot, chatId);
  } else if (data.startsWith("query_menu_")) {
    const queryName = data.replace("query_menu_", "");
    showQueryMenu(bot, chatId, queryName);
  } else if (data.startsWith("update_query_")) {
    const queryName = data.replace("update_query_", "");
    updateQuery(bot, chatId, queryName);
  } else if (data.startsWith("delete_query_")) {
    const queryName = data.replace("delete_query_", "");
    deleteQuery(bot, chatId, queryName);
  } else if (data.startsWith("connect_query_")) {
    const queryName = data.replace("connect_query_", "");
    connectQuery(bot, chatId, queryName);  // Ensure this callback is properly triggered
  } else if (data.startsWith("select_connection_")) {
    const { queryName, connectionName } = extractQueryAndConnection(data);
    setConnectionForQuery(bot, chatId, queryName, connectionName);
  }
};

module.exports = {
  handleQueryMenu,
};
