const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        const guild = member.guild;

        // 🧠 CANLI HAFIZA SİSTEMİ — Saliselik taze veri okuma
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

        // 🛡️ OTO MODERASYON: 1 SALİSEDE ANINDA BANLAMA VE TARAMA
        if (member.user.bot) {
            try {
                // ⚡ İLK SALİSE: Bot daha sunucu listesine düşmeden direkt banı vur kanka!
                await member.ban({ reason: `🛡️ TSA Oto-Moderasyon: Anında Bot Koruması!` }).catch(() => null);

                // ⚡ AYNI SALİSE: Gecikme olmadan direkt güncel denetim kaydını çek
                const fetchedLogs = await guild.fetchAuditLogs({
                    limit: 3, // En son 3 kayda bak, hızlıca tara
                    type: AuditLogEvent.BotAdd
                }).catch(() => null);

                let botiEkleyen = null;

                if (fetchedLogs) {
                    // Eklenen botun ID'si ile loglardaki hedef bot ID'sini salisesinde eşleştir
                    const dogruEntry = fetchedLogs.entries.find(entry => entry.target && entry.target.id === member.id);
                    if (dogruEntry) {
                        botiEkleyen = dogruEntry.executor;
                    }
                }

                const logChan = hafiza.kanalId ? guild.channels.cache.get(hafiza.kanalId) : null;

                // Eğer botu ekleyen kişi o salise yakalandıysa ve GÜVENLİ LİSTEDEYSE
                if (botiEkleyen && (botiEkleyen.id === guild.ownerId || hafiza.guvenliListe.includes(botiEkleyen.id))) {
                    // Bizim yetkililerden biriyse banı salisesinde kaldırıp içeri al kanka
                    await guild.members.unban(member.id, "Güvenli yetkili tarafından eklenen onaylı bot.").catch(() => null);
                    
                    if (logChan) {
                        const guvenliEmbed = new EmbedBuilder()
                            .setTitle('🟢 ONAYLI BOT GİRİŞİ')
                            .setDescription(`✅ ${botiEkleyen} tarafından eklenen **${member.user.tag}** botu güvenli listede olduğu için banı kaldırıldı ve içeri alındı kanka.`)
                            .setColor('#2ecc71')
                            .setTimestamp();
                        await logChan.send({ embeds: [guvenliEmbed] }).catch(() => null);
                    }
                    return;
                }

                // Eğer ekleyen kişi yabancıysa veya o salise Discord logu yetiştiremediyse (Göz açtırmıyoruz)
                if (logChan) {
                    const korumaEmbed = new EmbedBuilder()
                        .setTitle('🛡️ ANINDA OTO-MODERASYON TETİKLENDİ!')
                        .setDescription(
                            `⚠️ Sunucuya sızmaya çalışan yabancı bot 1 salisede infaz edildi kanka!\n\n` +
                            `**Banlanan Bot:** ${member.user.tag} (\`${member.id}\`)\n` +
                            `**Eklemeye Çalışan:** ${botiEkleyen ? `${botiEkleyen} (\`${botiEkleyen.id}\`)` : '`Gecikmeli Giriş / Kaçak İstek`'}\n\n` +
                            `*Sistem botu algıladığı an sunucu düzenini bozmasına fırsat vermeden kalıcı olarak banladı!*`
                        )
                        .setColor('#e74c3c')
                        .setTimestamp();

                    await logChan.send({ embeds: [korumaEmbed] }).catch(() => null);
                }
                return; // Kaçak botsa giriş logunu çalıştırma, işlemi kes kanka.

            } catch (err) {
                console.error('Saliselik oto-moderasyon hatası kanka:', err);
            }
        }

        // 🖼️ NORMAL ÜYELER İÇİN SAYAÇLI GİRİŞ LOGU (Eğer giren bot değilse burası çalışır)
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
