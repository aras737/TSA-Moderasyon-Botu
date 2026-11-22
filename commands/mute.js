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
        .setDescription('🔇 Belirtilen kullaniciyı sunucuda susturur (Timeout).')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
        .addUserOption(option =>
            option.setName('kullanici').setDescription('Susturulacak üyeyi seçin.').setRequired(true))
        .addStringOption(option =>
            option.setName('sure').setDescription('Süre girin (Örn: 10m, 1h, 1d)').setRequired(true))
        .addStringOption(option =>
            option.setName('sebep').setDescription('Susturma sebebini yazın.').setMaxLength(500).setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('kullanici', true);
        const durationString = interaction.options.getString('sure', true);
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi.';
        const durationMs = parseDuration(durationString);

        if (!durationMs || durationMs < 5000 || durationMs > MAX_TIMEOUT_MS) {
            return interaction.reply({
                content: '⛔ Geçersiz sure. Örnekler: `10m`, `1h`, `1d`, `1h30m`. En az 5 saniye, en fazla 28 gün.',
                ephemeral: true
            });
        }

        if (target.id === interaction.user.id || target.id === interaction.guild.ownerId) {
            return interaction.reply({ content: '⛔ Kendini veya sunucu sahibini susturamazsın.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            return interaction.editReply({ content: '⚠️ Bu kullanici sunucuda bulunamadı.', ephemeral: true });
        }

        const moderator = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!moderator) {
            return interaction.editReply({ content: '❌ Yetkili bilgisi alınamadı. İşlem iptal edildi.', ephemeral: true });
        }
        if (moderator.id !== interaction.guild.ownerId &&
            moderator.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
            return interaction.editReply({ content: '⛔ Eşit veya daha yüksek rütbeli bir üyeyi susturamazsın.', ephemeral: true });
        }

        const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
        if (!botMember || !member.moderatable || botMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
            return interaction.editReply({ content: '⛔ Botun rol hiyerarşisi bu üyeyi susturmaya izin vermiyor.', ephemeral: true });
        }

        try {
            await member.timeout(durationMs, reason.slice(0, 500));

            const embed = new EmbedBuilder()
                .setTitle('<:Ses:1505164439505342484> TMF | Kullanıcı Susturuldu')
                .setDescription(`**${target.tag}** adlı üye başarıyla susturuldu.`)
                .addFields(
                    { name: '📌 Susturulan', value: `${member}`, inline: true },
                    { name: '📌 Yetkili', value: `${interaction.user}`, inline: true },
                    { name: '📌 Süre', value: `\`${durationString}\``, inline: true },
                    { name: '📌 Sebep', value: reason.slice(0, 1000), inline: false }
                )
                .setColor('#f1c40f')
                .setThumbnail(target.displayAvatarURL())
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Mute komutu hatası:', error);
            return interaction.editReply({ content: '❌ Susturma işlemi sırasında hata oluştu. Botun Moderate Members yetkisini kontrol et.', ephemeral: true });
        }
    }
};