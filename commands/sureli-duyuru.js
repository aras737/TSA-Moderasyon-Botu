const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

function canSendEmbed(channel, botMember) {
    const permissions = channel?.permissionsFor?.(botMember);
    return Boolean(
        permissions?.has(PermissionFlagsBits.ViewChannel) &&
        permissions.has(PermissionFlagsBits.SendMessages) &&
        permissions.has(PermissionFlagsBits.EmbedLinks)
    );
}

function stopLoop(client, key) {
    const timer = client.sureliDuyurular?.get(key);
    if (!timer) return false;
    clearInterval(timer);
    client.sureliDuyurular.delete(key);
    return true;
}

module.exports = {
    requiredPerms: [PermissionFlagsBits.ManageMessages],

    data: new SlashCommandBuilder()
        .setName('sureli-duyuru')
        .setDescription('Belirli kanala veya tüm uygun kanallara zaman ayarlı duyuru kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcommand =>
            subcommand
                .setName('baslat')
                .setDescription('Periyodik duyuru döngüsünü başlatır.')
                .addIntegerOption(option =>
                    option.setName('dakika')
                        .setDescription('Duyuru aralığı (dakika).')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(10080))
                .addStringOption(option =>
                    option.setName('mesaj')
                        .setDescription('Duyurulacak mesaj metni.')
                        .setRequired(true)
                        .setMaxLength(3500))
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Duyurunun gönderileceği kanal.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('hepsi')
                        .setDescription('Uygun tüm metin kanallarına kurulsun mu?')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('durdur')
                .setDescription('Aktif duyuru döngüsünü sonlandırır.')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Duyurusu durdurulacak kanal.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('hepsi')
                        .setDescription('Sunucudaki tüm duyuru döngülerini iptal eder.')
                        .setRequired(false))),

    async execute(interaction) {
        const client = interaction.client;
        if (!client.sureliDuyurular) client.sureliDuyurular = new Map();

        const guild = interaction.guild;
        const guildId = guild.id;
        const subcommand = interaction.options.getSubcommand();
        const selectedChannel = interaction.options.getChannel('kanal');
        const targetChannel = selectedChannel || interaction.channel;
        const allChannels = interaction.options.getBoolean('hepsi') === true;

        if (subcommand === 'baslat') {
            const dakika = interaction.options.getInteger('dakika', true);
            const mesajMetni = interaction.options.getString('mesaj', true).trim();

            if (!mesajMetni) {
                return interaction.reply({ content: '⚠️ Duyuru mesajı boş olamaz.', ephemeral: true });
            }

            const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
            if (!botMember) {
                return interaction.reply({ content: '❌ Botun sunucu üye bilgisi alınamadı.', ephemeral: true });
            }

            const duyuruEmbed = new EmbedBuilder()
                .setTitle('📢 TMF | OTOMATİK DUYURU')
                .setDescription(mesajMetni.replace(/\\n/g, '\n'))
                .setColor('#3498db')
                .setTimestamp()
                .setFooter({ text: 'Bu bir periyodik sistem duyurusudur.' });

            const preview = mesajMetni.length > 900
                ? `${mesajMetni.slice(0, 900)}…`
                : mesajMetni;

            const startLoop = channel => {
                const key = `${guildId}_${channel.id}`;
                stopLoop(client, key);

                const timer = setInterval(async () => {
                    try {
                        const currentChannel = await guild.channels.fetch(channel.id).catch(() => null);
                        if (!currentChannel || !canSendEmbed(currentChannel, botMember)) {
                            stopLoop(client, key);
                            console.warn(`TMF süreli duyuru durduruldu: ${channel.id} kanalına erişilemiyor.`);
                            return;
                        }

                        await currentChannel.send({ embeds: [duyuruEmbed] });
                    } catch (error) {
                        console.error(`[TMF Süreli Duyuru] ${channel.id} gönderim hatası:`, error.message);
                    }
                }, dakika * 60 * 1000);

                timer.unref?.();
                client.sureliDuyurular.set(key, timer);
            };

            if (allChannels) {
                const channels = await guild.channels.fetch();
                const eligibleChannels = channels.filter(channel =>
                    channel?.type === ChannelType.GuildText && canSendEmbed(channel, botMember)
                );

                if (eligibleChannels.size === 0) {
                    return interaction.reply({
                        content: '⚠️ Botun mesaj ve embed gönderme izni olan bir metin kanalı bulunamadı.',
                        ephemeral: true
                    });
                }

                for (const channel of eligibleChannels.values()) startLoop(channel);

                const embed = new EmbedBuilder()
                    .setTitle('✅ TMF | Küresel Duyuru Aktif')
                    .setDescription(`${eligibleChannels.size} uygun metin kanalında periyodik duyuru başlatıldı.`)
                    .addFields(
                        { name: '⏰ Aralık', value: `${dakika} dakika`, inline: true },
                        { name: '💬 Mesaj Önizlemesi', value: preview, inline: false }
                    )
                    .setColor('#107a29');

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (!canSendEmbed(targetChannel, botMember)) {
                return interaction.reply({
                    content: '⛔ Botun seçilen kanalda Görüntüle, Mesaj Gönder ve Embed Bağlantıları izinleri olmalı.',
                    ephemeral: true
                });
            }

            startLoop(targetChannel);

            const embed = new EmbedBuilder()
                .setTitle('✅ TMF | Süreli Duyuru Aktif')
                .setDescription(`${targetChannel} kanalında periyodik duyuru başlatıldı.`)
                .addFields(
                    { name: '⏰ Aralık', value: `${dakika} dakika`, inline: true },
                    { name: '💬 Mesaj Önizlemesi', value: preview, inline: false }
                )
                .setColor('#107a29');

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === 'durdur') {
            if (allChannels) {
                let stopped = 0;

                for (const key of [...client.sureliDuyurular.keys()]) {
                    if (key.startsWith(`${guildId}_`) && stopLoop(client, key)) {
                        stopped++;
                    }
                }

                return interaction.reply({
                    content: `✅ Bu sunucuda ${stopped} süreli duyuru döngüsü durduruldu.`,
                    ephemeral: true
                });
            }

            const key = `${guildId}_${targetChannel.id}`;
            if (!stopLoop(client, key)) {
                return interaction.reply({
                    content: `⚠️ ${targetChannel} kanalında çalışan bir periyodik duyuru döngüsü yok.`,
                    ephemeral: true
                });
            }

            return interaction.reply({
                content: `✅ ${targetChannel} kanalındaki periyodik duyuru durduruldu.`,
                ephemeral: true
            });
        }
    }
};
