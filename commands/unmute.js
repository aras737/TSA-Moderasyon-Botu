const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    requiredPerms: [PermissionsBitField.Flags.ModerateMembers],

    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Belirtilen kullanıcının susturma cezasını (Timeout) kaldırır.')
        .addUserOption(option => 
            option.setName('kullanıcı').setDescription('Cezası kaldırılacak üyeyi seçin.').setRequired(true))
        .addStringOption(option => 
            option.setName('sebep').setDescription('Cezayı kaldırma sebebini yazın.').setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('kullanıcı');
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmemiş kanka.';

        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: '<a:uyari:1505166167189487757> Bu kullanıcı sunucuda bulunamadı kanka.', ephemeral: true });
        }

        if (!member.isCommunicationDisabled()) {
            return interaction.reply({ content: '<a:uyari:1505166167189487757> Bu kullanıcı zaten susturulmamış (Timeout cezası yok).', ephemeral: true });
        }

        try {
            await member.timeout(null, reason);

            const embed = new EmbedBuilder()
                .setTitle('🔊 TSA | Susturma Kaldırıldı')
                .setDescription(`**${target.tag}** kullanıcısının cezası el ile kaldırıldı.`)
                .addFields(
                    { name: '<:uzaybot_kullanicilar:1505146190973505567> Üye', value: `${member}`, inline: true },
                    { name: '<:Yetkili:1505192912680390827> Yetkili', value: `${interaction.user}`, inline: true },
                    { name: '<:Paper:1505146388596391977> Kaldırma Sebebi', value: `*${reason}*`, inline: false }
                )
                .setColor('#2ecc71')
                .setThumbnail(target.displayAvatarURL())
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '<a:baarsz:1505146967817326675> Ceza kaldırılırken teknik bir hata oluştu!', ephemeral: true });
        }
    }
};