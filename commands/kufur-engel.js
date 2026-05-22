const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { ayarGetir, ayarKaydet } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kufurengel')
        .setDescription('Sunucu koruma ve filtre sistemlerini yönet.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Sadece adminler görebilir
        .addSubcommand(sub =>
            sub.setName('ac')
                .setDescription('Seçilen koruma sistemini aktif eder.')
                .addStringOption(opt =>
                    opt.setName('tur')
                        .setDescription('Hangi koruma sistemi açılsın?')
                        .setRequired(true)
                        .addChoices(
                            { name: '🤬 Küfür Engeli', value: 'kufur' },
                            { name: '🔗 Link Engeli',  value: 'link'  },
                            { name: '⚠️ Spam Koruması', value: 'spam'  },
                            { name: '⛔ Büyük Harf (Caps) Engeli', value: 'caps' },
                            { name: '🎭 Toplu Etiket (Mass Mention) Koruması', value: 'etiket' },
                            { name: '🤖 Antiraid (Bot Giriş) Koruması', value: 'bot' },
                            { name: '🛡️ Sağ Tık Rol/Yetki Koruması', value: 'sagtik' },
                            { name: '✅ Tüm Korumaları Aç', value: 'hepsi' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('kapat')
                .setDescription('Seçilen koruma sistemini devre dışı bırakır.')
                .addStringOption(opt =>
                    opt.setName('tur')
                        .setDescription('Hangi koruma sistemi kapatılsın?')
                        .setRequired(true)
                        .addChoices(
                            { name: '🤬 Küfür Engeli', value: 'kufur' },
                            { name: '🔗 Link Engeli',  value: 'link'  },
                            { name: '⚠️ Spam Koruması', value: 'spam'  },
                            { name: '⛔ Büyük Harf (Caps) Engeli', value: 'caps' },
                            { name: '🎭 Toplu Etiket (Mass Mention) Koruması', value: 'etiket' },
                            { name: '🤖 Antiraid (Bot Giriş) Koruması', value: 'bot' },
                            { name: '🛡️ Sağ Tık Rol/Yetki Koruması', value: 'sagtik' },
                            { name: '❌ Tüm Korumaları Kapat', value: 'hepsi' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('durum')
                .setDescription('Mevcut tüm koruma sistemlerinin durumunu listeler.')
        ),

    // Çift dikiş güvenlik yetkisi kanka
    requiredPerms: [PermissionFlagsBits.Administrator],

    async execute(interaction) {
        // İlk olarak etkileşimi erteliyoruz (Bot düşünüyor...)
        await interaction.deferReply({ ephemeral: true }).catch(() => null);

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({
                content: '❌ Bu komutu kullanmak için **Yönetici** yetkisine sahip olman gerekiyor kanka.'
            });
        }

        const sub     = interaction.options.getSubcommand();
        const tur     = interaction.options.getString('tur');
        const guildId = interaction.guildId;
        const client  = interaction.client;

        // Canlı RAM hafızası yoksa hemen oluşturalım
        if (!client.sistemBellegi) client.sistemBellegi = new Map();

        // ── 📊 DURUM ALT KOMUTU ───────────────────────────────────────────
        if (sub === 'durum') {
            const kufurDurum  = await ayarGetir(guildId, 'kufurEngelDurum', false);
            const linkDurum   = await ayarGetir(guildId, 'linkEngelDurum',  false);
            const spamDurum   = await ayarGetir(guildId, 'spamEngelDurum',  false);
            const capsDurum   = await ayarGetir(guildId, 'capsEngelDurum',  false);
            const etiketDurum = await ayarGetir(guildId, 'etiketEngelDurum',false);
            const botDurum    = await ayarGetir(guildId, 'botEngelDurum',   false);
            const sagtikDurum = await ayarGetir(guildId, 'sagtikEngelDurum',false);

            const embed = new EmbedBuilder()
                .setTitle('<:koruma1:1505143174190989352> Sunucu Filtre & Koruma Sistemleri')
                .setDescription('🛡️ Aşağıda sunucunun aktif/pasif olan tüm zırh sistemleri listelenmiştir kanka:')
                .addFields(
                    { name: '🤬 Küfür Engeli', value: kufurDurum ? '`✅ Açık`' : '`❌ Kapalı`', inline: true },
                    { name: '🔗 Link Engeli',  value: linkDurum  ? '`✅ Açık`' : '`❌ Kapalı`', inline: true },
                    { name: '⚠️ Spam Koruması', value: spamDurum  ? '`✅ Açık`' : '`❌ Kapalı`', inline: true },
                    { name: '⛔ Caps Lock Engeli', value: capsDurum  ? '`✅ Açık`' : '`❌ Kapalı`', inline: true },
                    { name: '🎭 Toplu Etiket Engeli', value: etiketDurum ? '`✅ Açık`' : '`❌ Kapalı`', inline: true },
                    { name: '🤖 Antiraid (Bot) Koruması', value: botDurum ? '`✅ Açık`' : '`❌ Kapalı`', inline: true },
                    { name: '🛡️ Sağ Tık Rol Koruması', value: sagtikDurum ? '`✅ Açık`' : '`❌ Kapalı`', inline: true }
                )
                .setColor('#3498db')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // ── ⚙️ AÇ / KAPAT ALT KOMUTLARI ────────────────────────────────────
        const yeniDurum = sub === 'ac';

        if (!client.sistemBellegi.has(guildId)) {
            client.sistemBellegi.set(guildId, { kufur: false, link: false, spam: false, caps: false, etiket: false, bot: false, sagtik: false });
        }
        const mevcutHafiza = client.sistemBellegi.get(guildId);

        // Seçilen türe göre DB ve RAM eşitlemesini yapıyoruz kanka
        if (tur === 'kufur' || tur === 'hepsi') {
            await ayarKaydet(guildId, 'kufurEngelDurum', yeniDurum);
            mevcutHafiza.kufur = yeniDurum;
        }
        if (tur === 'link' || tur === 'hepsi') {
            await ayarKaydet(guildId, 'linkEngelDurum', yeniDurum);
            mevcutHafiza.link = yeniDurum;
        }
        if (tur === 'spam' || tur === 'hepsi') {
            await ayarKaydet(guildId, 'spamEngelDurum', yeniDurum);
            mevcutHafiza.spam = yeniDurum;
        }
        if (tur === 'caps' || tur === 'hepsi') {
            await ayarKaydet(guildId, 'capsEngelDurum', yeniDurum);
            mevcutHafiza.caps = yeniDurum;
        }
        if (tur === 'etiket' || tur === 'hepsi') {
            await ayarKaydet(guildId, 'etiketEngelDurum', yeniDurum);
            mevcutHafiza.etiket = yeniDurum;
        }
        if (tur === 'bot' || tur === 'hepsi') {
            await ayarKaydet(guildId, 'botEngelDurum', yeniDurum);
            mevcutHafiza.bot = yeniDurum;
        }
        if (tur === 'sagtik' || tur === 'hepsi') {
            await ayarKaydet(guildId, 'sagtikEngelDurum', yeniDurum);
            mevcutHafiza.sagtik = yeniDurum;
        }

        // Güncel veriyi RAM belleğe geri fırlat kanka
        client.sistemBellegi.set(guildId, mevcutHafiza);

        // Dinamik başlık yazısı ayarlama alanı
        let turYazi = 'Seçilen Sistem';
        if (tur === 'hepsi')  turYazi = 'Tüm Koruma Filtreleri';
        if (tur === 'kufur')  turYazi = 'Küfür Engeli';
        if (tur === 'link')   turYazi = 'Link Engeli';
        if (tur === 'spam')   turYazi = 'Spam Koruması';
        if (tur === 'caps')   turYazi = 'Büyük Harf (Caps) Engeli';
        if (tur === 'etiket') turYazi = 'Toplu Etiket Koruması';
        if (tur === 'bot')    turYazi = 'Antiraid Bot Koruması';
        if (tur === 'sagtik') turYazi = 'Sağ Tık Rol Verme Koruması';

        const renk = yeniDurum ? '#2ecc71' : '#e74c3c';
        const icon = yeniDurum ? '✅' : '❌';

        const embed = new EmbedBuilder()
            .setTitle('<:koruma1:1505143174190989352> Koruma Sistemi Güncellendi!')
            .setDescription(`${icon} **${turYazi}** başarıyla **${yeniDurum ? 'açıldı' : 'kapatıldı'}** kanka.`)
            .addFields({ name: '<:uzaybot_kullanicilar:1505146190973505567> İşlemi Yapan', value: `${interaction.user}` })
            .setColor(renk)
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }
};
