const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const { ayarGetir } = require('../utils/db'); 

module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        const guild = member.guild;

        // 🧠 CANLI HAFIZA SİSTEMİ (Her üye girişinde tetikte bekler)
        if (!client.girisCikisCache) client.girisCikisCache = new Map();
        if (!client.girisCikisCache.has(guild.id)) {
            client.girisCikisCache.set(guild.id, {
                kanalId: ayarGetir(guild.id, 'girisCikisKanal', null),
                durum: ayarGetir(guild.id, 'girisCikisDurum', false),
                guvenliListe: ayarGetir(guild.id, 'botGuvenliListe', [])
            });
        }

        const hafiza = client.girisCikisCache.get(guild.id);

        // 🛡️ OTO MODERASYON: ANINDA BOT BANLAMA ETKİNLİĞİ
        if (member.user.bot) {
            try {
                // Discord API denetim kaydını bazen geç yansıtır, o yüzden 1 saniye gecikmeyle en garanti veriyi çekiyoruz
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.BotAdd }).catch(() => null);
                if (!fetchedLogs) return;
                
                const logGirdisi = fetchedLogs.entries.first();

                if (logGirdisi) {
                    const botiEkleyen = logGirdisi.executor;
                    
                    // Sunucu sahibi veya komutla eklediğin güvenli listede OLMAYAN biri bot soktuysa direkt ban!
                    if (botiEkleyen.id !== guild.ownerId && !hafiza.guvenliListe.includes(botiEkleyen.id)) {
                        
                        // ❌ Yabancı botu acımadan anında sunucudan banla!
                        await member.ban({ reason: `🛡️ Oto-Moderasyon: İzinsiz yabancı bot eklemesi! Ekleyen: ${botiEkleyen.tag}` }).catch(() => null);
                        
                        // Log kanalını botun aklından bulup uyarımızı fırlatalım
                        const logChan = hafiza.kanalId ? guild.channels.cache.get(hafiza.kanalId) : null;
                        if (logChan) {
                            const korumaEmbed = new EmbedBuilder()
                                .setTitle('<:riva_kilit:1505203119427162192> OTO-MODERASYON TETİKLENDİ!')
                                .setDescription(`<a:baarsz:1505146967817326675> Sunucuya izinsiz bir bot sokulmaya çalışıldı kanka!\n\n**Banlanan Zararlı Bot:** ${member.user.tag} (\`${member.id}\`)\n**Sokan Yetkili:** ${botiEkleyen} (\`${botiEkleyen.id}\`)\n\n*Sistem botu algıladığı gibi sunucudan kalıcı olarak uzaklaştırdı!*`)
                                .setColor('#e74c3c')
                                .setTimestamp();
                                
                            await logChan.send({ embeds: [korumaEmbed] }).catch(() => null);
                        }
                        return; // Sistemi burada kesiyoruz ki sahte bota resimli hoş geldin mesajı atmasın.
                    }
                }
            } catch (err) {
                console.error('Oto-moderasyon ban hatası kanka:', err);
            }
        }

        // 🖼️ NORMAL ÜYELER İÇİN SAYAÇLI RESİMLİ GİRİŞ LOGU (Işık Hızı)
        if (hafiza.durum && hafiza.kanalId) {
            const logChan = guild.channels.cache.get(hafiza.kanalId);
            if (!logChan) return;

            const avatar = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const username = encodeURIComponent(member.user.username);
            const guildName = encodeURIComponent(guild.name);
            const memberCount = guild.memberCount;

            const resimUrl = `https://dummyimage.com/800x350/2b2d31/f2f3f5.png&text=HOŞ+GELDİN+KANKA!%0A${username}%0A%0ASunucu:+${guildName}%0AÜye+Sayısı:+${memberCount}`;

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
