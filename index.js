const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// --- 1. 7/24 AKTİFLİK SİSTEMİ (RENDER İÇİN) ---
const app = express();
app.get('/', (req, res) => res.send('TSA Sistemi 7/24 Aktif! ✅'));
app.listen(8080, () => console.log('Web sunucusu 8080 portunda hazır.'));

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
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        slashCommands.push(command.data.toJSON());
    }
}

// --- 3. CRASH PROTECTION (BOTUN KAPANMASINI ÖNLER) ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [Hata] unhandledRejection:', reason);
});

process.on('uncaughtException', (err, origin) => {
    console.error('⚠️ [Hata] uncaughtException:', err);
});

// --- 4. BOT HAZIR OLDUĞUNDA ---
client.once('ready', async () => {
    console.log(`[BOT] ${client.user.tag} aktif ve TSA emrinde!`);
    
    // RENDER LOGLARI İÇİN HER SANİYE AKTİFLİK BİLGİSİ
    setInterval(() => {
        const zaman = new Date().toLocaleTimeString('tr-TR');
        console.log(`[7/24 TSA LOG] Sistem Sorunsuz Çalışıyor | Saat: ${zaman}`);
    }, 1000);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('[SİSTEM] TSA Slash komutları başarıyla yüklendi.');
    } catch (error) {
        console.error('[HATA] Komut yükleme hatası:', error);
    }
});

// --- 5. MERKEZİ ETKİLEŞİM YÖNETİMİ (YETKİ KONTROLLÜ) ---
client.on('interactionCreate', async interaction => {
    
    // A. SLASH KOMUTLARI
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        // Yetki Kontrol Sistemi (Merkezi)
        if (command.requiredPerms) {
            const hasPerm = command.requiredPerms.some(perm => interaction.member.permissions.has(perm));
            if (!hasPerm) {
                return interaction.reply({ 
                    content: '⚠️ **Yetersiz Yetki:** Bu işlemi yapmak için gerekli TSA yetkisine sahip değilsin.', 
                    ephemeral: true 
                }).catch(() => {});
            }
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`[KOMUT HATASI] ${interaction.commandName}:`, error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Bu komut çalışırken teknik bir hata oluştu!', ephemeral: true }).catch(() => {});
            }
        }
    }

    // B. DESTEK SİSTEMİ (BUTON VE MENÜLER)
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        // Zaten bir slash komutu cevabı verilmişse diğer handler'a geçme
        if (interaction.replied || interaction.deferred) return;

        const biletKomutu = client.commands.get('destek-kur');
        if (biletKomutu && biletKomutu.interactionHandler) {
            try {
                await biletKomutu.interactionHandler(interaction);
            } catch (error) {
                console.error('[BİLET HATASI]:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Bilet işlemi sırasında bir hata oluştu.', ephemeral: true }).catch(() => {});
                }
            }
        }
    }
});

client.login(process.env.TOKEN);
