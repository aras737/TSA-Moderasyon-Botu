const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// --- 1. RENDER 7/24 AKTİF TUTMA (WEB SERVER) ---
const app = express();
app.get('/', (req, res) => res.send('TSA İttifak Sistemi 7/24 Aktif!'));
app.listen(8080, () => console.log('Web sunucusu 8080 portunda hazır.'));

// --- 2. BOTU BAŞLATMA ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // Yetki kontrolü için şart
    ]
});

// Komut koleksiyonu
client.commands = new Collection();
const slashCommands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Komutları klasörden oku
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        slashCommands.push(command.data.toJSON());
    }
}

// --- 3. BOT HAZIR OLDUĞUNDA ---
client.once('ready', async () => {
    console.log(`[BOT] ${client.user.tag} girişi yapıldı!`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('[SİSTEM] Slash komutları başarıyla senkronize edildi.');
    } catch (error) {
        console.error('[HATA] Komutlar yüklenemedi:', error);
    }
});

// --- 4. MERKEZİ ETKİLEŞİM VE YETKİ KONTROLÜ ---
client.on('interactionCreate', async interaction => {
    
    // SLASH KOMUT KONTROLÜ
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        // --- MERKEZİ YETKİ KONTROLÜ (ERERESİ MANTIĞI) ---
        if (command.requiredPerms) {
            const hasPerm = command.requiredPerms.some(perm => interaction.member.permissions.has(perm));
            
            if (!hasPerm) {
                const yetkiHata = new EmbedBuilder()
                    .setTitle('⚠️ Yetki Yetersiz')
                    .setDescription('Bu komutu kullanmak için gerekli "İttifak Konseyi" yetkisine sahip değilsin.')
                    .setColor('Red');
                
                return interaction.reply({ embeds: [yetkiHata], ephemeral: true });
            }
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Komut çalışırken bir iç hata oluştu!', ephemeral: true });
        }
    }

    // --- DESTEK SİSTEMİ ETKİLEŞİMLERİ (BUTON VE MENÜ) ---
    // destek-kur.js içindeki interactionHandler'ı tetikler
    const biletKomutu = client.commands.get('destek-kur');
    if (biletKomutu && biletKomutu.interactionHandler) {
        try {
            await biletKomutu.interactionHandler(interaction);
        } catch (error) {
            console.error('[HATA] Bilet etkileşimi başarısız:', error);
        }
    }
});

// --- 5. BOTU ÇALIŞTIR ---
client.login(process.env.TOKEN);
