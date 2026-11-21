const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

function parseDuration(input) {
    if (typeof input !== 'string') return null;
    const value = input.trim().toLowerCase();
    if (!value) return null;

    const units = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
    const pattern = /(\d+)\s*(s|m|h|d|w)/g;
    let total = 0;
    let consumed = '';
    let match;

    while ((match = pattern.exec(value)) !== null) {
        total += Number(match[1]) * units[match[2]];
        consumed += match[0];
        if (!Number.isSafeInteger(total) || total > MAX_TIMEOUT_MS) return null;
    }

    return consumed.replace(/\s/g, '') === value.replace(/\s/g, '') ? total : null;
}

module.exports = {
    requiredPerms: [PermissionsBitField.Flags.ModerateMembers],

    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Belirtilen kullanıcıyı sunucuda susturur (Timeout).')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
        .addUserOption(option =>
            option.setName('kullanıcı').setDescription('Susturulacak üyeyi seçin.').setRequired(true))
        .addStringOption(option =>
            option.setName('süre').setDescription('Süre girin (Örn: 10m, 1h, 1d)').setRequired(true))
        .addStringOption(option =>
            option.setName('sebep').setDescription('Susturma sebebini yazın.').setMaxLength(500).setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('kullanıcı', true);
        const durationString = interaction.options.getString('süre', true);
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi.';
        const durationMs = parseDuration(durationString);

        if (!durationMs || durationMs < 5000 || durationMs > MAX_TIMEOUT_MS) {
            return interaction.reply({
                content: '⛔ Geçersiz süre. Örnekler: `10m`, `1h`, `1d`, `1h30m`. En az 5 saniye, en fazla 28 gün.',
                ephemeral: true
            });
        }

        if (target.id === interaction.user.id || target.id === interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ Kendini veya sunucu sahibini susturamazsın.', ephemeral: true });
        }

        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: '⚠️ Bu kullanıcı sunucuda bulunamadı.', ephemeral: true });
        }

        const moderator = interaction.member;
        if (moderator.id !== interaction.guild.ownerId &&
            moderator.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
            return interaction.reply({ content: '⛔ Eşit veya daha yüksek rütbeli bir üyeyi susturamazsın.', ephemeral: true });
        }

        const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
        if (!botMember || !member.moderatable || botMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
            return interaction.reply({ content: '⛔ Botun rol hiyerarşisi bu üyeyi susturmaya izin vermiyor.', ephemeral: true });
        }

        try {
            await member.timeout(durationMs, reason.slice(0, 500));

            const embed = new EmbedBuilder()
                .setTitle('<:Ses:1505164439505342484> TMF | Kullanıcı Susturuldu')
                .setDescription(`**${target.tag}** adlı üye başarıyla susturuldu.`)
                .addFields(
                    { name: 'Susturulan', value: `${member}`, inline: true },
                    { name: 'Yetkili', value: `${interaction.user}`, inline: true },
                    { name: 'Süre', value: `\`${durationString}\``, inline: true },
                    { name: 'Sebep', value: reason.slice(0, 1000), inline: false }
                )
                .setColor('#f1c40f')
                .setThumbnail(target.displayAvatarURL())
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Mute komutu hatası:', error);
            return interaction.reply({ content: '❌ Susturma işlemi sırasında hata oluştu. Botun Moderate Members yetkisini kontrol et.', ephemeral: true });
        }
    }
};