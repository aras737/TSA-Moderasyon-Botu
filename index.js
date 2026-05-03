const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// --- 1. 7/24 AKTİFLİK SİSTEMİ (WEB SERVER) ---
const app = express();
app.get('/', (req, res) => res.send('TEAF Moderasyon Sistemi 7/24 Aktif! ✅'));
app.listen(8080, () => console.log('Web sunucusu 8080 portunda hazır.'));

// --- 2. BOT BAŞLATMA ---
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

// --- 3. CRASH PROTECTION (BOTUN KAPANMASINI ÖNLER) ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [Hata Yakalandı] unhandledRejection:', reason);
});

process.on('uncaughtException', (err, origin) => {
    console.error('⚠️ [Hata Yakalandı] uncaughtException:', err);
});

// --- 4. READY EVENT VE 7/24 DÖNGÜSÜ ---
client.once('ready', async () => {
    console.log(`[BOT] ${client.user.tag} aktif!`);
    
    // RENDER LOGLARI İÇİN HER SANİYE ÇALIŞAN DÖNGÜ
    setInterval(() => {
        const zaman = new Date().toLocaleTimeString('tr-TR');
        console.log(`[7/24 LOG] Sistem Aktif | Saat: ${zaman} | Sunucu: TSA`);
    }, 1000); // 1000ms = 1 Saniye

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('[SİSTEM] Komutlar yüklendi.');
    } catch (error) {
        console.error('[HATA] Yükleme hatası:', error);
    }
});

// --- 5. MERKEZİ ETKİLEŞİM YÖNETİMİ ---
client.on('interactionCreate', async interaction => {
    
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        if (command.requiredPerms) {
            const hasPerm = command.requiredPerms.some(perm => interaction.member.permissions.has(perm));
            if (!hasPerm) {
                return interaction.reply({ content: '⚠️ Yetkin yok kanka.', ephemeral: true }).catch(() => {});
            }
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`[KOMUT HATASI] ${interaction.commandName}:`, error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Bu komut çalışırken bir hata oluştu!', ephemeral: true }).catch(() => {});
            }
        }
        return;
    }

    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        if (interaction.replied || interaction.deferred) return;

        const biletKomutu = client.commands.get('destek-kur');
        if (biletKomutu && biletKomutu.interactionHandler) {
            try {
                await biletKomutu.interactionHandler(interaction);
            } catch (error) {
                console.error('[BİLET HATASI]:', error);
                if (!interaction.replied && !interaction.deferred) {
                   await interaction.reply({ content: 'İşlem başarısız oldu.', ephemeral: true }).catch(() => {});
                }
            }
        }
    }
});

client.login(process.env.TOKEN);
