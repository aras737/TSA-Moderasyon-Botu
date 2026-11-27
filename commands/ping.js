const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('🏓 TMF botunun anlık gecikme sürelerini gösterir.'),

    async execute(interaction) {
        const startedAt = Date.now();
        const websocketPing = interaction.client.ws.ping;
        const apiPing = Number.isFinite(websocketPing) && websocketPing >= 0
            ? Math.round(websocketPing)
            : null;

        const embed = new EmbedBuilder()
            .setTitle('<:Ping_Pong:1505191883603710077> Pong! TMF Gecikme Değerleri')
            .addFields(
                {
                    name: '<a:last_yildirim:1505192115565760564> Bot Gecikmesi',
                    value: `${Math.max(0, startedAt - interaction.createdTimestamp)}ms`,
                    inline: true
                },
                {
                    name: '<:antena:1505192362270527518> API Gecikmesi',
                    value: apiPing === null ? 'Ölçülemiyor' : `${apiPing}ms`,
                    inline: true
                }
            )
            .setColor(apiPing !== null && apiPing > 150 ? '#ff4d4d' : '#2ecc71')
            .setFooter({ text: 'TMF 7/24 Stabilite Sistemi' })
            .setTimestamp();

        // /ping yanıtı hızlı olduğu için deferReply kullanma:
        // Discord'un "düşünüyor..." durumunda takılı kalmasını önler.
        await interaction.reply({ embeds: [embed] });
    }
};
