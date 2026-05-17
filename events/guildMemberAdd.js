const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        const guild = member.guild;

        // 🧠 CANLI HAFIZA SİSTEMİ — her seferinde taze oku, stale cache olmasın
        if (!client.girisCikisCache) client.girisCikisCache = new Map();

        // ✅ FIX: Cache'i her zaman güncelle (en azından ayar değişmiş olabilir)
        const tazeKanalId = ayarGetir(guild.id, 'girisCikisKanal', null);
        const tazeDurum = ayarGetir(guild.id, 'girisCikisDurum', false);
        const tazeGuvenliListe = ayarGetir(guild.id, 'botGuvenliListe', []);

        client.girisCikisCache.set(guild.id, {
            kanalId: tazeKanalId,
            durum: tazeDurum,
            guvenliListe: tazeGuvenliListe
        });

        const hafiza = client.girisCikisCache.get(guild.id);

        // 🛡️ OTO MODERASYON: ANINDA BOT BANLAMA
        if (member.user.bot) {
            try {
                // Audit log'un Discord'a düşmesi için bekle — ama yalnızca bu botun ID'sini kontrol edeceğiz
                await new Promise(resolve => setTimeout(resolve, 1500));

                const fetchedLogs = await guild.fetchAuditLogs({
                    limit: 5,  // ✅ FIX: Son 5 entry'yi çek, en günceli bul
                    type: AuditLogEvent.BotAdd
                }).catch(() => null);

                if (fetchedLogs) {
                    // ✅ FIX: Doğru entry'yi bul — hedefteki bot ID'si eşleşmeli
                    const dogruEntry = fetchedLogs.entries.find(entry => {
                        const target = entry.target;
                        // target bir User objesi olmalı ve ID eşleşmeli
                        return target && target.id === member.id;
                    });

                    if (dogruEntry) {
                        const botiEkleyen = dogruEntry.executor;

                        // ✅ FIX: executor null kontrolü — Discord bazen siler
                        if (!botiEkleyen) {
                            console.warn(`[Oto-Mod] Bot ekleyen yetkili tespit edilemedi (executor null): ${member.user.tag}`);
                            // Executor bilinmiyorsa sadece botu banla, yetkiliyi banlama
                            await member.ban({ reason: `🛡️ Oto-Moderasyon: İzinsiz bot! Ekleyen tespit edilemedi.` }).catch(() => null);
                            return;
                        }

                        const guvenli = botiEkleyen.id === guild.ownerId || hafiza.guvenliListe.includes(botiEkleyen.id);

                        if (!guvenli) {
                            // ❌ Yabancı botu banla
                            await member.ban({
                                reason: `🛡️ Oto-Moderasyon: İzinsiz yabancı bot eklemesi! Ekleyen: ${botiEkleyen.tag}`
                            }).catch(() => null);

                            const logChan = hafiza.kanalId ? guild.channels.cache.get(hafiza.kanalId) : null;
                            if (logChan) {
                                const korumaEmbed = new EmbedBuilder()
                                    .setTitle('🛡️ OTO-MODERASYON TETİKLENDİ!')
                                    .setDescription(
                                        `⚠️ Sunucuya izinsiz bir bot sokulmaya çalışıldı!\n\n` +
                                        `**Banlanan Zararlı Bot:** ${member.user.tag} (\`${member.id}\`)\n` +
                                        `**Sokan Yetkili:** ${botiEkleyen} (\`${botiEkleyen.id}\`)\n\n` +
                                        `*Sistem botu algıladığı gibi sunucudan kalıcı olarak uzaklaştırdı!*`
                                    )
                                    .setColor('#e74c3c')
                                    .setTimestamp();

                                await logChan.send({ embeds: [korumaEmbed] }).catch(() => null);
                            }
                            return;
                        }
                    } else {
                        // ✅ FIX: Audit log'da bu bota ait entry yoksa — muhtemelen güvenli listeden eklenmiş
                        // veya Discord henüz log'u yazmamış. Botu banlamadan uyarı ver.
                        console.warn(`[Oto-Mod] Audit log'da bu bot (${member.user.tag}) için entry bulunamadı. Güvenli listede olmayabilir ama emin değiliz.`);
                    }
                }
            } catch (err) {
                console.error('Oto-moderasyon hatası:', err);
            }
        }

        // 🖼️ NORMAL ÜYELER İÇİN SAYAÇLI GİRİŞ LOGU
        if (hafiza.durum && hafiza.kanalId) {
            const logChan = guild.channels.cache.get(hafiza.kanalId);
            if (!logChan) return;

            const avatar = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const memberCount = guild.memberCount;

            // ✅ FIX: dummyimage yerine canvas/yerel oluşturucu kullan önerisi
            // Şimdify dummyimage ile ama Türkçe karakter encode ediliyor
            const username = encodeURIComponent(member.user.username);
            const guildName = encodeURIComponent(guild.name);

            const resimUrl = `https://dummyimage.com/800x350/2b2d31/f2f3f5.png&text=HOS+GELDIN+KANKA!%0A${username}%0A%0ASunucu:+${guildName}%0AUye+Sayisi:+${memberCount}`;

            const girisEmbed = new EmbedBuilder()
                .setTitle(`🎉 Sunucumuza Yeni Bir Kan Katıldı!`)
                .setDescription(`Aramıza hoş geldin ${member}! Seninle birlikte anlık **${memberCount}** kişi olduk!`)
                .setThumbnail(avatar)
                .setImage(resimUrl)
                .setColor('#2ecc71')
                .setTimestamp();

            await logChan.send({ embeds: [girisEmbed] }).catch(() => null);
        }
    });
};
