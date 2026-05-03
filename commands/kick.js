const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    // Sadece Üyeleri Atma yetkisi veya Yönetici yetkisi olanlar kullanabilir
    requiredPerms: [PermissionsBitField.Flags.KickMembers, PermissionsBitField.Flags.Administrator],

    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('TSA sunucusundan bir üyeyi atar.')
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

        // --- GÜVENLİK KONTROLLERİ ---
        if (!member) {
            return interaction.reply({ content: '❌ Bu kullanıcı sunucuda bulunmuyor kanka.', ephemeral: true });
        }

        if (!member.kickable) {
            return interaction.reply({ content: '❌ Bu üyeyi atamıyorum! Rolü benim rolümden yüksek olabilir veya yetkim yetersiz.', ephemeral: true });
        }

        if (member.id === interaction.user.id) {
            return interaction.reply({ content: '❌ Kendini mi atacaksın kanka? Yapma öyle şeyler.', ephemeral: true });
        }

        try {
            // Üyeyi At
            await member.kick(reason);

            const kickEmbed = new EmbedBuilder()
                .setTitle('👢 TSA | Üye Sunucudan Atıldı')
                .setColor('#f1c40f') // Sarı tonu (Kick için standart)
                .setThumbnail(user.displayAvatarURL())
                .addFields(
                    { name: '👤 Atılan Kullanıcı', value: `${user.tag} (${user.id})`, inline: false },
                    { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: true },
                    { name: '📄 Sebep', value: `\`${reason}\``, inline: true }
                )
                .setFooter({ text: 'TSA Disiplin Sistemi' })
                .setTimestamp();

            await interaction.reply({ embeds: [kickEmbed] });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Üye atılırken teknik bir hata oluştu!', ephemeral: true });
        }
    }
};
