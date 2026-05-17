const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { ayarKaydet, ayarGetir } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giriscikis')
        .setDescription('Erensi tarzı resimli giriş-çıkış ve Anti-Bot sistemini yönet kanka.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Sadece adminler görsün
        .addSubcommand(subcommand =>
            subcommand.setName('ayarla')
                .setDescription('Sistemin aktif olacağı log kanalını seç kanka.')
                .addChannelOption(option => 
                    option.setName('kanal')
                        .setDescription('Giriş-çıkış resimlerinin akacağı kanal')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('kapat')
                .setDescription('Resimli giriş-çıkış sistemini tamamen kapatır.'))
        .addSubcommand(subcommand =>
            subcommand.setName('guvenli-ekle')
                .setDescription('Sunucuya bot eklemesine izin verilen güvenli kullanıcıyı ekler.')
                .addUserOption(option =>
                    option.setName('kullanici')
                        .setDescription('Güvenli listeye eklenecek yetkili')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('guvenli-cikar')
                .setDescription('Bir kullanıcıyı bot ekleyebilecek güvenli listeden çıkarır.')
                .addUserOption(option =>
                    option.setName('kullanici')
                        .setDescription('Güvenli listeden çıkarılacak yetkili')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('test')
                .setDescription('Resimli sistemi denemek için kanala test mesajı fırlatır.')),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const altKomut = interaction.options.getSubcommand();

        // 🟢 1. ALT KOMUT: AYARLAMA
        if (altKomut === 'ayarla') {
            const kanal = interaction.options.getChannel('kanal');
            
            ayarKaydet(guildId, 'girisCikisKanal', kanal.id);
            ayarKaydet(guildId, 'girisCikisDurum', true);

            const embed = new EmbedBuilder()
                .setTitle('<:yeni:1505201065476362325> ERENSI RESİMLİ LOG AKTİF!')
                .setDescription(`<a:tik:1505164671081123840> Resimli giriş-çıkış sistemi başarıyla ${kanal} kanalına bağlandı ve **data klasörüne işlendi** kanka.\n\n*Artık yeni biri geldiğinde veya çıktığında resimli mesaj göreceksin.*`)
                .setColor('#2ecc71')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // 🔴 2. ALT KOMUT: KAPATMA
        if (altKomut === 'kapat') {
            ayarKaydet(guildId, 'girisCikisDurum', false);

            const embed = new EmbedBuilder()
                .setTitle('<:riva_kilit:1505203119427162192> SİSTEM DEVRE DIŞI')
                .setDescription(`<a:baarsz:1505146967817326675> Resimli giriş-çıkış takip sistemi bu sunucu için kalıcı olarak **kapatıldı kanka**. Ayarlar sıfırlanmadı, tekrar açtığında kaldığı yerden devam edecek.`)
                .setColor('#e74c3c')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // 🛡️ 3. ALT KOMUT: GÜVENLİ LİSTEYE EKLEME
        if (altKomut === 'guvenli-ekle') {
            const kullanici = interaction.options.getUser('kullanici');
            // Mevcut listeyi alıyoruz, yoksa boş array dönüyor
            let guvenliListe = ayarGetir(guildId, 'botGuvenliListe', []);

            if (guvenliListe.includes(kullanici.id)) {
                return interaction.reply({ content: `<a:uyari:1505166167189487757> Kanka ${kullanici} zaten güvenli listede ekli!`, ephemeral: true });
            }

            guvenliListe.push(kullanici.id);
            ayarKaydet(guildId, 'botGuvenliListe', guvenliListe);

            const embed = new EmbedBuilder()
                .setTitle('<:yeni:1505201065476362325> GÜVENLİ LİSTEYE EKLENDİ')
                .setDescription(`<a:tik:1505164671081123840> ${kullanici} kullanıcısı güvenli listeye alındı kanka. Artık sunucuya bot eklemesine izin verilecek.`)
                .setColor('#2ecc71')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // 🛡️ 4. ALT KOMUT: GÜVENLİ LİSTEDEN ÇIKARMA
        if (altKomut === 'guvenli-cikar') {
            const kullanici = interaction.options.getUser('kullanici');
            let guvenliListe = ayarGetir(guildId, 'botGuvenliListe', []);

            if (!guvenliListe.includes(kullanici.id)) {
                return interaction.reply({ content: `<a:uyari:1505166167189487757> Kanka ${kullanici} zaten güvenli listede bulunmuyor!`, ephemeral: true });
            }

            // Kullanıcıyı array içinden siliyoruz
            guvenliListe = guvenliListe.filter(id => id !== kullanici.id);
            ayarKaydet(guildId, 'botGuvenliListe', guvenliListe);

            const embed = new EmbedBuilder()
                .setTitle('<:riva_kilit:1505203119427162192> GÜVENLİ LİSTEDEN ÇIKARILDI')
                .setDescription(`<a:baarsz:1505146967817326675> ${kullanici} kullanıcısı güvenli listeden şutlandı kanka. Artık bot eklemeye çalışırsa eklediği bot anında banlanacak!`)
                .setColor('#e74c3c')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // 🟡 5. ALT KOMUT: TEST ETME
        if (altKomut === 'test') {
            const kanalId = ayarGetir(guildId, 'girisCikisKanal', null);
            const durum = ayarGetir(guildId, 'girisCikisDurum', false);
            const logChan = kanalId ? interaction.guild.channels.cache.get(kanalId) : null;

            if (!logChan || !durum) {
                return interaction.reply({ content: '<a:uyari:1505166167189487757> Kanka önce `/giriscikis ayarla` komutuyla bir kanal seçip sistemi aktif etmen lazım!', ephemeral: true });
            }

            const avatar = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
            const username = encodeURIComponent(interaction.user.username);
            const guildName = encodeURIComponent(interaction.guild.name);
            const memberCount = interaction.guild.memberCount;
            const testResimUrl = `https://dummyimage.com/800x350/2b2d31/f2f3f5.png&text=TEST+BAŞARILI+KANKA!%0A${username}%0A%0ASunucu:+${guildName}%0AÜye+Sayısı:+${memberCount}`;

            const testEmbed = new EmbedBuilder()
                .setTitle(`<a:join_join:1505202309343215717> [TEST] Sunucuya Yeni Bir Kan Katıldı!`)
                .setDescription(`Aramıza hoş geldin ${interaction.user}! Resimli sistem canavar gibi çalışıyor kanka.`)
                .setThumbnail(avatar)
                .setImage(testResimUrl)
                .setColor('#5865f2')
                .setTimestamp();

            await logChan.send({ content: `🧪 **TSA Sistem Testi:**`, embeds: [testEmbed] });
            
            return interaction.reply({ content: `<a:tik:1505164671081123840> Test afişi başarıyla ${logChan} kanalına fırlatıldı kanka!`, ephemeral: true });
        }
    },
};
