const {
    Client,
    GatewayIntentBits,
    Collection,
    PermissionFlagsBits,
    REST,
    Routes,
    MessageFlags
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

require('dotenv').config();

if (!process.env.TOKEN) {
    console.error('❌ TOKEN ortam değişkeni bulunamadı. Bot başlatılmadı.');
    process.exit(1);
}

const app = express();
app.disable('x-powered-by');
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
let isShuttingDown = false;
let commandRegistrationPromise = null;

function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) {
        throw new Error(`Komut klasörü bulunamadı: ${commandsPath}`);
    }

    for (const file of fs.readdirSync(commandsPath).filter(name => name.endsWith('.js')).sort()) {
        try {
            const command = require(path.join(commandsPath, file));
            if (!command.data || typeof command.execute !== 'function') {
                console.error(`❌ Komut yüklenmedi: ${file} (data/execute eksik)`);
                continue;
            }

            const data = command.data.toJSON();
            if (!data.name || client.commands.has(data.name)) {
                console.error(`❌ Yinelenen/geçersiz komut adı: ${data.name || file}`);
                continue;
            }

            client.commands.set(data.name, command);
            slashCommands.push(data);
            console.log(`✅ Komut yüklendi: /${data.name}`);
        } catch (error) {
            console.error(`❌ Komut yüklenemedi (${file}):`, error);
        }
    }

    console.log(`📋 Toplam ${slashCommands.length} komut yüklendi.`);
}

function loadEvents() {
    // Aynı Discord olaylarını iki kez çalıştıran eski modüller bilerek yüklenmez.
    // Anti-Raid modülünün içeriği ve davranışı bu düzenlemede değiştirilmemiştir.
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
            if (typeof register !== 'function') {
                console.error(`❌ Olay modülü geçersiz: ${file}`);
                continue;
            }
            register(client);
            console.log(`✅ Olay modülü yüklendi: ${file}`);
        } catch (error) {
            console.error(`❌ Olay modülü yüklenemedi (${file}):`, error);
        }
    }
}

loadCommands();

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

    if (process.env.RENDER === 'true' && !process.env.DATA_DIR) {
        console.warn(
            '⚠️ [STORAGE] DATA_DIR ayarlı değil. Render dosya sistemi kalıcı olmayabilir; ' +
            'ayarlar ve Anti-Raid yedekleri yeniden başlatma/deploy sonrası kaybolabilir.'
        );
    }

    require('./services/datastore-events')(client);
} catch (error) {
    console.error('❌ Veri sistemi başlatılamadı:', error);
    process.exit(1);
}

loadEvents();

app.get('/', (_req, res) => {
    res.status(200).send('TMF Moderasyon Sistemi Aktif! ✅');
});

// Liveness: HTTP process ayakta mı? Render sağlık kontrolü bu endpoint'i kullanır.
app.get('/health', (_req, res) => {
    const ready = client.isReady();
    res.status(200).json({
        ok: true,
        process: 'alive',
        discord: ready ? 'ready' : 'connecting',
        bot: ready ? client.user.tag : null,
        commands: slashCommands.length,
        uptimeSeconds: Math.floor(process.uptime())
    });
});

// Readiness: Discord bağlantısı hazır değilse 503 döndürür.
app.get('/ready', (_req, res) => {
    const ready = client.isReady();
    res.status(ready ? 200 : 503).json({
        ok: ready,
        status: ready ? 'ready' : 'connecting',
        bot: ready ? client.user.tag : null,
        commands: slashCommands.length
    });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`📡 TMF sağlık sunucusu ${PORT} portunda çalışıyor.`);
});

async function registerSlashCommands() {
    if (commandRegistrationPromise) return commandRegistrationPromise;

    commandRegistrationPromise = (async () => {
        if (!client.application?.id) {
            throw new Error('Discord Application ID hazır değil.');
        }
        if (slashCommands.length === 0) {
            throw new Error('Kaydedilecek slash komutu bulunamadı.');
        }

        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        console.log(`🔄 ${slashCommands.length} slash komutu Discord'a kaydediliyor...`);

        const registered = await rest.put(
            Routes.applicationCommands(client.application.id),
            { body: slashCommands }
        );

        console.log(`✅ ${registered.length} slash komut Discord'a kaydedildi.`);
        return registered;
    })();

    try {
        return await commandRegistrationPromise;
    } catch (error) {
        commandRegistrationPromise = null;
        throw error;
    }
}

client.once('clientReady', async () => {
    console.log(`✅ Bot Discord'a giriş yaptı: ${client.user.tag}`);
    try {
        await registerSlashCommands();
    } catch (error) {
        console.error('❌ Slash komut kayıt hatası:', error);
    }
});

async function sendInteractionError(interaction, content) {
    if (!interaction.isRepliable()) return;

    try {
        if (interaction.deferred) {
            await interaction.editReply({ content });
        } else if (interaction.replied) {
            await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content, flags: MessageFlags.Ephemeral });
        }
    } catch (error) {
        console.error('❌ Etkileşim hata mesajı gönderilemedi:', error);
    }
}

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                return sendInteractionError(interaction, '❌ Bu komut botun mevcut sürümünde bulunamadı. Biraz sonra tekrar dene.');
            }

            if (!interaction.inGuild()) {
                return sendInteractionError(interaction, '⛔ Bu komut yalnızca bir Discord sunucusunda kullanılabilir.');
            }

            if (Array.isArray(command.requiredPerms) && command.requiredPerms.length > 0) {
                const permissions = interaction.memberPermissions;
                const isAdmin = permissions?.has(PermissionFlagsBits.Administrator) === true;
                const hasAllRequiredPermissions = command.requiredPerms.every(permission => permissions?.has(permission));

                if (!isAdmin && !hasAllRequiredPermissions) {
                    return sendInteractionError(interaction, '⛔ Bu komutu kullanmak için gerekli sunucu yetkilerine sahip değilsin.');
                }
            }

            const startedAt = Date.now();
            console.log(`📥 Komut alındı: /${interaction.commandName} | ${interaction.user.tag} | ${interaction.id}`);

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`❌ Komut hatası: /${interaction.commandName} | ${interaction.id}`, error);
                await sendInteractionError(interaction, '💥 Komut çalıştırılırken hata oluştu. Hata kaydedildi; daha sonra tekrar dene.');
                return;
            }

            const acknowledged = interaction.replied || interaction.deferred;
            console.log(
                `${acknowledged ? '✅' : '⚠️'} Komut tamamlandı: /${interaction.commandName} | ` +
                `${Date.now() - startedAt}ms | ${interaction.replied ? 'replied' : interaction.deferred ? 'deferred' : 'yanıtsız'}`
            );

            if (!acknowledged) {
                await sendInteractionError(interaction, '⚠️ Komut yanıt üretmedi. Lütfen tekrar dene.');
            }
            return;
        }

        if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
            for (const command of client.commands.values()) {
                if (typeof command.interactionHandler !== 'function') continue;
                if (interaction.replied || interaction.deferred) break;

                await command.interactionHandler(interaction);
            }

            if (!interaction.replied && !interaction.deferred && interaction.isRepliable()) {
                // Bilinmeyen/eski panel butonları sessizce beklemede kalmasın.
                if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
                    await sendInteractionError(interaction, '⚠️ Bu panel etkileşimi tanınmadı veya süresi doldu. Paneli yeniden açmayı dene.');
                }
            }
        }
    } catch (error) {
        console.error('❌ Etkileşim işleyici hatası:', error);
        await sendInteractionError(interaction, '💥 İşlem sırasında beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar dene.');
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

process.on('uncaughtException', error => {
    console.error('❌ Yakalanmamış işlem hatası; süreç güvenli biçimde kapatılıyor:', error);
    shutdown('uncaughtException');
});

function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`🛑 ${signal} alındı. TMF güvenli şekilde kapatılıyor...`);

    try {
        const flushed = Storage?.flushQueuedLogs?.() || 0;
        if (flushed) console.log(`💾 ${flushed} bekleyen veri kaydı diske yazıldı.`);
    } catch (error) {
        console.error('❌ Bekleyen veriler kaydedilemedi:', error);
    }

    const forceExit = setTimeout(() => {
        console.error('⚠️ Kapatma zaman aşımı. Süreç sonlandırılıyor.');
        client.destroy();
        process.exit(1);
    }, 10000);
    forceExit.unref();

    server.close(() => {
        client.destroy();
        clearTimeout(forceExit);
        process.exit(0);
    });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

client.login(process.env.TOKEN).catch(error => {
    console.error('❌ Discord bot girişi başarısız:', error);
    process.exit(1);
});

console.log('🚀 TMF başlatılıyor...');
