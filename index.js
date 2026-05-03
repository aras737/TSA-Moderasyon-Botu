const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('node:fs');
require('dotenv').config();

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

// --- CRASH PROTECTION (Botun Hatalarda Kapanmasını Önler) ---
process.on('unhandledRejection', (error) => {
    console.error('⚠️ [HATA YAKALANDI]:', error);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ [KRİTİK HATA]:', error);
});

// --- READY EVENT ---
client.once('ready', async () => {
    console.log(`🚀 [TSA] ${client.user.tag} Aktif ve Görevde!`);
    
    // SANİYELİK LOG YERİNE DAKİKALIK LOG (Kapanma Sebebi Bu!)
    setInterval(() => {
        const zaman = new Date().toLocaleTimeString('tr-TR');
        console.log(`[TSA DURUM] Sistem Stabil | Saat: ${zaman}`);
    }, 60000); // 60 saniyede bir log atar.

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('📡 [TSA] Komutlar Başarıyla Güncellendi.');
    } catch (error) {
        console.error('❌ Komut yükleme hatası:', error);
    }
});

// --- INTERACTION HANDLER ---
client.on('interactionCreate', async interaction => {
    // 1. SLASH KOMUTLAR
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        if (command.requiredPerms) {
            const hasPerm = command.requiredPerms.some(p => interaction.member.permissions.has(p));
            if (!hasPerm) return interaction.reply({ content: '⚠️ Bu komut için yetkiniz yetersiz.', ephemeral: true }).catch(() => {});
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Komut çalışırken bir hata oluştu!', ephemeral: true }).catch(() => {});
            }
        }
    }

    // 2. DESTEK SİSTEMİ (BUTON/MENÜ)
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        if (interaction.replied || interaction.deferred) return;

        const biletKomutu = client.commands.get('destek-kur');
        if (biletKomutu && biletKomutu.interactionHandler) {
            try {
                await biletKomutu.interactionHandler(interaction);
            } catch (error) {
                console.error('[BİLET SİSTEM HATASI]:', error);
            }
        }
    }
});

client.login(process.env.TOKEN);
