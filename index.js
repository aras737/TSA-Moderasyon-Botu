const { Client, GatewayIntentBits, Collection, REST, Routes, Partials } = require('discord.js');
const { verifyKey } = require('discord-interactions');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express'); 

// Render'ın dosya sisteminde yolların kırılmaması için try-catch ile güvenli require yapıyoruz kanka
let Storage;
try {
    Storage = require('./services/storage');
} catch (e) {
    console.log("⚠️ Storage servisi yüklenemedi, boş obje atandı.");
    Storage = new Map();
}

let registerDatastoreEvents;
try {
    registerDatastoreEvents = require('./services/datastore-events');
} catch (e) {
    registerDatastoreEvents = null;
}

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000; 

// 1. CLIENT & COMMAND SETUP (Render mutlak yol senaryosu)
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

// 💡 ÇÖKME ÇÖZÜMÜ: Klasör yolunu absolute (tam) hale getiriyoruz ki Render bulabilsin
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
    for (const file of commandFiles) {
        try {
            const cmd = require(path.join(commandsPath, file));
            if (cmd.data && cmd.execute) {
                client.commands.set(cmd.data.name, cmd);
                slashCommands.push(cmd.data.toJSON());
            }
        } catch (err) {
            console.error(`Komut yüklenirken hata oluştu (${file}):`, err);
        }
    }
}

// Render imza doğrulaması için ham gövdeyi (rawBody) koruyoruz
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.get('/', (req, res) => {
    res.send('TSA Sistemi Aktif ve Görevde! ✅');
});

// 2. DISCORD WEBHOOK INTERACTION KÖPRÜSÜ
app.post('/interactions', async (req, res) => {
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    
    if (!signature || !timestamp) return res.status(401).send('Eksik imza.');

    const publicKey = process.env.PUBLIC_KEY;
    if (!publicKey) {
        return res.status(500).send('Sunucu ayarı eksik (PUBLIC_KEY).');
    }

    const isVerified = verifyKey(
        req.rawBody || JSON.stringify(req.body),
        signature,
        timestamp,
        publicKey
    );
    
    if (!isVerified) return res.status(401).send('Geçersiz imza.');

    const { type, data, guild_id, channel_id, member, user, token, application_id } = req.body;

    // Discord Portal Doğrulama PING'i
    if (type === 1) { 
        return res.send({ type: 1 });
    }

    // SLASH KOMUT TETİKLENDİĞİNDE (Type 2)
    if (type === 2) {
        const commandName = data.name;
        const command = client.commands.get(commandName);
        
        if (!command) {
            return res.send({
                type: 4,
                data: { content: '❌ Bu komut sistemde bulunamadı.' }
            });
        }

        // Klasördeki kodların kırılmaması için sahte (mock) bir interaction objesi üretiyoruz
        const mockInteraction = {
            commandName: commandName,
            guildId: guild_id,
            channelId: channel_id,
            user: member ? member.user : user,
            member: member,
            replied: false,
            deferred: false,
            options: {
                _options: data.options || [],
                get(name) { return this._options.find(o => o.name === name); },
                getString(name) { const o = this.get(name); return o ? String(o.value) : null; },
                getInteger(name) { const o = this.get(name); return o ? Number(o.value) : null; },
                getBoolean(name) { const o = this.get(name); return o ? Boolean(o.value) : null; },
                getUser(name) {
                    const o = this.get(name);
                    return o && req.body.data.resolved?.users ? req.body.data.resolved.users[o.value] : null;
                },
                getMember(name) {
                    const o = this.get(name);
                    return o && req.body.data.resolved?.members ? req.body.data.resolved.members[o.value] : null;
                },
                getChannel(name) {
                    const o = this.get(name);
                    return o && req.body.data.resolved?.channels ? req.body.data.resolved.channels[o.value] : null;
                }
            },
            async reply(content) {
                if (this.replied) return;
                this.replied = true;
                
                let responseData = {};
                if (typeof content === 'string') {
                    responseData = { content: content };
                } else {
                    responseData = {
                        content: content.content || '',
                        embeds: content.embeds || [],
                        ephemeral: content.ephemeral ? 64 : 0
                    };
                }
                return res.send({ type: 4, data: responseData });
            },
            async deferReply(options = {}) {
                if (this.deferred || this.replied) return;
                this.deferred = true;
                return res.send({ type: 5, data: { flags: options.ephemeral ? 64 : 0 } });
            },
            async editReply(content) {
                let responseData = {};
                if (typeof content === 'string') {
                    responseData = { content: content };
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

        // Gerçek komut dosyanı tetikliyoruz
        try {
            await command.execute(mockInteraction);
        } catch (err) {
            console.error(`Komut hatası (${commandName}):`, err);
            if (!mockInteraction.replied) {
                return res.send({
                    type: 4,
                    data: { content: '💥 Komut çalıştırılırken teknik bir hata oluştu!', flags: 64 }
                });
            }
        }
    }
});

// Render için port dinleme (Render'da sunucunun açık kalması için şarttır)
app.listen(PORT, () => {
    console.log(`📡 Render Port aktif: ${PORT}`);
});

client.storage = Storage;
if (typeof registerDatastoreEvents === 'function') {
    registerDatastoreEvents(client);
}

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

// 🎯 EN KRİTİK NOKTA: Render'ın çökmesini engelleyen asıl ihracat satırı!
module.exports = app;
