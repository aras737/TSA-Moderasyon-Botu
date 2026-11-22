const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sunucu-bilgi')
        .setDescription('🏠 Sunucunun tüm detaylarını, boost durumunu ve emojilerini listeler.'),

    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild?.id) {
            return interaction.reply({
                content: '⛔ Bu komut yalnızca geçerli bir Discord sunucusunda kullanılabilir.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        // Discord API/cache bazen createdTimestamp alanını null döndürebilir.
        // Guild snowflake ID'si, oluşturulma zamanını güvenli şekilde hesaplamayı sağlar.
        let createdAtMs = Number.isFinite(guild.createdTimestamp)
            ? guild.createdTimestamp
            : null;

        if (createdAtMs === null) {
            try {
                createdAtMs = Number((BigInt(guild.id) >> 22n) + 1420070400000n);
            } catch {
                createdAtMs = Date.now();
            }
        }

        const kurulmaTarihi = Number.isFinite(createdAtMs)
            ? `<t:${Math.floor(createdAtMs / 1000)}:R>`
            : 'Bilinmiyor';

        // Sabit özel emoji sistemin
        const korumaEmoji = '<:koruma1:1505143174190989352>';

        // Kanalları türlerine göre sayalım
        const kanallar = guild.channels.cache;
        const metinKanallari = kanallar.filter(c => c.type === ChannelType.GuildText).size;
        const sesKanallari = kanallar.filter(c => c.type === ChannelType.GuildVoice).size;
        const kategoriSayisi = kanallar.filter(c => c.type === ChannelType.GuildCategory).size;

        // Emojileri ayıralım
        const emojiler = guild.emojis.cache;
        const normalEmoji = emojiler.filter(e => !e.animated).size;
        const hareketliEmoji = emojiler.filter(e => e.animated).size;
        const toplamEmoji = emojiler.size;

        // Takviye (Boost) Durumu Kontrolü
        const boostSayisi = guild.premiumSubscriptionCount || 0;
        const boostSeviyesi = guild.premiumTier;
        let boostDurumu = `<a:baarsz:1505146967817326675> Takviye Yok (0 Başlangıç)`;
        
        if (boostSayisi > 0) {
            boostDurumu = `<a:Logo_Boosts:1505158932270813254> **${boostSayisi} Takviye** var! (Seviye: \`${boostSeviyesi}\`)`;
        }

        // Sunucu Bilgi Embed Paneli
        const bilgiEmbed = new EmbedBuilder()
            .setTitle(`${korumaEmoji} TMF | Sunucu Bilgi Paneli`)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }) || undefined)
            .setDescription(`**${guild.name}** sunucusunun anlık genel durum raporu aşağıda listelenmiştir.`)
            .addFields(
                { name: '<:tac:1505158450538352670> Sunucu Sahibi', value: `<@${guild.ownerId}> \`(${guild.ownerId})\``, inline: false },
                { name: '<:elner_tarih:1505158205460844565> Kuruluş Tarihi', value: kurulmaTarihi, inline: true },
                { name: '<:n_id:1505158042738491464> Sunucu ID', value: `\`${guild.id}\``, inline: true },
                { 
                    name: '<:uzaybot_kullanicilar:1505146190973505567> Üye Durumu', 
                    value: `<:uzaybot_kullanicilar:1505146190973505567> Toplam Üye: \`${guild.memberCount}\`\n<:koruma1:1505143174190989352> Rol Sayısı: \`${guild.roles.cache.size}\``, 
                    inline: false 
                },
                { 
                    name: '<:uzaybot_kanal:1505159120074833931> Kanal Sayıları', 
                    value: `<:uzaybot_mesaj:1505162349026344970> Metin: \`${metinKanallari}\`\n🔊 Sesli: \`${sesKanallari}\`\n<:appEmoji_kategori:1505159567879966811> Kategori: \`${kategoriSayisi}\``, 
                    inline: true 
                },
                { 
                    name: '<:RolsimgesiMasterNetworkz172:1505162557009432626> Emoji Bilgileri', 
                    value: `<a:mor_yildiz:1505162201273729044> Normal: \`${normalEmoji}\`\n🔥 Hareketli: \`${hareketliEmoji}\`\n<:clip_board:1505160480325632020> Toplam: \`${toplamEmoji}\``, 
                    inline: true 
                },
                { 
                    name: '<:takviye:1505157853994815530> Takviye (Boost) Durumu', 
                    value: boostDurumu, 
                    inline: false 
                }
            )
            .setColor('#1abc9c') // Şık turkuaz rengi
            .setFooter({ text: `Sorgulayan: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        // Yanıtı gönderiyoruz
        await interaction.editReply({ embeds: [bilgiEmbed] });
    }
};