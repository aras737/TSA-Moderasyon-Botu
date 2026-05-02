const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// --- 1. 7/24 AKTİF TUTMA SİSTEMİ (Express Web Server) ---
const app = express();
app.get('/', (req, res) => res.send('TEAF Moderasyon Sistemi 7/24 Aktif! ✅'));
app.listen(8080, () => console.log('Web sunucusu 8080 portunda hazır. Bot uyanık tutuluyor.'));

// --- 2. BOT AYARLARI ---
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
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        slashCommands.push(command.data.toJSON());
    }
}

// --- 3. BOTUN ASLA KAPANMAMASI İÇİN HATA YAKALAYICILAR (Crash Protection) ---
process.on('unhandledRejection', (reason, promise) => {
    console.error(' [HATA] Yakalanamayan Reddetme:', promise, 'Sebep:', reason);
});

process.on('uncaughtException', (err, origin) => {
    console.error(' [HATA] Yakalanamayan İstisna:', err, 'Köken:', origin);
});

process.on('uncaughtExceptionMonitor', (err, origin) => {
    console.error(' [HATA] İstisna İzleyici:', err, origin);
});

// --- 4. BOT HAZIR OLDUĞUNDA ---
client.once('ready', async () => {
    console.log(`[BOT] ${client.user.tag} olarak giriş yapıldı!`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('[SİSTEM] Slash komutları yüklendi.');
    } catch (error) {
        console.error('[HATA] Komut yükleme başarısız:', error);
    }
});

// --- 5. ETKİLEŞİMLER VE YETKİ KONTROLÜ ---
client.on('interactionCreate', async interaction => {
    
    // Slash Komut Çalıştırıcı
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        // Yetki Kontrolü (Yetki Ereresi Mantığı)
        if (command.requiredPerms) {
            const hasPerm = command.requiredPerms.some(perm => interaction.member.permissions.has(perm));
            if (!hasPerm) {
                return interaction.reply({ 
                    content: '⚠️ Bu komutu kullanmak için gerekli "İttifak Konseyi" yetkisine sahip değilsin.', 
                    ephemeral: true 
                });
            }
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Komut çalışırken bir hata oluştu!', ephemeral: true });
        }
    }

    // Bilet Sistemi Etkileşimleri (Buton & Menü)
    const biletKomutu = client.commands.get('destek-kur');
    if (biletKomutu && biletKomutu.interactionHandler) {
        try {
            await biletKomutu.interactionHandler(interaction);
        } catch (error) {
            console.error('[HATA] Bilet işlemi yapılamadı:', error);
        }
    }
});

client.login(process.env.TOKEN);
