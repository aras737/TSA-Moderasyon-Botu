const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { ayarKaydet, ayarGetir } = require('../utils/db');
// 🟢 Çakışmayı önlemek için napi-rs canvas'ı doğrudan bu isimle çağırıyoruz:
const napiCanvas = require('@napi-rs/canvas'); 

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
                .setDescription('Sistemi test etmek için anlık resimli mesaj fırlatır.')),

    requiredPerms: [PermissionFlagsBits.Administrator],

    async execute(interaction) {
        const guildId  = interaction.guild.id;
        const altKomut = interaction.options.getSubcommand();
        const client   = interaction.client;

        if (!client.girisCikisCache) client.girisCikisCache = new Map();

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
                .setDescription(`<a:tik:1505164671081123840> Giriş-çıkış sistemi ${kanal} kanalına başarıyla bağlandı kanka.`)
                .setColor('#2ecc71');

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
                .setColor('#e74c3c');

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
                .setColor('#2ecc71');

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
                .setColor('#e74c3c');

            return interaction.editReply({ embeds: [embed] });
        }

        // =========================================================
        // 5. TEST (Hataları çözen güvenli bölge)
        // =========================================================
        if (altKomut === 'test') {
            if (!hafiza.durum || !hafiza.kanalId) {
                return interaction.editReply({
                    content: '<a:uyari:1505166167189487757> Kanka önce `/giriscikis ayarla` ile sistemi aktif etmen lazım!'
                });
            }

            const logChan = interaction.guild.channels.cache.get(hafiza.kanalId);
            if (!logChan) return interaction.editReply({ content: '❌ Kayıtlı kanal bulunamadı kanka.' });

            try {
                // Görsel Boyutlandırma
                const canvas = napiCanvas.createCanvas(700, 250);
                const ctx = canvas.getContext('2d');

                // Arka Plan Çizimi
                ctx.fillStyle = '#1e1f22';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Çerçeve (Görseldeki gibi Turuncu/Kırmızı Çizgi)
                ctx.strokeStyle = '#e67e22';
                ctx.lineWidth = 4;
                ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

                // Sağ Alt ERENSİBOT Logosu
                ctx.font = 'bold 12px sans-serif';
                ctx.fillStyle = '#4e5058';
                ctx.fillText('ERENSİBOT', canvas.width - 100, canvas.height - 25);

                // Profil Resmi İşleme
                const avatarURL = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
                try {
                    const avatarImg = await napiCanvas.loadImage(avatarURL);
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(100, 125, 60, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(avatarImg, 40, 65, 120, 120);
                    ctx.restore();

                    ctx.beginPath();
                    ctx.arc(100, 125, 61, 0, Math.PI * 2, true);
                    ctx.strokeStyle = '#e67e22';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                } catch (avatarErr) {
                    // Avatar yüklenirken hata verirse bot çökmesin, varsayılan renk bassın
                    ctx.fillStyle = '#5865f2';
                    ctx.beginPath();
                    ctx.arc(100, 125, 60, 0, Math.PI * 2, true);
                    ctx.fill();
                }

                // Yazılar
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 28px sans-serif';
                ctx.fillText(interaction.user.username.toUpperCase(), 190, 105);

                ctx.fillStyle = '#2ecc71';
                ctx.font = '18px sans-serif';
                ctx.fillText('Sisteme Giriş Yaptı! (TEST)', 190, 140);

                ctx.fillStyle = '#949ba4';
                ctx.font = '14px sans-serif';
                ctx.fillText(`Sunucuda ${interaction.guild.memberCount} kişi olduk kanka.`, 190, 180);

                const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'giris-test.png' });

                await logChan.send({
                    content: `<a:join_join:1505202309343215717> **TSA Sistem Testi:** Aramıza hoş geldin ${interaction.user}!`,
                    files: [attachment]
                });

                return interaction.editReply({
                    content: `<a:tik:1505164671081123840> Test afişi başarıyla ve sunucu emojileriyle birlikte ${logChan} kanalına fırlatıldı!`
                });

            } catch (error) {
                // Eğer burada bir hata yakalanırsa konsola detayını basacak
                console.error("Canvas Çizim Hatası Kontrolü:", error);
                return interaction.editReply({
                    content: `❌ Resim oluşturulurken teknik bir hata alındı kanka. Konsolu (terminali) kontrol et!`
                });
            }
        }
    }
};
