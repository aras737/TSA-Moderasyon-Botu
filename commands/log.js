const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { ayarKaydet, ayarGetir } = require('../utils/db');

module.exports = {
    requiredPerms: [PermissionFlagsBits.Administrator],

    data: new SlashCommandBuilder()
        .setName('log')
        .setDescription('TMF Log sistemini yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('kanali-ayarla')
                .setDescription('Sunucudaki olayların kaydedileceği log kanalını belirler.')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Log kanalı olacak metin kanalı.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('goster')
                .setDescription('Ayarlı log kanalını gosterir.'))
        .addSubcommand(subcommand =>
            subcommand.setName('kapat')
                .setDescription('Log sistemini kapatır.')),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'kanali-ayarla') {
            const channel = interaction.options.getChannel('kanal', true);
            const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
            const permissions = botMember ? channel.permissionsFor(botMember) : null;

            if (!permissions?.has(PermissionFlagsBits.ViewChannel) ||
                !permissions.has(PermissionFlagsBits.SendMessages) ||
                !permissions.has(PermissionFlagsBits.EmbedLinks)) {
                return interaction.reply({
                    content: '⛔ Botun seçilen log kanalında Görüntüle, Mesaj Gönder ve Embed Bağlantıları izinleri olmalı.',
                    ephemeral: true
                });
            }

            ayarKaydet(guildId, 'logKanal', channel.id);

            const embed = new EmbedBuilder()
                .setTitle('⚙️ TMF | Log Sistemi Aktif')
                .setDescription(`Sunucu olayları artık ${channel} kanalına kaydedilecek. Bu ayar bot yeniden başlatıldığında korunur.`)
                .setColor('#2ecc71')
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === 'goster') {
            const channelId = ayarGetir(guildId, 'logKanal', null);
            if (!channelId) {
                return interaction.reply({
                    content: '⚠️ Henüz log kanalı ayarlanmamış. `/log kanali-ayarla` kullan.',
                    ephemeral: true
                });
            }

            const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
            const embed = new EmbedBuilder()
                .setTitle('📋 TMF | Log Kanalı Bilgisi')
                .setDescription(channel ? `Log kanalı: ${channel}` : 'Kayıtlı kanal bulunamadı veya silinmiş.')
                .addFields(
                    { name: 'Kanal ID', value: `\`${channelId}\``, inline: true },
                    { name: 'Durum', value: channel ? '✅ Aktif' : '⚠️ Kanal bulunamadı', inline: true }
                )
                .setColor('#3498db')
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === 'kapat') {
            ayarKaydet(guildId, 'logKanal', null);
            return interaction.reply({
                content: '⛔ Bu sunucu için log sistemi kapatıldı.',
                ephemeral: true
            });
        }
    }
};
