// 🔥 En sona ActivityType eklendi kanka, durumu ayarlamak için şarttı!
const { Client, GatewayIntentBits, Collection, REST, Routes, Partials, EmbedBuilder, WebhookClient, ActivityType } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
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
        Partials.User,
        Partials.GuildMember
    ]
});

// --- STORAGE VE VAXERA ALTYAPI UYUMLULUĞU ---
client.storage = Storage;
client.database = {
    antiNukeData: { get: async (id) => Storage.get(`antinuke_${id}`) },
    guildData: { get: async (id) => Storage.get(`guild_${id}`) }
};
client.cache = new Map();
client.config = { Client: { Owners: process.env.OWNERS?.split(',') || [] } };
client.ErrorColor = '#e74c3c';
client.util = {
    checkOwner: (id) => process.env.OWNERS?.split(',')?.includes(id) || false,
    embed: () => new EmbedBuilder(),
    replaceOriginal: async (text, member) => text?.replace(/{user}/g, `${member}`)?.replace(/{guild}/g, `${member.guild.name}`),
    replacerOriginal: async (embeds, member) => embeds
};
// Event engelleme cezalandırma sistemi
client.eventRestrict = async (punishment, userId, guildId, reason) => {
    console.log(`[Caza Sistemi] Yetkiliye ceza uygulandı: ${userId} -> ${punishment} (${reason})`);
};

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

// --- 3. KRİTİK HATA KORUMASI (Botun Asla Çökmemesini Sağlar) ---
process.on('unhandledRejection', (error) => {
    console.error('❌ [YAKALANAMAYAN HATA]:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ [KRİTİK SİSTEM HATASI]:', error);
});

// --- 4. READY EVENT ---
client.once('ready', async () => {
    console.log(`🚀 [TSA] ${client.user.tag} Aktif!`);
    
    // 🔥 BOTUN DURUMUNU "Çalışıyorum…" YAPTIK KANKA
    client.user.setPresence({
        activities: [{ name: 'Çalışıyorum…', type: ActivityType.Custom }],
        status: 'online' // Çevrimiçi yeşil ışık yakar
    });
    
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
            console.error("Komut çalışırken hata fırlattı kanka:", error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Hata oluştu kanka, sistem kontrol ediliyor!', ephemeral: true });
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
// 🔥 SINIF TABANLI VE DÜZ ETKİNLİK (EVENT) LOADER ENTEGRASYONU
// =========================================================================
const eventsPath = './events';
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        try {
            const TargetEvent = require(`./events/${file}`);
            
            if (typeof TargetEvent === 'function' && TargetEvent.toString().startsWith('class')) {
                const eventInstance = new TargetEvent(client);
                const eventName = eventInstance.name || file.split('.')[0];
                
                if (eventInstance.once) {
                    client.once(eventName, (...args) => eventInstance.run(...args));
                } else {
                    client.on(eventName, (...args) => eventInstance.run(...args));
                }
                console.log(`[Sınıf Eventi] 🟢 ${eventName} başarıyla yüklendi.`);
            } else {
                if (typeof TargetEvent === 'function') {
                    TargetEvent(client);
                    console.log(`[Düz Fonksiyon Eventi] 🟢 ${file} başarıyla bağlandı.`);
                }
            }
        } catch (error) {
            console.error(`❌ Etkinlik yüklenirken patladı (${file}):`, error);
        }
    }
}

// --- BOT GİRİŞİ ---
client.login(process.env.TOKEN).catch(error => {
    console.error('❌ Bot giriş hatası:', error.message);
    process.exit(1);
});
