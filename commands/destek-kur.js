const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionsBitField, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('destek-kur')
        .setDescription('Profesyonel TSA destek sistemini kurar.'),
    
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'Bu komut için yetkin yetersiz kanka!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('Turkish Armed Forces')
            .setDescription('Yardıma mı ihtiyacınız var? Aşağıdaki menüden bir kategori seçerek destek talebi oluşturabilirsiniz.\n\n' +
                '🔄 **Moderatör Bileti** — Discord içi sorunlar.\n' +
                '🎖️ **General Bileti** — Oyun içi sorunlar.\n' +
                '💰 **Gamepass Bileti** — Rütbe/Satın alım sorunları.\n' +
                '🚨 **Yönetim Bileti** — Üst yönetim desteği.')
            .setColor(0x2f3136)
            .setImage('https://r.resimlink.com/dPmL6Oo3Rz.png'); // image.png linki

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder('Kategori Seçiniz...')
                .addOptions([
                    { label: 'Moderatör Bileti', value: 'Moderatör', emoji: '🔄' },
                    { label: 'General Bileti', value: 'General', emoji: '🎖️' },
                    { label: 'Gamepass Bileti', value: 'Gamepass', emoji: '💰' },
                    { label: 'Yönetim Bileti', value: 'Yönetim', emoji: '🚨' },
                ])
        );

        await interaction.reply({ content: 'Destek sistemi kuruluyor...', ephemeral: true });
        await interaction.channel.send({ embeds: [embed], components: [menu] });
    },

    // Ticket açma mantığı (index.js'den çağrılıyor)
    async ticketHandler(interaction) {
        const category = interaction.values[0];
        const channel = await interaction.guild.channels.create({
            name: `destek-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            ],
        });

        await interaction.reply({ content: `Destek kanalın hazır: ${channel}`, ephemeral: true });

        const welcome = new EmbedBuilder()
            .setTitle('TSA Destek Birimi')
            .setDescription(`Selam ${interaction.user}, **${category}** birimine hoş geldin. Lütfen sorununu yaz, ilgileneceğiz.`)
            .setColor('Blue');

        await channel.send({ embeds: [welcome] });
    }
};
