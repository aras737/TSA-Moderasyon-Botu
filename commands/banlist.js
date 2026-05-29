const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    requiredPerms: [PermissionsBitField.Flags.BanMembers, PermissionsBitField.Flags.Administrator],

    data: new SlashCommandBuilder()
        .setName('banlist')
        .setDescription('TSA sunucusundaki yasaklıları genel, tam yasaklı ve normal diye bölümlere ayırarak listeler.'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
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

            const banArray = Array.from(bans.values());
            
            // 🔥 VERİLERİ BÖLÜMLERE (KATEGORİLERE) AYIRIYORUZ
            const kureselBanlar = banArray.filter(ban => ban.reason && ban.reason.includes('Küresel Sıkıyönetim'));
            const standartBanlar = banArray.filter(ban => !ban.reason || !ban.reason.includes('Küresel Sıkıyönetim'));

            let mevcutFiltre = 'hepsi'; // 'hepsi', 'tam', 'standart'
            let mevcutSayfa = 0;
            const herSayfada = 10;

            // ⚡ AKTİF BÖLÜME GÖRE VERİ SEÇEN FONKSİYON
            const aktifListeyiGetir = () => {
                if (mevcutFiltre === 'tam') return kureselBanlar;
                if (mevcutFiltre === 'standart') return standartBanlar;
                return banArray;
            };

            // 🖼️ DİNAMİK EMBED OLUŞTURUCU
            const sayfaEmbedOlustur = () => {
                const aktifListe = aktifListeyiGetir();
                const toplamSayfa = Math.ceil(aktifListe.length / herSayfada) || 1;

                if (mevcutSayfa >= toplamSayfa) mevcutSayfa = 0;

                const baslangic = mevcutSayfa * herSayfada;
                const bitis = baslangic + herSayfada;
                const sayfaVerisi = aktifListe.slice(baslangic, bitis);

                // Başlık metni aktif bölüme göre değişiyor kanka
                let bolumBasligi = '<:yasaklandi:1505146022588842095> TSA | Genel Yasaklı Listesi';
                if (mevcutFiltre === 'tam') bolumBasligi = '<:yasaklandi:1505146022588842095> TSA | Tam Yasaklananlar Bölümü';
                if (mevcutFiltre === 'standart') bolumBasligi = '<:Paper:1505146388596391977> TSA | Standart Sunucu Yasakları Bölümü';

                let listeMetni = '';
                if (aktifListe.length === 0) {
                    listeMetni = '*<a:uyari:1505166167189487757> Bu bölümde listelenecek herhangi bir yasaklı üye bulunmuyor kanka.*';
                } else {
                    listeMetni = sayfaVerisi.map((ban, index) => {
                        const sebep = ban.reason ? ban.reason : 'Sebep belirtilmemiş.';
                        const isGlobal = ban.reason && ban.reason.includes('Küresel Sıkıyönetim');
                        const rozet = isGlobal ? '🔴 `[KÜRESEL TAM YASAK]`' : '🟡 `[SUNUCU YASAĞI]`';

                        return `**${baslangic + index + 1}.** <:uzaybot_kullanicilar:1505146190973505567> **${ban.user.tag}** \`(${ban.user.id})\` — ${rozet}\n┗ <:Paper:1505146388596391977> **Sebep:** *${sebep}*`;
                    }).join('\n\n');
                }

                return new EmbedBuilder()
                    .setTitle(bolumBasligi)
                    .setDescription(
                        `📊 **Bölüm İstatistikleri:**\n` +
                        `• <:uzaybot_kullanicilar:1505146190973505567> Toplam Yasaklı: **${banArray.length}**\n` +
                        `• <:yasaklandi:1505146022588842095> Tam Yasaklananlar: **${kureselBanlar.length}**\n` +
                        `• <:Paper:1505146388596391977> Standart Yasaklananlar: **${standartBanlar.length}**\n\n` +
                        `• <a:tik:1505164671081123840> Şu An Gösterilen: **${aktifListe.length}** üye listeleniyor.\n\n` +
                        `--------------------------------------------------\n\n` +
                        `${listeMetni}`
                    )
                    .setColor(mevcutFiltre === 'tam' ? '#7a0010' : (mevcutFiltre === 'standart' ? '#f1c40f' : '#ff4d4d'))
                    .setThumbnail(interaction.guild.iconURL())
                    .setFooter({ text: `Sayfa: ${mevcutSayfa + 1}/${toplamSayfa} | Bölüm: ${mevcutFiltre.toUpperCase()}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();
            };

            // 🎛️ BUTON SATIRLARINI HAZIRLAMA (SANA ÖZEL EMOJİLER ENTEGRE EDİLDİ)
            const butonlariOlustur = () => {
                const aktifListe = aktifListeyiGetir();
                const toplamSayfa = Math.ceil(aktifListe.length / herSayfada) || 1;

                // 1. Satır: Sayfa Değiştirme Butonları (◀️ / ▶️)
                const yonSatiri = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('onceki_sayfa')
                        .setLabel('Geri')
                        .setEmoji('◀️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(mevcutSayfa === 0 || aktifListe.length === 0),
                    new ButtonBuilder()
                        .setCustomId('sonraki_sayfa')
                        .setLabel('İleri')
                        .setEmoji('▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(mevcutSayfa === toplamSayfa - 1 || aktifListe.length === 0)
                );

                // 2. Satır: Bölüm/Filtre Değiştirme Butonları (SENİN EMOJİLERİNLE KANKA)
                const filtreSatiri = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('filtre_hepsi')
                        .setLabel('Tümü')
                        .setEmoji('1505146190973505567') // uzaybot_kullanicilar emojisi
                        .setStyle(mevcutFiltre === 'hepsi' ? ButtonStyle.Success : ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('filtre_tam')
                        .setLabel('Tam Yasaklılar')
                        .setEmoji('1505146022588842095') // yasaklandi emojisi
                        .setStyle(mevcutFiltre === 'tam' ? ButtonStyle.Danger : ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('filtre_standart')
                        .setLabel('Sunucu Yasakları')
                        .setEmoji('1505146388596391977') // Paper emojisi
                        .setStyle(mevcutFiltre === 'standart' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                );

                return [yonSatiri, filtreSatiri];
            };

            // İlk mesajı basıyoruz kanka
            const mesaj = await interaction.editReply({
                embeds: [sayfaEmbedOlustur()],
                components: butonlariOlustur()
            });

            // 🔄 ETKİLEŞİM TOPLAYICI (COLLECTOR)
            const collector = mesaj.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000 // 2 dakika boyunca menü aktif kalır kanka
            });

            collector.on('collect', async buttonInteraction => {
                if (buttonInteraction.user.id !== interaction.user.id) {
                    return buttonInteraction.reply({ content: '<a:uyari:1505166167189487757> Bu listeyi sen sorgulamadın, butonları kullanamazsın kanka.', ephemeral: true });
                }

                if (buttonInteraction.customId === 'onceki_sayfa') {
                    mevcutSayfa--;
                } else if (buttonInteraction.customId === 'sonraki_sayfa') {
                    mevcutSayfa++;
                } else if (buttonInteraction.customId === 'filtre_hepsi') {
                    mevcutFiltre = 'hepsi';
                    mevcutSayfa = 0;
                } else if (buttonInteraction.customId === 'filtre_tam') {
                    mevcutFiltre = 'tam';
                    mevcutSayfa = 0;
                } else if (buttonInteraction.customId === 'filtre_standart') {
                    mevcutFiltre = 'standart';
                    mevcutSayfa = 0;
                }

                await buttonInteraction.update({
                    embeds: [sayfaEmbedOlustur()],
                    components: butonlariOlustur()
                });
            });

            collector.on('end', () => {
                const kapaliSatir = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('b1').setLabel('🔒 Menü Zaman Aşımına Uğradı').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );
                mesaj.edit({ components: [kapaliSatir] }).catch(() => {});
            });

        } catch (error) {
            console.error('Ban listesi hatası kanka:', error);
            if (interaction.deferred) {
                await interaction.editReply({ content: '<a:baarsz:1505146967817326675> Ban listesi bölümlere ayrılırken teknik bir hata oluştu!' });
            }
        }
    }
};
