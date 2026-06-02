const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sureli-duyuru')
        .setDescription('Belirli kanala veya TÜM kanallara zaman ayarlı periyodik duyuru sistemi kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcommand =>
            subcommand
                .setName('baslat')
                .setDescription('Periyodik duyuru döngüsünü başlatır kanka.')
                .addIntegerOption(option =>
                    option.setName('dakika')
                        .setDescription('Kaç dakikada bir bu duyuru tekrarlansın?')
                        .setRequired(true)
                        .setMinValue(1)
                )
                .addStringOption(option =>
                    option.setName('mesaj')
                        .setDescription('Duyurulacak mesaj metni (Markdown destekler).')
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Duyurunun atılacağı kanal (Boş bırakırsan bulunduğun kanal seçilir).')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false) // ARTIK ZORUNLU DEĞİL KANKA!
                )
                .addBooleanOption(option =>
                    option.setName('hepsi')
                        .setDescription('Duyuru sunucudaki TÜM yazı kanallarına mı kurulsun?')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('durdur')
                .setDescription('Aktif duyuru döngüsünü sonlandırır.')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Duyurusu durdurulacak kanal (Boş bırakırsan bulunduğun kanal seçilir).')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addBooleanOption(option =>
                    option.setName('hepsi')
                        .setDescription('Sunucudaki TÜM süreli duyuruları iptal etmek için True yap.')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        if (!interaction.client.sureliDuyurular) {
            interaction.client.sureliDuyurular = new Map();
        }

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // Kanal seçilmediyse komutun yazıldığı kanalı hedef al kanka
        const secilenKanal = interaction.options.getChannel('kanal');
        const hedefKanal = secilenKanal || interaction.channel;
        const hepsiSecenegi = interaction.options.getBoolean('hepsi') || false;

        // ==========================================
        // 🚀 DUYURU BAŞLATMA SİSTEMİ
        // ==========================================
        if (subcommand === 'baslat') {
            const dakika = interaction.options.getInteger('dakika', true);
            const mesajMetni = interaction.options.getString('mesaj', true);

            const duyuruEmbed = new EmbedBuilder()
                .setTitle('📢 TSA | OTOMATİK DUYURU')
                .setDescription(mesajMetni.replace(/\\n/g, '\n'))
                .setColor('#3498db')
                .setTimestamp()
                .setFooter({ text: 'Bu bir periyodik sistem duyurusudur.' });

            // --- DURUM 1: TÜM KANALLARA AYARLAMA ---
            if (hepsiSecenegi) {
                // Sunucudaki tüm metin kanallarını buluyoruz kanka
                const textChannels = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
                let baslatilanKanalSayisi = 0;

                textChannels.forEach(chan => {
                    const key = `${guildId}_${chan.id}`;

                    // Varsa eski döngüyü temizle kanka spam olmasın
                    if (interaction.client.sureliDuyurular.has(key)) {
                        clearInterval(interaction.client.sureliDuyurular.get(key));
                    }

                    const intervalId = setInterval(async () => {
                        try {
                            const c = await interaction.guild.channels.fetch(chan.id).catch(() => null);
                            if (!c) {
                                clearInterval(intervalId);
                                interaction.client.sureliDuyurular.delete(key);
                                return;
                            }
                            await c.send({ embeds: [duyuruEmbed] });
                        } catch (err) {
                            console.error(`[Duyuru Hatası] ${chan.name} kanalına atılamadı:`, err.message);
                        }
                    }, dakika * 60 * 1000);

                    interaction.client.sureliDuyurular.set(key, intervalId);
                    baslatilanKanalSayisi++;
                });

                const hepsiBasariEmbed = new EmbedBuilder()
                    .setTitle('<a:tik:1505164671081123840> Küresel Duyuru Aktif Edildi')
                    .setDescription(`Sunucudaki toplam **${baslatilanKanalSayisi}** yazı kanalının tamamında periyodik duyuru başlatıldı kanka!`)
                    .addFields(
                        { name: '⏰ Süre Periyodu', value: `\`${dakika}\` dakikada bir`, inline: true },
                        { name: '💬 Mesaj İçeriği', value: `\`\`\`${mesajMetni}\`\`\``, inline: false }
                    )
                    .setColor('#107a29');

                return interaction.reply({ embeds: [hepsiBasariEmbed] });
            }

            // --- DURUM 2: TEK KANALA AYARLAMA (Mevcut veya Seçilen Kanal) ---
            const key = `${guildId}_${hedefKanal.id}`;

            if (interaction.client.sureliDuyurular.has(key)) {
                clearInterval(interaction.client.sureliDuyurular.get(key));
                interaction.client.sureliDuyurular.delete(key);
            }

            const intervalId = setInterval(async () => {
                try {
                    const c = await interaction.guild.channels.fetch(hedefKanal.id).catch(() => null);
                    if (!c) {
                        clearInterval(intervalId);
                        interaction.client.sureliDuyurular.delete(key);
                        return;
                    }
                    await c.send({ embeds: [duyuruEmbed] });
                } catch (err) {
                    console.error(`[Duyuru Hatası] ${hedefKanal.name} kanalına atılamadı:`, err.message);
                }
            }, dakika * 60 * 1000);

            interaction.client.sureliDuyurular.set(key, intervalId);

            const tekBasariEmbed = new EmbedBuilder()
                .setTitle('<a:tik:1505164671081123840> Süreli Duyuru Aktif Edildi')
                .setDescription(`${hedefKanal} kanalında periyodik duyuru sistemi başarıyla başlatıldı kanka.`)
                .addFields(
                    { name: '⏰ Süre Periyodu', value: `\`${dakika}\` dakikada bir`, inline: true },
                    { name: '💬 Mesaj İçeriği', value: `\`\`\`${mesajMetni}\`\`\``, inline: false }
                )
                .setColor('#107a29');

            return interaction.reply({ embeds: [tekBasariEmbed] });
        }

        // ==========================================
        // 🛑 DUYURU DURDURMA SİSTEMİ
        // ==========================================
        if (subcommand === 'durdur') {
            // --- DURUM 1: TÜM SUNUCUDAKİLERİ DURDUR ---
            if (hepsiSecenegi) {
                let durdurulanSayi = 0;
                
                // Botun hafızasındaki bu sunucuya ait tüm döngüleri bulup kapatıyoruz kanka
                for (let [mapKey, value] of interaction.client.sureliDuyurular.entries()) {
                    if (mapKey.startsWith(`${guildId}_`)) {
                        clearInterval(value);
                        interaction.client.sureliDuyurular.delete(mapKey);
                        durdurulanSayi++;
                    }
                }

                const hepsiDurdurulduEmbed = new EmbedBuilder()
                    .setTitle('<a:tik:1505164671081123840> Tüm Döngüler Kapatıldı')
                    .setDescription(`Sunucuda aktif çalışan toplam **${durdurulanSayi}** kanallı tüm otomatik duyurular tamamen durduruldu kanka.`)
                    .setColor('#e74c3c');

                return interaction.reply({ embeds: [hepsiDurdurulduEmbed] });
            }

            // --- DURUM 2: TEK KANALI DURDUR ---
            const key = `${guildId}_${hedefKanal.id}`;

            if (!interaction.client.sureliDuyurular.has(key)) {
                return interaction.reply({
                    content: `⚠️ Kanka, ${hedefKanal} kanalında zaten çalışan periyodik bir duyuru döngüsü yok.`,
                    ephemeral: true
                });
            }

            clearInterval(interaction.client.sureliDuyurular.get(key));
            interaction.client.sureliDuyurular.delete(key);

            const tekDurdurulduEmbed = new EmbedBuilder()
                .setTitle('<a:tik:1505164671081123840> Duyuru Durduruldu')
                .setDescription(`${hedefKanal} kanalındaki otomatik duyuru döngüsü sonlandırıldı kanka.`)
                .setColor('#e74c3c');

            return interaction.reply({ embeds: [tekDurdurulduEmbed] });
        }
    }
};
