// İlk satıra WebhookClient eklendi kanka, gözden kaçırma 
const { Client, GatewayIntentBits, Collection, REST, Routes, Partials, EmbedBuilder, WebhookClient } = require('discord.js');
const fs = require('node:fs');
const express = require('express'); 
const Storage = require('./services/storage');
require('dotenv').config();

// --- 1. RENDER'I İKNA ETME SİSTEMİ (WEB SERVER) ---
const app = express();
const PORT = process.env.PORT || 3000; 

app.get('/', (req, res) => {
    res.send('TSA Sistemi Aktif ve 7/24 Görevde! ✅ Bilgisayar kapalı olsa bile bot yayında.');
});

app.listen(PORT, () => {
    console.log(`📡 [WEB] Render Portu Dinleniyor: ${PORT}`);
});

// --- 2. BOT YAPILANDIRMASI (FULL INTENTS) ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.User
    ]
});

// --- STORAGE ENTEGRASYONU ---
client.storage = Storage;

client.commands = new Collection();
const slashCommands = [];

// Commands klasörü var mı kontrol et
if (!fs.existsSync('./commands')) {
    console.warn('⚠️ ./commands klasörü bulunamadı!');
    fs.mkdirSync('./commands', { recursive: true });
} else {
    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        try {
            const command = require(`./commands/${file}`);
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
                slashCommands.push(command.data.toJSON());
            }
        } catch (error) {
            console.error(`❌ Komut yükleme hatası (${file}):`, error);
        }
    }
}

// --- 3. KRİTİK HATA KORUMASI ---
process.on('unhandledRejection', (error) => {
    console.error('❌ [HATA]:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ [KRİTİK HATA]:', error);
});

// --- 4. READY EVENT ---
client.once('ready', async () => {
    console.log(`🚀 [TSA] ${client.user.tag} Aktif!`);
    
    setInterval(() => {
        console.log(`[TSA DURUM] Sistem Stabil | Saat: ${new Date().toLocaleTimeString('tr-TR')}`);
    }, 60000);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('📡 [TSA] Slash Komutları Yüklendi.');
    } catch (error) {
        console.error('❌ Slash Hatası:', error);
    }
});

// --- 5. ETKİLEŞİM YÖNETİMİ ---
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        if (command.requiredPerms) {
            const hasPerm = command.requiredPerms.some(p => interaction.member.permissions.has(p));
            if (!hasPerm) return interaction.reply({ content: '⚠️ Yetkin yetersiz kanka.', ephemeral: true });
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Hata oluştu!', ephemeral: true });
            }
        }
    }
    
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const biletKomutu = client.commands.get('destek-kur');
        if (biletKomutu?.interactionHandler) {
            await biletKomutu.interactionHandler(interaction).catch(() => {});
        }
    }
});

// =========================================================================
// 🛡️ KÜFÜR ENGEL SİSTEMİ — RAM BELLEĞİ
// =========================================================================
const sistemBellegi = new Map();
client.sistemBellegi = sistemBellegi;

// =========================================================================
// 🔥 DIŞ DOSYA BAĞLANTILARI
// =========================================================================
if (fs.existsSync('./events/gelismislog.js')) {
    require('./events/gelismislog')(client);
}
if (fs.existsSync('./events/kufurengel.js')) {
    require('./events/kufurengel')(client);
}

// --- BOT GİRİŞİ ---
client.login(process.env.TOKEN).catch(error => {
    console.error('❌ Bot giriş hatası:', error.message);
    process.exit(1);
});
