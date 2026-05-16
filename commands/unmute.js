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
        const target = interaction.options.getMember('kullanıcı');
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmemiş kanka.';

        if (!target) {
            return interaction.reply({ content: '<a:uyari:1505166167189487757> Bu kullanıcı sunucuda bulunamadı kanka.', ephemeral: true });
        }

        if (!target.isCommunicationDisabled()) {
            return interaction.reply({ content: '<a:uyari:1505166167189487757> Bu kullanıcı zaten susturulmamış (Timeout cezası yok).', ephemeral: true });
        }

        try {
            await target.timeout(null, reason); // Timeout'u null yapmak cezayı tamamen siler

            const embed = new EmbedBuilder()
                .setTitle('🔊 TSA | Susturma Kaldırıldı')
                .setDescription(`**${target.user.tag}** kullanıcısının cezası el ile kaldırıldı.`)
                .addFields(
                    { name: '<:uzaybot_kullanicilar:1505146190973505567> Üye', value: `${target}`, inline: true },
                    { name: '<:Yetkili:1505192912680390827> Yetkili', value: `${interaction.user}`, inline: true },
                    { name: '<:Paper:1505146388596391977> Kaldırma Sebebi', value: `*${reason}*`, inline: false }
                )
                .setColor('#2ecc71') // Yeşil renk
                .setThumbnail(target.user.displayAvatarURL())
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '<a:baarsz:1505146967817326675> Ceza kaldırılırken teknik bir hata oluştu!', ephemeral: true });
        }
    }
};
