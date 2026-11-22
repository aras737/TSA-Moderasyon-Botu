const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    requiredPerms: [PermissionsBitField.Flags.ModerateMembers],

    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Belirtilen kullanicinın susturma cezasını kaldırır.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
        .addUserOption(option =>
            option.setName('kullanici').setDescription('Cezası kaldırılacak üyeyi seçin.').setRequired(true))
        .addStringOption(option =>
            option.setName('sebep').setDescription('Cezayı kaldırma sebebini yazın.').setMaxLength(500).setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('kullanici', true);
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi.';

        if (target.id === interaction.user.id || target.id === interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ Kendinin veya sunucu sahibinin cezasını bu komutla kaldıramazsın.', ephemeral: true });
        }

        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: '⚠️ Bu kullanici sunucuda bulunamadı.', ephemeral: true });
        }

        const moderator = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!moderator) {
            return interaction.reply({ content: '❌ Yetkili bilgisi alınamadı. İşlem iptal edildi.', ephemeral: true });
        }

        if (moderator.id !== interaction.guild.ownerId &&
            moderator.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
            return interaction.reply({ content: '⛔ Eşit veya daha yüksek rütbeli bir üyenin cezasını kaldıramazsın.', ephemeral: true });
        }

        if (!member.isCommunicationDisabled()) {
            return interaction.reply({ content: '⚠️ Bu kullanici zaten susturulmamış.', ephemeral: true });
        }

        const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
        if (!botMember || !member.moderatable || botMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
            return interaction.reply({ content: '⛔ Botun rol hiyerarşisi bu kullanicinın cezasını kaldırmaya izin vermiyor.', ephemeral: true });
        }

        try {
            await member.timeout(null, reason.slice(0, 500));

            const embed = new EmbedBuilder()
                .setTitle('🔊 TMF | Susturma Kaldırıldı')
                .setDescription(`**${target.tag}** kullanicisının cezası kaldırıldı.`)
                .addFields(
                    { name: 'Üye', value: `${member}`, inline: true },
                    { name: 'Yetkili', value: `${interaction.user}`, inline: true },
                    { name: 'Sebep', value: reason.slice(0, 1000), inline: false }
                )
                .setColor('#2ecc71')
                .setThumbnail(target.displayAvatarURL())
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Unmute komutu hatası:', error);
            return interaction.reply({ content: '❌ Ceza kaldırılırken hata oluştu. Botun Moderate Members yetkisini kontrol et.', ephemeral: true });
        }
    }
};