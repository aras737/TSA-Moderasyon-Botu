const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('node:fs');
require('dotenv').config();

// VDS'te Express'e (app.listen) gerek yok ama istersen durabilir. 
// Direkt botu çalıştırmaya odaklanıyoruz.

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

// --- CRITICAL CRASH PROTECTION (VDS'te Botun Asla Kapanmaması İçin) ---
process.on('unhandledRejection', (error) => {
    console.error('⚠️ [Hata] Yakalanamayan Reddetme:', error);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ [Hata] Yakalanamayan İstisna:', error);
});

// --- READY EVENT ---
client.once('ready', async () => {
    console.log(`🚀 [TSA VDS] ${client.user.tag} Aktif!`);
    
    // VDS'teysen Saniyelik Log Atabilirsin, Sorun Olmaz:
    setInterval(() => {
        const zaman = new Date().toLocaleTimeString('tr-TR');
        console.log(`[TSA LOG] Sistem 7/24 Aktif | Saat: ${zaman}`);
    }, 1000);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('📡 [TSA] Komutlar Global Olarak Güncellendi.');
    } catch (error) {
        console.error('❌ Slash yükleme hatası:', error);
    }
});

// --- ETKİLEŞİM YÖNETİMİ ---
client.on('interactionCreate', async interaction => {
    // 1. SLASH KOMUTLAR
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        if (command.requiredPerms) {
            const hasPerm = command.requiredPerms.some(p => interaction.member.permissions.has(p));
            if (!hasPerm) return interaction.reply({ content: '⚠️ Bu komutu kullanmaya TSA yetkiniz yetmiyor.', ephemeral: true }).catch(() => {});
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Bir hata oluştu!', ephemeral: true }).catch(() => {});
            }
        }
    }

    // 2. DESTEK SİSTEMİ (BUTON/MENÜ)
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        if (interaction.replied || interaction.deferred) return; // Çakışmayı önle

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
