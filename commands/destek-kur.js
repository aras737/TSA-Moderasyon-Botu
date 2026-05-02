const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionsBitField, 
    ChannelType 
} = require('discord.js');

module.exports = {
    // Merkezi yetki kontrolü: Sadece Yönetici yetkisi olanlar kurabilir
    requiredPerms: [PermissionsBitField.Flags.Administrator],

    data: new SlashCommandBuilder()
        .setName('destek-kur')
        .setDescription('TSA Gelişmiş Destek Sistemi')
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
            .setTitle('Turkish Armed Forces | Destek Merkezi')
            .setDescription('Yardıma mı ihtiyacınız var? Aşağıdaki menüden kategori seçerek bir talep oluşturun.')
            .setColor(0x2f3136)
            .setImage('https://r.resimlink.com/7p9L1Q.jpg');

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`tsa_ticket_${rolIDleri.join('-')}_${logKanali.id}`)
                .setPlaceholder('Kategori Seçiniz...')
                .addOptions([
                    { label: 'Moderatör Bileti', value: 'Moderatör', emoji: '🔄' },
                    { label: 'General Bileti', value: 'General', emoji: '🎖️' },
                    { label: 'Gamepass Bileti', value: 'Gamepass', emoji: '💰' },
                ])
        );

        await interaction.reply({ content: `✅ Sistem ${rolIDleri.length} yetkili rolüyle kuruldu.`, ephemeral: true });
        await interaction.channel.send({ embeds: [anaEmbed], components: [menu] });
    },

    async interactionHandler(interaction) {
        // --- 1. TICKET AÇMA ---
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('tsa_ticket_')) {
            const data = interaction.customId.split('_');
            const roller = data[2].split('-');
            const logID = data[3];

            const izinler = [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.ReadMessageHistory] }
            ];
            roller.forEach(r => izinler.push({ id: r, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }));

            const kanal = await interaction.guild.channels.create({
                name: `destek-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: izinler,
                topic: logID // Log kanalını buraya saklıyoruz
            });

            const hosgeldin = new EmbedBuilder()
                .setTitle('TSA Destek Hattı')
                .setDescription(`Selam ${interaction.user}, talebin açıldı. Yetkililer en kısa sürede burada olacak.`)
                .setColor('Blue')
                .setFooter({ text: 'Kapatmak için aşağıdaki butona basın.' });

            const kapatButon = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tsa_kapat_iste').setLabel('Talebi Kapat').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await kanal.send({ content: `${roller.map(r => `<@&${r}>`).join(' ')}`, embeds: [hosgeldin], components: [kapatButon] });
            await interaction.reply({ content: `✅ Kanalın açıldı: ${kanal}`, ephemeral: true });
        }

        // --- 2. KAPATMA İLK BASIŞ (ONAY) ---
        if (interaction.isButton() && interaction.customId === 'tsa_kapat_iste') {
            const onayEmbed = new EmbedBuilder()
                .setTitle('Kapatma Onayı')
                .setDescription('Bu bileti kapatmak istediğinizden emin misiniz? Kanal kalıcı olarak silinecektir.')
                .setColor('Yellow');

            const onayRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tsa_kapat_kesin').setLabel('Evet, Kapat').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('tsa_kapat_iptal').setLabel('Vazgeç').setStyle(ButtonStyle.Secondary)
            );

            return interaction.reply({ embeds: [onayEmbed], components: [onayRow], ephemeral: false });
        }

        // --- 3. KESİN SİLME (ONAYLANDI) ---
        if (interaction.isButton() && interaction.customId === 'tsa_kapat_kesin') {
            const logID = interaction.channel.topic;
            
            // Kullanıcıya bilgi ver
            await interaction.update({ content: '🔒 **Bilet Kapatıldı.** Kanal 5 saniye içinde imha ediliyor...', embeds: [], components: [] });

            // Log gönder
            const logKanal = interaction.guild.channels.cache.get(logID);
            if (logKanal) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📢 Bilet Kapatıldı')
                    .addFields(
                        { name: 'Kanal', value: `\`${interaction.channel.name}\``, inline: true },
                        { name: 'Kapatan', value: `${interaction.user.tag}`, inline: true }
                    )
                    .setColor('Red').setTimestamp();
                logKanal.send({ embeds: [logEmbed] }).catch(() => {});
            }

            // Kanalı sil
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (e) {
                    console.log("Kanal silinemedi, yetki hatası olabilir.");
                }
            }, 5000);
        }

        // --- 4. İPTAL ---
        if (interaction.isButton() && interaction.customId === 'tsa_kapat_iptal') {
            return interaction.message.delete().catch(() => {});
        }
    }
};
