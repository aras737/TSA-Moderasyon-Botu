const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const { ayarKaydet, ayarGetir } = require('../utils/db');

module.exports = {
    requiredPerms: [PermissionFlagsBits.Administrator],

    data: new SlashCommandBuilder()
        .setName('koruma')
        .setDescription('TMF güvenlik ve giriş-çıkış koruma ayarlarını yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('durum')
                .setDescription('Bu sunucunun güvenlik ayarlarını gösterir.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('guard')
                .setDescription('Anti-raid Guard korumasını açar veya kapatır.')
                .addBooleanOption(option =>
                    option.setName('aktif')
                        .setDescription('Guard koruması aktif olsun mu?')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('kufur')
                .setDescription('Küfür filtresini açar veya kapatır.')
                .addBooleanOption(option =>
                    option.setName('aktif')
                        .setDescription('Küfür filtresi aktif olsun mu?')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('giris-cikis')
                .setDescription('Üye giriş-çıkış log kanalını ayarlar.')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Giriş-çıkış mesajlarının gönderileceği kanal.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('giris-cikis-kapat')
                .setDescription('Üye giriş-çıkış loglarını kapatır.')),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'durum') {
            const guard = ayarGetir(guildId, 'guardAktif', false) === true;
            const kufur = ayarGetir(guildId, 'kufurEngelDurum', false) === true;
            const girisCikis = ayarGetir(guildId, 'girisCikisDurum', false) === true;
            const channelId = ayarGetir(guildId, 'girisCikisKanal', null);

            const embed = new EmbedBuilder()
                .setTitle('🛡️ TMF | Güvenlik Ayarları')
                .addFields(
                    { name: 'Anti-Raid Guard', value: guard ? '✅ Açık' : '⛔ Kapalı', inline: true },
                    { name: 'Küfür Filtresi', value: kufur ? '✅ Açık' : '⛔ Kapalı', inline: true },
                    { name: 'Giriş-Çıkış Logları', value: girisCikis ? '✅ Açık' : '⛔ Kapalı', inline: true },
                    { name: 'Giriş-Çıkış Kanalı', value: channelId ? `<#${channelId}>` : 'Ayarlanmamış', inline: false }
                )
                .setColor('#2ecc71')
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === 'guard') {
            const enabled = interaction.options.getBoolean('aktif', true);
            ayarKaydet(guildId, 'guardAktif', enabled);
            return interaction.reply({
                content: enabled
                    ? '✅ TMF Anti-Raid Guard bu sunucuda etkinleştirildi.'
                    : '⛔ TMF Anti-Raid Guard bu sunucuda devre dışı bırakıldı.',
                ephemeral: true
            });
        }

        if (subcommand === 'kufur') {
            const enabled = interaction.options.getBoolean('aktif', true);
            ayarKaydet(guildId, 'kufurEngelDurum', enabled);

            if (!interaction.client.sistemBellegi) {
                interaction.client.sistemBellegi = new Map();
            }
            const settings = interaction.client.sistemBellegi.get(guildId) || {};
            settings.kufur = enabled;
            interaction.client.sistemBellegi.set(guildId, settings);

            return interaction.reply({
                content: enabled
                    ? '✅ Küfür filtresi etkinleştirildi. Spam, etiket ve büyük harf korumaları ayrıca çalışmaya devam eder.'
                    : '⛔ Küfür filtresi kapatıldı. Spam, etiket ve büyük harf korumaları çalışmaya devam eder.',
                ephemeral: true
            });
        }

        if (subcommand === 'giris-cikis') {
            const channel = interaction.options.getChannel('kanal', true);
            const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
            const permissions = botMember ? channel.permissionsFor(botMember) : null;

            if (!permissions?.has(PermissionFlagsBits.ViewChannel) ||
                !permissions.has(PermissionFlagsBits.SendMessages) ||
                !permissions.has(PermissionFlagsBits.EmbedLinks)) {
                return interaction.reply({
                    content: '⛔ Botun seçilen kanalda Görüntüle, Mesaj Gönder ve Embed Bağlantıları izinleri olmalı.',
                    ephemeral: true
                });
            }

            ayarKaydet(guildId, 'girisCikisKanal', channel.id);
            ayarKaydet(guildId, 'girisCikisDurum', true);

            return interaction.reply({
                content: `✅ Giriş-çıkış logları ${channel} kanalında etkinleştirildi.`,
                ephemeral: true
            });
        }

        if (subcommand === 'giris-cikis-kapat') {
            ayarKaydet(guildId, 'girisCikisDurum', false);
            return interaction.reply({
                content: '⛔ Üye giriş-çıkış logları kapatıldı.',
                ephemeral: true
            });
        }
    }
};
