const { REST, Routes } = require('discord.js');
const { verifyKey } = require('discord-interactions');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express'); 

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000; 

// Güvenli Storage yüklemesi
let Storage;
try {
    Storage = require('./services/storage');
} catch (e) {
    Storage = new Map();
}

let registerDatastoreEvents;
try {
    registerDatastoreEvents = require('./services/datastore-events');
} catch (e) {
    registerDatastoreEvents = null;
}

// Komutları belleğe yükleme map'i
const commands = new Map();
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
    for (const file of commandFiles) {
        try {
            const cmd = require(path.join(commandsPath, file));
            if (cmd.data && cmd.execute) {
                commands.set(cmd.data.name, cmd);
            }
        } catch (err) {
            console.error(`Komut yüklenirken hata (${file}):`, err);
        }
    }
}

// Express Raw Body (İmza doğrulaması için hayati önem taşır)
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.get('/', (req, res) => {
    res.send('TSA Sistemi Aktif ve Görevde! ✅');
});

// DISCORD INTERACTIONS WEBHOOK ENDPOINT
app.post('/interactions', async (req, res) => {
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    
    if (!signature || !timestamp) {
        return res.status(401).send('Eksik imza.');
    }

    const publicKey = process.env.PUBLIC_KEY;
    if (!publicKey) {
        return res.status(500).send('Sunucu ayarı eksik (PUBLIC_KEY).');
    }

    // Güvenlik imza doğrulaması
    const isVerified = verifyKey(
        req.rawBody || JSON.stringify(req.body),
        signature,
        timestamp,
        publicKey
    );
    
    if (!isVerified) {
        return res.status(401).send('Geçersiz imza.');
    }

    const body = req.body;

    // 1. PING (Discord test isteği)
    if (body.type === 1) {
        return res.json({ type: 1 });
    }

    // 2. APPLICATION COMMAND (Slash komut tetiklendiğinde)
    if (body.type === 2) {
        const { data, guild_id, channel_id, member, user, token, application_id } = body;
        const commandName = data.name;
        const command = commands.get(commandName);

        if (!command) {
            return res.json({
                type: 4,
                data: { content: '❌ Bu komut sistemde bulunamadı.' }
            });
        }

        let isResponded = false;

        // Komutların sorunsuz çalışması için gelişmiş Mock Interaction objesi
        const mockInteraction = {
            commandName,
            guildId: guild_id,
            channelId: channel_id,
            user: member ? member.user : user,
            member,
            options: {
                _options: data.options || [],
                get(name) { return this._options.find(o => o.name === name); },
                getString(name) { const o = this.get(name); return o ? String(o.value) : null; },
                getInteger(name) { const o = this.get(name); return o ? Number(o.value) : null; },
                getBoolean(name) { const o = this.get(name); return o ? Boolean(o.value) : null; },
                getUser(name) {
                    const o = this.get(name);
                    return o && body.data.resolved?.users ? body.data.resolved.users[o.value] : null;
                },
                getMember(name) {
                    const o = this.get(name);
                    return o && body.data.resolved?.members ? body.data.resolved.members[o.value] : null;
                },
                getChannel(name) {
                    const o = this.get(name);
                    return o && body.data.resolved?.channels ? body.data.resolved.channels[o.value] : null;
                }
            },
            async reply(content) {
                if (isResponded) return;
                isResponded = true;

                let responseData = {};
                if (typeof content === 'string') {
                    responseData = { content };
                } else {
                    responseData = {
                        content: content.content || '',
                        embeds: content.embeds || [],
                        flags: content.ephemeral ? 64 : 0
                    };
                }
                return res.json({ type: 4, data: responseData });
            },
            async deferReply(options = {}) {
                if (isResponded) return;
                isResponded = true;
                return res.json({ type: 5, data: { flags: options.ephemeral ? 64 : 0 } });
            },
            async editReply(content) {
                let responseData = {};
                if (typeof content === 'string') {
                    responseData = { content };
                } else {
                    responseData = { content: content.content || '', embeds: content.embeds || [] };
                }
                try {
                    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
                    await rest.patch(Routes.webhookMessage(application_id, token, '@original'), { body: responseData });
                } catch (err) {
                    console.error('editReply Hatası:', err);
                }
            }
        };

        try {
            await command.execute(mockInteraction);
        } catch (err) {
            console.error(`Komut çalıştırma hatası (${commandName}):`, err);
            if (!isResponded) {
                return res.json({
                    type: 4,
                    data: { content: '💥 Komut çalıştırılırken teknik bir hata oluştu!', flags: 64 }
                });
            }
        }
    }
});

const clientStorage = Storage;
if (typeof registerDatastoreEvents === 'function' && clientStorage) {
    // Gerekirse event kayıtları yapılabilir
}

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

app.listen(PORT, () => {
    console.log(`📡 Webhook Sunucusu aktif ve ${PORT} portunu dinliyor.`);
});

module.exports = app;
