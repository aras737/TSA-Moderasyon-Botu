const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');

const dbDosyaYolu = './kufur_ayarlar.json';

// Veritabanı okuma fonksiyonu
function dbOku() {
    if (!fs.existsSync(dbDosyaYolu)) fs.writeFileSync(dbDosyaYolu, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(dbDosyaYolu, 'utf-8'));
}

// Veritabanı yazma fonksiyonu
function dbYaz(veri) {
    fs.writeFileSync(dbDosyaYolu, JSON.stringify(veri, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('küfür-engel')
        .setDescription('Küfür engelleyici sistemini yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) // Sadece sunucuyu yönet yetkisi olanlar
        .addSubcommand(subcommand =>
            subcommand
                .setName('ayarla')
                .setDescription('Küfür engel sistemini aktif eder ve log kanalını belirler.')
                .addChannelOption(option => 
                    option.setName('kanal')
                        .setDescription('Küfür loglarının atılacağı kanal')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('kapat')
                .setDescription('Küfür engel sistemini devre dışı bırakır.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const ayarlar = dbOku();

        if (subcommand === 'ayarla') {
            const logKanal = interaction.options.getChannel('kanal');

            // Ayarları JSON dosyasına kaydet
            ayarlar[guildId] = {
                durum: true,
                logKanalId: logKanal.id
            };
            dbYaz(ayarlar);

            const embed = new EmbedBuilder()
                .setTitle('✅ Küfür Engelleme Aktif')
                .setDescription(`Sistem başarıyla açıldı.\n**Log Kanalı:** ${logKanal}`)
                .setColor('Green')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'kapat') {
            if (ayarlar[guildId]) {
                delete ayarlar[guildId];
                dbYaz(ayarlar);
            }

            const embed = new EmbedBuilder()
                .setTitle('❌ Küfür Engelleme Kapatıldı')
                .setDescription('Küfür engel sistemi bu sunucuda tamamen devre dışı bırakıldı.')
                .setColor('Red')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    }
};
