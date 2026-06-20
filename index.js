const { Client, GatewayIntentBits, Collection, REST, Routes, Partials } = require('discord.js');
const { verifyKey } = require('discord-interactions');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express'); 
const Storage = require('./services/storage');
const registerDatastoreEvents = require('./services/datastore-events');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000; 

// 1. CLIENT & COMMAND SETUP (İstek gelmeden önce komutları hafızaya yüklüyoruz kanka)
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

// Vercel imza doğrulaması için ham gövdeyi (rawBody) koruyoruz
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

    const isVerified = verifyKey(
        req.rawBody || JSON.stringify(req.body),
        signature,
        timestamp,
        process.env.PUBLIC_KEY
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

        // Kanka burası sihirli nokta! commands/ klasöründeki kodların kırılmasın diye sahte bir interaction objesi üretiyoruz.
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
            // interaction.reply() fonksiyonunu Express'in res.send() methoduna bağlıyoruz!
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
            // Ağır işlemler için deferReply() desteği
            async deferReply(options = {}) {
                if (this.deferred || this.replied) return;
                this.deferred = true;
                return res.send({ type: 5, data: { flags: options.ephemeral ? 64 : 0 } });
            },
            // deferReply sonrasında mesajı güncellemek için editReply() desteği
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

        // Gerçek komut dosyanı çalıştırıyoruz kanka!
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

app.listen(PORT, () => {
    console.log(`📡 [WEB] Vercel Köprüsü Aktif! Port: ${PORT}`);
});

// Arka planda veritabanı veya diğer eventleri başlatmak istersen tetikleyici
client.storage = Storage;
if (typeof registerDatastoreEvents === 'function') {
    registerDatastoreEvents(client);
}

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
