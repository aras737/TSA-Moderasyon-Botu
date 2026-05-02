const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// --- 1. 7/24 AKTİFLİK SİSTEMİ ---
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

// --- 4. READY EVENT ---
client.once('ready', async () => {
    console.log(`[BOT] ${client.user.tag} aktif!`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('[SİSTEM] Komutlar yüklendi.');
    } catch (error) {
        console.error('[HATA] Yükleme hatası:', error);
    }
});

// --- 5. MERKEZİ ETKİLEŞİM YÖNETİMİ (HATA BURADAYDI) ---
client.on('interactionCreate', async interaction => {
    
    // A. SLASH KOMUTLARINI YÖNET
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        // Yetki Kontrolü
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
            // Hata mesajını sadece cevap verilmediyse gönder
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Bu komut çalışırken bir hata oluştu!', ephemeral: true }).catch(() => {});
            }
        }
        return; // İşlem bitti, aşağıya (bilet sistemine) geçme!
    }

    // B. BİLET SİSTEMİ (BUTON VE MENÜLER)
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        // Eğer etkileşim zaten bir slash komutu tarafından cevaplandıysa dur
        if (interaction.replied || interaction.deferred) return;

        const biletKomutu = client.commands.get('destek-kur');
        if (biletKomutu && biletKomutu.interactionHandler) {
            try {
                await biletKomutu.interactionHandler(interaction);
            } catch (error) {
                console.error('[BİLET HATASI]:', error);
                // Kullanıcıya çaktırmadan hata yönetimini yap
                if (!interaction.replied && !interaction.deferred) {
                   await interaction.reply({ content: 'İşlem başarısız oldu.', ephemeral: true }).catch(() => {});
                }
            }
        }
    }
});

client.login(process.env.TOKEN);
