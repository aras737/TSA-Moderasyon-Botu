const { Client, GatewayIntentBits, Collection, REST, Routes, Partials } = require('discord.js');
const fs = require('node:fs');
const express = require('express'); 
require('dotenv').config();

// --- 1. RENDER'I İKNA ETME SİSTEMİ (WEB SERVER) ---
const app = express();
// ÜCRETSİZ SERVİSLER İÇİN EN İDEAL PORT AYARI
const PORT = process.env.PORT || 3000; 

app.get('/', (req, res) => {
    res.send('TSA Sistemi Aktif ve 7/24 Görevde! ✅ Bilgisayar kapalı olsa bile bot yayında.');
});

app.listen(PORT, () => {
    console.log(`📡 [WEB] Render Portu Dinleniyor: ${PORT}`);
});

// --- 2. BOT YAPILANDIRMASI (LOGLARIN GELMESİ İÇİN FULL INTENTS & PARTIALS) ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,   // 🔊 SES HAREKETLERİNİ DUYMASI İÇİN ŞART!
        GatewayIntentBits.GuildModeration     // 🔨 SAĞ TIK BAN VE UNBAN HAREKETLERİ İÇİN ŞART!
    ],
    partials: [
        Partials.Message,  // 🗑️ Bot açık değilken silinen veya önbellekte olmayan eski mesajları yakalar
        Partials.Channel,  // 📁 Kanallardaki değişiklikleri eksiksiz tarar
        Partials.User      // 👤 Kullanıcı verilerini her durumda eksiksiz çeker
    ]
});

client.commands = new Collection();
const slashCommands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
        slashCommands.push(command.data.toJSON());
    }
}

// --- 3. KRİTİK HATA KORUMASI (Botun Kapanmasını Önler) ---
process.on('unhandledRejection', (error) => {
    console.error('❌ [HATA]:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ [KRİTİK HATA]:', error);
});

// --- 4. READY EVENT ---
client.once('ready', async () => {
    console.log(`🚀 [TSA] ${client.user.tag} Aktif!`);
    
    // Dakikalık stabilite logu (Render console'unda yaşadığını kanıtlar)
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
    
    // Destek Sistemi Buton/Menü Yönetimi
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const biletKomutu = client.commands.get('destek-kur');
        if (biletKomutu?.interactionHandler) {
            await biletKomutu.interactionHandler(interaction).catch(() => {});
        }
    }
});

// =========================================================================
// 🔥 LINUX / RENDER SUNUCULARINA UYUMLU TAMAMEN KÜÇÜK HARFLİ LOG BAĞLANTISI
// =========================================================================
require('./events/gelismislog')(client);

client.login(process.env.TOKEN);
