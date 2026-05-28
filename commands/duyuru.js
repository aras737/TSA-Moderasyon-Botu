const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duyuru')
        .setDescription('Sunucuda gelişmiş duyuru gönderir kanka.')
        
        // 🔒 DISCORD'UN KENDİ GÜVENLİK YETKİSİ:
        // Buraya hangi temel yetkiyi istiyorsan onu yazıyorsun kanka. 
        // Örn: PermissionFlagsBits.ManageMessages (Mesajları Yönet) veya PermissionFlagsBits.Administrator (Yönetici)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) 
        
        .addStringOption(opt => opt.setName('başlık').setDescription('Duyurunun başlığı').setRequired(true))
        .addStringOption(opt => opt.setName('içerik').setDescription('Duyurunun içeriği').setRequired(true))
        .addChannelOption(opt => 
            opt.setName('hedef')
                .setDescription('Duyurunun gönderileceği kanal (Boş bırakırsan olduğun kanala gönderir)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)) 
        .addStringOption(opt => 
            opt.setName('tip')
                .setDescription('Duyuru tipi (Görsel kutu mu, düz yazı mı?)')
                .setRequired(false)
                .addChoices(
                    { name: 'Embed (Şık Kutu)', value: 'embed' },
                    { name: 'Düz Yazı', value: 'text' }
                ))
        .addStringOption(opt => opt.setName('resim').setDescription('Duyuruya eklenecek resim URL\'si (Opsiyonel)').setRequired(false))
        .addStringOption(opt => opt.setName('footer').setDescription('Alt yazı (Opsiyonel)').setRequired(false))
        .addBooleanOption(opt => opt.setName('everyone').setDescription('@everyone ile gönderilsin mi?').setRequired(false)),

    async execute(interaction) {
        // Kodun içinde hiçbir manuel if(rol) kontrolü yok, Discord yetkiyi otomatik denetliyor!
        const baslik = interaction.options.getString('başlık');
        const icerik = interaction.options.getString('içerik');
        const hedefKanal = interaction.options.getChannel('hedef') || interaction.channel;
        const tip = interaction.options.getString('tip') || 'embed';
        const resim = interaction.options.getString('resim');
        const footer = interaction.options.getString('footer');
        const everyoneKontrol = interaction.options.getBoolean('everyone') || false;

        const yetkiliEnYuksekRol = interaction.member.roles.highest.name;
        const yetkiliIsim = interaction.user.username;

        // Botun kanala yazma yetkisi var mı kontrolü
        if (!hedefKanal.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.SendMessages)) {
            return interaction.reply({ content: `❌ Kanka ${hedefKanal} kanalına mesaj gönderme yetkim yok!`, ephemeral: true });
        }

        await interaction.reply({ content: `🚀 Duyuru başarıyla ${hedefKanal} kanalına iletildi kanka.`, ephemeral: true });

        const etiketIcerigi = everyoneKontrol ? '@everyone' : '';

        if (tip === 'embed') {
            const duyuruEmbed = new EmbedBuilder()
                .setTitle(baslik)
                .setDescription(`${icerik}\n\n*[${yetkiliEnYuksekRol}] ${yetkiliIsim} tarafından.*`)
                .setColor('#f1c40f')
                .setTimestamp();

            if (resim) duyuruEmbed.setImage(resim);
            if (footer) duyuruEmbed.setFooter({ text: footer });

            if (everyoneKontrol) {
                await hedefKanal.send({ content: etiketIcerigi, embeds: [duyuruEmbed] });
            } else {
                await hedefKanal.send({ embeds: [duyuruEmbed] });
            }
        } else {
            let duzMetin = `📢 **${baslik}**\n\n${icerik}\n\n*[${yetkiliEnYuksekRol}] ${yetkiliIsim} tarafından.*\n`;
            if (footer) duzMetin += `\n*${footer}*`;
            if (everyoneKontrol) duzMetin += `\n\n${etIketIcerigi}`;

            await hedefKanal.send({ content: duzMetin });
        }
    }
};
