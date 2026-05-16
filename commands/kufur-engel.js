const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');

const dbDosyaYolu = './kufur_ayarlar.json';
function dbOku() {
    if (!fs.existsSync(dbDosyaYolu)) fs.writeFileSync(dbDosyaYolu, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(dbDosyaYolu, 'utf-8'));
}
function dbYaz(veri) {
    fs.writeFileSync(dbDosyaYolu, JSON.stringify(veri, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('küfür-engel')
        .setDescription('Küfür engelleme sistemini açar veya kapatır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option =>
            option.setName('durum')
                .setDescription('Sistemin durumunu seçin.')
                .setRequired(true)
                .addChoices(
                    { name: 'Aç', value: 'ac' },
                    { name: 'Kapat', value: 'kapat' }
                )),

    async execute(interaction) {
        const durum = interaction.options.getString('durum');
        const guildId = interaction.guild.id;
        const ayarlar = dbOku();

        if (durum === 'ac') {
            ayarlar[guildId] = true;
            dbYaz(ayarlar);
            
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ Sistem Aktif Edildi')
                .setDescription('Küfür engelleme sistemi başarıyla **açıldı**! Artık yetkililer hariç kimse küfür edemez.');
                
            return interaction.reply({ embeds: [embed] });
        } else if (durum === 'kapat') {
            delete ayarlar[guildId];
            dbYaz(ayarlar);
            
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ Sistem Devre Dışı')
                .setDescription('Küfür engelleme sistemi bu sunucuda **kapatıldı**.');
                
            return interaction.reply({ embeds: [embed] });
        }
    }
};
