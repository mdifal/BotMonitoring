const fs = require("fs");
const crypto = require("crypto");

const { Client } = require("pg");
const puppeteer = require("puppeteer");
const path = require("path");
const connectionsFile = path.resolve(__dirname, "../data/connections.json");
const queriesFile = path.resolve(__dirname, "../data/queries.json");
// Kunci harus panjang 32 byte (64 karakter hexadecimal)
const ENCRYPTION_KEY = crypto.createHash("sha256").update("34fe2efe46ef51d04b86621f619b6536").digest();
const IV_LENGTH = 16; // IV panjang 16 byte

const encrypt = (text) => {
  if (!text) {
    console.error("Input text tidak boleh kosong");
    return;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  console.log("IV (16 byte):", iv.toString("hex"));
  
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  const result = `${iv.toString("hex")}:${encrypted.toString("hex")}`;
  

  return result;
};

const decrypt = (text) => {
  if (!text) {
    console.error("Input text untuk dekripsi tidak boleh kosong");
    return;
  }

  const parts = text.split(":");
  const iv = Buffer.from(parts.shift(), "hex");
  const encryptedText = Buffer.from(parts.join(":"), "hex");



  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString();
  
  
  return decrypted;
};

const executeQuery = async (bot, chatId, queryName, asScreenshot = false) => {
  const connections = readJSON(connectionsFile);
  const queries = readJSON(queriesFile);

  const query = queries[queryName];
  if (!query) {
    bot.sendMessage(chatId, `Query "${queryName}" tidak ditemukan.`);
    return;
  }

  const connectionDetails = JSON.parse(decrypt(connections[query.connection]));

  const client = new Client({
    user: connectionDetails.db_user,
    host: connectionDetails.db_host,
    database: connectionDetails.db_name,
    password: connectionDetails.db_password,
    port: connectionDetails.db_port,
  });

  try {
    await client.connect();
    const result = await client.query(query.sql);

    if (asScreenshot) {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();

      // Ambil nama kolom dari hasil query
      const columns = result.fields.map((field) => field.name);

      // Bangun HTML tabel
      const tableHTML = `
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px; /* Tambahkan margin di semua sisi */
              padding: 0;
            }
            table {
              border-collapse: collapse;
              width: auto; /* Sesuai dengan ukuran konten */
              table-layout: auto; /* Kolom akan menyesuaikan isi */
              margin: 0 auto; /* Agar tabel center di halaman */
            }
            th, td {
              border: 1px solid #ddd;
              padding: 4px 8px; /* Padding minimal dengan margin kanan/kiri kecil */
              text-align: center; /* Isi sel di tengah */
              white-space: nowrap; /* Hindari pemotongan teks */
              font-size: 12px; /* Ukuran font lebih kecil */
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            tr:hover {
              background-color: #ddd;
            }
          </style>
        </head>
        <body>
          <table>
            <thead>
              <tr>${columns.map((col) => `<th>${col}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${result.rows
                .map(
                  (row) =>
                    `<tr>${columns
                      .map((col) => `<td>${row[col] ?? ""}</td>`)
                      .join("")}</tr>`
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
      `;
      

      // Set konten halaman dengan tabel
       // Set konten halaman dengan tabel
       await page.setContent(tableHTML);

       // Atur ukuran default minimum (viewport)
       let minWidth = 600;
       let minHeight = 400;
 
       await page.setViewport({
         width: minWidth,
         height: minHeight,
         deviceScaleFactor: 1, // Tidak ada zoom out
       });
 
       // Hitung tinggi total tabel secara dinamis
       const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
       const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
 
       // Perbarui viewport berdasarkan ukuran konten tabel
       await page.setViewport({
         width: Math.max(minWidth, bodyWidth), // Lebar minimal atau sesuai konten
         height: Math.max(minHeight, bodyHeight), // Tinggi minimal atau sesuai konten
         deviceScaleFactor: 1,
       });
 
       const screenshotPath = `screenshot-${Date.now()}.png`;
 
       // Ambil screenshot dari seluruh halaman
       await page.screenshot({ path: screenshotPath, fullPage: true });
 
       await browser.close();
       await bot.sendPhoto(chatId, screenshotPath);
    } else {
      // Jika tidak dalam mode screenshot, kirim data sebagai teks JSON
      bot.sendMessage(chatId, JSON.stringify(result.rows, null, 2));
    }
  } catch (error) {
    bot.sendMessage(chatId, `Error saat menjalankan query "${queryName}": ${error.message}`);
  } finally {
    await client.end();
  }
};



const extractQueryAndConnection = (data) => {
  const parts = data.split("_");

  // Mengambil bagian kedua sebagai queryName dan bagian ketiga sebagai connectionName
  const queryName = parts[2]; 
  const connectionName = parts.slice(3).join("_");

  return { queryName, connectionName };
};


const readJSON = (file) => JSON.parse(fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "{}");
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

module.exports = { encrypt, decrypt, readJSON, writeJSON, extractQueryAndConnection, executeQuery, readJSON };
