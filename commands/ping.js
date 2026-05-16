const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('TSA botunun anlık gecikme sürelerini gösterir.'),

    async execute(interaction) {
        const sent = await interaction.deferReply({ fetchReply: true });
        
        const botPing = sent.createdTimestamp - interaction.createdTimestamp;
        const apiPing = Math.round(interaction.client.ws.ping);

        const embed = new EmbedBuilder()
            .setTitle('<:Ping_Pong:1505191883603710077> Pong! TSA Gecikme Değerleri')
            .addFields(
                { name: '<a:last_yildirim:1505192115565760564> Bot Gecikmesi', value: `\`${botPing}ms\``, inline: true },
                { name: '<:antena:1505192362270527518> API Gecikmesi', value: `\`${apiPing}ms\``, inline: true }
            )
            .setColor(apiPing > 150 ? '#ff4d4d' : '#2ecc71') // Ping yüksekse kırmızı, düşükse yeşil yanar
            .setFooter({ text: 'TSA 7/24 Stabilite Sistemi' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
