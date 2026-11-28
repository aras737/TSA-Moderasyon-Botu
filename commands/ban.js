const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    requiredPerms: [PermissionFlagsBits.BanMembers],

    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('🔨 Kullanıcıyı sunucudan yasaklar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Banlanacak kullanıcıyı seçin')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Banlanma sebebi')
                .setMaxLength(500)
                .setRequired(false)),

    async execute(interaction) {
        // Discord ilk yanıt için 3 saniye verir. Ağ isteği yapmadan önce ACK gönder.
        await interaction.deferReply();

        const guild = interaction.guild;
        const user = interaction.options.getUser('kullanici', true);
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi.';

        if (user.id === guild.ownerId) {
            return interaction.editReply('⛔ Sunucu sahibi yasaklanamaz.');
        }

        try {
            const botMember = guild.members.me || await guild.members.fetchMe();
            if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
                return interaction.editReply('⛔ Botta **Üyeleri Yasakla** izni yok.');
            }

            const moderator = await guild.members.fetch(interaction.user.id).catch(() => null);
            if (!moderator) {
                return interaction.editReply('❌ Yetkili bilgisi alınamadı. İşlem iptal edildi.');
            }

            const member = await guild.members.fetch(user.id).catch(() => null);
            if (member) {
                if (moderator.id !== guild.ownerId &&
                    moderator.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
                    return interaction.editReply('⛔ Eşit veya daha yüksek rütbeli bir üyeyi banlayamazsın.');
                }

                if (!member.bannable ||
                    botMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
                    return interaction.editReply('⛔ Botun rol sırası bu üyeyi banlamaya yetmiyor. Bot rolünü hedefin üstüne taşı.');
                }
            }

            await guild.members.ban(user.id, {
                reason: (interaction.user.tag + ' tarafından: ' + reason).slice(0, 500)
            });

            const embed = new EmbedBuilder()
                .setTitle('✨ TMF | Ban İşlemi Başarılı')
                .setDescription('**' + user.tag + '** sunucudan yasaklandı.')
                .addFields(
                    { name: '👤 Kullanıcı', value: user.tag + ' (' + user.id + ')', inline: true },
                    { name: '🛡️ Yetkili', value: interaction.user.tag, inline: true },
                    { name: '📝 Sebep', value: reason.slice(0, 1000), inline: false }
                )
                .setThumbnail(user.displayAvatarURL())
                .setColor('#ff3333')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // DM gönderimi ban yanıtını geciktirmesin.
            user.send({
                embeds: [new EmbedBuilder()
                    .setTitle('✨ TMF | Sunucudan Yasaklandınız')
                    .setDescription('**' + guild.name + '** sunucusundan yasaklandınız.')
                    .addFields(
                        { name: '📝 Sebep', value: reason.slice(0, 1000) },
                        { name: 'Banlayan yetkili', value: interaction.user.tag }
                    )
                    .setColor('#ff4d4d')
                    .setTimestamp()]
            }).catch(error => console.warn('[BAN] Kullanıcıya DM gönderilemedi:', error?.message || error));
        } catch (error) {
            console.error('[BAN] Komut hatası:', error);
            await interaction.editReply({
                content: '❌ Ban işlemi başarısız: ' + (error?.message || 'Bilinmeyen Discord API hatası')
            }).catch(replyError => console.error('[BAN] Hata yanıtı gönderilemedi:', replyError.message));
        }
    }
};