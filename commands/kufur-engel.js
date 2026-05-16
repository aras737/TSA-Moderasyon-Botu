const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('küfür-engel')
        .setDescription('Erensi stili tüm kanalları tarayan küfür engel sistemini yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) // Sadece sunucuyu yönet yetkisi olan adminler görebilir/kullanabilir
        .addSubcommand(subcommand =>
            subcommand
                .setName('aç')
                .setDescription('Küfür engel sistemini aktif eder (Komutu kullandığınız kanal log kanalı olur).')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('kapat')
                .setDescription('Küfür engel sistemini kapatır.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const client = interaction.client;

        if (subcommand === 'aç') {
            // Ayarı direkt index.js'deki canlı belleğe fırlatıyoruz
            client.sistemBellegi.set(guildId, {
                durum: true,
                logKanalId: interaction.channel.id
            });

            const embed = new EmbedBuilder()
                .setTitle('✅ Küfür Engel Sistemi Aktif')
                .setDescription(`Sistem bu sunucudaki **bütün kanallar** için başarıyla açıldı!\n\n📢 **Log Kanalı:** ${interaction.channel}\n⚠️ *Yetkililer hariç herkes saniyede filtrelenir.*`)
                .setColor('Green')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'kapat') {
            client.sistemBellegi.delete(guildId);

            const embed = new EmbedBuilder()
                .setTitle('❌ Küfür Engel Sistemi Kapatıldı')
                .setDescription('Sistem devre dışı bırakıldı. Artık kanallar taranmayacak.')
                .setColor('Red')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    }
};
