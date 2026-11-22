const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const { ayarKaydet, ayarGetir } = require('../utils/db');
const { yedekAl } = require('../services/sunucuYedek');

function getSecurityCache(client, guildId) {
    if (!client.sistemBellegi) client.sistemBellegi = new Map();
    let settings = client.sistemBellegi.get(guildId);

    if (!settings) {
        settings = {
            kufur: ayarGetir(guildId, 'kufurEngelDurum', false) === true,
            spam: ayarGetir(guildId, 'spamEngelDurum', false) === true,
            mention: ayarGetir(guildId, 'topluEtiketEngelDurum', false) === true,
            caps: ayarGetir(guildId, 'capsEngelDurum', false) === true
        };
    }

    client.sistemBellegi.set(guildId, settings);
    return settings;
}

module.exports = {
    requiredPerms: [PermissionFlagsBits.Administrator],

    data: new SlashCommandBuilder()
        .setName('koruma')
        .setDescription('TMF güvenlik ve giriş-çıkış koruma ayarlarını yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('durum').setDescription('Bu sunucunun güvenlik ayarlarını gösterir.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('guard')
                .setDescription('Anti-raid Guard korumasını açar veya kapatır.')
                .addBooleanOption(option =>
                    option.setName('aktif').setDescription('Guard koruması aktif olsun mu?').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('yedek-al').setDescription('Sunucunun rol, kanal ve izin yapısının anlık yedeğini alır.'))
        .addSubcommand(subcommand =>
            subcommand.setName('yedek-durum').setDescription('Son sunucu yedeğinin tarihini ve kapsamını gösterir.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('kufur')
                .setDescription('Küfür filtresini açar veya kapatır.')
                .addBooleanOption(option =>
                    option.setName('aktif').setDescription('Küfür filtresi aktif olsun mu?').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('spam')
                .setDescription('3 saniyede 5 mesaj spam korumasını yönetir.')
                .addBooleanOption(option =>
                    option.setName('aktif').setDescription('Spam koruması aktif olsun mu?').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('etiket')
                .setDescription('Toplu etiket korumasını yönetir.')
                .addBooleanOption(option =>
                    option.setName('aktif').setDescription('Toplu etiket koruması aktif olsun mu?').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('caps')
                .setDescription('Büyük harf (caps lock) korumasını yönetir.')
                .addBooleanOption(option =>
                    option.setName('aktif').setDescription('Caps koruması aktif olsun mu?').setRequired(true)))
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
            subcommand.setName('giris-cikis-kapat').setDescription('Üye giriş-çıkış loglarını kapatır.')),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'durum') {
            const guard = ayarGetir(guildId, 'guardAktif', false) === true;
            const kufur = ayarGetir(guildId, 'kufurEngelDurum', false) === true;
            const spam = ayarGetir(guildId, 'spamEngelDurum', false) === true;
            const mention = ayarGetir(guildId, 'topluEtiketEngelDurum', false) === true;
            const caps = ayarGetir(guildId, 'capsEngelDurum', false) === true;
            const girisCikis = ayarGetir(guildId, 'girisCikisDurum', false) === true;
            const channelId = ayarGetir(guildId, 'girisCikisKanal', null);

            const embed = new EmbedBuilder()
                .setTitle('🛡️ TMF | Güvenlik Ayarları')
                .addFields(
                    { name: 'Anti-Raid Guard', value: guard ? '✅ Açık' : '⛔ Kapalı', inline: true },
                    { name: 'Küfür Filtresi', value: kufur ? '✅ Açık' : '⛔ Kapalı', inline: true },
                    { name: 'Spam Koruması', value: spam ? '✅ Açık' : '⛔ Kapalı', inline: true },
                    { name: 'Toplu Etiket', value: mention ? '✅ Açık' : '⛔ Kapalı', inline: true },
                    { name: 'Caps Koruması', value: caps ? '✅ Açık' : '⛔ Kapalı', inline: true },
                    { name: 'Giriş-Çıkış Logları', value: girisCikis ? '✅ Açık' : '⛔ Kapalı', inline: true },
                    { name: 'Giriş-Çıkış Kanalı', value: channelId ? `<#${channelId}>` : 'Ayarlanmamış', inline: false }
                )
                .setColor('#2ecc71')
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === 'yedek-al') {
            await interaction.deferReply({ ephemeral: true });
            const backup = await yedekAl(interaction.guild);
            if (!backup) {
                return interaction.editReply('❌ Yedek alınamadı. Botun kanal ve rol bilgilerini görüntüleme izinlerini kontrol et.');
            }
            return interaction.editReply(
                '✅ Sunucu yedeği alındı. ' + backup.roller.length + ' rol ve ' +
                backup.kanallar.length + ' kanal kaydedildi. Tarih: ' + backup.alinmaZamani
            );
        }

        if (subcommand === 'yedek-durum') {
            const backup = ayarGetir(guildId, 'sunucuYedek', null);
            if (!backup?.alinmaZamani) {
                return interaction.reply({ content: '⚠️ Henüz sunucu yedeği yok. Önce /koruma yedek-al komutunu kullan.', ephemeral: true });
            }
            return interaction.reply({
                content: '🗂️ Son yedek: ' + new Date(backup.alinmaZamani).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) +
                    '\\nRoller: ' + (backup.roller?.length || 0) +
                    '\\nKanallar: ' + (backup.kanallar?.length || 0),
                ephemeral: true
            });
        }

        if (subcommand === 'guard') {
            const enabled = interaction.options.getBoolean('aktif', true);
            if (enabled) {
                await interaction.deferReply({ ephemeral: true });
                const backup = await yedekAl(interaction.guild);
                if (!backup) {
                    return interaction.editReply('⛔ Yedek alınamadığı için Anti-Raid açılmadı. Önce bot izinlerini düzelt.');
                }
                ayarKaydet(guildId, 'guardAktif', true);
                return interaction.editReply(
                    '✅ TMF Anti-Raid etkinleştirildi. Ön güvenlik yedeği alındı: ' +
                    backup.roller.length + ' rol, ' + backup.kanallar.length + ' kanal.'
                );
            }

            ayarKaydet(guildId, 'guardAktif', false);
            return interaction.reply({
                content: '⛔ TMF Anti-Raid Guard bu sunucuda devre dışı bırakıldı.',
                ephemeral: true
            });
        }

        const filters = {
            kufur: { cacheKey: 'kufur', dbKey: 'kufurEngelDurum', label: 'Küfür filtresi' },
            spam: { cacheKey: 'spam', dbKey: 'spamEngelDurum', label: 'Spam koruması' },
            etiket: { cacheKey: 'mention', dbKey: 'topluEtiketEngelDurum', label: 'Toplu etiket koruması' },
            caps: { cacheKey: 'caps', dbKey: 'capsEngelDurum', label: 'Caps koruması' }
        };

        if (filters[subcommand]) {
            const enabled = interaction.options.getBoolean('aktif', true);
            const filter = filters[subcommand];
            ayarKaydet(guildId, filter.dbKey, enabled);

            const settings = getSecurityCache(interaction.client, guildId);
            settings[filter.cacheKey] = enabled;
            interaction.client.sistemBellegi.set(guildId, settings);

            return interaction.reply({
                content: enabled
                    ? `✅ ${filter.label} etkinleştirildi.`
                    : `⛔ ${filter.label} devre dışı bırakıldı.`,
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
