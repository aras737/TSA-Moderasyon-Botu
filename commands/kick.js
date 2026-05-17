const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    requiredPerms: [PermissionsBitField.Flags.KickMembers, PermissionsBitField.Flags.Administrator],

    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('TSA sunucusundan bir üyeyi atar ve DM atar.')
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Atılacak üyeyi seçin')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('sebep')
                .setDescription('Atılma sebebini belirtin')
                .setRequired(false)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('kullanici');
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi.';
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) return interaction.reply({ content: '<a:baarsz:1505146967817326675> Bu kullanıcı sunucuda yok.', ephemeral: true });
        if (!member.kickable) return interaction.reply({ content: '<a:baarsz:1505146967817326675> Yetkim bu üyeyi atmaya yetmiyor.', ephemeral: true });

        // --- 1. ÖZEL DM EMBED MESAJI ---
        const dmEmbed = new EmbedBuilder()
            .setTitle('TSA | Sunucudan Atıldınız')
            .setDescription(`**${interaction.guild.name}** sunucusundan uzaklaştırıldınız.`)
            .addFields(
                { name: '<:Paper:1505146388596391977> Sebep', value: `\`${reason}\`` },
                { name: '<:koruma1:1505143174190989352> Atan Yetkili', value: `${interaction.user.tag}` }
            )
            .setColor('#e67e22')
            .setTimestamp()
            .setFooter({ text: 'Tekrar katılmak için kurallara uymanız rica olunur.' });

        // Önce DM atmayı dene (Üyeyi atmadan önce yapmalıyız yoksa sunucudan çıktığı için atamayabilir)
        try {
            await user.send({ embeds: [dmEmbed] });
        } catch (err) {
            console.log(`${user.tag} kullanıcısının DM'leri kapalı, mesaj iletilemedi.`);
        }

        // --- 2. ÜYEYİ AT ---
        try {
            await member.kick(reason);

            const kickEmbed = new EmbedBuilder()
                .setTitle('<:icons_kick:1505438748035518464> TSA | İşlem Başarılı')
                .setDescription(`**${user.tag}** sunucudan atıldı.`)
                .addFields(
                    { name: 'Kullanıcı', value: `${user.tag}`, inline: true },
                    { name: 'Sebep', value: `\`${reason}\``, inline: true },
                    { name: 'DM Durumu', value: '<a:tik:1505164671081123840> Gönderildi (DM kapalıysa iletilemez)', inline: false }
                )
                .setColor('#f1c40f')
                .setTimestamp();

            await interaction.reply({ embeds: [kickEmbed] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '<a:baarsz:1505146967817326675> Kick işlemi sırasında bir hata oluştu!', ephemeral: true });
        }
    }
};
