const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { emoji } = require('../utils/emojis');

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
            .setTitle(`${emoji('Ping_Pong')} Pong! TMF Gecikme Değerleri`)
            .addFields(
                {
                    name: `${emoji('last_yildirim')} Bot Gecikmesi`,
                    value: `${Math.max(0, startedAt - interaction.createdTimestamp)}ms`,
                    inline: true
                },
                {
                    name: `${emoji('antena')} API Gecikmesi`,
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
