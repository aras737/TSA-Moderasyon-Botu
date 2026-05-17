const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        const guild = member.guild;

        // 🧠 CANLI HAFIZA SİSTEMİ — taze veri okuma
        if (!client.girisCikisCache) client.girisCikisCache = new Map();

        const tazeKanalId = ayarGetir(guild.id, 'girisCikisKanal', null);
        const tazeDurum = ayarGetir(guild.id, 'girisCikisDurum', false);
        const tazeGuvenliListe = ayarGetir(guild.id, 'botGuvenliListe', []);

        client.girisCikisCache.set(guild.id, {
            kanalId: tazeKanalId,
            durum: tazeDurum,
            guvenliListe: tazeGuvenliListe
        });

        const hafiza = client.girisCikisCache.get(guild.id);

        // 🛡️ OTO MODERASYON: ANINDA SIFIR GECİKME BOT BANLAMA
        if (member.user.bot) {
            try {
                // 1. ÖNLEM: Önce botu sunucudan anında şutluyoruz ki sunucuya zarar veremesin!
                await member.ban({ reason: `🛡️ Oto-Moderasyon: Güvenlik taraması yapılıyor...` }).catch(() => null);

                // 2. ÖNLEM: Şimdi arka planda rahat rahat logları tarayıp suçluyu arıyoruz
                let botiEkleyen = null;
                
                // Logların düşmesi için max 3 kez döngüyle kontrol ediyoruz
                for (let i = 0; i < 3; i++) {
                    await new Promise(resolve => setTimeout(resolve, 1500)); // Her denemede 1.5 sn bekle
                    
                    const fetchedLogs = await guild.fetchAuditLogs({
                        limit: 10, // Son 10 logu çek ki arada kaynamasın
                        type: AuditLogEvent.BotAdd
                    }).catch(() => null);

                    if (fetchedLogs) {
                        const dogruEntry = fetchedLogs.entries.find(entry => entry.target && entry.target.id === member.id);
                        if (dogruEntry) {
                            botiEkleyen = dogruEntry.executor;
                            break; // Logu bulduysak döngüden çık kanka
                        }
                    }
                }

                // Log kanalını bulalım
                const logChan = hafiza.kanalId ? guild.channels.cache.get(hafiza.kanalId) : null;

                // Eğer botu ekleyen kişi bulunduysa ve güvenli listedeyse (Sunucu sahibi veya whitelist)
                if (botiEkleyen && (botiEkleyen.id === guild.ownerId || hafiza.guvenliListe.includes(botiEkleyen.id))) {
                    // Kanka botu güvenli biri eklemiş ama biz acele edip banladık! Geri banını açıyoruz.
                    await guild.members.unban(member.id, "Güvenli yetkili tarafından eklenen yasal bot.").catch(() => null);
                    
                    if (logChan) {
                        const guvenliEmbed = new EmbedBuilder()
                            .setTitle('🟢 GÜVENLİ BOT GİRİŞİ')
                            .setDescription(`✅ ${botiEkleyen} tarafından sunucuya eklenen **${member.user.tag}** botu güvenli listede onaylandı ve sunucuya alındı kanka.`)
                            .setColor('#2ecc71')
                            .setTimestamp();
                        await logChan.send({ embeds: [guvenliEmbed] }).catch(() => null);
                    }
                    return; // Onaylı bot olduğu için hoş geldin mesajına geçebilir
                }

                // Eğer ekleyen kişi güvenli listede değilse veya hiç bulunamadıysa (Kaçak giriş)
                if (logChan) {
                    const korumaEmbed = new EmbedBuilder()
                        .setTitle('🛡️ OTO-MODERASYON TETİKLENDİ!')
                        .setDescription(
                            `⚠️ Sunucuya izinsiz bir bot sokuldu ve sistem tarafından infaz edildi kanka!\n\n` +
                            `**Banlanan Zararlı Bot:** ${member.user.tag} (\`${member.id}\`)\n` +
                            `**Sokan Yetkili:** ${botiEkleyen ? `${botiEkleyen} (\`${botiEkleyen.id}\`)` : '`Tespit Edilemedi (Discord Log Hatası)`'}\n\n` +
                            `*Sistem botu algıladığı salise sunucudan kalıcı olarak uzaklaştırdı!*`
                        )
                        .setColor('#e74c3c')
                        .setTimestamp();

                    await logChan.send({ embeds: [korumaEmbed] }).catch(() => null);
                }
                return; // İzinsiz bot olduğu için aşağıya inip hoş geldin mesajı fırlatmasın
                
            } catch (err) {
                console.error('Oto-moderasyon ana hata:', err);
            }
        }

        // 🖼️ NORMAL ÜYELER İÇİN SAYAÇLI GİRİŞ LOGU (Eğer bot değilse burası çalışır)
        if (hafiza.durum && hafiza.kanalId) {
            const logChan = guild.channels.cache.get(hafiza.kanalId);
            if (!logChan) return;

            const avatar = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const memberCount = guild.memberCount;

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
