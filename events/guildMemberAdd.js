const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        const guild = member.guild;

        if (!client.girisCikisCache) client.girisCikisCache = new Map();

        const kanalId      = await ayarGetir(guild.id, 'girisCikisKanal', null);
        const durum        = await ayarGetir(guild.id, 'girisCikisDurum', false);
        const guvenliListe = await ayarGetir(guild.id, 'botGuvenliListe', []);

        const hafiza = { kanalId, durum, guvenliListe };
        client.girisCikisCache.set(guild.id, hafiza);

        // 🛡️ OTO MODERASYON: BOT GİRİŞİ
        if (member.user.bot) {
            try {
                // Audit log retry
                let logGirdisi = null;
                for (let i = 0; i < 3; i++) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const fetchedLogs = await guild.fetchAuditLogs({
                        limit: 1,
                        type: AuditLogEvent.BotAdd
                    }).catch(() => null);

                    logGirdisi = fetchedLogs?.entries.first();
                    if (logGirdisi) break;
                }

                if (logGirdisi) {
                    const botiEkleyen = logGirdisi.executor;

                    // Güvenli listede veya sunucu sahibi DEĞİLSE ban at
                    if (botiEkleyen.id !== guild.ownerId && !hafiza.guvenliListe.includes(botiEkleyen.id)) {

                        // ❌ Botu anında banla
                        await member.ban({
                            reason: `🛡️ Oto-Moderasyon: İzinsiz bot eklemesi! Ekleyen: ${botiEkleyen.tag}`
                        }).catch(() => null);

                        // Log embed
                        const korumaEmbed = new EmbedBuilder()
                            .setTitle('<:riva_kilit:1505203119427162192> OTO-MODERASYON TETİKLENDİ!')
                            .setDescription(
                                `<a:baarsz:1505146967817326675> Sunucuya izinsiz bir bot sokulmaya çalışıldı kanka!\n\n` +
                                `**Banlanan Bot:** ${member.user.tag} (\`${member.id}\`)\n` +
                                `**Sokan Yetkili:** ${botiEkleyen} (\`${botiEkleyen.id}\`)\n\n` +
                                `*Sistem botu algıladığı gibi sunucudan kalıcı olarak uzaklaştırdı!*`
                            )
                            .setColor('#e74c3c')
                            .setTimestamp();

                        // Log kanalına gönder
                        const logChan = hafiza.kanalId ? guild.channels.cache.get(hafiza.kanalId) : null;
                        if (logChan) {
                            await logChan.send({ embeds: [korumaEmbed] }).catch(() => null);
                        }

                        // 📩 Sunucu sahibine DM at
                        try {
                            const owner = await guild.fetchOwner();
                            const dmEmbed = new EmbedBuilder()
                                .setTitle('🚨 Sunucuna İzinsiz Bot Sokuldu!')
                                .setDescription(
                                    `**${guild.name}** sunucuna habersiz bir bot eklenmeye çalışıldı ve anında banlandı!\n\n` +
                                    `**Banlanan Bot:** \`${member.user.tag}\` (\`${member.id}\`)\n` +
                                    `**Ekleyen Kişi:** \`${botiEkleyen.tag}\` (\`${botiEkleyen.id}\`)\n\n` +
                                    `⚠️ Bu kişinin yetkilerini kontrol etmeni öneririm kanka!`
                                )
                                .setColor('#e74c3c')
                                .setTimestamp();

                            await owner.send({ embeds: [dmEmbed] }).catch(() => null);
                        } catch {
                            // Sahibin DM'i kapalıysa sessizce geç
                        }

                        return;
                    }
                }
            } catch (err) {
                console.error('Oto-moderasyon ban hatası kanka:', err);
            }

            // Güvenli bot da olsa hoş geldin gönderme
            return;
        }

        // 🖼️ NORMAL ÜYELER İÇİN HOŞ GELDİN MESAJI
        if (hafiza.durum && hafiza.kanalId) {
            const logChan = guild.channels.cache.get(hafiza.kanalId);
            if (!logChan) return;

            const avatar      = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const memberCount = guild.memberCount;
            const username    = encodeURIComponent(member.user.username);
            const guildName   = encodeURIComponent(guild.name);
            const resimUrl    = `https://placehold.co/800x350/2b2d31/f2f3f5/png?text=HOS+GELDIN+KANKA!%0A${username}%0A%0ASunucu:+${guildName}%0AUye+Sayisi:+${memberCount}`;

            const girisEmbed = new EmbedBuilder()
                .setTitle(`<a:join_join:1505202309343215717> Sunucumuza Yeni Bir Kan Katıldı!`)
                .setDescription(`Aramıza hoş geldin ${member}! Seninle birlikte anlık **${memberCount}** kişi olduk kanka.`)
                .setThumbnail(avatar)
                .setImage(resimUrl)
                .setColor('#2ecc71')
                .setTimestamp();

            await logChan.send({ embeds: [girisEmbed] }).catch(() => null);
        }
    });
};
