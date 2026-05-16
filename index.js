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
        GatewayIntentBits.MessageContent, 
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
// 🔥 MODERN V14 TÜM KANALLARI TARAYAN KÜFÜR ENGELLEME MOTORU (RAM TABANLI)
// =========================================================================
const sistemBellegi = new Map();

client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    // RAM Bellekten sunucu kontrolü yap
    const sunucuAyari = sistemBellegi.get(message.guild.id);
    if (!sunucuAyari || !sunucuAyari.durum) return;

    // Yönetici ve Mesajları Yönet yetkisi olan yetkilileri es geç
    if (message.member.permissions.has('Administrator') || message.member.permissions.has('ManageMessages')) return;

    // Gelişmiş küfür ve argo kelime listesi
    const kufurler = ['amk', 'aq', 'orospu', 'piç', 'sik', 'yarrak', 'göt', 'amcık', 'meme', 'fuck', 'bitch', 'sktir', 'pç', 'orospuçocuğu', 'oc'];
    
    const hamMesaj = message.content.toLowerCase();
    
    // Boşlukları, noktaları ve özel karakterleri eritir (Örn: "a.m.k" veya "a m k" -> "amk")
    const birlesikMesaj = hamMesaj.replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]/g, '');

    // Harf uzatmalarını teke indirir (Örn: "amkkkkkk" -> "amk")
    const temizMesaj = birlesikMesaj.replace(/(.)\1+/g, '$1');

    // Saniyede filtre kontrolü
    const kufurYakalandi = kufurler.some(kufur => 
        hamMesaj.includes(kufur) || 
        birlesikMesaj.includes(kufur) || 
        temizMesaj.includes(kufur)
    );

    if (kufurYakalandi) {
        try {
            // 1. Mesajı saniyesinde siler
            await message.delete();
            
            // 2. Kanala uyarı mesajı gönderir
            const uyari = await message.channel.send(`⚠️ ${message.author}, **Bu sunucuda küfür etmek yasaktır! Filtre saniyede yakalar.**`);
            setTimeout(() => uyari.delete().catch(() => {}), 4000);

            // 3. Log kanalına detaylı embed gönderir
            let logKanali = message.guild.channels.cache.get(sunucuAyari.logKanalId) || 
                            message.guild.channels.cache.find(c => c.name.includes('mod-log') || c.name.includes('bot-log') || c.name.includes('log'));
            
            if (logKanali) {
                const embed = new EmbedBuilder()
                    .setColor('#ff3333')
                    .setTitle('🤬 Küfür Filtresi Yakaladı')
                    .addFields(
                        { name: 'Kullanıcı:', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
                        { name: 'Kanal:', value: `${message.channel}`, inline: true },
                        { name: 'Engellenen Mesaj:', value: `\`\`\`${message.content}\`\`\`` }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'TSA Otomatik Küfür Filtre Sistemi' });

                await logKanali.send({ embeds: [embed] }).catch(() => {});
            }
        } catch (err) {
            console.error('Küfür temizleme motorunda hata:', err);
        }
    }
});

// Slash komut dosyasının RAM belleğe erişebilmesi için dışa aktarıyoruz
client.sistemBellegi = sistemBellegi;

// =========================================================================
// 🔥 DIŞ DOSYA BAĞLANTILARI
// =========================================================================
require('./events/gelismislog')(client);

client.login(process.env.TOKEN);
