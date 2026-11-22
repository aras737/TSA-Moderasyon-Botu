const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sil')
        .setDescription('🗑️ Belirtilen miktarda mesajı kanaldan temizler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option.setName('miktar')
                .setDescription('Silinecek mesaj sayısı (1 - 100 arası)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        ),

    // Sadece Mesajları Yönet veya Yönetici yetkisi olanlar kullanabilir
    requiredPerms: [PermissionFlagsBits.ManageMessages],

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const miktar = interaction.options.getInteger('miktar', true);

        try {
            const silinenler = await interaction.channel.bulkDelete(miktar, true);
            const silEmbed = new EmbedBuilder()
                .setTitle('🛡️ TMF | Temizlik Tamamlandı')
                .setDescription('Kanal temizleme işlemi tamamlandı.')
                .addFields(
                    { name: '📌 Silinen Mesaj', value: `${silinenler.size} adet`, inline: true },
                    { name: '📌 Yetkili', value: `${interaction.user}`, inline: true },
                    { name: '📌 Not', value: '14 günden eski mesajlar Discord tarafından toplu silinemez.', inline: false }
                )
                .setColor('#3498db')
                .setTimestamp();

            return interaction.editReply({ embeds: [silEmbed] });
        } catch (error) {
            console.error('Mesaj temizleme hatası:', error);
            return interaction.editReply({
                content: '❌ Mesajlar silinemedi. Botun Mesajları Yönet iznini ve kanal izinlerini kontrol et.'
            });
        }
    }
};