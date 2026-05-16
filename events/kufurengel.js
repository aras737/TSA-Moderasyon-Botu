const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
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

    // Genişletilebilir Küfür Listesi kanka, istediğini ekle/çıkar
    const kufurler = ['amk', 'aq', 'piç', 'orospu', 'sik', 'yarrak', 'pezevenk', 'göt', 'sktir'];
    // Profesyonel Link/Reklam yakalama regex'i
    const linkRegex = /(https?:\/\/[^\s]+)/g;

    client.on('messageCreate', async (message) => {
        // Mesajı atan botsa veya sunucu dışı (DM) ise es geç
        if (message.author.bot || !message.guild) return;

        // Yönetici yetkisi olanları engellemesin, adminler rahat takılsın
        if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

        const icerik = message.content.toLowerCase();
        let tetiklendi = false;
        let sebep = '';

        // 1. Küfür Kontrolü
        if (kufurler.some(kufur => icerik.includes(kufur))) {
            tetiklendi = true;
            sebep = 'Küfürlü İçerik';
        }

        // 2. Link/Reklam Kontrolü
        if (linkRegex.test(message.content)) {
            tetiklendi = true;
            sebep = 'Link / Reklam Paylaşımı';
        }

        // Eğer filtreye takıldıysa operasyon başlasın:
        if (tetiklendi) {
            try {
                // Mesajı saniyesinde haritadan siliyoruz
                await message.delete();

                // Kullanıcıya şık bir uyarı mesajı gönderip 5 saniye sonra uyarısını siliyoruz kanka (sohbet kirletmesin)
                const uyariMsg = await message.channel.send(`<a:uyari:1505166167189487757> ${message.author}, bu sunucuda **${sebep}** kullanımı yasaktır kanka!`);
                setTimeout(() => uyariMsg.delete().catch(() => {}), 5000);

                // Gelişmiş Log kanalına raporu uçuruyoruz
                const logChan = logKanalGetir(message.guild.id);
                if (logChan) {
                    const embed = new EmbedBuilder()
                        .setTitle('<:koruma1:1505143174190989352> Sohbet Koruması: Mesaj Engellendi!')
                        .addFields(
                            { name: 'Söyleyen Üye', value: `${message.author} \`(${message.author.id})\``, inline: true },
                            { name: 'Yazıldığı Kanal', value: `${message.channel}`, inline: true },
                            { name: 'Engellenme Nedeni', value: `\`${sebep}\`` },
                            { name: 'Silinen İçerik', value: `\`\`\`${message.content}\`\`\`` }
                        )
                        .setColor('#e74c3c')
                        .setTimestamp();
                    
                    logChan.send({ embeds: [embed] }).catch(() => {});
                }
            } catch (err) {
                console.error('Küfür/Link engelleme ve silme hatası:', err);
            }
        }
    });
};
