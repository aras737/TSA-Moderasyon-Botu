const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    // Sadece Üyeleri Yasakla veya Yönetici yetkisi olanlar görebilir
    requiredPerms: [PermissionsBitField.Flags.BanMembers, PermissionsBitField.Flags.Administrator],

    data: new SlashCommandBuilder()
        .setName('banlist')
        .setDescription('TSA sunucusundaki yasaklı kullanıcıları sayfalı ve sebepleriyle listeler.'),

    async execute(interaction) {
        // Render 7/24 sisteminde zaman aşımı olmasın diye yanıtı önceden rezerve ediyoruz
        await interaction.deferReply();

        try {
            // Sunucudaki banlı kullanıcıları çekiyoruz
            const bans = await interaction.guild.bans.fetch();

            if (bans.size === 0) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('TSA | Yasaklı Listesi')
                            .setDescription('<a:tik:1505164671081123840> Sunucuda yasaklı kullanıcı bulunmuyor kanka.')
                            .setColor('Green')
                    ]
                });
            }

            // Ban verilerini diziye aktarıyoruz (Gelişmiş bilgi ve sebep dahil)
            const banArray = Array.from(bans.values());
            
            // Sayfalandırma Ayarları (Her sayfada 10 kullanıcı)
            const herSayfada = 10;
            const toplamSayfa = Math.ceil(banArray.length / herSayfada);
            let mevcutSayfa = 0;

            // Sayfa içeriğini oluşturan fonksiyon
            const sayfaEmbedOlustur = (sayfaNo) => {
                const baslangic = sayfaNo * herSayfada;
                const bitis = baslangic + herSayfada;
                const sayfaVerisi = banArray.slice(baslangic, bitis);

                const listeMetni = sayfaVerisi.map((ban, index) => {
                    const sebep = ban.reason ? ban.reason : 'Sebep belirtilmemiş.';
                    return `**${baslangic + index + 1}.** <:uzaybot_kullanicilar:1505146190973505567> **${ban.user.tag}** \`(${ban.user.id})\`\n┗ <:Paper:1505146388596391977> **Sebep:** *${sebep}*`;
                }).join('\n\n');

                return new EmbedBuilder()
                    .setTitle('<:yasaklandi:1505146022588842095> TSA | Detaylı Yasaklı Listesi')
                    .setDescription(`Sunucuda toplam **${banArray.length}** yasaklı üye var.\n\n${listeMetni}`)
                    .setColor('#ff4d4d')
                    .setThumbnail(interaction.guild.iconURL())
                    .setFooter({ text: `Sayfa: ${sayfaNo + 1}/${toplamSayfa} | Sorgulayan: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();
            };

            // Butonları oluşturuyoruz
            const butonSatiri = () => new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('onceki_sayfa')
                    .setLabel('◀️ Geri')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(mevcutSayfa === 0), // İlk sayfadaysa geri butonu kapalı olur
                new ButtonBuilder()
                    .setCustomId('sonraki_sayfa')
                    .setLabel('İleri ▶️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(mevcutSayfa === toplamSayfa - 1) // Son sayfadaysa ileri butonu kapalı olur
            );

            // İlk sayfayı gönderiyoruz
            const mesaj = await interaction.editReply({
                embeds: [sayfaEmbedOlustur(mevcutSayfa)],
                components: toplamSayfa > 1 ? [butonSatiri()] : [] // Eğer tek sayfa varsa butonları hiç göstermiyoruz
            });

            // Eğer birden fazla sayfa varsa buton tıklamalarını dinlemeye başlıyoruz
            if (toplamSayfa > 1) {
                const collector = mesaj.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 60000 // 60 saniye sonra butonlar deaktif olur (Sunucuyu yormamak için)
                });

                collector.on('collect', async buttonInteraction => {
                    // Güvenlik: Komutu kim yazdıysa butonlara sadece o basabilir kanka
                    if (buttonInteraction.user.id !== interaction.user.id) {
                        return buttonInteraction.reply({ content: '<a:uyari:1505166167189487757> Bu listeyi sen sorgulamadın, butonları kullanamazsın kanka.', ephemeral: true });
                    }

                    if (buttonInteraction.customId === 'onceki_sayfa') {
                        mevcutSayfa--;
                    } else if (buttonInteraction.customId === 'sonraki_sayfa') {
                        mevcutSayfa++;
                    }

                    // Mesajı yeni sayfa ve güncel buton durumlarıyla güncelliyoruz
                    await buttonInteraction.update({
                        embeds: [sayfaEmbedOlustur(mevcutSayfa)],
                        components: [butonSatiri()]
                    });
                });

                // Süre bittiğinde butonları kapatıyoruz
                collector.on('end', () => {
                    const kapaliSatir = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('b1').setLabel('◀️ Geri').setStyle(ButtonStyle.Secondary).setDisabled(true),
                        new ButtonBuilder().setCustomId('b2').setLabel('İleri ▶️').setStyle(ButtonStyle.Secondary).setDisabled(true)
                    );
                    mesaj.edit({ components: [kapaliSatir] }).catch(() => {});
                });
            }

        } catch (error) {
            console.error('Ban listesi hatası kanka:', error);
            if (interaction.deferred) {
                await interaction.editReply({ content: '<a:baarsz:1505146967817326675> Ban listesi çekilirken teknik bir hata oluştu!' });
            }
        }
    }
};