const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { ayarGetir, ayarKaydet } = require('../utils/db');

module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        // Eğer eklenen üye bir bot ise
        if (member.user.bot) {
            try {
                // Bot'un kendi ID'si mi kontrol et (kendini banlama)
                if (member.user.id === client.user.id) {
                    console.log('<a:tik:1505164671081123840> TSA Botu sunucuya eklendi.');
                    return;
                }

                // Bot'un ban yetkisi var mı?
                if (!member.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
                    console.warn('<a:uyari:1505166167189487757> Bot başka botları banlamak için yetki yok!');
                    return;
                }

                // Botu ban at
                await member.ban({ reason: '<:Discord_Bots:1505436085742731346> TSA Sistemi: Yetkisiz Bot Girişi Engellendi' });

                // Log kanalına bildir
                const logKanalId = ayarGetir(member.guild.id, 'logKanal', null);
                const logChan = logKanalId ? client.channels.cache.get(logKanalId) : null;

                if (logChan) {
                    const botBanEmbed = new EmbedBuilder()
                        .setAuthor({ name: 'Bot Koruma Sistemi', iconURL: member.guild.iconURL() })
                        .setTitle('<a:baarsz:1505146967817326675> Yetkisiz Bot Engellendi!')
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .addFields(
                            { name: '<:appEmoji_kategori:1505159567879966811> Bot Adı', value: `${member.user.username}`, inline: true },
                            { name: '<:n_id:1505158042738491464> Bot ID', value: `\`${member.user.id}\``, inline: true },
                            { name: '<:duration:1505171054497370275> Zaman', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: false },
                            { name: '<:Paper:1505146388596391977> İşlem', value: 'Otomatik Ban - TSA Koruma Sistemi' }
                        )
                        .setColor('#ff0000')
                        .setTimestamp();

                    await logChan.send({ embeds: [botBanEmbed] });
                }

                console.log(`<a:baarsz:1505146967817326675> Bot engellendi: ${member.user.tag}`);

            } catch (error) {
                console.error('❌ Bot engel hatası:', error);
            }
        }
    });
};
