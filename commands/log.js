const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { ayarKaydet, ayarGetir } = require('../utils/db');

module.exports = {
    requiredPerms: [PermissionFlagsBits.Administrator],

    data: new SlashCommandBuilder()
        .setName('log')
        .setDescription('TSA Log sistemini yönetir.')
        .addSubcommand(subcommand =>
            subcommand.setName('kanalı-ayarla')
                .setDescription('Sunucudaki tüm olayların akacağı log kanalını belirler.')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Log kanalı olacak metin kanalını seçin kanka.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('göster')
                .setDescription('Şu anda ayarlı olan log kanalını gösterir.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('kapat')
                .setDescription('Log sistemini bu sunucu için kapatır.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'kanalı-ayarla') {
            const kanal = interaction.options.getChannel('kanal');

            try {
                // Database'e kaydet
                ayarKaydet(interaction.guild.id, 'logKanal', kanal.id);

                const embed = new EmbedBuilder()
                    .setTitle('<a:acs_ayarlar:1505165015127162994> TSA | Log Sistemi Aktif!')
                    .setDescription(`<a:tik:1505164671081123840> Harika! Sunucudaki tüm mesaj, rol, kanal, ses, üye, ban, emoji, sticker ve invite hareketleri artık ${kanal} kanalına raporlanacak kanka.`)
                    .setColor('#2ecc71')
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error('<a:baarsz:1505146967817326675> Log kanalı ayar hatası:', error);
                return interaction.reply({ content: '<a:baarsz:1505146967817326675> Bir hata oluştu kanka!', ephemeral: true });
            }
        }

        if (subcommand === 'göster') {
            try {
                const logKanalId = ayarGetir(interaction.guild.id, 'logKanal', null);

                if (!logKanalId) {
                    return interaction.reply({ 
                        content: '<a:uyari:1505166167189487757> Henüz hiç log kanalı ayarlanmamış kanka! `/log kanalı-ayarla` kullan.', 
                        ephemeral: true 
                    });
                }

                const logKanal = interaction.guild.channels.cache.get(logKanalId);

                const embed = new EmbedBuilder()
                    .setTitle('<:Paper:1505146388596391977> Log Kanalı Bilgisi')
                    .setDescription(`Log kanalı: ${logKanal || '`Kanal silindi!`'}`)
                    .addFields(
                        { name: 'Kanal ID', value: `\`${logKanalId}\`` },
                        { name: 'Durum', value: logKanal ? '<a:tik:1505164671081123840> Aktif' : '<:sil:1505147967907037275> Kanal Silinmiş' }
                    )
                    .setColor('#3498db')
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error('<a:baarsz:1505146967817326675> Log göster hatası:', error);
                return interaction.reply({ content: '<a:baarsz:1505146967817326675> Bir hata oluştu kanka!', ephemeral: true });
            }
        }

        if (subcommand === 'kapat') {
            try {
                ayarKaydet(interaction.guild.id, 'logKanal', null);

                const embed = new EmbedBuilder()
                    .setTitle('<a:baarsz:1505146967817326675> Log Sistemi Kapatıldı')
                    .setDescription('Log sistemi bu sunucu için devre dışı bırakıldı.')
                    .setColor('#e74c3c')
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error('<a:baarsz:1505146967817326675> Log kapatma hatası:', error);
                return interaction.reply({ content: '<a:baarsz:1505146967817326675> Bir hata oluştu kanka!', ephemeral: true });
            }
        }
    }
};
