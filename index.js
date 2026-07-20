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

// 1. CLIENT & COMMAND SETUP (Render sunucu senaryosu)
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
                console.log(`✅ Komut yüklendi: ${cmd.data.name}`);
            } else {
                console.warn(`⚠️ Komut eksik özellik: ${file} (data ve execute gerekli)`);
            }
        } catch (err) {
            console.error(`❌ Komut yüklenirken hata oluştu (${file}):`, err.message || err);
        }
    }
    console.log(`📋 Toplam ${slashCommands.length} komut yüklendi.`);
} else {
    console.warn(`⚠️ Commands klasörü bulunamadı: ${commandsPath}`);
}

// İmza doğrulaması için ham gövdeyi (rawBody) koruyoruz
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
            console.warn(`⚠️ Komut bulunamadı: ${commandName}`);
            return res.send({
                type: 4,
                data: { content: '❌ Bu komut sistemde bulunamadı.' }
            });
        }

        console.log(`🔨 Komut çalıştırılıyor: ${commandName} (Kullanıcı: ${user?.username || member?.user?.username})`);

        // Klasördeki kodların kırılmaması için sahte (mock) bir interaction objesi üretiyoruz
        const mockInteraction = {
            commandName: commandName,
            guildId: guild_id,
            channelId: channel_id,
            user: member ? member.user : user,
            member: member,
            guild: { id: guild_id },
            replied: false,
            deferred: false,
            client: client,
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
                if (this.replied) {
                    console.warn('⚠️ reply() zaten çağrıldı, yeniden çağrılamaz');
                    return;
                }
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
                if (this.deferred || this.replied) {
                    console.warn('⚠️ deferReply() zaten çağrıldı, yeniden çağrılamaz');
                    return;
                }
                this.deferred = true;
                res.send({ type: 5, data: { flags: options.ephemeral ? 64 : 0 } });
                // fetchReply: true yerine obje dönüyoruz
                return { createdTimestamp: Date.now() };
            },
            async editReply(content) {
                if (!this.deferred) {
                    console.warn('⚠️ editReply() çağrılmadan önce deferReply() çağrılmalı');
                    return;
                }
                
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
                    console.error('❌ editReply Hatası:', err.message || err);
                }
            }
        };

        // Gerçek komut dosyanı tetikliyoruz
        try {
            await command.execute(mockInteraction);
            console.log(`✅ Komut başarıyla çalıştırıldı: ${commandName}`);
        } catch (err) {
            console.error(`❌ Komut hatası (${commandName}):`, err.message || err);
            console.error('Stack:', err.stack);
            if (!mockInteraction.replied && !mockInteraction.deferred) {
                return res.send({
                    type: 4,
                    data: { content: '💥 Komut çalıştırılırken teknik bir hata oluştu! Hata detayı: `' + (err.message || 'Bilinmeyen hata') + '`', flags: 64 }
                });
            } else if (mockInteraction.deferred) {
                try {
                    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
                    await rest.patch(Routes.webhookMessage(application_id, token, '@original'), {
                        body: { content: '💥 Komut çalıştırılırken teknik bir hata oluştu! Hata: `' + (err.message || 'Bilinmeyen hata') + '`' }
                    });
                } catch (err) {
                    console.error('Hata bilgisi gönderilemedi:', err.message);
                }
            }
        }
    }
});

// 🎯 EN KRİTİK NOKTA: Render bir "Web Service" olarak sürekli çalışan bir process
// beklediği için sunucuyu HER ZAMAN dinlemeye açıyoruz (Vercel'deki gibi serverless değil).
app.listen(PORT, () => {
    console.log(`📡 Render üzerinde port aktif: ${PORT}`);
});

client.storage = Storage;
if (typeof registerDatastoreEvents === 'function') {
    registerDatastoreEvents(client);
}

// Bot Discord'a bağlanıp aktif (online) göründüğünde bunu logluyoruz
client.once('ready', () => {
    console.log(`✅ Bot giriş yaptı ve aktif: ${client.user.tag}`);
    
    // Bot hazır olduktan sonra slash komutları register et (varsa)
    if (slashCommands.length > 0 && process.env.TOKEN && process.env.APPLICATION_ID) {
        registerSlashCommands();
    }
});

// Slash komutları Discord'a register et
async function registerSlashCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        console.log(`🔄 ${slashCommands.length} slash komut register ediliyor...`);
        
        const data = await rest.put(
            Routes.applicationCommands(process.env.APPLICATION_ID),
            { body: slashCommands }
        );
        
        console.log(`✅ ${data.length} slash komut başarıyla register edildi!`);
    } catch (error) {
        console.error('❌ Slash komut register hatası:', error.message || error);
    }
}

if (process.env.TOKEN) {
    client.login(process.env.TOKEN).catch((err) => {
        console.error('❌ Bot girişi başarısız oldu:', err);
    });
} else {
    console.log('⚠️ TOKEN env değişkeni bulunamadı, bot gateway girişi atlanıyor.');
}

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

module.exports = app;
