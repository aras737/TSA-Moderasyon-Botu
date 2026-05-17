const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        const guild = member.guild;

        // 🧠 CANLI HAFIZA SİSTEMİ - Her girişte taze veri çekiyoruz (cache güncelleme sorunu çözüldü)
        if (!client.girisCikisCache) client.girisCikisCache = new Map();

        // Her seferinde güncel ayarları çek (async düzeltmesi yapıldı)
        const kanalId      = await ayarGetir(guild.id, 'girisCikisKanal', null);
        const durum        = await ayarGetir(guild.id, 'girisCikisDurum', false);
        const guvenliListe = await ayarGetir(guild.id, 'botGuvenliListe', []);

        const hafiza = { kanalId, durum, guvenliListe };

        // Cache'i her seferinde tazele
        client.girisCikisCache.set(guild.id, hafiza);

        // 🛡️ OTO MODERASYON: BOT GİRİŞİ ALGILANDI
        if (member.user.bot) {
            try {
                // Audit log için retry mekanizması (race condition düzeltmesi)
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

                    // Sunucu sahibi veya güvenli listede OLMAYAN biri bot soktuysa direkt ban!
                    if (botiEkleyen.id !== guild.ownerId && !hafiza.guvenliListe.includes(botiEkleyen.id)) {

                        // ❌ İzinsiz botu anında banla
                        await member.ban({
                            reason: `🛡️ Oto-Moderasyon: İzinsiz yabancı bot eklemesi! Ekleyen: ${botiEkleyen.tag}`
                        }).catch(() => null);

                        const logChan = hafiza.kanalId ? guild.channels.cache.get(hafiza.kanalId) : null;
                        if (logChan) {
                            const korumaEmbed = new EmbedBuilder()
                                .setTitle('<:riva_kilit:1505203119427162192> OTO-MODERASYON TETİKLENDİ!')
                                .setDescription(
                                    `<a:baarsz:1505146967817326675> Sunucuya izinsiz bir bot sokulmaya çalışıldı kanka!\n\n` +
                                    `**Banlanan Zararlı Bot:** ${member.user.tag} (\`${member.id}\`)\n` +
                                    `**Sokan Yetkili:** ${botiEkleyen} (\`${botiEkleyen.id}\`)\n\n` +
                                    `*Sistem botu algıladığı gibi sunucudan kalıcı olarak uzaklaştırdı!*`
                                )
                                .setColor('#e74c3c')
                                .setTimestamp();

                            await logChan.send({ embeds: [korumaEmbed] }).catch(() => null);
                        }
                    }
                }
            } catch (err) {
                console.error('Oto-moderasyon ban hatası kanka:', err);
            }

            // ✅ Bot girişlerinde (güvenli de olsa) hoş geldin mesajı gönderme (erken return düzeltmesi)
            return;
        }

        // 🖼️ NORMAL ÜYELER İÇİN RESİMLİ GİRİŞ LOGU
        if (hafiza.durum && hafiza.kanalId) {
            const logChan = guild.channels.cache.get(hafiza.kanalId);
            if (!logChan) return;

            const avatar      = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const memberCount = guild.memberCount;

            // dummyimage.com yerine güvenilir placeholder servisi kullanıldı
            const username  = encodeURIComponent(member.user.username);
            const guildName = encodeURIComponent(guild.name);
            const resimUrl  = `https://placehold.co/800x350/2b2d31/f2f3f5/png?text=HOS+GELDIN+KANKA!%0A${username}%0A%0ASunucu:+${guildName}%0AUye+Sayisi:+${memberCount}`;

            const girisEmbed = new EmbedBuilder()
                .setTitle(`<a:join_join:1505202309343215717> Sunucumuza Yeni Bir Kan Katıldı!`)
                .setDescription(
                    `Aramıza hoş geldin ${member}! Seninle birlikte anlık **${memberCount}** kişi olduk kanka.`
                )
                .setThumbnail(avatar)
                .setImage(resimUrl)
                .setColor('#2ecc71')
                .setTimestamp();

            await logChan.send({ embeds: [girisEmbed] }).catch(() => null);
        }
    });
};
