const {
    Client, GatewayIntentBits, Collection,
    REST, Routes, Partials, MessageFlags
} = require('discord.js');
const fs      = require('node:fs');
const express = require('express');
const Storage = require('./services/storage');
require('dotenv').config();

// =========================================================================
// 1. RENDER WEB SERVER
// =========================================================================
const app  = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => {
    res.send('TSA Sistemi Aktif ve 7/24 Görevde! ✅');
});

app.listen(PORT, () => {
    console.log(`📡 [WEB] Render Portu Dinleniyor: ${PORT}`);
});

// =========================================================================
// 2. BOT YAPILANDIRMASI
// =========================================================================
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

// =========================================================================
// 3. STORAGE & KOLEKSİYON
// =========================================================================
client.storage     = Storage;
client.commands    = new Collection();
client.sistemBellegi = new Map();

const slashCommands = [];

// =========================================================================
// 4. KOMUT YÜKLEME
// =========================================================================
if (!fs.existsSync('./commands')) {
    console.warn('⚠️ ./commands klasörü bulunamadı, oluşturuluyor...');
    fs.mkdirSync('./commands', { recursive: true });
} else {
    const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
    for (const file of commandFiles) {
        try {
            const command = require(`./commands/${file}`);
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
                slashCommands.push(command.data.toJSON());
            } else {
                console.warn(`⚠️ Eksik data/execute: ${file}`);
            }
        } catch (err) {
            console.error(`❌ Komut yükleme hatası (${file}):`, err);
        }
    }
}

// =========================================================================
// 5. KRİTİK HATA KORUMALARI
// =========================================================================
process.on('unhandledRejection', (err) => {
    // 10062 = Unknown interaction (süresi dolmuş), 40060 = Already acknowledged
    // Bunlar beklenen hatalar, konsolu kirletmesin
    if (err?.code === 10062 || err?.code === 40060) return;
    console.error('❌ [UNHANDLED REJECTION]:', err);
});

process.on('uncaughtException', (err) => {
    console.error('❌ [KRİTİK HATA]:', err);
});

// =========================================================================
// 6. READY EVENT
// =========================================================================
client.once('ready', async () => {
    console.log(`🚀 [TSA] ${client.user.tag} Aktif!`);

    // Durum log'u (her dakika)
    setInterval(() => {
        console.log(`[TSA DURUM] Sistem Stabil | Saat: ${new Date().toLocaleTimeString('tr-TR')}`);
    }, 60000);

    // Slash komutlarını kaydet
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log(`📡 [TSA] ${slashCommands.length} Slash Komutu Yüklendi.`);
    } catch (err) {
        console.error('❌ Slash Hatası:', err);
    }
});

// =========================================================================
// 7. ETKİLEŞİM YÖNETİMİ
// =========================================================================

// Interaction süre dolmuş mu kontrolü
const isInteractionExpired = (err) => err?.code === 10062 || err?.code === 40060;

client.on('interactionCreate', async (interaction) => {

    // ── A) SLASH KOMUTLARI ─────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        // Yetki kontrolü
        if (command.requiredPerms) {
            const hasPerms = command.requiredPerms.some(p => interaction.member.permissions.has(p));
            if (!hasPerms) {
                return interaction.reply({
                    content: '⚠️ Bu komutu kullanmak için yetkin yok kanka.',
                    flags: MessageFlags.Ephemeral  // ephemeral: true artık deprecated
                }).catch(() => {});
            }
        }

        // ⚡ Önce defer et — 3sn limitini 15dk'ya uzatır
        try {
            await interaction.deferReply();
        } catch (err) {
            if (isInteractionExpired(err)) return; // Süresi dolmuş, sessizce çık
            console.error('❌ Defer hatası:', err);
            return;
        }

        // Komutu çalıştır
        try {
            await command.execute(interaction);
        } catch (err) {
            if (isInteractionExpired(err)) return;
            console.error(`❌ Komut hatası [${interaction.commandName}]:`, err);
            await interaction.editReply({ content: '❌ Bir hata oluştu kanka.' }).catch(() => {});
        }
        return;
    }

    // ── B) BUTON & SELECT MENU ─────────────────────────────────────────────
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const biletKomutu = client.commands.get('destek-kur');
        if (!biletKomutu?.interactionHandler) return;

        try {
            await biletKomutu.interactionHandler(interaction);
        } catch (err) {
            if (isInteractionExpired(err)) return; // Sessizce geç
            console.error('❌ Button/Select hatası:', err);

            // Henüz yanıtlanmadıysa hata mesajı gönder
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ İşlem sırasında bir hata oluştu.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }
    }
});

// =========================================================================
// 8. DIŞ DOSYA BAĞLANTILARI
// =========================================================================
const eventler = ['./events/gelismislog.js', './events/kufurengel.js'];
for (const event of eventler) {
    if (fs.existsSync(event)) {
        require(event)(client);
    }
}

// =========================================================================
// 9. BOT GİRİŞİ
// =========================================================================
client.login(process.env.TOKEN).catch((err) => {
    console.error('❌ Bot giriş hatası:', err.message);
    process.exit(1);
});
