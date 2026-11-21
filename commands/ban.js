const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Kullanıcıyı sunucudan yasaklar (ID veya Etiket ile).')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Banlanacak kullanıcıyı seçin veya doğrudan ID yazın')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Banlanma sebebini belirtin')
                .setMaxLength(500)
                .setRequired(false)
        ),

    requiredPerms: [PermissionFlagsBits.BanMembers],

    async execute(interaction) {
        const user = interaction.options.getUser('kullanici', true);
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi.';
        const korumaEmoji = '<:koruma1:1505143174190989352>';

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (member && !member.bannable) {
            return interaction.reply({
                content: '<a:baarsz:1505146967817326675> Bu üyeyi banlamaya botun yetkisi yetmiyor. Rol hiyerarşisini kontrol et.',
                ephemeral: true
            });
        }

        if (user.id === interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ Sunucu sahibi yasaklanamaz.', ephemeral: true });
        }

        if (member) {
            const moderator = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (!moderator) {
                return interaction.reply({ content: '❌ Yetkili bilgisi alınamadı. İşlem iptal edildi.', ephemeral: true });
            }
            if (moderator.id !== interaction.guild.ownerId &&
                moderator.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
                return interaction.reply({ content: '⛔ Eşit veya daha yüksek rütbeli bir üyeyi banlayamazsın.', ephemeral: true });
            }
            const dmEmbed = new EmbedBuilder()
                .setTitle('<:yasaklandi:1505146022588842095> TMF | Sunucudan Yasaklandınız')
                .setDescription(`**${interaction.guild.name}** sunucusundan kalıcı olarak uzaklaştırıldınız.`)
                .addFields(
                    { name: '<:Paper:1505146388596391977> Sebep', value: reason.slice(0, 1000) },
                    { name: `${korumaEmoji} Banlayan Yetkili`, value: interaction.user.tag }
                )
                .setColor('#ff4d4d')
                .setTimestamp()
                .setFooter({ text: 'Adil bir topluluk için kurallara uymanız gerekir.' });

            await user.send({ embeds: [dmEmbed] }).catch(() => {});
        }

        try {
            await interaction.guild.bans.create(user.id, {
                reason: `${interaction.user.tag} tarafından: ${reason}`.slice(0, 500)
            });

            const banEmbed = new EmbedBuilder()
                .setTitle('<:yasaklandi:1505146022588842095> TMF | Ban İşlemi Başarılı')
                .setDescription(`**${user.tag}** başarıyla sunucudan uzaklaştırıldı.`)
                .addFields(
                    { name: '<:uzaybot_kullanicilar:1505146190973505567> Kullanıcı', value: `${user.tag} (\`${user.id}\`)`, inline: true },
                    { name: `${korumaEmoji} Yetkili`, value: `${interaction.user}`, inline: true },
                    { name: '<:Paper:1505146388596391977> Sebep', value: reason.slice(0, 1000), inline: false },
                    { name: '<:global:1505146647221374977> Durum', value: member ? '✅ Sunucudaydı (DM denendi)' : 'ℹ️ Sunucuda değildi', inline: false }
                )
                .setThumbnail(user.displayAvatarURL({ dynamic: true }) || interaction.guild.iconURL())
                .setColor('#ff3333')
                .setFooter({ text: `Sorgulayan: ${interaction.user.tag}` })
                .setTimestamp();

            return interaction.reply({ embeds: [banEmbed] });
        } catch (error) {
            console.error('Ban komutu hatası:', error);
            return interaction.reply({
                content: '❌ Ban işlemi gerçekleştirilemedi. Botun Ban Members yetkisini kontrol et.',
                ephemeral: true
            });
        }
    }
};
