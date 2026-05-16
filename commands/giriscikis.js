const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { ayarKaydet, ayarGetir } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giriscikis')
        .setDescription('🚪 Erensi tarzı resimli giriş-çıkış sistemini yönet kanka.')
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
            subcommand.setName('test')
                .setDescription('Resimli sistemi denemek için kanala test mesajı fırlatır.')),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const altKomut = interaction.options.getSubcommand();

        // 🟢 1. ALT KOMUT: AYARLAMA
        if (altKomut === 'ayarla') {
            const kanal = interaction.options.getChannel('kanal');
            
            // Veritabanına hem kanalı kaydediyoruz hem de sistemi aktif ediyoruz kanka
            ayarKaydet(guildId, 'girisCikisKanal', kanal.id);
            ayarKaydet(guildId, 'girisCikisDurum', true);

            const embed = new EmbedBuilder()
                .setTitle('🖼️ ERENSI RESİMLİ LOG AKTİF!')
                .setDescription(`✅ Resimli giriş-çıkış sistemi başarıyla ${kanal} kanalına bağlandı ve **data klasörüne işlendi** kanka.\n\n*Artık yeni biri geldiğinde veya çıktığında bu kanala otomatik afiş fırlatılacak.*`)
                .setColor('#2ecc71')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // 🔴 2. ALT KOMUT: KAPATMA
        if (altKomut === 'kapat') {
            // Veritabanında durumu false yapıyoruz
            ayarKaydet(guildId, 'girisCikisDurum', false);

            const embed = new EmbedBuilder()
                .setTitle('🔓 SİSTEM DEVRE DIŞI')
                .setDescription(`❌ Resimli giriş-çıkış takip sistemi bu sunucu için kalıcı olarak **kapatıldı kanka**. Ayarlar sıfırlanmadı, tekrar açtığında kaldığı yerden devam eder.`)
                .setColor('#e74c3c')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // 🟡 3. ALT KOMUT: TEST ETME
        if (altKomut === 'test') {
            const kanalId = ayarGetir(guildId, 'girisCikisKanal', null);
            const durum = ayarGetir(guildId, 'girisCikisDurum', false);
            const logChan = kanalId ? interaction.guild.channels.cache.get(kanalId) : null;

            if (!logChan || !durum) {
                return interaction.reply({ content: '⚠️ Kanka önce `/giriscikis ayarla` komutuyla bir kanal seçip sistemi aktif etmen lazım!', ephemeral: true });
            }

            // Test için komutu yazan kişinin bilgilerini kullanıyoruz kanka
            const avatar = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
            const username = encodeURIComponent(interaction.user.username);
            const guildName = encodeURIComponent(interaction.guild.name);
            const testResimUrl = `https://dummyimage.com/800x350/2b2d31/f2f3f5.png&text=TEST+BAŞARILI+KANKA!%0A${username}%0A%0ASunucu:+${guildName}`;

            const testEmbed = new EmbedBuilder()
                .setTitle(`📥 [TEST] Sunucuya Yeni Bir Kan Katıldı!`)
                .setDescription(`Aramıza hoş geldin ${interaction.user}! Resimli sistem canavar gibi çalışıyor kanka.`)
                .setThumbnail(avatar)
                .setImage(testResimUrl)
                .setColor('#5865f2')
                .setTimestamp();

            // Belirlenen log kanalına test mesajını yolluyoruz
            await logChan.send({ content: `🧪 **TSA Sistem Testi:**`, embeds: [testEmbed] });
            
            return interaction.reply({ content: `✅ Test afişi başarıyla ${logChan} kanalına fırlatıldı kanka!`, ephemeral: true });
        }
    },
};
