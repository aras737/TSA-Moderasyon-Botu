const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    requiredPerms: [PermissionFlagsBits.KickMembers],

    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('👢 TMF sunucusundan bir üyeyi atar.'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Atılacak üyeyi seçin')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Atılma sebebi')
                .setMaxLength(500)
                .setRequired(false)),

    async execute(interaction) {
        // Üye/rol/DM sorgularından önce Discord etkileşimini onayla.
        await interaction.deferReply();

        const guild = interaction.guild;
        const user = interaction.options.getUser('kullanici', true);
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi.';

        if (user.id === interaction.user.id || user.id === guild.ownerId) {
            return interaction.editReply('⛔ Kendini veya sunucu sahibini atamazsın.');
        }

        try {
            const botMember = guild.members.me || await guild.members.fetchMe();
            if (!botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
                return interaction.editReply('⛔ Botta **Üyeleri At** izni yok.');
            }

            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) {
                return interaction.editReply('⚠️ Bu kullanıcı sunucuda bulunamadı.');
            }

            const moderator = await guild.members.fetch(interaction.user.id).catch(() => null);
            if (!moderator) {
                return interaction.editReply('❌ Yetkili bilgisi alınamadı. İşlem iptal edildi.');
            }

            if (moderator.id !== guild.ownerId &&
                moderator.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
                return interaction.editReply('⛔ Eşit veya daha yüksek rütbeli bir üyeyi atamazsın.');
            }

            if (!member.kickable ||
                botMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
                return interaction.editReply('⛔ Botun rol sırası bu üyeyi atmaya yetmiyor.');
            }

            await member.kick(reason.slice(0, 500));

            const embed = new EmbedBuilder()
                .setTitle('✨ TMF | Kullanıcı Atıldı')
                .setDescription('**' + user.tag + '** sunucudan atıldı.')
                .addFields(
                    { name: '👤 Kullanıcı', value: user.tag, inline: true },
                    { name: '🛡️ Yetkili', value: interaction.user.tag, inline: true },
                    { name: '📝 Sebep', value: reason.slice(0, 1000), inline: false }
                )
                .setColor('#f1c40f')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            user.send({
                embeds: [new EmbedBuilder()
                    .setTitle('✨ TMF | Sunucudan Atıldınız')
                    .setDescription('**' + guild.name + '** sunucusundan atıldınız.')
                    .addFields(
                        { name: '📝 Sebep', value: reason.slice(0, 1000) },
                        { name: 'Atan yetkili', value: interaction.user.tag }
                    )
                    .setColor('#e67e22')
                    .setTimestamp()]
            }).catch(() => {});
        } catch (error) {
            console.error('[KICK] Komut hatası:', error);
            await interaction.editReply({
                content: '❌ Kick işlemi başarısız: ' + (error?.message || 'Bilinmeyen Discord API hatası')
            }).catch(replyError => console.error('[KICK] Hata yanıtı gönderilemedi:', replyError.message));
        }
    }
};