const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roblox-oyun')
        .setDescription('<:Yetkili:1505192912680390827> Paylaşılan Roblox oyununun tüm detaylarını ve katılım linkini gösterir kanka.'),

    async execute(interaction) {
        // Kullanıcıya oyunun detaylarını şık bir embed ile sunuyoruz
        const oyunEmbed = new EmbedBuilder()
            .setTitle('ROBLOX OYUNU PAYLAŞILDI!')
            .setDescription(`Kanka, ekiple birlikte akacağımız harika bir Roblox deneyimi seni bekliyor! Aşağıdaki butona tıklayarak doğrudan oyuna dahil olabilirsin.`)
            .addFields(
                { name: '<:global:1505146647221374977> Oyun Tipi', value: '`Experience Details (Deneyim Detayları)`', inline: true },
                { name: '<:Discord_Link:1505166617426923661> Paylaşım Kodu', value: '`02306cd6c6c3314dbdef099e121c508e`', inline: true },
                { name: '<a:acs_ayarlar:1505165015127162994> Durum', value: '<a:online:1505145208046878730> Aktif / Katılıma Açık', inline: false },
                { name: '<a:megafon:1505454906176176241> Bilgilendirme', value: 'Oyuna giriş yaparken Roblox hesabınızın açık olduğundan emin olun kanka. Keyifli oyunlar!' }
            )
            .setImage('https://images.rbxcdn.com/95995ef1db79d0124de31f7cf6f018e5.png') // Genel Roblox görseli (İstersen oyun afişiyle değiştirebilirsin kanka)
            .setColor('#f1c40f') // Roblox sarısı/altın rengi tonu
            .setTimestamp()
            .setFooter({ text: `${interaction.guild.name} | Roblox Etkinliği`, iconURL: interaction.guild.iconURL() });

        // Doğrudan verdiğin orijinal linke yönlendiren şık bir buton ekliyoruz kanka
        const butonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('<:Discord_Link:1505166617426923661> Oyuna Katıl (Roblox)')
                    .setURL('https://www.roblox.com/share?code=02306cd6c6c3314dbdef099e121c508e&type=ExperienceDetails&stamp=1779005500109')
                    .setStyle(ButtonStyle.Link)
            );

        // Mesajı kanala gönderiyoruz
        return interaction.reply({ embeds: [oyunEmbed], components: [butonRow] });
    },
};
