const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    // Sadece Üyeleri Yasakla veya Yönetici yetkisi olanlar görebilir
    requiredPerms: [PermissionsBitField.Flags.BanMembers, PermissionsBitField.Flags.Administrator],

    data: new SlashCommandBuilder()
        .setName('banlist')
        .setDescription('TSA sunucusundaki yasaklı kullanıcıları listeler.'),

    async execute(interaction) {
        try {
            // Sunucudaki banlı kullanıcıları çekiyoruz
            const bans = await interaction.guild.bans.fetch();

            if (bans.size === 0) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('TSA | Yasaklı Listesi')
                            .setDescription('✅ Sunucuda yasaklı kullanıcı bulunmuyor.')
                            .setColor('Green')
                    ],
                    ephemeral: true
                });
            }

            // Banlı kullanıcıları şık bir formatta eşliyoruz
            // Not: Çok fazla ban varsa Discord Embed sınırı (4096 karakter) nedeniyle ilk 20 kişiyi gösteriyoruz
            const banList = bans.map(ban => `👤 **${ban.user.tag}** \`(${ban.user.id})\``).join('\n');

            const embed = new EmbedBuilder()
                .setTitle('🚫 TSA | Yasaklı Kullanıcı Listesi')
                .setDescription(`Sunucuda toplam **${bans.size}** yasaklı kullanıcı bulunuyor:\n\n${banList.slice(0, 3000)}`) // Karakter sınırına karşı koruma
                .setColor('#ff4d4d') // Kırmızı tonu
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: `Sorgulayan: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Ban listesi çekilirken bir hata oluştu!', ephemeral: true });
        }
    }
};
