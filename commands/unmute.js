const {
     SlashCommandBuilder, EmbedBuilder, PermissionsBitField,
    MessageFlags
} = require('discord.js');

module.exports = {
    requiredPerms: [PermissionsBitField.Flags.ModerateMembers],

    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('🔊 Belirtilen kullanicinın susturma cezasını kaldırır.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
        .addUserOption(option =>
            option.setName('kullanici').setDescription('Cezası kaldırılacak üyeyi seçin.').setRequired(true))
        .addStringOption(option =>
            option.setName('sebep').setDescription('Cezayı kaldırma sebebini yazın.').setMaxLength(500).setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('kullanici', true);
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi.';

        if (target.id === interaction.user.id || target.id === interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ Kendinin veya sunucu sahibinin cezasını bu komutla kaldıramazsın.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            return interaction.editReply({ content: '⚠️ Bu kullanici sunucuda bulunamadı.' });
        }

        const moderator = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!moderator) {
            return interaction.editReply({ content: '❌ Yetkili bilgisi alınamadı. İşlem iptal edildi.' });
        }

        if (moderator.id !== interaction.guild.ownerId &&
            moderator.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
            return interaction.editReply({ content: '⛔ Eşit veya daha yüksek rütbeli bir üyenin cezasını kaldıramazsın.' });
        }

        if (!member.isCommunicationDisabled()) {
            return interaction.editReply({ content: '⚠️ Bu kullanici zaten susturulmamış.' });
        }

        const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
        if (!botMember || !member.moderatable || botMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
            return interaction.editReply({ content: '⛔ Botun rol hiyerarşisi bu kullanicinın cezasını kaldırmaya izin vermiyor.' });
        }

        try {
            await member.timeout(null, reason.slice(0, 500));

            const embed = new EmbedBuilder()
                .setTitle('🔊 TMF | Susturma Kaldırıldı')
                .setDescription(`**${target.tag}** kullanicisının cezası kaldırıldı.`)
                .addFields(
                    { name: '📌 Üye', value: `${member}`, inline: true },
                    { name: '📌 Yetkili', value: `${interaction.user}`, inline: true },
                    { name: '📌 Sebep', value: reason.slice(0, 1000), inline: false }
                )
                .setColor('#2ecc71')
                .setThumbnail(target.displayAvatarURL())
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Unmute komutu hatası:', error);
            return interaction.editReply({ content: '❌ Ceza kaldırılırken hata oluştu. Botun Moderate Members yetkisini kontrol et.' });
        }
    }
};