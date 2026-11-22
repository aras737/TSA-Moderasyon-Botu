const { Client, GatewayIntentBits, Collection, PermissionFlagsBits, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.DirectMessages
    ]
});

client.commands = new Collection();
const slashCommands = [];

function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) {
        console.warn(`⚠️ Commands klasörü bulunamadı: ${commandsPath}`);
        return;
    }

    for (const file of fs.readdirSync(commandsPath).filter(name => name.endsWith('.js'))) {
        try {
            const command = require(path.join(commandsPath, file));
            if (!command.data || typeof command.execute !== 'function') {
                console.warn(`⚠️ Komut yüklenmedi: ${file} (data/execute eksik)`);
                continue;
            }

            const data = command.data.toJSON();
            if (client.commands.has(data.name)) {
                console.warn(`⚠️ Yinelenen komut adı atlandı: ${data.name}`);
                continue;
            }

            client.commands.set(data.name, command);
            slashCommands.push(data);
            console.log(`✅ Komut yüklendi: ${data.name}`);
        } catch (error) {
            console.error(`❌ Komut yüklenemedi (${file}):`, error);
        }
    }

    console.log(`📋 Toplam ${slashCommands.length} komut yüklendi.`);
}

function loadEvents() {
    // Eski botengel.js ve girisCikisSistemi.js modülleri aynı olayları
    // tekrar işlediği için yüklenmiyor. Tek bir anti-bot ve giriş/çıkış
    // akışı kullanılıyor.
    const eventModules = [
        'antibot.js',
        'gelismislog.js',
        'giriscikis.js',
        'korumasistemleri.js'
    ];
    const eventsPath = path.join(__dirname, 'events');

    for (const file of eventModules) {
        try {
            const register = require(path.join(eventsPath, file));
            if (typeof register === 'function') {
                register(client);
                console.log(`✅ Olay modülü yüklendi: ${file}`);
            }
        } catch (error) {
            console.error(`❌ Olay modülü yüklenemedi (${file}):`, error);
        }
    }
}

loadCommands();

// Voice-panel buttons must remain operational after every restart,
// even when the setup slash command has not been run again.
const sesPanelCommand = client.commands.get('ses-paneli-kur');
if (typeof sesPanelCommand?.register === 'function') {
    try {
        sesPanelCommand.register(client);
        console.log('✅ TMF geçici ses odası olayları hazır.');
    } catch (error) {
        console.error('❌ Ses odası olayları başlatılamadı:', error);
    }
}

let Storage;
try {
    Storage = require('./services/storage');
    client.storage = Storage;
    require('./services/datastore-events')(client);
} catch (error) {
    console.error('❌ Kalıcı veri sistemi yüklenemedi:', error);
    process.exit(1);
}

loadEvents();

app.get('/', (_req, res) => {
    res.status(200).send('TMF Moderasyon Sistemi Aktif! ✅');
});

// Render liveness probe: HTTP process is alive even while Discord is reconnecting.
app.get('/health', (_req, res) => {
    const ready = client.isReady();
    res.status(200).json({
        ok: true,
        process: 'alive',
        discord: ready ? 'ready' : 'connecting',
        bot: ready ? client.user.tag : null,
        commands: slashCommands.length
    });
});

// Optional readiness probe for diagnostics; do not use this as Render's liveness check.
app.get('/ready', (_req, res) => {
    const ready = client.isReady();
    res.status(ready ? 200 : 503).json({
        ok: ready,
        status: ready ? 'ready' : 'connecting',
        bot: ready ? client.user.tag : null,
        commands: slashCommands.length
    });
});

const server = app.listen(PORT, () => {
    console.log(`📡 Web sağlık sunucusu ${PORT} portunda çalışıyor.`);
});

client.once('ready', async () => {
    console.log(`✅ Bot giriş yaptı: ${client.user.tag}`);

    if (slashCommands.length === 0) {
        console.warn('⚠️ Kaydedilecek slash komutu bulunamadı.');
        return;
    }

    try {
        const applicationId = client.application?.id || process.env.APPLICATION_ID;
        if (!applicationId) {
            throw new Error('Application ID alınamadı. APPLICATION_ID ortam değişkenini kontrol et.');
        }

        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        console.log(`🔄 ${slashCommands.length} slash komutu kaydediliyor...`);

        const registered = await rest.put(
            Routes.applicationCommands(applicationId),
            { body: slashCommands }
        );

        console.log(`✅ ${registered.length} slash komut kaydedildi.`);
    } catch (error) {
        console.error('❌ Slash komut kayıt hatası:', error);
    }
});

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                return interaction.reply({
                    content: '❌ Bu komut sistemde bulunamadı.',
                    ephemeral: true
                });
            }

            if (!interaction.inGuild()) {
                return interaction.reply({
                    content: '⛔ Bu komut yalnızca bir Discord sunucusunda kullanılabilir.',
                    ephemeral: true
                });
            }

            if (Array.isArray(command.requiredPerms) && command.requiredPerms.length > 0) {
                const permissions = interaction.memberPermissions;
                const isAdmin = permissions?.has(PermissionFlagsBits.Administrator) === true;
                const hasRequiredPermission = command.requiredPerms.some(permission => permissions?.has(permission));

                if (!interaction.inGuild() || (!isAdmin && !hasRequiredPermission)) {
                    return interaction.reply({
                        content: '⛔ Bu komutu kullanmak için gerekli sunucu yetkisine sahip değilsin.',
                        ephemeral: true
                    });
                }
            }

            console.log(`🔨 /${interaction.commandName} | ${interaction.user.tag}`);
            await command.execute(interaction);
            return;
        }

        if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
            for (const command of client.commands.values()) {
                if (typeof command.interactionHandler !== 'function') continue;
                await command.interactionHandler(interaction);

                if (interaction.replied || interaction.deferred) break;
            }
        }
    } catch (error) {
        console.error('❌ Etkileşim hatası:', error);
        const response = {
            content: `💥 İşlem sırasında hata oluştu: \`${error?.message || 'Bilinmeyen hata'}\``
        };

        try {
            if (interaction.deferred) {
                await interaction.editReply(response);
            } else if (interaction.replied) {
                await interaction.followUp({ ...response, ephemeral: true });
            } else if (interaction.isRepliable()) {
                await interaction.reply({ ...response, ephemeral: true });
            }
        } catch (replyError) {
            console.error('❌ Hata yanıtı gönderilemedi:', replyError);
        }
    }
});

client.on('shardReconnecting', shardId => {
    console.warn('🔄 Discord shard yeniden bağlanıyor:', shardId);
});
client.on('shardDisconnect', (event, shardId) => {
    console.warn('⚠️ Discord shard bağlantısı kesildi:', shardId, event?.code || '');
});
client.on('shardError', (error, shardId) => {
    console.error('❌ Discord shard hatası:', shardId, error);
});
client.on('warn', warning => console.warn('⚠️ Discord uyarısı:', warning));
client.on('error', error => console.error('❌ Discord istemci hatası:', error));
process.on('unhandledRejection', error => console.error('❌ Yakalanmamış Promise hatası:', error));
process.on('uncaughtException', error => console.error('❌ Yakalanmamış işlem hatası:', error));

function shutdown(signal) {
    console.log(`🛑 ${signal} alındı. TMF kapatılıyor...`);
    server.close(() => {
        client.destroy();
        process.exit(0);
    });
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

if (!process.env.TOKEN) {
    console.error('❌ TOKEN ortam değişkeni bulunamadı!');
    process.exit(1);
}

client.login(process.env.TOKEN).catch(error => {
    console.error('❌ Bot girişi başarısız:', error);
    process.exit(1);
});

console.log('🚀 TMF başlatılıyor...');
