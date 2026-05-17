const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { ayarGetir, ayarKaydet } = require('../utils/db');

module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        // Eğer eklenen üye bir bot ise
        if (member.user.bot) {
            try {
                // Bot'un kendi ID'si mi kontrol et (kendini banlama)
                if (member.user.id === client.user.id) {
                    console.log('✅ TSA Botu sunucuya eklendi.');
                    return;
                }

                // Bot'un ban yetkisi var mı?
                if (!member.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
                    console.warn('⚠️ Bot başka botları banlamak için yetki yok!');
                    return;
                }

                // Botu ban at
                await member.ban({ reason: '🤖 TSA Sistemi: Yetkisiz Bot Girişi Engellendi' });

                // Log kanalına bildir
                const logKanalId = ayarGetir(member.guild.id, 'logKanal', null);
                const logChan = logKanalId ? client.channels.cache.get(logKanalId) : null;

                if (logChan) {
                    const botBanEmbed = new EmbedBuilder()
                        .setAuthor({ name: 'Bot Koruma Sistemi', iconURL: member.guild.iconURL() })
                        .setTitle('🚫 Yetkisiz Bot Engellendi!')
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .addFields(
                            { name: '🤖 Bot Adı', value: `${member.user.username}`, inline: true },
                            { name: '🔢 Bot ID', value: `\`${member.user.id}\``, inline: true },
                            { name: '⏰ Zaman', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: false },
                            { name: '📝 İşlem', value: 'Otomatik Ban - TSA Koruma Sistemi' }
                        )
                        .setColor('#ff0000')
                        .setTimestamp();

                    await logChan.send({ embeds: [botBanEmbed] });
                }

                console.log(`🚫 Bot engellendi: ${member.user.tag}`);

            } catch (error) {
                console.error('❌ Bot engel hatası:', error);
            }
        }
    });
};
