const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ayarGetir, ayarKaydet } = require('../utils/db');

module.exports = (client) => {

    client.on('guildMemberAdd', async (member) => {
        // Gelen üye bot değilse işlem yapma kanka
        if (!member.user.bot) return;

        const guild = member.guild;
        const owner = await guild.fetchOwner();

        // 🛡️ Veritabanından güvenli (izin verilmiş) botlar listesini çek kanka
        let guvenliBotlar = ayarGetir(guild.id, 'guvenliBotlar', []);
        if (guvenliBotlar.includes(member.user.id)) return; // Eğer bot daha önce onaylandıysa engelleme yapma

        // ⏱️ Denetim kaydından bu botu kimin davet ettiğini buluyoruz
        const logs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.BotAdd }).catch(() => null);
        const entry = logs?.entries.first();
        const davetEden = entry?.executor;

        // Botu direkt sunucu sahibi eklediyse muaf tut kanka
        if (davetEden && davetEden.id === guild.ownerId) return;

        try {
            // 🚨 ADIM 1: Yabancı botu tehlike yaratmaması için ANINDA sunucudan tekmeliyoruz
            await member.kick('🚨 TSA Anti-Bot: Sunucu sahibi DM onayı bekleniyor.');

            // 📝 ADIM 2: Gelişmiş Log kanalına ihbarı fırlatıyoruz
            const logKanalId = ayarGetir(guild.id, 'logKanal', null);
            const logChan = logKanalId ? client.channels.cache.get(logKanalId) : null;
            
            if (logChan) {
                const kanalLogEmbed = new EmbedBuilder()
                    .setTitle('🤖 ŞÜPHELİ BOT SIZMA GİRİŞİMİ!')
                    .setDescription(`Sunucuya izinsiz bir bot eklenmeye çalışıldı kanka. Bot güvenlik amacıyla anında dışarı atıldı ve karar verilmesi için sunucu sahibinin DM kutusuna gönderildi.`)
                    .addFields(
                        { name: '🤖 Atılan Bot', value: `**${member.user.tag}**\n\`ID: ${member.user.id}\``, inline: true },
                        { name: '👤 Davet Eden Yetkili', value: `${davetEden ? davetEden : 'Bilinmiyor'}\n\`ID: ${davetEden ? davetEden.id : '---'}\``, inline: true }
                    )
                    .setColor('#e67e22')
                    .setTimestamp();
                logChan.send({ embeds: [kanalLogEmbed] }).catch(() => {});
            }

            // 📩 ADIM 3: Sunucu sahibine DM'den "Kalsın mı, Gitsin mi?" Sorgusu Gönderiyoruz
            const dmEmbed = new EmbedBuilder()
                .setTitle('🛡️ TSA Otomatik Moderasyon: Bot Karar Merkezi')
                .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
                .setDescription(`⚠️ Sunucunuzda yetkili bir hesap tarafından bot eklendi. Sistem botu geçici olarak dışarı attı.\n\n**Bu bot sunucuda kalsın mı, yoksa kalıcı olarak gitsin mi kanka?**`)
                .addFields(
                    { name: '🤖 Eklenmek İstenen Bot', value: `${member.user.tag}\n\`ID: ${member.user.id}\``, inline: true },
                    { name: '👤 Ekleyen Yetkili', value: `${davetEden ? davetEden : 'Bilinmiyor'}\n\`ID: ${davetEden ? davetEden.id : '---'}\``, inline: true }
                )
                .setColor('#f1c40f')
                .setFooter({ text: 'Seçimini aşağıdaki butonlarla yap kanka.', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            // Karar Butonları
            const butonlar = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`antibot_kalsin_${member.user.id}_${guild.id}`)
                    .setLabel('✅ Kalsın (Onayla)')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`antibot_gitsin_${member.user.id}_${guild.id}_${davetEden?.id}`)
                    .setLabel('❌ Gitsin (Reddet & Yetki Al)')
                    .setStyle(ButtonStyle.Danger)
            );

            await owner.send({ embeds: [dmEmbed], components: [butonlar] }).catch(() => {
                // Sahibinin DM kapalıysa kanala acil uyarı geç kanka
                if (logChan) {
                    logChan.send(`⚠️ @everyone **KUSURAT!** Sunucu sahibinin DM kutusu kapalı olduğu için bot onay paneli gönderilemedi! Bot güvenlik sebebiyle sunucuya alınmıyor.`);
                }
            });

        } catch (err) {
            console.error('Anti-bot koruma motoru hatası:', err);
        }
    });

    // =========================================================================
    // 🎛️ DM BUTON ETKİLEŞİM YÖNETİMİ
    // =========================================================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        const parcalar = interaction.customId.split('_');
        if (parcalar[0] !== 'antibot') return;

        const [, karar, botId, guildId, yetkiliId] = parcalar;
        await interaction.deferUpdate();

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        // 🟢 SEÇENEK 1: KALSIN (ONAY)
        if (karar === 'kalsin') {
            // Botu güvenli listeye (data) ekle kanka
            let guvenliBotlar = ayarGetir(guildId, 'guvenliBotlar', []);
            if (!guvenliBotlar.includes(botId)) {
                guvenliBotlar.push(botId);
                ayarKaydet(guildId, 'guvenliBotlar', guvenliBotlar);
            }

            const onayEmbed = new EmbedBuilder()
                .setTitle('✅ Bot Onaylandı kanka!')
                .setDescription(`\`${botId}\` ID'li bot güvenli listeye eklendi. Yetkililer botu tekrar davet ettiğinde artık otomatik olarak atılmayacak.`)
                .setColor('#2ecc71')
                .setTimestamp();

            await interaction.editReply({ embeds: [onayEmbed], components: [] });

            // Log kanalına bilgi ver
            const logKanalId = ayarGetir(guildId, 'logKanal', null);
            const logChan = logKanalId ? client.channels.cache.get(logKanalId) : null;
            if (logChan) {
                logChan.send(`✅ Sunucu sahibi DM üzerinden onay verdi: \`${botId}\` ID'li botun sunucuya katılmasına izin verildi.`);
            }
        } 
        
        // 🔴 SEÇENEK 2: GİTSİN (REDDET & ABUSE ENGELLE)
        else if (karar === 'gitsin') {
            const yetkiliUye = await guild.members.fetch(yetkiliId).catch(() => null);
            
            if (yetkiliUye) {
                try {
                    // Yetkilinin tüm rollerini sıfırlıyoruz kanka (Abuse önleme duvarı)
                    await yetkiliUye.roles.set([], '🚨 Anti-Bot: Sunucu sahibinin reddettiği botu izinsiz eklemek.');
                } catch (e) {
                    console.error('Yetkili rolleri sökülürken hata çıktı:', e);
                }
            }

            const redEmbed = new EmbedBuilder()
                .setTitle('❌ İstek Reddedildi & Güvenlik Sağlandı!')
                .setDescription(`Botun girişi kalıcı olarak engellendi kanka. Botu sunucuya sızdırmaya çalışan \`${yetkiliId}\` ID'li yetkilinin tüm rolleri istismar (abuse) ihtimaline karşı söküldü!`)
                .setColor('#da373c')
                .setTimestamp();

            await interaction.editReply({ embeds: [redEmbed], components: [] });

            // Log kanalına haini ifşalıyoruz kanka
            const logKanalId = ayarGetir(guildId, 'logKanal', null);
            const logChan = logKanalId ? client.channels.cache.get(logKanalId) : null;
            if (logChan) {
                const ifsaEmbed = new EmbedBuilder()
                    .setTitle('🚨 RECON: İZİNSİZ BOT DAVETİ REDDEDİLDİ!')
                    .setDescription(`👤 **Davet Eden Hain:** ${yetkiliUye ? yetkiliUye : `\`ID: ${yetkiliId}\``}\n🤖 **Eklemek İstediği Bot:** \`${botId}\`\n\n❌ Sunucu sahibi DM üzerinden **REDDİ** bastı! Sızmaya çalışan bot engellendi ve davet eden yetkilinin tüm rolleri sıfırlandı.`)
                    .setColor('#960018')
                    .setTimestamp();
                logChan.send({ embeds: [ifsaEmbed] }).catch(() => {});
            }
        }
    });
};
