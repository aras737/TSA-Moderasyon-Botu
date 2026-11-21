const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    requiredPerms: [PermissionFlagsBits.ManageMessages],

    data: new SlashCommandBuilder()
        .setName('duyuru')
        .setDescription('Sunucuda gelişmiş duyuru gönderir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt => opt.setName('başlık').setDescription('Duyurunun başlığı').setMaxLength(256).setRequired(true))
        .addStringOption(opt => opt.setName('içerik').setDescription('Duyurunun içeriği').setMaxLength(3500).setRequired(true))
        .addChannelOption(opt => opt.setName('hedef').setDescription('Duyurunun gönderileceği kanal').addChannelTypes(ChannelType.GuildText).setRequired(false))
        .addStringOption(opt => opt.setName('tip').setDescription('Duyuru tipi').setRequired(false).addChoices(
            { name: 'Embed (Şık Kutu)', value: 'embed' },
            { name: 'Düz Yazı', value: 'text' }
        ))
        .addStringOption(opt => opt.setName('resim').setDescription('Duyuru görselinin HTTPS URL adresi').setMaxLength(500).setRequired(false))
        .addStringOption(opt => opt.setName('footer').setDescription('Alt yazı').setMaxLength(2048).setRequired(false))
        .addBooleanOption(opt => opt.setName('everyone').setDescription('@everyone ile gönderilsin mi?').setRequired(false)),

    async execute(interaction) {
        const baslik = interaction.options.getString('başlık', true);
        const icerik = interaction.options.getString('içerik', true);
        const hedefKanal = interaction.options.getChannel('hedef') || interaction.channel;
        const tip = interaction.options.getString('tip') || 'embed';
        const resim = interaction.options.getString('resim');
        const footer = interaction.options.getString('footer');
        const everyone = interaction.options.getBoolean('everyone') ?? false;

        const moderatorPermissions = interaction.memberPermissions;
        if (everyone && !moderatorPermissions?.has(PermissionFlagsBits.MentionEveryone) &&
            !moderatorPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '⛔ @everyone kullanmak için Mention Everyone yetkisine sahip olmalısın.', ephemeral: true });
        }

        const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
        if (!botMember) {
            return interaction.reply({ content: '❌ Bot üye bilgisi alınamadı.', ephemeral: true });
        }

        const botPermissions = hedefKanal.permissionsFor(botMember);
        if (!botPermissions?.has(PermissionFlagsBits.SendMessages) ||
            (tip === 'embed' && !botPermissions.has(PermissionFlagsBits.EmbedLinks))) {
            return interaction.reply({ content: '❌ Botun seçilen kanalda mesaj veya embed gönderme yetkisi yok.', ephemeral: true });
        }
        if (everyone && !botPermissions.has(PermissionFlagsBits.MentionEveryone)) {
            return interaction.reply({ content: '❌ Botun seçilen kanalda @everyone etiketleme yetkisi yok.', ephemeral: true });
        }

        if (resim) {
            try {
                const parsed = new URL(resim);
                if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('URL scheme');
            } catch {
                return interaction.reply({ content: '⚠️ Görsel için geçerli bir HTTP/HTTPS URL adresi gir.', ephemeral: true });
            }
        }

        const roleName = interaction.member.roles.highest?.name || 'Yetkili';
        const byline = `[ ${roleName} ] ${interaction.user.username} tarafından.`;
        const allowedMentions = everyone ? { parse: ['everyone'] } : { parse: [] };

        try {
            if (tip === 'embed') {
                const embed = new EmbedBuilder()
                    .setTitle(baslik)
                    .setDescription(`${icerik}\n\n*${byline}*`)
                    .setColor('#f1c40f')
                    .setTimestamp();
                if (resim) embed.setImage(resim);
                if (footer) embed.setFooter({ text: footer });

                await hedefKanal.send({
                    content: everyone ? '@everyone' : undefined,
                    embeds: [embed],
                    allowedMentions
                });
            } else {
                let text = `📢 **${baslik}**\n\n${icerik}\n\n*${byline}*`;
                if (footer) text += `\n\n*${footer}*`;
                if (everyone) text = `@everyone\n${text}`;

                // Discord mesaj sınırına sığmayan içerikleri sessizce kırpmak yerine reddet.
                if (text.length > 2000) {
                    return interaction.reply({ content: '⚠️ Düz yazı duyurusu 2.000 karakter sınırını aşıyor.', ephemeral: true });
                }
                await hedefKanal.send({ content: text, allowedMentions });
            }

            return interaction.reply({ content: `✅ Duyuru ${hedefKanal} kanalına gönderildi.`, ephemeral: true });
        } catch (error) {
            console.error('Duyuru gönderme hatası:', error);
            return interaction.reply({ content: '❌ Duyuru gönderilemedi. Kanal izinlerini ve görsel adresini kontrol et.', ephemeral: true });
        }
    }
};