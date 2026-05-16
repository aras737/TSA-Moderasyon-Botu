const { Client, GatewayIntentBits, Collection, REST, Routes, Partials, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const express = require('express'); 
require('dotenv').config();

// --- 1. RENDER'I İKNA ETME SİSTEMİ (WEB SERVER) ---
const app = express();
const PORT = process.env.PORT || 3000; 

app.get('/', (req, res) => {
    res.send('TSA Sistemi Aktif ve 7/24 Görevde! ✅ Bilgisayar kapalı olsa bile bot yayında.');
});

app.listen(PORT, () => {
    console.log(`📡 [WEB] Render Portu Dinleniyor: ${PORT}`);
});

// --- 2. BOT YAPILANDIRMASI (FULL INTENTS) ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // 💬 Mesaj içeriğini taramak için şart!
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.User
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

// --- 3. KRİTİK HATA KORUMASI ---
process.on('unhandledRejection', (error) => {
    console.error('❌ [HATA]:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ [KRİTİK HATA]:', error);
});

// --- 4. READY EVENT ---
client.once('ready', async () => {
    console.log(`🚀 [TSA] ${client.user.tag} Aktif!`);
    
    setInterval(() => {
        console.log(`[TSA DURUM] Sistem Stabil | Saat: ${new Date().toLocaleTimeString('tr-TR')}`);
    }, 60000);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('📡 [TSA] Slash Komutları Yüklendi.');
    } catch (error) {
        console.error('❌ Slash Hatası:', error);
    }
});

// --- 5. ETKİLEŞİM YÖNETİMİ ---
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        if (command.requiredPerms) {
            const hasPerm = command.requiredPerms.some(p => interaction.member.permissions.has(p));
            if (!hasPerm) return interaction.reply({ content: '⚠️ Yetkin yetersiz kanka.', ephemeral: true });
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Hata oluştu!', ephemeral: true });
            }
        }
    }
    
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const biletKomutu = client.commands.get('destek-kur');
        if (biletKomutu?.interactionHandler) {
            await biletKomutu.interactionHandler(interaction).catch(() => {});
        }
    }
});

// =========================================================================
// 🔥 KÜFÜR ENGELLEME VE AKILLI LOG SİSTEMİ (DIREKT ENTEGRE)
// =========================================================================
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    // Yönetici veya mesajları yönet yetkisi olanları es geç
    if (message.member.permissions.has('Administrator') || message.member.permissions.has('ManageMessages')) return;

    // Kapsamlı Küfür Filtresi
    const kufurler = ['amk', 'aq', 'orospu', 'piç', 'sik', 'yarrak', 'göt', 'amcık', 'meme', 'fuck', 'bitch', 'sktir'];
    
    // Kelimeleri harf harf aralara nokta/boşluk koysalar bile yakalamak için temizleme
    const temizMesaj = message.content.toLowerCase().replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]/g, '');
    const kuralIhlali = kufurler.some(kufur => message.content.toLowerCase().includes(kufur) || temizMesaj.includes(kufur));

    if (kuralIhlali) {
        try {
            // 1. Mesajı sistemden temizle
            await message.delete();

            // 2. Kullanıcıyı geçici olarak uyar (5 saniye sonra silinir)
            const uyariMesaji = await message.channel.send(`⚠️ ${message.author}, **Bu sunucuda küfür etmek yasaktır!**`);
            setTimeout(() => uyariMesaji.delete().catch(() => {}), 5000);

            // 3. Slash komutuyla ayarlanan log kanalını otomatik bulma mantığı
            // Not: Altyapındaki slash komutunun kaydettiği yere göre db.get() veya local json kullanılabilir.
            // Şimdilik sistemde en çok tercih edilen dinamik kanal bulma veya default isim tarama mantığı ekli:
            let logKanali = message.guild.channels.cache.find(c => c.name.includes('mod-log') || c.name.includes('bot-log') || c.name.includes('log'));

            // Eğer veritabanı (db) modülü kullanıyorsan buraya `const logKanalId = db.get(...)` şeklinde de bağlayabiliriz kanka.
            if (logKanali) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#ff3333')
                    .setTitle('<a:alarme:1505209430319300718> Küfür Filtresi Tetiklendi!')
                    .addFields(
                        { name: 'Kullanıcı:', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
                        { name: 'Kanal:', value: `${message.channel}`, inline: true },
                        { name: 'Silinen Mesaj:', value: `\`\`\`${message.content}\`\`\`` }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'TSA Moderasyon Sistemi' });

                await logKanali.send({ embeds: [logEmbed] });
            }
        } catch (err) {
            console.error('Küfür sistemi log atarken hata yaşandı:', err);
        }
    }
});

// =========================================================================
// 🔥 DIŞ DOSYA BAĞLANTILARI
// =========================================================================
require('./events/gelismislog')(client); // Gelişmiş Log Sistemi aktif kanka

client.login(process.env.TOKEN);
