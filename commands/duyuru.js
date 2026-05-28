const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duyuru')
        .setDescription('Sunucuda gelişmiş ve şık bir duyuru yayınlar kanka.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Sadece Yöneticiler kullanabilir
        .addStringOption(opt => 
            opt.setName('başlık')
                .setDescription('Duyurunun ana başlığı ne olacak kanka?')
                .setRequired(true))
        .addStringOption(opt => 
            opt.setName('içerik')
                .setDescription('Duyurunun mesaj metnini buraya yaz kanka.')
                .setRequired(true))
        .addChannelOption(opt => 
            opt.setName('hedef')
                .setDescription('Duyurunun gönderileceği log/duyuru kanalı')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addStringOption(opt => 
            opt.setName('tip')
                .setDescription('Duyuru tipi (Embed çerçeveli mi olsun, düz yazı mı?)')
                .setRequired(false)
                .addChoices(
                    { name: 'Embed (Renkli Çerçeveli)', value: 'embed' },
                    { name: 'Düz Yazı (Normal Metin)', value: 'duz_yazi' }
                ))
        .addStringOption(opt => 
            opt.setName('resim')
                .setDescription('Duyuruya eklenecek büyük resim URL\'si (Opsiyonel)'))
        .addStringOption(opt => 
            opt.setName('footer')
                .setDescription('Duyurunun en altına eklenecek küçük alt yazı (Opsiyonel)'))
        .addBooleanOption(opt => 
            opt.setName('everyone')
                .setDescription('@everyone etiketiyle herkesten rol çalınsın mı?')),

    async execute(interaction) {
        // Komutun çalıştığına dair kullanıcıya gizli bir onay göstermek için defer ediyoruz
        await interaction.deferReply({ ephemeral: true });

        const baslik = interaction.options.getString('başlık');
        const icerik = interaction.options.getString('içerik');
        const hedefKanal = interaction.options.getChannel('hedef');
        const tip = interaction.options.getString('tip') || 'embed';
        const resim = interaction.options.getString('resim');
        const footerText = interaction.options.getString('footer');
        const everyone = interaction.options.getBoolean('everyone') || false;

        // Görseldeki gibi "[Rol] İsim tarafından." formatını oluşturuyoruz
        const uye = interaction.member;
        const enYuksekRol = uye.roles.highest.name;
        const olusturanNotu = `\n\n[${enYuksekRol}] ${interaction.user.username} tarafından.`;

        // Kanala gönderilecek ana paket nesnesi
        const mesajPaketi = {};

        // @everyone kontrolü (Embed içine yazılırsa pinglemez, o yüzden dış metin olarak ekliyoruz)
        if (everyone) {
            mesajPaketi.content = '@everyone';
        }

        // 1. SEÇENEK: EMBED (ÇERÇEVELİ DUYURU)
        if (tip === 'embed') {
            const embed = new EmbedBuilder()
                .setTitle(baslik)
                .setDescription(`${icerik}${olusturanNotu}`)
                .setColor('#f1c40f'); // Görseldeki sarı/turuncu çizgi rengi

            if (resim && (resim.startsWith('http://') || resim.startsWith('https://'))) {
                embed.setImage(resim);
            }

            if (footerText) {
                embed.setFooter({ text: footerText });
            }

            mesajPaketi.embeds = [embed];

        // 2. SEÇENEK: DÜZ YAZI (NORMAL METİN)
        } else {
            let duzMetinFormatı = `**${baslik}**\n\n${icerik}${olusturanNotu}`;
            
            if (footerText) {
                duzMetinFormatı += `\n\n*${footerText}*`;
            }
            if (resim && (resim.startsWith('http://') || resim.startsWith('https://'))) {
                duzMetinFormatı += `\n${resim}`;
            }

            if (mesajPaketi.content) {
                mesajPaketi.content += `\n${duzMetinFormatı}`;
            } else {
                mesajPaketi.content = duzMetinFormatı;
            }
        }

        // Duyuruyu hedef kanala fırlatma aşaması
        try {
            await hedefKanal.send(mesajPaketi);
            return interaction.editReply({ content: `✅ Duyuru başarıyla ${hedefKanal} kanalında uçuruldu kanka!` });
        } catch (error) {
            console.error('Duyuru gönderme hatası:', error);
            return interaction.editReply({ content: '❌ Duyuru gönderilirken hata çıktı. Botun o kanala mesaj gönderme yetkilerini kontrol et kanka.' });
        }
    }
};
