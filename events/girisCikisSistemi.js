const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const { ayarGetir } = require('../utils/db'); // db yolunu projene göre ayarla kanka

module.exports = (client) => {

    // 🟢 SAYAÇ: HER SANİYE YENİ BİRİ GELİRSE TETİKLENEN GİRİŞ LOGU
    client.on('guildMemberAdd', async (member) => {
        const guild = member.guild;

        // 🧠 Önbellek/Hafıza kontrolü: Yoksa veritabanından aklına yazsın
        if (!client.girisCikisCache) client.girisCikisCache = new Map();
        if (!client.girisCikisCache.has(guild.id)) {
            client.girisCikisCache.set(guild.id, {
                kanalId: ayarGetir(guild.id, 'girisCikisKanal', null),
                durum: ayarGetir(guild.id, 'girisCikisDurum', false),
                guvenliListe: ayarGetir(guild.id, 'botGuvenliListe', [])
            });
        }

        const hafiza = client.girisCikisCache.get(guild.id);

        // 🛡️ ANTI-BOT GÜVENLİK SİSTEMİ
        if (member.user.bot) {
            try {
                const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.BotAdd });
                const logGirdisi = fetchedLogs.entries.first();

                if (logGirdisi) {
                    const botiEkleyen = logGirdisi.executor;
                    if (botiEkleyen.id !== guild.ownerId && !hafiza.guvenliListe.includes(botiEkleyen.id)) {
                        await member.ban({ reason: `İzinsiz yabancı bot eklemesi! Ekleyen: ${botiEkleyen.id}` });
                        
                        const logChan = hafiza.kanalId ? guild.channels.cache.get(hafiza.kanalId) : null;
                        if (logChan) {
                            const korumaEmbed = new EmbedBuilder()
                                .setTitle('<:riva_kilit:1505203119427162192> İZİNSİZ BOT BANLANDI')
                                .setDescription(`<a:baarsz:1505146967817326675> Sunucuya izinsiz entegrasyon tespit edildi!\n\n**Uzaklaştırılan Bot:** ${member.user.tag}\n**Eklemeye Çalışan:** ${botiEkleyen}\n\n*Hafıza eşleşmesi başarısız, bot infaz edildi kanka!*`)
                                .setColor('#e74c3c')
                                .setTimestamp();
                            await logChan.send({ embeds: [korumaEmbed] });
                        }
                        return; 
                    }
                }
            } catch (err) {
                console.error('Anti-bot koruma hatası:', err);
            }
        }

        // 🖼️ ANLIK GİRİŞ RESİMLİ EMBED LOGU
        if (hafiza.durum && hafiza.kanalId) {
            const logChan = guild.channels.cache.get(hafiza.kanalId);
            if (!logChan) return;

            const avatar = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const username = encodeURIComponent(member.user.username);
            const guildName = encodeURIComponent(guild.name);
            const memberCount = guild.memberCount; // Anlık üye sayısı (Sayacın kendisi)

            const resimUrl = `https://dummyimage.com/800x350/2b2d31/f2f3f5.png&text=HOŞ+GELDİN+KANKA!%0A${username}%0A%0ASunucu:+${guildName}%0AÜye+Sayısı:+${memberCount}`;

            const girisEmbed = new EmbedBuilder()
                .setTitle(`<a:join_join:1505202309343215717> Sunucumuza Yeni Bir Kan Katıldı!`)
                .setDescription(`Aramıza hoş geldin ${member}! Seninle birlikte tam **${memberCount}** kişi olduk kanka.`)
                .setThumbnail(avatar)
                .setImage(resimUrl)
                .setColor('#2ecc71')
                .setTimestamp();

            await logChan.send({ embeds: [girisEmbed] }).catch(() => null);
        }
    });

    // 🔴 SAYAÇ: BİRİ SUNUCUDAN ÇIKTIĞINDA TETİKLENEN ÇIKIŞ LOGU
    client.on('guildMemberRemove', async (member) => {
        const guild = member.guild;

        if (!client.girisCikisCache || !client.girisCikisCache.has(guild.id)) return;
        const hafiza = client.girisCikisCache.get(guild.id);

        // 🖼️ ANLIK ÇIKIŞ RESİMLİ EMBED LOGU
        if (hafiza.durum && hafiza.kanalId) {
            const logChan = guild.channels.cache.get(hafiza.kanalId);
            if (!logChan) return;

            const avatar = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const username = encodeURIComponent(member.user.username);
            const guildName = encodeURIComponent(guild.name);
            const memberCount = guild.memberCount; // Ayrıldıktan sonraki anlık güncel üye sayısı

            const resimUrl = `https://dummyimage.com/800x350/2b2d31/f2f3f5.png&text=GÜLE+GÜLE+KANKA!%0A${username}%0A%0ASunucu:+${guildName}%0AÜye+Sayısı:+${memberCount}`;

            const cikisEmbed = new EmbedBuilder()
                .setTitle(`<:riva_kilit:1505203119427162192> Sunucudan Biri Eksildi!`)
                .setDescription(`${member.user.tag} aramizdan ayrıldı. Sunucuda geriye **${memberCount}** kişi kaldık kanka.`)
                .setThumbnail(avatar)
                .setImage(resimUrl)
                .setColor('#e74c3c')
                .setTimestamp();

            await logChan.send({ embeds: [cikisEmbed] }).catch(() => null);
        }
    });
};
