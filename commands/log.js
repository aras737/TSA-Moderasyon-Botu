const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    requiredPerms: [PermissionsBitField.Flags.Administrator], // Sadece kurucular görebilir

    data: new SlashCommandBuilder()
        .setName('log')
        .setDescription('TSA Log sistemini yönetir.')
        .addSubcommand(subcommand =>
            subcommand.setName('kanalı-ayarla')
                .setDescription('Sunucudaki tüm olayların akacağı log kanalını belirler.')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Log kanalı olacak metin kanalını seçin kanka.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'kanalı-ayarla') {
            const kanal = interaction.options.getChannel('kanal');

            if (!fs.existsSync('./ayarlar')) fs.mkdirSync('./ayarlar');
            
            let logAyari = {};
            if (fs.existsSync('./ayarlar/gelismisLog.json')) {
                logAyari = JSON.parse(fs.readFileSync('./ayarlar/gelismisLog.json', 'utf8'));
            }

            logAyari[interaction.guild.id] = kanal.id;
            fs.writeFileSync('./ayarlar/gelismisLog.json', JSON.stringify(logAyari, null, 4));

            const embed = new EmbedBuilder()
                .setTitle('⚙️ TSA | Log Sistemi Aktif!')
                .setDescription(`✅ Harika! Sunucudaki tüm mesaj, rol, kanal, ses ve ban hareketleri artık ${kanal} kanalına raporlanacak kanka.`)
                .setColor('#2ecc71')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    }
};
