const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { ayarKaydet, ayarGetir } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giriscikis')
        .setDescription('Resimli giriş-çıkış sistemini yönet kanka.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('ayarla')
                .setDescription('Sistemin aktif olacağı log kanalını seç.')
                .addChannelOption(opt =>
                    opt.setName('kanal')
                        .setDescription('Giriş-çıkış resimlerinin akacağı kanal')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('kapat')
                .setDescription('Resimli giriş-çıkış sistemini kapatır.'))
        .addSubcommand(sub =>
            sub.setName('guvenli-ekle')
                .setDescription('Sunucuya bot eklemesine izin verilen kullanıcıyı güvenli listeye ekler.')
                .addUserOption(opt =>
                    opt.setName('kullanici')
                        .setDescription('Güvenli listeye eklenecek yetkili')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('guvenli-cikar')
                .setDescription('Bir kullanıcıyı güvenli listeden çıkarır.')
                .addUserOption(opt =>
                    opt.setName('kullanici')
                        .setDescription('Güvenli listeden çıkarılacak yetkili')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('test')
                .setDescription('Sistemi test etmek için anlık mesaj fırlatır.')),

    requiredPerms: [PermissionFlagsBits.Administrator],

    async execute(interaction) {
        const guildId  = interaction.guild.id;
        const altKomut = interaction.options.getSubcommand();
        const client   = interaction.client;

        if (!client.girisCikisCache) client.girisCikisCache = new Map();

        // ✅ async ayarGetir düzeltmesi
        const kanalId      = await ayarGetir(guildId, 'girisCikisKanal', null);
        const durum        = await ayarGetir(guildId, 'girisCikisDurum', false);
        const guvenliListe = await ayarGetir(guildId, 'botGuvenliListe', []);

        const hafiza = { kanalId, durum, guvenliListe };
        client.girisCikisCache.set(guildId, hafiza);

        // =========================================================
        // 1. AYARLA
        // =========================================================
        if (altKomut === 'ayarla') {
            const kanal = interaction.options.getChannel('kanal');

            await ayarKaydet(guildId, 'girisCikisKanal', kanal.id);
            await ayarKaydet(guildId, 'girisCikisDurum', true);

            hafiza.kanalId = kanal.id;
            hafiza.durum   = true;

            const embed = new EmbedBuilder()
                .setTitle('<:yeni:1505201065476362325> RESİMLİ LOG AKTİF!')
                .setDescription(
                    `<a:tik:1505164671081123840> Giriş-çıkış sistemi ${kanal} kanalına bağlandı kanka.\n\n` +
                    `*Artık yeni biri geldiğinde veya çıktığında anlık sayaç tetiklenecek.*`
                )
                .setColor('#2ecc71')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // =========================================================
        // 2. KAPAT
        // =========================================================
        if (altKomut === 'kapat') {
            await ayarKaydet(guildId, 'girisCikisDurum', false);
            hafiza.durum = false;

            const embed = new EmbedBuilder()
                .setTitle('<:riva_kilit:1505203119427162192> SİSTEM DEVRE DIŞI')
                .setDescription(`<a:baarsz:1505146967817326675> Giriş-çıkış sistemi bu sunucu için kapatıldı kanka.`)
                .setColor('#e74c3c')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // =========================================================
        // 3. GÜVENLİ EKLE
        // =========================================================
        if (altKomut === 'guvenli-ekle') {
            const kullanici = interaction.options.getUser('kullanici');

            if (hafiza.guvenliListe.includes(kullanici.id)) {
                return interaction.editReply({
                    content: `<a:uyari:1505166167189487757> Kanka ${kullanici} zaten güvenli listede!`
                });
            }

            hafiza.guvenliListe.push(kullanici.id);
            await ayarKaydet(guildId, 'botGuvenliListe', hafiza.guvenliListe);

            const embed = new EmbedBuilder()
                .setTitle('<:yeni:1505201065476362325> GÜVENLİ LİSTEYE EKLENDİ')
                .setDescription(`<a:tik:1505164671081123840> ${kullanici} güvenli listeye alındı kanka.`)
                .setColor('#2ecc71')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // =========================================================
        // 4. GÜVENLİ ÇIKAR
        // =========================================================
        if (altKomut === 'guvenli-cikar') {
            const kullanici = interaction.options.getUser('kullanici');

            if (!hafiza.guvenliListe.includes(kullanici.id)) {
                return interaction.editReply({
                    content: `<a:uyari:1505166167189487757> Kanka ${kullanici} zaten güvenli listede bulunmuyor!`
                });
            }

            hafiza.guvenliListe = hafiza.guvenliListe.filter(id => id !== kullanici.id);
            await ayarKaydet(guildId, 'botGuvenliListe', hafiza.guvenliListe);

            const embed = new EmbedBuilder()
                .setTitle('<:riva_kilit:1505203119427162192> GÜVENLİ LİSTEDEN ÇIKARILDI')
                .setDescription(`<a:baarsz:1505146967817326675> ${kullanici} güvenli listeden çıkarıldı kanka.`)
                .setColor('#e74c3c')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // =========================================================
        // 5. TEST
        // =========================================================
        if (altKomut === 'test') {
            if (!hafiza.durum || !hafiza.kanalId) {
                return interaction.editReply({
                    content: '<a:uyari:1505166167189487757> Kanka önce `/giriscikis ayarla` ile sistemi aktif etmen lazım!'
                });
            }

            const logChan = interaction.guild.channels.cache.get(hafiza.kanalId);
            if (!logChan) {
                return interaction.editReply({ content: '❌ Kayıtlı kanal bulunamadı kanka.' });
            }

            const avatar      = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
            const username    = encodeURIComponent(interaction.user.username);
            const guildName   = encodeURIComponent(interaction.guild.name);
            const memberCount = interaction.guild.memberCount;

            // ✅ dummyimage.com yerine placehold.co
            const testResimUrl = `https://placehold.co/800x350/2b2d31/f2f3f5/png?text=TEST+BASARILI+KANKA!%0A${username}%0A%0ASunucu:+${guildName}%0AUye+Sayisi:+${memberCount}`;

            const testEmbed = new EmbedBuilder()
                .setTitle(`<a:join_join:1505202309343215717> [TEST] Sunucuya Yeni Bir Kan Katıldı!`)
                .setDescription(`Aramıza hoş geldin ${interaction.user}! Sistem gayet güzel çalışıyor kanka.`)
                .setThumbnail(avatar)
                .setImage(testResimUrl)
                .setColor('#5865f2')
                .setTimestamp();

            await logChan.send({ content: `🧪 **TSA Sistem Testi:**`, embeds: [testEmbed] });

            return interaction.editReply({
                content: `<a:tik:1505164671081123840> Test afişi **${memberCount}** üye sayısıyla ${logChan} kanalına fırlatıldı!`
            });
        }
    }
};
