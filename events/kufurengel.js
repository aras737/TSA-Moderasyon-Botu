const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const LOG_YOLU = path.join(__dirname, '../ayarlar/gelismisLog.json');

module.exports = (client) => {
    // Yardımcı Fonksiyon: Gelişmiş Log kanalını çekme
    const logKanalGetir = (guildId) => {
        if (!fs.existsSync(LOG_YOLU)) return null;
        const ayarlar = JSON.parse(fs.readFileSync(LOG_YOLU, 'utf8'));
        return ayarlar[guildId] ? client.channels.cache.get(ayarlar[guildId]) : null;
    };

    // Genişletilebilir Küfür Listesi
    const kufurler = ['amk', 'aq', 'piç', 'orospu', 'sik', 'yarrak', 'pezevenk', 'göt', 'sktir', 'sg'];
    
    // Gelişmiş Link/Reklam yakalama regex'i (www, http, https vb. her şeyi yakalar)
    const linkRegex = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;

    client.on('messageCreate', async (message) => {
        // Mesajı atan botsa veya sunucu dışı (DM) ise es geç
        if (message.author.bot || !message.guild) return;

        const icerik = message.content.toLowerCase();
        let tetiklendi = false;
        let sebep = '';

        // 1. Küfür Kontrolü
        if (kufurler.some(kufur => icerik.includes(kufur))) {
            tetiklendi = true;
            sebep = 'Küfür / Argo Kullanımı';
        }

        // 2. Link/Reklam Kontrolü
        if (linkRegex.test(message.content)) {
            tetiklendi = true;
            sebep = 'Link / Reklam Paylaşımı';
        }

        // Eğer filtreye takıldıysa operasyon başlasın:
        if (tetiklendi) {
            try {
                // Mesajı kim olursa olsun saniyesinde siliyoruz (Yetkili affı YOK)
                await message.delete();

                // 🔴 KANALA GİDECEK ŞIK UYARI EMBED'İ
                const uyariEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setDescription(`<a:uyari:1505166167189487757> **${message.author}**, bu sunucuda **${sebep}** kesinlikle yasaktır!\n*Kurallar yöneticiler dahil herkes için geçerlidir.*`);
                
                // Uyarıyı atıp 7 saniye sonra temizliyoruz
                const uyariMsg = await message.channel.send({ embeds: [uyariEmbed] });
                setTimeout(() => uyariMsg.delete().catch(() => {}), 7000);

                // 📝 GELİŞMİŞ LOG KANALINA GİDECEK DETAYLI RAPOR
                const logChan = logKanalGetir(message.guild.id);
                if (logChan) {
                    // Mesaj çok uzunsa API hata vermesin diye kısaltıyoruz
                    const silinenMesaj = message.content.length > 1000 
                        ? message.content.substring(0, 1000) + '... (Devamı kırpıldı)' 
                        : message.content;

                    const logEmbed = new EmbedBuilder()
                        .setAuthor({ name: 'Sohbet Koruması Devreye Girdi!', iconURL: message.guild.iconURL() || client.user.displayAvatarURL() })
                        .setTitle('<:koruma1:1505143174190989352> İhlal Tespit Edildi ve Temizlendi')
                        .setThumbnail(message.author.displayAvatarURL({ dynamic: true })) // Suçlunun profil fotosu
                        .addFields(
                            { name: '👤 İhlal Yapan Kullanıcı', value: `${message.author}\n\`ID: ${message.author.id}\``, inline: true },
                            { name: '📍 Olayın Yaşandığı Kanal', value: `${message.channel}\n\`ID: ${message.channel.id}\``, inline: true },
                            { name: '⚠️ Tespit Edilen İhlal', value: `**${sebep}**`, inline: false },
                            { name: '🗑️ Sansürlenen Orijinal Mesaj', value: `\`\`\`${silinenMesaj}\`\`\``, inline: false }
                        )
                        .setColor('#960018') // Koyu kan kırmızısı
                        .setFooter({ text: 'TSA Güvenlik & Moderasyon', iconURL: client.user.displayAvatarURL() })
                        .setTimestamp();
                    
                    logChan.send({ embeds: [logEmbed] }).catch(() => {});
                }
            } catch (err) {
                console.error('Küfür/Link engelleme ve silme hatası:', err);
            }
        }
    });
};
