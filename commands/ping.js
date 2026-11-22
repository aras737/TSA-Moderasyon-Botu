const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('🏓 TMF botunun anlık gecikme sürelerini gösterir.'),

    async execute(interaction) {
        const interactionCreatedAt = interaction.createdTimestamp || Date.now();
        await interaction.deferReply();

        const botPing = Math.max(0, Date.now() - interactionCreatedAt);
        const websocketPing = interaction.client.ws.ping;
        const apiPing = Number.isFinite(websocketPing) ? Math.round(websocketPing) : 0;

        const embed = new EmbedBuilder()
            .setTitle('<:Ping_Pong:1505191883603710077> Pong! TMF Gecikme Değerleri')
            .addFields(
                { name: '<a:last_yildirim:1505192115565760564> Bot Gecikmesi', value: `${botPing}ms`, inline: true },
                { name: '<:antena:1505192362270527518> API Gecikmesi', value: `${apiPing}ms`, inline: true }
            )
            .setColor(apiPing > 150 ? '#ff4d4d' : '#2ecc71')
            .setFooter({ text: 'TMF 7/24 Stabilite Sistemi' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
