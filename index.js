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
// 🔥 GELİŞMİŞ TÜM MESAJLARI SANİYESİNDE TARAYAN KÜFÜR ENGELLEME MOTORU
// =========================================================================
const dbDosyaYolu = './kufur_ayarlar.json';
function dbOku() {
    if (!fs.existsSync(dbDosyaYolu)) fs.writeFileSync(dbDosyaYolu, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(dbDosyaYolu, 'utf-8'));
}

client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    // Ayarları dosyadan oku
    const ayarlar = dbOku();
    const sunucuAyari = ayarlar[message.guild.id];
    
    // Sunucuda sistem kapalıysa veya pasifse geç
    if (!sunucuAyari || !sunucuAyari.durum) return; 

    // Yetkilileri ve mesaj silme yetkisi olanları es geç
    if (message.member.permissions.has('Administrator') || message.member.permissions.has('ManageMessages')) return;

    // Genişletilmiş ve optimize edilmiş küfür listesi
    const kufurler = ['amk', 'aq', 'orospu', 'piç', 'sik', 'yarrak', 'göt', 'amcık', 'meme', 'fuck', 'bitch', 'sktir', 'pç', 'orospuçocuğu', 'oc'];
    
    // 1. ADIM: Tamamen küçük harfe çevir
    const hamMesaj = message.content.toLowerCase();

    // 2. ADIM: Nokta, sembol, emoji ve tüm boşlukları temizle (Her şeyi yapıştırır)
    // Örn: "a.m.k" ya da "a m k" yazılırsa direkt "amk" olur.
    const birlesikMesaj = hamMesaj.replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]/g, '');

    // 3. ADIM: Yan yana uzatılan harfleri teke indir (Harf uzatma hilesini bozar)
    // Örn: "amkkkkkk" veya "aaammmkkk" yazılırsa "amk" olur.
    const temizMesaj = birlesikMesaj.replace(/(.)\1+/g, '$1');

    // TARAMA MOTORU: Mesajın her varyasyonunu kelime kelime değil, saniyede baştan sona tarar
    const kuralIhlali = kufurler.some(kufur => 
        hamMesaj.includes(kufur) || 
        birlesikMesaj.includes(kufur) || 
        temizMesaj.includes(kufur)
    );

    if (kuralIhlali) {
        try {
            // Mesajı saniyesinde yok et
            await message.delete();
            
            const uyari = await message.channel.send(`⚠️ ${message.author}, **Bu sunucuda kelimelerine dikkat etmelisin! Küfür filtresi aktiftir.**`);
            setTimeout(() => uyari.delete().catch(() => {}), 4000);

            // Komutla ayarlanan log kanalını kontrol et, yoksa sunucuda otomatik isim taraması yap
            let logKanali = message.guild.channels.cache.get(sunucuAyari.logKanalId) || 
                            message.guild.channels.cache.find(c => c.name.includes('mod-log') || c.name.includes('bot-log') || c.name.includes('log'));
            
            if (logKanali) {
                const embed = new EmbedBuilder()
                    .setColor('#ff3333')
                    .setTitle('🤬 Küfür Filtresi Yakaladı')
                    .addFields(
                        { name: 'Kullanıcı:', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
                        { name: 'Kanal:', value: `${message.channel}`, inline: true },
                        { name: 'Yazılan Mesaj:', value: `\`\`\`${message.content}\`\`\`` }
                    )
                    .setTimestamp();
                await logKanali.send({ embeds: [embed] }).catch(() => {});
            }
        } catch (err) {
            console.error('Küfür silme işleminde hata oluştu:', err);
        }
    }
});

// =========================================================================
// 🔥 DIŞ DOSYA BAĞLANTILARI
// =========================================================================
require('./events/gelismislog')(client);

client.login(process.env.TOKEN);
