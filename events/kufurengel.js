const { EmbedBuilder } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {
    const kufurler = ['amk', 'aq', 'piç', 'orospu', 'sik', 'yarrak', 'pezevenk', 'göt', 'sktir', 'sg'];
    const linkRegex = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,})/gi;

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const icerik = message.content.toLowerCase();
        let tetiklendi = false;
        let sebep = '';

        if (kufurler.some(kufur => icerik.includes(kufur))) {
            tetiklendi = true;
            sebep = 'Küfür / Argo Kullanımı';
        }

        if (linkRegex.test(message.content)) {
            tetiklendi = true;
            sebep = 'Link / Reklam Paylaşımı';
        }

        if (tetiklendi) {
            try {
                await message.delete();

                const uyariEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setDescription(`<a:uyari:1505166167189487757> **${message.author}**, bu sunucuda **${sebep}** kesinlikle yasaktır!\n*Kurallar herkes için geçerlidir.*`);
                
                const uyariMsg = await message.channel.send({ embeds: [uyariEmbed] });
                setTimeout(() => uyariMsg.delete().catch(() => {}), 7000);

                // Merkezi veritabanından log kanalını çekiyoruz kanka
                const logKanalId = ayarGetir(message.guild.id, 'logKanal', null);
                const logChan = logKanalId ? client.channels.cache.get(logKanalId) : null;

                if (logChan) {
                    const silinenMesaj = message.content.length > 1000 ? message.content.substring(0, 1000) + '...' : message.content;
                    const logEmbed = new EmbedBuilder()
                        .setAuthor({ name: 'Sohbet Koruması', iconURL: message.guild.iconURL() })
                        .setTitle('<:koruma1:1505143174190989352> İhlal Temizlendi')
                        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                        .addFields(
                            { name: '👤 Kullanıcı', value: `${message.author}\n\`ID: ${message.author.id}\``, inline: true },
                            { name: '📍 Kanal', value: `${message.channel}`, inline: true },
                            { name: '🗑️ Mesaj', value: `\`\`\`${silinenMesaj}\`\`\`` }
                        )
                        .setColor('#960018').setTimestamp();
                    
                    logChan.send({ embeds: [logEmbed] }).catch(() => {});
                }
            } catch (err) {}
        }
    });
};
