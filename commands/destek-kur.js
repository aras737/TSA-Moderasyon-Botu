const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionsBitField, 
    ChannelType,
    StringSelectMenuBuilder
} = require('discord.js');

module.exports = {
    // Merkezi yetki kontrolü (Sadece Adminler kurabilir)
    requiredPerms: [PermissionsBitField.Flags.Administrator],

    data: new SlashCommandBuilder()
        .setName('destek-kur')
        .setDescription('TSA Moderasyon Destek Sistemini kurar.')
        .addStringOption(option => 
            option.setName('yetkili-roller')
                .setDescription('Yetkili rolleri etiketle (Örn: @Rol1 @Rol2)')
                .setRequired(true)
        )
        .addChannelOption(option => 
            option.setName('log-kanali')
                .setDescription('Bilet kayıtlarının gideceği kanal')
                .setRequired(true)
        ),
    
    async execute(interaction) {
        const rollerInput = interaction.options.getString('yetkili-roller');
        const logKanali = interaction.options.getChannel('log-kanali');
        const rolIDleri = rollerInput.match(/\d+/g); 

        if (!rolIDleri) return interaction.reply({ content: "❌ Geçerli roller girmelisin!", ephemeral: true });

        const anaEmbed = new EmbedBuilder()
            .setTitle('Turkish Armed Forces | Destek')
            .setDescription('Yardıma mı ihtiyacınız var? Aşağıdaki butona tıklayarak bir destek talebi oluşturabilirsiniz. Talebiniz en kısa sürede ekibimiz tarafından yanıtlanacaktır.\n\n🔄 **Moderatör Bileti** — Discord içi sorunlar ve moderasyon desteği.\n🎖️ **General Bileti** — Oyun içi sorunlar ve genel destek.\n💰 **Gamepass Bileti** — Rütbe ve Gamepass sorunları.\n🚨 **Yönetim Bileti** — Üst yönetim gerektiren ciddi konular.')
            .setColor('#2f3136')
            .setImage('https://r.resimlink.com/EnN8AFTihKvk.png')
            .setFooter({ text: 'TSA Destek Sistemi', iconURL: interaction.guild.iconURL() });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`tsa_setup_${rolIDleri.join('-')}_${logKanali.id}`)
                .setLabel('Destek Talebi Oluştur')
                .setEmoji('📩')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ content: `✅ **TSA Destek Sistemi** başarıyla kuruldu.`, ephemeral: true });
        await interaction.channel.send({ embeds: [anaEmbed], components: [row] });
    },

    async interactionHandler(interaction) {
        // --- 1. KATEGORİ SEÇİMİ ---
        if (interaction.isButton() && interaction.customId.startsWith('tsa_setup_')) {
            const data = interaction.customId.split('_');
            const roller = data[2];
            const logID = data[3];

            const menuRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`tsa_create_${roller}_${logID}`)
                    .setPlaceholder('Bilet Kategorisi Seçin...')
                    .addOptions([
                        { label: 'Moderatör Bileti', value: 'Moderatör', emoji: '🔄' },
                        { label: 'General Bileti', value: 'General', emoji: '🎖️' },
                        { label: 'Gamepass Bileti', value: 'Gamepass', emoji: '💰' },
                        { label: 'Yönetim Bileti', value: 'Yönetim', emoji: '🚨' },
                    ])
            );

            await interaction.reply({ content: 'Lütfen sorununuzla ilgili kategoriyi seçin:', components: [menuRow], ephemeral: true });
        }

        // --- 2. BİLET KANALI OLUŞTURMA ---
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('tsa_create_')) {
            const data = interaction.customId.split('_');
            const roller = data[2].split('-');
            const logID = data[3];
            const kategori = interaction.values[0];

            const izinler = [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.ReadMessageHistory] }
            ];
            roller.forEach(r => izinler.push({ id: r, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }));

            const kanal = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: izinler,
                topic: `Açan: ${interaction.user.id} | Kategori: ${kategori} | Log: ${logID}`
            });

            const hosgeldin = new EmbedBuilder()
                .setTitle('TSA Destek Hattı')
                .setThumbnail(interaction.user.displayAvatarURL())
                .setDescription(`Selam ${interaction.user}, **${kategori}** birimi için talebin oluşturuldu.\n\nYetkililerimiz talebini üstlendiğinde burada bilgi göreceksin. Lütfen sorununuzu detaylıca yazın.`)
                .addFields(
                    { name: '👤 Kullanıcı', value: `${interaction.user.tag}`, inline: true },
                    { name: '📂 Kategori', value: `${kategori}`, inline: true }
                )
                .setColor('Blue')
                .setTimestamp();

            const biletButonlar = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tsa_claim').setLabel('Bileti Üstlen').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
                new ButtonBuilder().setCustomId('tsa_fast_close').setLabel('Bileti Kapat').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await kanal.send({ content: `${roller.map(r => `<@&${r}>`).join(' ')} | ${interaction.user}`, embeds: [hosgeldin], components: [biletButonlar] });
            await interaction.update({ content: `✅ Kanalın başarıyla açıldı: ${kanal}`, components: [], ephemeral: true });

            // Log Gönder
            const logKanal = interaction.guild.channels.cache.get(logID);
            if (logKanal) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📩 Yeni Bilet Açıldı')
                    .addFields(
                        { name: 'Kullanıcı', value: `${interaction.user.tag} (${interaction.user.id})` },
                        { name: 'Kategori', value: kategori },
                        { name: 'Kanal', value: `${kanal}` }
                    )
                    .setColor('Green').setTimestamp();
                logKanal.send({ embeds: [logEmbed] });
            }
        }

        // --- 3. BİLETİ ÜSTLENME ---
        if (interaction.isButton() && interaction.customId === 'tsa_claim') {
            const claimEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .addFields({ name: '🛠️ Üstlenen Yetkili', value: `${interaction.user.tag}`, inline: false })
                .setColor('Yellow');

            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tsa_claimed').setLabel('Bilet Üstlenildi').setStyle(ButtonStyle.Success).setDisabled(true).setEmoji('✅'),
                new ButtonBuilder().setCustomId('tsa_fast_close').setLabel('Bileti Kapat').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await interaction.update({ embeds: [claimEmbed], components: [disabledRow] });
            await interaction.followUp({ content: `📢 **${interaction.user.tag}** bu biletle ilgilenmeye başladı!`, ephemeral: false });
        }

        // --- 4. HIZLI KAPATMA VE LOGLAMA ---
        if (interaction.isButton() && interaction.customId === 'tsa_fast_close') {
            const topicData = interaction.channel.topic;
            const logID = topicData.split('Log: ')[1];
            const acanID = topicData.split('Açan: ')[1].split(' |')[0];

            const logKanal = interaction.guild.channels.cache.get(logID);
            if (logKanal) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🔒 Bilet Kapatıldı')
                    .addFields(
                        { name: 'Kanal', value: `\`${interaction.channel.name}\``, inline: true },
                        { name: 'Açan Kişi', value: `<@${acanID}>`, inline: true },
                        { name: 'Kapatan', value: `${interaction.user.tag}`, inline: true }
                    )
                    .setColor('Red').setTimestamp();
                await logKanal.send({ embeds: [logEmbed] });
            }

            await interaction.reply('🔒 **Bilet Kapatıldı.** Kanal 3 saniye içinde imha ediliyor...');
            setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        }
    }
};
