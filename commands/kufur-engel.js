const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('küfür-engel')
        .setDescription('TSA Gelişmiş küfür engel sistemini yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('aç')
                .setDescription('Küfür engel sistemini aktif eder. Komutu kullandığınız kanal log kanalı olur.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('kapat')
                .setDescription('Küfür engel sistemini kapatır.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('durum')
                .setDescription('Küfür engel sisteminin mevcut durumunu gösterir.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('sıfırla')
                .setDescription('Bir kullanıcının küfür uyarı sayısını sıfırlar.')
                .addUserOption(option =>
                    option
                        .setName('kullanıcı')
                        .setDescription('Uyarısı sıfırlanacak kullanıcı')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const client = interaction.client;

        // ── /küfür-engel aç ──
        if (subcommand === 'aç') {
            client.sistemBellegi.set(guildId, {
                durum: true,
                logKanalId: interaction.channel.id
            });

            const embed = new EmbedBuilder()
                .setTitle('✅ Küfür Engel Sistemi Aktif')
                .setDescription(
                    `Sistem bu sunucudaki **bütün kanallar** için başarıyla açıldı!\n\n` +
                    `📢 **Log Kanalı:** ${interaction.channel}\n` +
                    `🛡️ **Koruma:** Mesaj yazma + Mesaj düzenleme\n` +
                    `⚡ **Filtre:** Leet speak, harf uzatma, sembol atlatma\n` +
                    `⚠️ **Otomatik Mute:** 5 uyarıda 10 dakika susturma\n` +
                    `👤 **Muaf:** Yönetici ve Mesajları Yönet yetkilileri`
                )
                .setColor('Green')
                .setTimestamp()
                .setFooter({ text: 'TSA Gelişmiş Küfür Filtre Sistemi v2' });

            return interaction.reply({ embeds: [embed] });
        }

        // ── /küfür-engel kapat ──
        if (subcommand === 'kapat') {
            client.sistemBellegi.delete(guildId);

            const embed = new EmbedBuilder()
                .setTitle('❌ Küfür Engel Sistemi Kapatıldı')
                .setDescription('Sistem devre dışı bırakıldı. Artık kanallar taranmayacak.')
                .setColor('Red')
                .setTimestamp()
                .setFooter({ text: 'TSA Gelişmiş Küfür Filtre Sistemi v2' });

            return interaction.reply({ embeds: [embed] });
        }

        // ── /küfür-engel durum ──
        if (subcommand === 'durum') {
            const ayar = client.sistemBellegi.get(guildId);
            const aktifMi = ayar?.durum || false;
            const logKanali = ayar?.logKanalId
                ? `<#${ayar.logKanalId}>`
                : 'Ayarlanmamış';

            const embed = new EmbedBuilder()
                .setTitle('📊 Küfür Engel Sistemi — Durum Raporu')
                .setColor(aktifMi ? 'Green' : 'Red')
                .addFields(
                    { name: 'Durum', value: aktifMi ? '🟢 **Aktif**' : '🔴 **Kapalı**', inline: true },
                    { name: 'Log Kanalı', value: logKanali, inline: true },
                    { name: 'Filtre Özellikleri', value: 'Leet speak, harf uzatma, sembol atlatma, Türkçe karakter varyantları', inline: false },
                    { name: 'Otomatik Mute', value: '5 uyarıda 10 dakika susturma', inline: false },
                    { name: 'Muaf Yetkiler', value: 'Yönetici, Mesajları Yönet', inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'TSA Gelişmiş Küfür Filtre Sistemi v2' });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // ── /küfür-engel sıfırla ──
        if (subcommand === 'sıfırla') {
            const hedefKullanici = interaction.options.getUser('kullanıcı');

            // Uyarı sıfırlama — events/kufurengel.js ile aynı Map referansını kullanmamız lazım
            // Bunun için client üzerinden erişim sağlıyoruz
            if (client.kufurUyariTakibi) {
                const anahtar = `${guildId}-${hedefKullanici.id}`;
                const onceki = client.kufurUyariTakibi.get(anahtar);
                client.kufurUyariTakibi.delete(anahtar);

                const embed = new EmbedBuilder()
                    .setTitle('🔄 Uyarı Sıfırlandı')
                    .setDescription(
                        `**${hedefKullanici.tag}** kullanıcısının küfür uyarıları sıfırlandı.\n` +
                        `Önceki uyarı sayısı: **${onceki?.sayi || 0}**`
                    )
                    .setColor('Blue')
                    .setTimestamp()
                    .setFooter({ text: 'TSA Gelişmiş Küfür Filtre Sistemi v2' });

                return interaction.reply({ embeds: [embed] });
            } else {
                return interaction.reply({
                    content: '⚠️ Uyarı takip sistemi henüz yüklenmemiş. Botu yeniden başlatın.',
                    ephemeral: true
                });
            }
        }
    }
};
