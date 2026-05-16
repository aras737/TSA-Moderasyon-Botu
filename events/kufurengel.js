const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const LOG_YOLU = path.join(__dirname, '../ayarlar/gelismisLog.json');

module.exports = (client) => {

    // Log Kanalı Çek
    const logKanalGetir = (guildId) => {
        if (!fs.existsSync(LOG_YOLU)) return null;

        try {
            const ayarlar = JSON.parse(fs.readFileSync(LOG_YOLU, 'utf8'));
            return ayarlar[guildId]
                ? client.channels.cache.get(ayarlar[guildId])
                : null;
        } catch (err) {
            console.error('Log JSON okunamadı:', err);
            return null;
        }
    };

    // Küfür Listesi
    const kufurler = [
        'amk',
        'aq',
        'piç',
        'orospu',
        'sik',
        'yarrak',
        'pezevenk',
        'göt',
        'sktir'
    ];

    // Link Regex
    const linkRegex = /(https?:\/\/[^\s]+|discord\.gg\/[^\s]+)/i;

    client.on('messageCreate', async (message) => {

        // Bot veya DM
        if (message.author.bot || !message.guild) return;

        // Admin bypass
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        // Botun yetkisi var mı?
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        const icerik = message.content.toLowerCase();

        let sebepler = [];

        // Küfür kontrolü
        const kufurBulundu = kufurler.some(kelime => {
            const regex = new RegExp(`\\b${kelime}\\b`, 'i');
            return regex.test(icerik);
        });

        if (kufurBulundu) {
            sebepler.push('Küfürlü İçerik');
        }

        // Link kontrolü
        if (linkRegex.test(message.content)) {
            sebepler.push('Link / Reklam');
        }

        // Hiçbir şey yoksa çık
        if (sebepler.length === 0) return;

        try {

            // Mesajı sil
            await message.delete().catch(() => {});

            // Uyarı mesajı
            const uyari = await message.channel.send({
                content: `⚠️ ${message.author}, bu sunucuda \`${sebepler.join(', ')}\` yasak oğlum.`
            });

            setTimeout(() => {
                uyari.delete().catch(() => {});
            }, 5000);

            // Log kanalı
            const logChan = logKanalGetir(message.guild.id);

            if (logChan) {

                const embed = new EmbedBuilder()
                    .setTitle('🛡️ Sohbet Koruması')
                    .setColor('#ff0000')
                    .addFields(
                        {
                            name: 'Kullanıcı',
                            value: `${message.author} (${message.author.id})`,
                            inline: true
                        },
                        {
                            name: 'Kanal',
                            value: `${message.channel}`,
                            inline: true
                        },
                        {
                            name: 'Sebep',
                            value: sebepler.join(', ')
                        },
                        {
                            name: 'Mesaj',
                            value: `\`\`\`${message.content.slice(0, 1000)}\`\`\``
                        }
                    )
                    .setTimestamp();

                await logChan.send({ embeds: [embed] }).catch(() => {});
            }

        } catch (err) {
            console.error('Koruma sistemi hatası:', err);
        }
    });
};
