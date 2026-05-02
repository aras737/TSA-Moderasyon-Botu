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
            .setTitle('Turkish Armed Forces')
            .setDescription('Yardıma mı ihtiyacınız var? Aşağıdaki butona tıklayarak bir destek talebi oluşturabilirsiniz. Talebiniz en kısa sürede ekibimiz tarafından yanıtlanacaktır.\n\n🔄 **Moderatör Bileti** — Discord içi sorunlar, kural ihlalleri ve moderasyon desteği için seçiniz.\n🎖️ **General Bileti** — Oyun içi sorunlar, kural ihlalleri ve genel destek için seçiniz.\n💰 **Gamepass Bileti** — Robux ile alınan rütbe/gamepass sorunları için bu kategoriyi seçiniz.\n🚨 **Yönetim Bileti** — Ciddi ve üst yönetim gerektiren önemli konular için bu kategoriyi seçiniz.')
            .setColor('#4a69bd') // Görseldeki maviye yakın ton
            .setImage('https://r.resimlink.com/EnN8AFTihKvk.png'); // Attığın görseldeki resim

        // Görseldeki "Destek Talebi Oluştur" Butonu
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`tsa_op_ticket_${rolIDleri.join('-')}_${logKanali.id}`)
                .setLabel('Destek Talebi Oluştur')
                .setEmoji('📩')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ content: `✅ TEAF Destek Sistemi kuruldu.`, ephemeral: true });
        await interaction.channel.send({ embeds: [anaEmbed], components: [row] });
    },

    async interactionHandler(interaction) {
        // --- 1. BUTONA BASINCA KATEGORİ SEÇİMİ (MENÜ) AÇILIR ---
        if (interaction.isButton() && interaction.customId.startsWith('tsa_op_ticket_')) {
            const data = interaction.customId.split('_');
            const roller = data[3];
            const logID = data[4];

            const menuRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`tsa_cat_${roller}_${logID}`)
                    .setPlaceholder('Kategori Seçiniz...')
                    .addOptions([
                        { label: 'Moderatör Bileti', value: 'Moderatör', emoji: '🔄' },
                        { label: 'General Bileti', value: 'General', emoji: '🎖️' },
                        { label: 'Gamepass Bileti', value: 'Gamepass', emoji: '💰' },
                        { label: 'Yönetim Bileti', value: 'Yönetim', emoji: '🚨' },
                    ])
            );

            await interaction.reply({ content: 'Lütfen bir bilet kategorisi seçin:', components: [menuRow], ephemeral: true });
        }

        // --- 2. KATEGORİ SEÇİLİNCE KANAL AÇMA ---
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('tsa_cat_')) {
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
                name: `destek-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: izinler,
                topic: logID
            });

            const biletEmbed = new EmbedBuilder()
                .setTitle('TEAF Destek Hattı')
                .setDescription(`Selam ${interaction.user}, **${kategori}** birimi için talebin açıldı.\nEn kısa sürede yetkililer seninle ilgilenecek.`)
                .setColor('Blue');

            const kapatButon = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tsa_fast_close').setLabel('Bileti Kapat').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await kanal.send({ content: `${roller.map(r => `<@&${r}>`).join(' ')}`, embeds: [biletEmbed], components: [kapatButon] });
            await interaction.update({ content: `✅ Kanalın başarıyla açıldı: ${kanal}`, components: [], ephemeral: true });
        }

        // --- 3. BİLET KAPAT (OTOMATİK VE HIZLI SİLME) ---
        if (interaction.isButton() && interaction.customId === 'tsa_fast_close') {
            const logID = interaction.channel.topic;

            // Log kanalına mesaj at
            const logKanal = interaction.guild.channels.cache.get(logID);
            if (logKanal) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('Bilet Silindi')
                    .setDescription(`**${interaction.channel.name}** kanalı, **${interaction.user.tag}** tarafından kapatıldı.`)
                    .setColor('Red').setTimestamp();
                logKanal.send({ embeds: [logEmbed] }).catch(() => {});
            }

            // Hiç sormadan direkt kanalı siliyoruz
            await interaction.reply('🔒 Kanal otomatik olarak siliniyor...');
            setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
        }
    }
};
