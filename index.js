const { Client, GatewayIntentBits, Collection, REST, Routes, Partials, EmbedBuilder, WebhookClient } = require('discord.js');
const { InteractionType, InteractionResponseType, verifyKeyMiddleware } = require('discord-interactions'); 
const fs = require('node:fs');
const path = require('node:path');
const express = require('express'); 
const Storage = require('./services/storage');
const registerDatastoreEvents = require('./services/datastore-events');
require('dotenv').config();

// --- 1. WEB SERVER & DISCORD VERIFICATION ---
const app = express();
const PORT = process.env.PORT || 3000; 

app.get('/', (req, res) => {
    res.send('TSA Sistemi Aktif ve 2026 Standartlarında Görevde! ✅');
});

// DISCORD'UN GÜVENLİK KAPISI (Sadece PING doğrulaması bırakıldı)
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), (req, res) => {
    const { type } = req.body;

    // Discord portal "Save Changes" dediğinde bu PING'i yakalar ve PONG döner.
    if (type === InteractionType.PING) {
        return res.send({ type: InteractionResponseType.PONG });
    }
    
    // NOT: Komutları tıkayan APPLICATION_COMMAND bloğu buradan kaldırıldı.
    // Artık komutlar aşağıda yer alan gerçek 'interactionCreate' olayına aktarılacak.
});

app.listen(PORT, () => {
    console.log(`📡 [WEB] Port: ${PORT}`);
});

// --- BOT ---
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
        Partials.User,
        Partials.GuildMember
    ]
});

client.storage = Storage;
registerDatastoreEvents(client);

client.database = {
    antiNukeData: { get: async (id) => Storage.get(`antinuke_${id}`) },
    guildData: { get: async (id) => Storage.getGuildSettings(id) }
};

client.cache = new Map();
client.commands = new Collection();
const slashCommands = [];

// COMMAND LOAD
if (fs.existsSync('./commands')) {
    const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));

    for (const file of commandFiles) {
        const cmd = require(`./commands/${file}`);
        if (cmd.data && cmd.execute) {
            client.commands.set(cmd.data.name, cmd);
            slashCommands.push(cmd.data.toJSON());
        }
    }
}

// --- ERROR HANDLER ---
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

// --- READY ---
client.once('ready', async () => {
    console.log(`🚀 Aktif: ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        await rest.put(Routes.applicationCommands(client.user.id), {
            body: slashCommands
        });

        console.log('📡 Slash komutlar yüklendi');
    } catch (err) {
        console.error(err);
    }
});

// --- INTERACTION FIXED ---
client.on('interactionCreate', async (interaction) => {

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // SAFE PERMISSION CHECK
    if (command.requiredPerms?.length) {

        if (!interaction.inGuild()) {
            return interaction.reply({
                content: 'Bu komut sadece sunucuda kullanılır.',
                ephemeral: true
            });
        }

        const perms = interaction.memberPermissions;

        if (!perms) {
            return interaction.reply({
                content: 'İzin bilgisi alınamadı.',
                ephemeral: true
            });
        }

        const hasPerm = command.requiredPerms.some(p => perms.has(p));

        if (!hasPerm) {
            return interaction.reply({
                content: 'Yetkin yok.',
                ephemeral: true
            });
        }
    }

    try {
        await command.execute(interaction);
    } catch (err) {
        console.error(err);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'Hata oluştu.',
                ephemeral: true
            });
        }
    }

    // BUTTON HANDLER
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const cmd = client.commands.get('destek-kur');
        if (cmd?.interactionHandler) {
            cmd.interactionHandler(interaction).catch(() => {});
        }
    }
});

// --- EVENTS LOADER ---
const eventsPath = './events';

if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

    for (const file of eventFiles) {
        const ev = require(`./events/${file}`);

        if (typeof ev === 'function') {
            ev(client);
        }
    }
}

// --- LOGIN ---
client.login(process.env.TOKEN);
