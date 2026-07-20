const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
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
    console.log("⚠️ Storage servisi yüklenemedi, Map kullanılıyor.");
    Storage = new Map();
}

let registerDatastoreEvents;
try {
    registerDatastoreEvents = require('./services/datastore-events');
} catch (e) {
    registerDatastoreEvents = null;
}

// 1. CLIENT SETUP
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

// 2. KOMUTLARI YÜKLEME VE DİSCORD'A KAYDETME
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
    for (const file of commandFiles) {
        try {
            const cmd = require(path.join(commandsPath, file));
            if (cmd.data && cmd.execute) {
                client.commands.set(cmd.data.name, cmd);
                slashCommands.push(cmd.data.toJSON());
                console.log(`✅ Komut yüklendi: ${cmd.data.name}`);
            }
        } catch (err) {
            console.error(`Komut yüklenirken hata oluştu (${file}):`, err);
        }
    }
}

// Bot açıldığında komutları Discord'a global olarak kaydet
client.once('ready', async () => {
    console.log(`🤖 Bot başarıyla giriş yaptı: ${client.user.tag} (Aktif!)`);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('🔄 Slash komutları Discord\'a kaydediliyor...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: slashCommands },
        );
        console.log('✨ Slash komutları başarıyla yüklendi!');
    } catch (error) {
        console.error('Komut kaydetme hatası:', error);
    }
});

// Express Raw Body Ayarı (Discord İmza Doğrulaması İçin)
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.get('/', (req, res) => {
    res.send('TSA Sistemi Aktif ve Görevde! ✅');
});

// 3. DISCORD WEBHOOK INTERACTIONS KÖPRÜSÜ
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

    // Discord Ping (Bağlantı Testi)
    if (type === 1) { 
        return res.send({ type: 1 });
    }

    // Slash Komut Çalıştırıldığında
    if (type === 2) {
        const commandName = data.name;
        const command = client.commands.get(commandName);
        
        if (!command) {
            return res.send({
                type: 4,
                data: { content: '❌ Bu komut sistemde bulunamadı.' }
            });
        }

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
                    return o && req.body.data.resolved?.members ? req.body.data.resolved.members[o.Developer] : null;
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

client.storage = Storage;
if (typeof registerDatastoreEvents === 'function') {
    registerDatastoreEvents(client);
}

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

// 4. SUNUCUYU BAŞLAT VE DİSCORD'A GİRİŞ YAP
app.listen(PORT, () => {
    console.log(`📡 Server aktif ve ${PORT} portunu dinliyor.`);
});

// 🎯 BOTUN DİSCORD'DA AKTİF GÖRÜNMESİNİ SAĞLAYAN KRİTİK SATIR
client.login(process.env.TOKEN);

module.exports = app;
