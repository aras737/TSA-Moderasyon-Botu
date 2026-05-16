const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('küfürengel')
        .setDescription('Küfür engelleme sistemini açar veya kapatır.')
        .addStringOption(option =>
            option
                .setName('durum')
                .setDescription('Aç veya kapat')
                .setRequired(true)
                .addChoices(
                    { name: 'Aç', value: 'ac' },
                    { name: 'Kapat', value: 'kapat' }
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {

        // Küfür listesi
        const kufurler = [
            "amk",
            "aq",
            "orospu",
            "piç",
            "sik",
            "yarrak",
            "göt",
            "ananı",
            "amına",
            "ibne",
            "salak",
            "gerizekalı"
        ];

        // Sistem durumu
        if (!client.kufurEngel) client.kufurEngel = new Map();

        const durum = interaction.options.getString('durum');

        if (durum === 'ac') {
            client.kufurEngel.set(interaction.guild.id, true);

            await interaction.reply({
                content: '<a:tik:1505164671081123840> Küfür engelleme sistemi açıldı.',
                ephemeral: true
            });
        }

        if (durum === 'kapat') {
            client.kufurEngel.set(interaction.guild.id, false);

            await interaction.reply({
                content: '<a:baarsz:1505146967817326675> Küfür engelleme sistemi kapatıldı.',
                ephemeral: true
            });
        }

        // Event sadece 1 kere çalışsın
        if (client.kufurEventKurulu) return;
        client.kufurEventKurulu = true;

        client.on('messageCreate', async (message) => {

            if (!message.guild) return;
            if (message.author.bot) return;

            const aktifMi = client.kufurEngel.get(message.guild.id);

            if (!aktifMi) return;

            // Admin bypass
            if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

            const mesaj = message.content.toLowerCase();

            const kufurVar = kufurler.some(kelime =>
                mesaj.includes(kelime)
            );

            if (kufurVar) {

                await message.delete().catch(() => {});

                const uyari = await message.channel.send({
                    content: `<a:alarme:1505209430319300718> ${message.author}, küfür etmek yasak.`
                });

                setTimeout(() => {
                    uyari.delete().catch(() => {});
                }, 5000);
            }
        });
    }
};
