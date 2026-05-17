const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { ayarGetir, ayarKaydet } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kufurengel')
        .setDescription('Küfür ve link engel sistemini yönet.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Sadece adminler görebilir
        .addSubcommand(sub =>
            sub.setName('ac')
                .setDescription('Küfür/link engelini açar.')
                .addStringOption(opt =>
                    opt.setName('tur')
                        .setDescription('Ne engellensin?')
                        .setRequired(true)
                        .addChoices(
                            { name: '🤬 Küfür Engeli', value: 'kufur' },
                            { name: '🔗 Link Engeli',  value: 'link'  },
                            { name: '✅ İkisi Birden', value: 'hepsi' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('kapat')
                .setDescription('Küfür/link engelini kapatır.')
                .addStringOption(opt =>
                    opt.setName('tur')
                        .setDescription('Ne kapatılsın?')
                        .setRequired(true)
                        .addChoices(
                            { name: '🤬 Küfür Engeli', value: 'kufur' },
                            { name: '🔗 Link Engeli',  value: 'link'  },
                            { name: '❌ İkisi Birden', value: 'hepsi' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('durum')
                .setDescription('Mevcut engel durumunu gösterir.')
        ),

    // Sadece bu yetkiye sahip olanlar çalıştırabilir
    requiredPerms: [PermissionFlagsBits.Administrator],

    async execute(interaction) {
        // Çift güvenlik: yetki kontrolü
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({
                content: '❌ Bu komutu kullanmak için **Yönetici** yetkisine sahip olman gerekiyor kanka.'
            });
        }

        const sub     = interaction.options.getSubcommand();
        const tur     = interaction.options.getString('tur');
        const guildId = interaction.guildId;

        // ── DURUM ─────────────────────────────────────────────────────────
        if (sub === 'durum') {
            const kufurDurum = await ayarGetir(guildId, 'kufurEngelDurum', false);
            const linkDurum  = await ayarGetir(guildId, 'linkEngelDurum',  false);

            const embed = new EmbedBuilder()
                .setTitle('<:koruma1:1505143174190989352> Engel Sistemi Durumu')
                .addFields(
                    { name: '🤬 Küfür Engeli', value: kufurDurum ? '`✅ Açık`' : '`❌ Kapalı`', inline: true },
                    { name: '🔗 Link Engeli',  value: linkDurum  ? '`✅ Açık`' : '`❌ Kapalı`', inline: true }
                )
                .setColor('#3498db')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // ── AÇ / KAPAT ────────────────────────────────────────────────────
        const yeniDurum = sub === 'ac';

        if (tur === 'kufur' || tur === 'hepsi') {
            await ayarKaydet(guildId, 'kufurEngelDurum', yeniDurum);
        }
        if (tur === 'link' || tur === 'hepsi') {
            await ayarKaydet(guildId, 'linkEngelDurum', yeniDurum);
        }

        const turYazi = tur === 'hepsi' ? 'Küfür & Link Engeli' : tur === 'kufur' ? 'Küfür Engeli' : 'Link Engeli';
        const renk    = yeniDurum ? '#2ecc71' : '#e74c3c';
        const icon    = yeniDurum ? '✅' : '❌';

        const embed = new EmbedBuilder()
            .setTitle('<:koruma1:1505143174190989352> Engel Sistemi Güncellendi!')
            .setDescription(`${icon} **${turYazi}** başarıyla **${yeniDurum ? 'açıldı' : 'kapatıldı'}** kanka.`)
            .addFields({ name: '<:uzaybot_kullanicilar:1505146190973505567> İşlemi Yapan', value: `${interaction.user}` })
            .setColor(renk)
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }
};
