const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

require('dotenv').config();

// Express server
const app = express();
const PORT = process.env.PORT || 3000;

// 1. CLIENT & COMMAND SETUP (PURE GATEWAY MODE)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ]
});

client.commands = new Collection();
const slashCommands = [];

// 💡 Komutları yükle
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
    for (const file of commandFiles) {
        try {
            const cmd = require(path.join(commandsPath, file));
            if (cmd.data && cmd.execute) {
                client.commands.set(cmd.data.name, cmd);
                slashCommands.push(cmd.data.toJSON());
                console.log(`✅ Komut yüklendi: ${cmd.data.name}`);
            } else {
                console.warn(`⚠️ Komut eksik özellik: ${file} (data ve execute gerekli)`);
            }
        } catch (err) {
            console.error(`❌ Komut yüklenirken hata oluştu (${file}):`, err.message || err);
        }
    }
    console.log(`📋 Toplam ${slashCommands.length} komut yüklendi.`);
} else {
    console.warn(`⚠️ Commands klasörü bulunamadı: ${commandsPath}`);
}

// Storage
let Storage;
try {
    Storage = require('./services/storage');
} catch (e) {
    console.log("⚠️ Storage servisi yüklenemedi.");
    Storage = new Map();
}

let registerDatastoreEvents;
try {
    registerDatastoreEvents = require('./services/datastore-events');
} catch (e) {
    registerDatastoreEvents = null;
}

client.storage = Storage;
if (typeof registerDatastoreEvents === 'function') {
    registerDatastoreEvents(client);
}

// 2. EXPRESS SERVER
app.get('/', (req, res) => {
    res.send('TSA Sistemi Aktif ve Görevde! ✅');
});

// Health check endpoint (Render için ping)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        ok: true, 
        bot: client.user ? client.user.tag : 'Bağlanılıyor...',
        commands: slashCommands.length 
    });
});

const server = app.listen(PORT, () => {
    console.log(`📡 Express server port ${PORT}'de çalışıyor`);
});

// 3. READY EVENT - Bot hazır olduğunda
client.once('ready', async () => {
    console.log(`✅ Bot giriş yaptı ve aktif: ${client.user.tag}`);
    
    // Slash komutları register et
    if (slashCommands.length > 0 && process.env.TOKEN && process.env.APPLICATION_ID) {
        try {
            const { REST, Routes } = require('discord.js');
            const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
            
            console.log(`🔄 ${slashCommands.length} slash komut register ediliyor...`);
            
            const data = await rest.put(
                Routes.applicationCommands(process.env.APPLICATION_ID),
                { body: slashCommands }
            );
            
            console.log(`✅ ${data.length} slash komut başarıyla register edildi!`);
        } catch (error) {
            console.error('❌ Slash komut register hatası:', error.message || error);
        }
    }
});

// 4. SLASH COMMAND INTERACTION HANDLER
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.warn(`⚠️ Komut bulunamadı: ${interaction.commandName}`);
        return interaction.reply({ 
            content: '❌ Bu komut sistemde bulunamadı.', 
            ephemeral: true 
        });
    }

    console.log(`🔨 Komut çalıştırılıyor: ${interaction.commandName} (Kullanıcı: ${interaction.user.username})`);

    try {
        await command.execute(interaction);
        console.log(`✅ Komut başarıyla çalıştırıldı: ${interaction.commandName}`);
    } catch (error) {
        console.error(`❌ Komut hatası (${interaction.commandName}):`, error.message || error);
        
        const errorMessage = {
            content: `💥 Komut çalıştırılırken hata oluştu!\nHata: \`${error.message || 'Bilinmeyen hata'}\``,
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

// 5. PING SISTEMÜ (Render'ın service'i çökmesini önle)
setInterval(() => {
    const botStatus = client.user ? `🟢 ${client.user.tag}` : '🔴 Bağlanılıyor';
    console.log(`💓 Ping: ${botStatus} | Komutlar: ${slashCommands.length}`);
}, 60000); // Her 60 saniye

// 6. BOT LOGIN
if (process.env.TOKEN) {
    client.login(process.env.TOKEN).catch((err) => {
        console.error('❌ Bot girişi başarısız oldu:', err);
    });
} else {
    console.error('❌ TOKEN env değişkeni bulunamadı!');
    process.exit(1);
}

// Error handling
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

console.log('🚀 Bot başlatılıyor... (Gateway Mode + Express Server)');

module.exports = { app, client };
