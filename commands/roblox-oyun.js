const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roblox-oyun')
        .setDescription('🎮 Paylaşılan Roblox oyununun tüm detaylarını ve katılım linkini gösterir kanka.'), // Hata veren özel emoji buradan kaldırıldı, sınır 100 karakter altına çekildi.

    async execute(interaction) {
        // Kullanıcıya oyunun detaylarını şık bir embed ile sunuyoruz
        const oyunEmbed = new EmbedBuilder()
            .setTitle('<:Yetkili:1505192912680390827> ROBLOX OYUNU PAYLAŞILDI!') // Özel yetkili emojin buraya eklendi kanka
            .setDescription(`Kanka, ekiple birlikte akacağımız harika bir Roblox deneyimi seni bekliyor! Aşağıdaki butona tıklayarak doğrudan oyuna dahil olabilirsin.`)
            .addFields(
                { name: '<:global:1505146647221374977> Oyun Tipi', value: '`Experience Details (Deneyim Detayları)`', inline: true },
                { name: '<:Discord_Link:1505166617426923661> Paylaşım Kodu', value: '`02306cd6c6c3314dbdef099e121c508e`', inline: true },
                { name: '<a:acs_ayarlar:1505165015127162994> Durum', value: '<a:online:1505145208046878730> Aktif / Katılıma Açık', inline: false },
                { name: '<a:megafon:1505454906176176241> Bilgilendirme', value: 'Oyuna giriş yaparken Roblox hesabınızın açık olduğundan emin olun kanka. Keyifli oyunlar!' }
            )
            .setImage('https://images.rbxcdn.com/95995ef1db79d0124de31f7cf6f018e5.png') 
            .setColor('#f1c40f') 
            .setTimestamp()
            .setFooter({ text: `${interaction.guild.name} | Roblox Etkinliği`, iconURL: interaction.guild.iconURL() });

        // Buton yapısı kurallara uygun hale getirildi kanka
        const butonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Oyuna Katıl (Roblox)')
                    .setEmoji('1505166617426923661') // Link emojisi kurallara uygun olarak butonun içine gömüldü
                    .setURL('https://www.roblox.com/share?code=02306cd6c6c3314dbdef099e121c508e&type=ExperienceDetails&stamp=1779005500109')
                    .setStyle(ButtonStyle.Link)
            );

        // Mesajı kanala gönderiyoruz
        return interaction.reply({ embeds: [oyunEmbed], components: [butonRow] });
    },
};
