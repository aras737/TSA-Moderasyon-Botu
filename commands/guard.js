const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guard-sistem')
        .setDescription('🚨 TSA Profesyonel Audit-Log tabanlı koruma sistemini yönetir!')
        .addStringOption(option =>
            option.setName('durum')
                .setDescription('Guard koruma modunu aç kapa kanka')
                .setRequired(true)
                .addChoices(
                    { name: '🛡️ Guard Korumasını Aktif Et', value: 'ac' },
                    { name: '🔓 Guard Korumasını Devre Dışı Bırak', value: 'kapat' }
                )),

    async execute(interaction) {
        // Sadece tam yetkili yöneticiler açıp kapatabilsin kanka sunucu güvencesi için
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '⚠️ Bu sistemi sadece Sunucu Yöneticileri yönetebilir kanka!', ephemeral: true });
        }

        const durum = interaction.options.getString('durum');
        const guildId = interaction.guild.id;

        // Ayarlar klasörünü ve dosyasını kontrol edelim
        if (!fs.existsSync('./ayarlar')) fs.mkdirSync('./ayarlar');
        
        let guardAyarlar = {};
        if (fs.existsSync('./ayarlar/guardAyari.json')) {
            guardAyarlar = JSON.parse(fs.readFileSync('./ayarlar/guardAyari.json', 'utf8'));
        }

        if (durum === 'ac') {
            guardAyarlar[guildId] = true;
            fs.writeFileSync('./ayarlar/guardAyari.json', JSON.stringify(guardAyarlar, null, 2));

            const embed = new EmbedBuilder()
                .setTitle('🛡️ TSA GUARD SİSTEMİ AKTİF EDİLDİ! 🔒')
                .setDescription(`✅ **Profesyonel Audit-Log (Denetim Kaydı) tabanlı hafıza koruması şu andan itibaren devrede!**\n\n📌 **Nasıl Çalışacak?**\n• Bir yetkili 5 saniye içinde 2 veya daha fazla yıkım işlemi (Rol Silme, Kanal Silme, Sağ-tık Banlama) yaparsa bot bunu anında algılayacak.\n• Saldırganı **direkt banlayacak** ve sunucuyu **otomatik karantinaya** alacak.`)
                .setColor('#2ecc71')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });

        } else {
            guardAyarlar[guildId] = false;
            fs.writeFileSync('./ayarlar/guardAyari.json', JSON.stringify(guardAyarlar, null, 2));

            const embed = new EmbedBuilder()
                .setTitle('🔓 TSA GUARD SİSTEMİ DEAKTİF BIKALILDI')
                .setDescription(`⚠️ Sunucunun guard koruma kalkanı kapatıldı. Yetkililerin peş peşe yaptığı sağ-tık işlemleri artık otomatik denetlenmeyecek.`)
                .setColor('#e74c3c')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    },
};
