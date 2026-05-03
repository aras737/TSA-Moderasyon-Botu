const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const express = require('express');
const fs = require('node:fs');
require('dotenv').config();

// --- 1. 7/24 AKTİFLİK SİSTEMİ (WEB SERVER) ---
const app = express();
app.get('/', (req, res) => res.send('TSA Sistemi 7/24 Aktif! ✅'));
app.listen(8080, () => console.log('🚀 Port 8080 dinleniyor. UptimeRobot için hazır.'));

// --- 2. BOT YAPILANDIRMASI ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
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

// --- 3. KRİTİK HATA KORUMASI (CRASH PROTECTION) ---
process.on('unhandledRejection', (error) => {
    console.error('❌ [Hata] Yakalanamayan Reddetme:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ [Hata] Yakalanamayan İstisna:', error);
});

// --- 4. READY EVENT ---
client.once('ready', async () => {
    console.log(`✅ [BOT] ${client.user.tag} aktif!`);
    
    // RENDER LOGLARI İÇİN DAKİKALIK HEARTBEAT (SANİYELİK YAPMA, BOTU KAPATIRLAR)
    setInterval(() => {
        console.log(`💓 [TSA SİSTEM] Heartbeat: Bot Sorunsuz Çalışıyor | ${new Date().toLocaleTimeString('tr-TR')}`);
    }, 60000); // 1 dakikada bir log atar, güvenlidir.

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('📡 [SİSTEM] TSA Komutları başarıyla güncellendi.');
    } catch (error) {
        console.error('❌ [HATA] Slash yükleme hatası:', error);
    }
});

// --- 5. ETKİLEŞİM YÖNETİMİ ---
client.on('interactionCreate', async interaction => {
    // A. SLASH KOMUTLAR
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        // Yetki Kontrolü
        if (command.requiredPerms) {
            const hasPerm = command.requiredPerms.some(p => interaction.member.permissions.has(p));
            if (!hasPerm) return interaction.reply({ content: '⚠️ Yetkin yetmiyor kanka.', ephemeral: true }).catch(() => {});
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Bir hata oluştu!', ephemeral: true }).catch(() => {});
            }
        }
        return;
    }

    // B. DESTEK SİSTEMİ (BUTON/MENÜ)
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const biletKomutu = client.commands.get('destek-kur');
        if (biletKomutu && biletKomutu.interactionHandler) {
            try {
                await biletKomutu.interactionHandler(interaction);
            } catch (error) {
                console.error('[BİLET HATASI]:', error);
            }
        }
    }
});

client.login(process.env.TOKEN);
