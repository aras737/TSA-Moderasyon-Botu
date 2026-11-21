const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    requiredPerms: [PermissionsBitField.Flags.KickMembers],

    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('TSA sunucusundan bir üyeyi atar ve DM bildirimi gönderir.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers)
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Atılacak üyeyi seçin')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Atılma sebebini belirtin')
                .setMaxLength(500)
                .setRequired(false)),

    async execute(interaction) {
        const user = interaction.options.getUser('kullanici', true);
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi.';

        if (user.id === interaction.user.id || user.id === interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ Kendini veya sunucu sahibini atamazsın.', ephemeral: true });
        }

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: '⚠️ Bu kullanıcı sunucuda bulunamadı.', ephemeral: true });
        }

        if (interaction.user.id !== interaction.guild.ownerId &&
            interaction.member.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
            return interaction.reply({ content: '⛔ Eşit veya daha yüksek rütbeli bir üyeyi atamazsın.', ephemeral: true });
        }

        const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
        if (!botMember || !member.kickable || botMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
            return interaction.reply({ content: '⛔ Botun rol hiyerarşisi bu üyeyi atmaya izin vermiyor.', ephemeral: true });
        }

        let dmSent = false;
        const dmEmbed = new EmbedBuilder()
            .setTitle('TSA | Sunucudan Atıldınız')
            .setDescription(`**${interaction.guild.name}** sunucusundan uzaklaştırıldınız.`)
            .addFields(
                { name: 'Sebep', value: reason.slice(0, 1000) },
                { name: 'Atan Yetkili', value: interaction.user.tag }
            )
            .setColor('#e67e22')
            .setTimestamp()
            .setFooter({ text: 'Tekrar katılmak için sunucu kurallarına uyunuz.' });

        try {
            await user.send({ embeds: [dmEmbed] });
            dmSent = true;
        } catch {
            dmSent = false;
        }

        try {
            await member.kick(reason.slice(0, 500));

            const embed = new EmbedBuilder()
                .setTitle('<:icons_kick:1505438748035518464> TSA | İşlem Başarılı')
                .setDescription(`**${user.tag}** sunucudan atıldı.`)
                .addFields(
                    { name: 'Kullanıcı', value: `${user.tag}`, inline: true },
                    { name: 'Sebep', value: reason.slice(0, 1000), inline: true },
                    { name: 'DM Durumu', value: dmSent ? '✅ Bildirim gönderildi.' : '⚠️ Kullanıcının DM kutusuna ulaşılamadı.' }
                )
                .setColor('#f1c40f')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Kick komutu hatası:', error);
            return interaction.reply({ content: '❌ Kick işlemi sırasında hata oluştu. Botun Kick Members yetkisini kontrol et.', ephemeral: true });
        }
    }
};