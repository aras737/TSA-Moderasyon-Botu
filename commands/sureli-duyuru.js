const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sureli-duyuru')
        .setDescription('Belirli bir kanala zaman ayarlı periyodik duyuru sistemi kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) // Sadece mesajları yönetebilen yetkililer
        .addSubcommand(subcommand =>
            subcommand
                .setName('baslat')
                .setDescription('Periyodik duyuru döngüsünü başlatır kanka.')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Duyurunun atılacağı yazı kanalı.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('dakika')
                        .setDescription('Kaç dakikada bir bu duyuru tekrarlansın?')
                        .setRequired(true)
                        .setMinValue(1) // En az 1 dakika olabilir
                )
                .addStringOption(option =>
                    option.setName('mesaj')
                        .setDescription('Duyurulacak mesaj metni (Markdown destekler).')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('durdur')
                .setDescription('Bir kanaldaki aktif duyuru döngüsünü sonlandırır.')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Duyurusu durdurulacak kanal.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        // Botun hafızasında aktif duyuruları tutmak için bir Map yoksa oluşturuyoruz kanka
        if (!interaction.client.sureliDuyurular) {
            interaction.client.sureliDuyurular = new Map();
        }

        const subcommand = interaction.options.getSubcommand();
        const kanal = interaction.options.getChannel('kanal', true);
        const guildId = interaction.guild.id;
        const key = `${guildId}_${kanal.id}`; // Her kanala özel benzersiz anahtar

        // ==========================================
        // 🚀 DUYURU BAŞLATMA ALT KOMUTU
        // ==========================================
        if (subcommand === 'baslat') {
            const dakika = interaction.options.getInteger('dakika', true);
            const mesajMetni = interaction.options.getString('mesaj', true);

            // Eğer o kanalda zaten aktif bir döngü varsa önce eskisini temizle kanka
            if (interaction.client.sureliDuyurular.has(key)) {
                clearInterval(interaction.client.sureliDuyurular.get(key));
                interaction.client.sureliDuyurular.delete(key);
            }

            // Göz alıcı bir duyuru embed'i tasarlıyoruz
            const duyuruEmbed = new EmbedBuilder()
                .setTitle('📢 TSA | OTOMATİK DUYURU')
                .setDescription(mesajMetni.replace(/\\n/g, '\n')) // Satır atlamalarını desteklesin kanka
                .setColor('#3498db')
                .setTimestamp()
                .setFooter({ text: 'Bu bir periyodik sistem duyurusudur.' });

            // Döngüyü (setInterval) kuruyoruz
            const intervalId = setInterval(async () => {
                try {
                    // Kanalın hala var olup olmadığını kontrol et kanka (silinmiş olabilir)
                    const hedefKanal = await interaction.guild.channels.fetch(kanal.id).catch(() => null);
                    if (!hedefKanal) {
                        clearInterval(intervalId);
                        interaction.client.sureliDuyurular.delete(key);
                        return;
                    }

                    await hedefKanal.send({ embeds: [duyuruEmbed] });
                } catch (error) {
                    console.error(`[Süreli Duyuru Hatası] ${kanal.name} kanalına mesaj atılamadı:`, error.message);
                }
            }, dakika * 60 * 1000); // Dakikayı milisaniyeye çeviriyoruz

            // Kurulan döngüyü botun ram belleğine kaydediyoruz
            interaction.client.sureliDuyurular.set(key, intervalId);

            const basariEmbed = new EmbedBuilder()
                .setTitle('<a:tik:1505164671081123840> Süreli Duyuru Aktif Edildi')
                .setDescription(`${kanal} kanalında periyodik duyuru sistemi başarıyla başlatıldı kanka.`)
                .addFields(
                    { name: '⏰ Tekrarlanma Süresi', value: `\`${dakika}\` dakikada bir`, inline: true },
                    { name: '💬 Kilitlenen Mesaj', value: `\`\`\`${mesajMetni}\`\`\``, inline: false }
                )
                .setColor('#107a29');

            return interaction.reply({ embeds: [basariEmbed] });
        }

        // ==========================================
        // 🛑 DUYURU DURDURMA ALT KOMUTU
        // ==========================================
        if (subcommand === 'durdur') {
            if (!interaction.client.sureliDuyurular.has(key)) {
                return interaction.reply({
                    content: `⚠️ Kanka, ${kanal} kanalında zaten aktif çalışan periyodik bir duyuru döngüsü bulamadım.`,
                    ephemeral: true
                });
            }

            // Döngüyü hafızadan bulup imha ediyoruz
            clearInterval(interaction.client.sureliDuyurular.get(key));
            interaction.client.sureliDuyurular.delete(key);

            const durdurulduEmbed = new EmbedBuilder()
                .setTitle('<a:tik:1505164671081123840> Sistem Durduruldu')
                .setDescription(`${kanal} kanalındaki otomatik duyuru döngüsü başarıyla sonlandırıldı kanka.`)
                .setColor('#e74c3c');

            return interaction.reply({ embeds: [durdurulduEmbed] });
        }
    }
};
