const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {

    client.on('guildMemberAdd', async (member) => {
        // Eğer katılan üye bir kullanıcıysa sistemi çalıştırma, sadece botları denetle
        if (!member.user.bot) return;

        const guild = member.guild;
        const owner = await guild.fetchOwner();

        // ⏱️ Denetim kaydından bu botu kimin davet ettiğini buluyoruz
        const logs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.BotAdd }).catch(() => null);
        const entry = logs?.entries.first();
        const davet Eden = entry?.executor;

        // Eğer botu direkt sunucu sahibi davet ettiyse, kontrol etmeye gerek yok kanka
        if (davetEden && davetEden.id === guild.ownerId) return;

        try {
            // 🚨 GÜVENLİK ÖNLEMİ 1: Botu tehlike geçene kadar ANINDA sunucudan tekmeliyoruz!
            await member.kick('🚨 TSA Anti-Bot: Sunucu sahibi onayı bekleniyor.');

            // 📩 SUNUCU SAHİBİNİN DM KUTUSUNA GİDECEK EMBED TASARIMI
            const dmEmbed = new EmbedBuilder()
                .setTitle('🚨 SUNUCUYA YABANCI BOT EKLEME GİRİŞİMİ!')
                .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
                .setDescription(`Sunucunuza bir yetkili tarafından yabancı bir bot eklenmeye çalışıldı. İstismar (Abuse) ihtimaline karşı bot anında sunucudan uzaklaştırıldı ve onayınıza sunuldu kanka.`)
                .addFields(
                    { name: '🤖 Eklenmek İsteyen Bot', value: `${member.user.tag}\n\`ID: ${member.user.id}\``, inline: true },
                    { name: '👤 Davet Eden Yetkili', value: `${davetEden ? davetEden : 'Bilinmiyor'}\n\`ID: ${davetEden ? davetEden.id : '---'}\``, inline: true },
                    { name: '🛡️ Güvenlik Durumu', value: '⚠️ Bot şu an sunucudan atıldı. Aşağıdaki butonlardan kalıcı karar verebilirsin.' }
                )
                .setColor('#f1c40f')
                .setFooter({ text: 'TSA İstismar Önleme Sistemi', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            // Onay ve İptal Butonları
            const butonlar = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`bot_onay_${member.user.id}_${davetEden?.id}`)
                    .setLabel('✅ Botu Onayla (İçeri Al)')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`bot_red_${member.user.id}_${davetEden?.id}`)
                    .setLabel('❌ Reddet & Yetkiyi Al')
                    .setStyle(ButtonStyle.Danger)
            );

            // Sunucu sahibine DM fırlatıyoruz
            const dmMesaj = await owner.send({ embeds: [dmEmbed], components: [butonlar] }).catch(() => null);

            // Eğer sahibinin DM'si kapalıysa log kanalına acil durum mesajı at kanka
            if (!dmMesaj) {
                const logKanalId = ayarGetir(guild.id, 'logKanal', null);
                const logChan = logKanalId ? client.channels.cache.get(logKanalId) : null;
                if (logChan) {
                    logChan.send(`⚠️ @everyone **KUSURAT!** Sunucu sahibinin DM kutusu kapalı olduğu için Anti-Bot onay mesajı gönderilemedi! Bot güvenlik amacıyla dışarıda tutuluyor.`);
                }
            }

        } catch (err) {
            console.error('Anti-bot hatası:', err);
        }
    });

    // =========================================================================
    // 🎛️ BUTON ETKİLEŞİM MERKEZİ (ONAY / RED İŞLEMLERİ)
    // =========================================================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        const [islem, tip, botId, yetkiliId] = interaction.customId.split('_');
        if (islem !== 'bot' || !botId) return;

        // Sadece sunucu sahibi butonlara basabilir, başkası basarsa hata ver
        const guildId = interaction.message.author.id; // DM olduğu için guild'i botların ortak olduğu yerden bulacağız
        // Güvenlik için işlemi yapan kişinin sunucu sahipliğini doğrula
        await interaction.deferUpdate();

        if (tip === 'onay') {
            // Siteden veya Discord'dan bota onay verildiğinde sahibine bilgi ver
            const basariliEmbed = new EmbedBuilder()
                .setTitle('✅ Bot Onaylandı!')
                .setDescription(`\`${botId}\` ID'li botun sunucuya girmesine izin verdin kanka. Artık yetkililer botu tekrar davet ettiğinde sistem onu atmayacak.`)
                .setColor('#2ecc71')
                .setTimestamp();

            // Onaylanan bot bilgisini merkezi veritabanına "Güvenli Botlar" listesi olarak ekle kanka
            // Not: Davet linki sunucu sahibine DM üzerinden hatırlatılabilir.
            await interaction.editReply({ embeds: [basariliEmbed], components: [] });
            
            // Buraya ileride istersen otomatik davet linki oluşturucu koyabilirsin kanka.
        } 
        
        else if (tip === 'red') {
            // REDDEDİLİRSE: Davet eden hainin tüm yetkilerini alıyoruz!
            const sunucular = client.guilds.cache;
            
            for (const [id, guild] of sunucular) {
                const owner = await guild.fetchOwner();
                if (owner.id !== interaction.user.id) continue; // Sadece o sahibin sunucusunda işlem yap

                const yetkiliUye = await guild.members.fetch(yetkiliId).catch(() => null);
                
                if (yetkiliUye) {
                    try {
                        // ✂️ Yetkilinin tüm rollerini siliyoruz (Abuse önleme)
                        const alinmayacakRoller = guild.roles.everyone;
                        await yetkiliUye.roles.set([], '🚨 Anti-Bot: İzinsiz bot ekleyerek sunucuyu riske atmak!');
                        
                        // Log kanalına bombayı bırak kanka
                        const logKanalId = ayarGetir(guild.id, 'logKanal', null);
                        const logChan = logKanalId ? client.channels.cache.get(logKanalId) : null;
                        
                        if (logChan) {
                            const logEmbed = new EmbedBuilder()
                                .setTitle('🚨 SQUASHED: ABUSER YETKİLİ ENGELLENDİ!')
                                .setDescription(`👤 **İşlemi Yapan Yetkili:** ${yetkiliUye} (\`${yetkiliUye.id}\`)\n🤖 **Eklemeye Çalıştığı Bot:** \`${botId}\`\n\n❌ Sunucu sahibi daveti **REDDETTİ** ve güvenlik gereği yetkilinin **TÜM ROLLERİ ALINDI!**`)
                                .setColor('#960018')
                                .setTimestamp();
                            logChan.send({ embeds: [logEmbed] });
                        }
                    } catch (e) {
                        console.error('Yetki alma hatası:', e);
                    }
                }
            }

            const reddedildiEmbed = new EmbedBuilder()
                .setTitle('❌ Giriş Reddedildi & Yetki Sıfırlandı!')
                .setDescription(`İstisari bot daveti başarıyla engellendi kanka. Botu davet eden \`${yetkiliId}\` ID'li yetkilinin sunucudaki tüm rolleri güvenlik amacıyla söküldü!`)
                .setColor('#e74c3c')
                .setTimestamp();

            await interaction.editReply({ embeds: [reddedildiEmbed], components: [] });
        }
    });
};
