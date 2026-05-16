const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sil')
        .setDescription('Belirtilen miktarda mesajı kanaldan temizler.')
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
        const miktar = interaction.options.getInteger('miktar');
        
        // Sabit özel emoji sistemin kanka
        const korumaEmoji = '<:koruma1:1505143174190989352>';

        try {
            // Kanaldan mesajları toplu olarak siliyoruz
            const silinenler = await interaction.channel.bulkDelete(miktar, true);

            // Şık bir bilgilendirme embed'i oluşturuyoruz
            const silEmbed = new EmbedBuilder()
                .setTitle(`${korumaEmoji} TSA | Temizlik Başarılı`)
                .setDescription(`Kanal başarıyla temizlendi ve düzen sağlandı.`)
                .addFields(
                    { name: '<:sil:1505147967907037275> Silinen Mesaj', value: `\`${silinenler.size}\` adet`, inline: true },
                    { name: '<:koruma1:1505143174190989352> Yetkili', value: `${interaction.user}`, inline: true }
                )
                .setColor('#3498db') // Şık bir mavi tonu
                .setTimestamp()
                .setFooter({ text: 'Bu mesaj 4 saniye içinde otomatik olarak silinecektir.' });

            // Mesajı gönderiyoruz
            await interaction.reply({ embeds: [silEmbed] });

            // Kanalda kalabalık yapmasın diye 4 saniye sonra botun yanıtını siliyoruz
            setTimeout(async () => {
                try {
                    await interaction.deleteReply();
                } catch (err) {
                    // Mesaj zaten silindiyse hata vermemesi için koruma
                }
            }, 4000);

        } catch (error) {
            console.error(error);
            // Discord 14 günden eski mesajların toplu silinmesine izin vermez, bu durumu yakalıyoruz
            await interaction.reply({ 
                content: '<:sil:1505147967907037275> **Hata:** Mesajlar silinemedi! (Discord kuralları gereği 14 günden eski mesajları toplu olarak silemem kanka).', 
                ephemeral: true 
            });
        }
    }
};