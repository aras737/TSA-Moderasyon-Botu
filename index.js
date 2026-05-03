const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const express = require('express'); // Port açmak için gerekli
require('dotenv').config();

// --- 1. RENDER İÇİN PORT BAĞLANTISI (ŞART) ---
const app = express();
const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.send('TSA Bot 7/24 Aktif! ✅');
});

app.listen(port, () => {
    console.log(`🚀 Port dinleniyor: ${port}. Render artık botu kapatmayacak.`);
});

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

// --- 3. HATA KORUMASI ---
process.on('unhandledRejection', (error) => {
    console.error('⚠️ [HATA]:', error);
});

// --- 4. READY EVENT ---
// Discord.js v14/v15 uyarısı için 'ready' yerine 'clientReady' kullanabilirsin
client.once('ready', async () => {
    console.log(`🚀 [TSA] ${client.user.tag} Aktif!`);
    
    // Dakikalık Stabilite Logu
    setInterval(() => {
        console.log(`[TSA DURUM] Sistem Stabil | Saat: ${new Date().toLocaleTimeString('tr-TR')}`);
    }, 60000);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('📡 [TSA] Komutlar Güncellendi.');
    } catch (error) {
        console.error('❌ Slash hatası:', error);
    }
});

// --- 5. KOMUT ÇALIŞTIRICI ---
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        if (command.requiredPerms) {
            const hasPerm = command.requiredPerms.some(p => interaction.member.permissions.has(p));
            if (!hasPerm) return interaction.reply({ content: '⚠️ Yetkiniz yetersiz.', ephemeral: true });
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (!interaction.replied) await interaction.reply({ content: 'Hata oluştu!', ephemeral: true });
        }
    }
    
    // Destek Sistemi Handler (Varsa)
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const biletKomutu = client.commands.get('destek-kur');
        if (biletKomutu?.interactionHandler) {
            await biletKomutu.interactionHandler(interaction).catch(e => console.error(e));
        }
    }
});

client.login(process.env.TOKEN);
