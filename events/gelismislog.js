const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {

    // =========================================================================
    // 🛠️ YARDIMCI FONKSİYONLAR & BELLEK YAPILARI (RAM DOSTU)
    // =========================================================================
    const logKanalGetir = async (guildId) => {
        const kanalId = await ayarGetir(guildId, 'logKanal', null);
        return kanalId ? (client.channels.cache.get(kanalId) || await client.channels.fetch(kanalId).catch(() => null)) : null;
    };

    const auditCache = new Map();
    const auditInflight = new Map();

    const auditLogCek = async (guild, type, hedefId = null) => {
        const cacheKey = guild.id + ':' + String(type);
        const now = Date.now();
        const cached = auditCache.get(cacheKey);
        let logs = cached && now - cached.loadedAt <= 200 ? cached.logs : null;

        if (!logs) {
            let pending = auditInflight.get(cacheKey);
            if (!pending) {
                pending = guild.fetchAuditLogs({ limit: 25, type })
                    .then(result => {
                        auditCache.set(cacheKey, { loadedAt: Date.now(), logs: result });
                        return result;
                    })
                    .catch(error => {
                        console.warn('[LOG] Denetim kaydı alınamadı:', error.message);
                        return null;
                    })
                    .finally(() => auditInflight.delete(cacheKey));
                auditInflight.set(cacheKey, pending);
            }
            logs = await pending;
        }

        if (!logs) return null;
        return logs.entries.find(item => {
            const createdAt = Number(item?.createdTimestamp);
            const age = Date.now() - createdAt;
            return Boolean(item?.executorId) &&
                Number.isFinite(createdAt) &&
                age >= 0 &&
                age <= 15000 &&
                (!hedefId || item.target?.id === hedefId);
        }) || null;
    };

    const kufurRegex = /(amcık|yarrak|sik|piç|orospu|sikiş|göt|meme|orospu çocuğu|amk|aq|pç|skm|amına)/i;
    
    // Hafıza (RAM) Takip Bellekleri kanka
    const mesajTakip = new Map();
    const banTakip = new Map();

    // 🔥 PERİYODİK BELLEK TEMİZLEYİCİ (Memory Leak Önleyici)
    // Her 5 dakikada bir RAM'deki eski log kalıntılarını temizler
    setInterval(() => {
        const simdi = Date.now();
        for (const [key, value] of mesajTakip.entries()) {
            const aktif = value.filter(ts => simdi - ts < 3000);
            if (aktif.length === 0) mesajTakip.delete(key);
            else mesajTakip.set(key, aktif);
        }
        for (const [key, value] of banTakip.entries()) {
            const aktif = value.filter(ts => simdi - ts < 10000);
            if (aktif.length === 0) banTakip.delete(key);
            else banTakip.set(key, aktif);
        }
    }, 5 * 60 * 1000);

    // =========================================================================
    // 🛡️ ANA MESAJ KORUMALARI (Küfür, Spam, Caps, Bahsetme)
    // =========================================================================
    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot || message.partial) return;

        // Muafiyet Kontrolü
        if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

        // Koruma ayarları sunucu bazında önbelleğe alınır.
        if (!client.sistemBellegi) client.sistemBellegi = new Map();
        let korumaAyar = client.sistemBellegi.get(message.guild.id);

        if (!korumaAyar) {
            korumaAyar = {
                kufur: ayarGetir(message.guild.id, 'kufurEngelDurum', false) === true,
                spam: ayarGetir(message.guild.id, 'spamEngelDurum', false) === true,
                mention: ayarGetir(message.guild.id, 'topluEtiketEngelDurum', false) === true,
                caps: ayarGetir(message.guild.id, 'capsEngelDurum', false) === true
            };
            client.sistemBellegi.set(message.guild.id, korumaAyar);
        }

        if (!Object.values(korumaAyar).some(Boolean)) return;

        const getLogChan = () => logKanalGetir(message.guild.id);
        const simdi = Date.now();

        // 1. KÜFÜR ENGEL SİSTEMİ
        if (korumaAyar.kufur && kufurRegex.test(message.content)) {
            await message.delete().catch(() => null);
            const uyariMsg = await message.channel.send({ content: `🤬 Temiz bir dil kullanalım lütfen ${message.author}! Bu sunucuda küfür etmek yasak kanka.` }).catch(() => null);
            if (uyariMsg) setTimeout(() => uyariMsg.delete().catch(() => null), 4000);

            const logChan = await getLogChan();
            if (logChan) {
                const embed = new EmbedBuilder()
                    .setTitle('<:koruma1:1505143174190989352> Küfür Filtresi Tetiklendi!')
                    .setDescription(`⚠️ **${message.author.tag}** adlı üye küfürlü kelime kullandı ve mesajı imha edildi!`)
                    .addFields(
                        { name: '<:uzaybot_kullanicilar:1505146190973505567> Mesajı Yazan', value: `${message.author} \`(${message.author.id})\``, inline: true },
                        { name: '<:Discord_Link:1505166617426923661> Kanal', value: `${message.channel}`, inline: true },
                        { name: '<:Paper:1505146388596391977> Engellenen Mesaj', value: `\`\`\`${message.content.substring(0, 1000)}\`\`\`` }
                    )
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true })).setColor('#e74c3c').setTimestamp();
                logChan.send({ embeds: [embed] }).catch(() => {});
            }
            return; 
        }

        // 2. ULTRA HIZLI SPAM KORUMASI (3 Saniyede 5 Mesaj)
        if (korumaAyar.spam) {
        const takipAnahtari = `${message.guild.id}:${message.author.id}`;
        const kullaniciLog = mesajTakip.get(takipAnahtari) || [];
        kullaniciLog.push(simdi);
        const filtrelenmisLog = kullaniciLog.filter(ts => simdi - ts < 3000);
        mesajTakip.set(takipAnahtari, filtrelenmisLog);

        if (filtrelenmisLog.length >= 5) {
            // Hiyerarşi kontrolü: Botun gücü yetiyorsa sustursun
            // Eşik geçildiğinde sayacı hemen sıfırla; sonraki her mesajda tekrar ceza verme.
            mesajTakip.delete(takipAnahtari);
            if (message.member?.moderatable) {
                await message.delete().catch(() => null);
                await message.member.timeout(5 * 60 * 1000, 'Spam Koruması Tetiklendi').catch(() => null);
                message.channel.send({ content: `⚠️ ${message.author} dur kanka! Çok hızlı mesaj attığın için 5 dakika susturuldun.` }).catch(() => null);

                const logChan = await getLogChan();
            if (logChan) {
                    const embed = new EmbedBuilder()
                        .setTitle('<:sil:1505147967907037275> Otomatik Spam Koruması!')
                        .setDescription(`🛑 **${message.author.tag}** serisinden spam yaptığı için otomatik olarak **5 dakika** susturuldu!`)
                        .setColor('#c0392b').setTimestamp();
                    logChan.send({ embeds: [embed] }).catch(() => {});
                }
            }
            return;
        }
        }

        // 3. MASS MENTION (TOPLU ETİKET) KORUMASI
        if (korumaAyar.mention) {
        const toplamEtiket = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 1 : 0);
        if (toplamEtiket > 5) {
            if (message.member?.moderatable) {
                await message.delete().catch(() => null);
                await message.member.timeout(10 * 60 * 1000, 'Toplu Etiket Koruması Tetiklendi').catch(() => null);
                message.channel.send({ content: `⚠️ ${message.author} Tek bir mesajda çok fazla kişiyi etiketlediğin için 10 dakika susturuldun kanka!` }).catch(() => null);

                const logChan = await getLogChan();
            if (logChan) {
                    const embed = new EmbedBuilder()
                        .setTitle('<:riva_kilit:1505203119427162192> Toplu Etiket Koruması!')
                        .setDescription(`🚨 **${message.author.tag}** tam \`${toplamEtiket}\` adet etiket atarak milleti darladı ve **10 dakika** susturuldu.`)
                        .setColor('#e67e22').setTimestamp();
                    logChan.send({ embeds: [embed] }).catch(() => {});
                }
            }
            return;
        }
        }

        // 4. BÜYÜK HARF (CAPS LOCK) ENGELLEYİCİ
        if (korumaAyar.caps && message.content.length > 10) {
            const buyukHarfler = message.content.replace(/[^A-ZĞÜŞİÖÇ]/g, "").length;
            const toplamHarf = message.content.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ]/g, "").length;
            
            if (toplamHarf > 0 && (buyukHarfler / toplamHarf) > 0.7) { 
                await message.delete().catch(() => null);
                const capsUyarisi = await message.channel.send({ content: `⚠️ Kanka büyük harfleri biraz kısabilir miyiz? Bağırmana gerek yok ${message.author}.` }).catch(() => null);
                if (capsUyarisi) setTimeout(() => capsUyarisi.delete().catch(() => null), 4000);
                return;
            }
        }
    });

    // Anti-bot controls are handled once by events/antibot.js.

    // =========================================================================
    // 🛡️ 6. SAĞ TIK ROL/YÖNETİCİ VERME KORUMASI
    // =========================================================================
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        const logChan = await logKanalGetir(newMember.guild.id);
        const verilenRoller = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        const alinanRoller = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

        if (verilenRoller.size > 0) {
            const tehlikeliYetkiler = [
                PermissionFlagsBits.Administrator,
                PermissionFlagsBits.BanMembers,
                PermissionFlagsBits.KickMembers,
                PermissionFlagsBits.ManageRoles
            ];
            const tehlikeliRoller = verilenRoller.filter(role =>
                tehlikeliYetkiler.some(permission => role.permissions.has(permission))
            );

            if (tehlikeliRoller.size > 0) {
                const logEntry = await auditLogCek(
                    newMember.guild,
                    AuditLogEvent.MemberRoleUpdate,
                    newMember.id
                );
                const işlemiYapan = logEntry?.executor;
                const ownerIslem = işlemiYapan?.id === newMember.guild.ownerId;
                const botIslem = işlemiYapan?.id === client.user.id;

                // Sunucu sahibinin bilinçli yetki atamalarını engelleme.
                // Diğer yetkililer için tehlikeli yetki yükseltmesini geri al.
                if (
                    işlemiYapan &&
                    !ownerIslem &&
                    !botIslem &&
                    newMember.manageable
                ) {
                    try {
                        await newMember.roles.remove(
                            [...tehlikeliRoller.keys()],
                            'TMF: Sunucu sahibi dışındaki bir kullanıcı kritik yetki verdi.'
                        );

                        if (logChan) {
                            const embed = new EmbedBuilder()
                                .setTitle('🛡️ TMF | Tehlikeli Rol Ataması Geri Alındı')
                                .setDescription('Sunucu sahibi dışındaki bir kullanıcı kritik yönetim yetkisi verdi. Yeni rol(ler) geri alındı.')
                                .addFields(
                                    { name: '📌 Verilen Tehlikeli Rol(ler)', value: tehlikeliRoller.map(role => String(role)).join(', ').slice(0, 1000) },
                                    { name: '📌 Rol Verilen Üye', value: String(newMember.user), inline: true },
                                    { name: '📌 İşlemi Yapan', value: String(işlemiYapan), inline: true }
                                )
                                .setColor('#c0392b')
                                .setTimestamp();
                            logChan.send({ embeds: [embed] }).catch(() => {});
                        }
                        return;
                    } catch (error) {
                        console.error('[ROLE-GUARD] Kritik rol geri alınamadı:', error.message);
                        if (logChan) {
                            logChan.send({
                                content: '🚨 Kritik rol ataması tespit edildi ancak bot rol hiyerarşisi/izinleri nedeniyle geri alamadı. Sunucu yöneticisi hemen kontrol etmeli.',
                                allowedMentions: { parse: [] }
                            }).catch(() => {});
                        }
                    }
                } else if (
                    işlemiYapan &&
                    !ownerIslem &&
                    !botIslem &&
                    !newMember.manageable
                ) {
                    if (logChan) {
                        logChan.send({
                            content:
                                '🚨 **KRİTİK:** Sunucu sahibi dışındaki bir kullanıcı, botun rol hiyerarşisinin üzerinde bulunan bir üyeye yönetici yetkili rol verdi. TMF botu rolü geri alamadı; sunucu sahibi hemen müdahale etmeli.',
                            allowedMentions: { parse: [] }
                        }).catch(() => {});
                    }
                    return;
                }
            }
        }

        // Rol sayısı değişmese bile eklenen/çıkarılan gerçek rolleri kaydet.
        if (verilenRoller.size > 0 || alinanRoller.size > 0) {
            const logEntry = await auditLogCek(
                newMember.guild,
                AuditLogEvent.MemberRoleUpdate,
                newMember.id
            );
            const yapan = logEntry?.executor ? String(logEntry.executor) : '`Bilinmiyor`';

            if (logChan) {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ TMF | Üye Rol Güncellemesi')
                    .setDescription(`Üye: ${newMember.user} (${newMember.user.tag})`)
                    .addFields({ name: '📌 İşlemi Yapan', value: yapan });
                if (verilenRoller.size > 0) {
                    embed.addFields({ name: '📌 Verilen Roller', value: verilenRoller.map(role => String(role)).join(', ').slice(0, 1000) });
                }
                if (alinanRoller.size > 0) {
                    embed.addFields({ name: '📌 Alınan Roller', value: alinanRoller.map(role => String(role)).join(', ').slice(0, 1000) });
                }
                embed.setThumbnail(newMember.user.displayAvatarURL() || null)
                    .setColor('#34495e')
                    .setTimestamp();
                logChan.send({ embeds: [embed] }).catch(() => {});
            }
        }

        // TIMEOUT LOGLARI
        const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
        const newTimeout = newMember.communicationDisabledUntilTimestamp;

        if (!oldTimeout && newTimeout) {
            const logEntry = await auditLogCek(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
            const yapan   = logEntry?.executor ? `${logEntry.executor}` : '`Bilinmiyor`';
            const sebep   = logEntry?.reason    || 'Belirtilmemiş.';

            if (!logChan) return;
            const embed = new EmbedBuilder()
                .setTitle('<:Ses:1505164439505342484> Bir Üye Susturuldu! (Timeout)')
                .addFields(
                    { name: '<:uzaybot_kullanicilar:1505146190973505567> Susturulan', value: `${newMember.user}`, inline: true },
                    { name: '<:sil:1505147967907037275> Yapan Yetkili', value: yapan, inline: true },
                    { name: '📌 ⏳ Ceza Bitiş', value: `<t:${Math.round(newTimeout / 1000)}:R>`, inline: true },
                    { name: '<:Paper:1505146388596391977> Sebep', value: `\`${sebep}\`` }
                )
                .setThumbnail(newMember.user.displayAvatarURL()).setColor('#f1c40f').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        } else if (oldTimeout && !newTimeout) {
            if (!logChan) return;
            const embed = new EmbedBuilder()
                .setTitle('<:Ses:1505164439505342484> Susturulma Kaldırıldı!')
                .setDescription(`<:uzaybot_kullanicilar:1505146190973505567> **Üye:** ${newMember.user} susturması bitti veya el ile kaldırıldı.`)
                .setThumbnail(newMember.user.displayAvatarURL()).setColor('#2ecc71').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }

        // TAKMA AD LOGU
        if (oldMember.nickname !== newMember.nickname) {
            if (!logChan) return;
            const embed = new EmbedBuilder()
                .setTitle('<:rol:1505201454615629845> Takma Ad Değiştirildi!')
                .addFields(
                    { name: '<:uzaybot_kullanicilar:1505146190973505567> Üye', value: `${newMember.user}`, inline: true },
                    { name: '<:change:1505202806666170501> Eski Ad', value: `\`${oldMember.nickname || 'Yok'}\``, inline: true },
                    { name: '<a:tik:1505164671081123840> Yeni Ad', value: `\`${newMember.nickname || 'Yok'}\``, inline: true }
                )
                .setThumbnail(newMember.user.displayAvatarURL()).setColor('#1abc9c').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }
    });

    // =========================================================================
    // 💬 MESAJ LOGLARI (DÜZENLEME & SİLME)
    // =========================================================================
    client.on('messageDelete', async (message) => {
        if (message.partial || message.author?.bot || !message.guild) return;
        const logChan = await logKanalGetir(message.guild.id);
        if (!logChan) return;

        const logEntry = await auditLogCek(message.guild, AuditLogEvent.MessageDelete, message.author.id);
        const silenKisi = logEntry?.executor ? `${logEntry.executor} \`(${logEntry.executor.id})\`` : '`Kendi sildi`';

        const embed = new EmbedBuilder()
            .setTitle('<:sil:1505147967907037275> Bir Mesaj Silindi!')
            .addFields(
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Yazan Üye', value: `${message.author} \`(${message.author.id})\``, inline: true },
                { name: '<:sil:1505147967907037275> Silen Kişi', value: silenKisi, inline: true },
                { name: '<:Discord_Link:1505166617426923661> Kanal', value: `${message.channel}`, inline: true },
                { name: '<:Paper:1505146388596391977> Silinen İçerik', value: message.content ? `\`\`\`${message.content.substring(0, 1000)}\`\`\`` : '*İçerik boş veya sadece görsel/dosya.*' }
            )
            .setThumbnail(message.author.displayAvatarURL() || null).setColor('#e74c3c').setTimestamp();

        if (message.attachments.size > 0) {
            embed.addFields({ name: '📎 Ek Dosyalar', value: message.attachments.map(a => `[${a.name}](${a.url})`).join('\n').substring(0, 500) });
        }
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (oldMessage.partial || oldMessage.author?.bot || !oldMessage.guild || oldMessage.content === newMessage.content) return;
        const logChan = await logKanalGetir(oldMessage.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setTitle('<:Paper:1505146388596391977> Bir Mesaj Düzenlendi!')
            .addFields(
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Üye', value: `${oldMessage.author}`, inline: true },
                { name: '<:Discord_Link:1505166617426923661> Kanal', value: `${oldMessage.channel}`, inline: true },
                { name: '🔗 Mesaj Linki', value: `[Tıkla Git](${newMessage.url})`, inline: true },
                { name: '<:change:1505202806666170501> Eski İçerik', value: `\`\`\`${oldMessage.content?.substring(0, 500) || 'Boş'}\`\`\`` },
                { name: '<a:tik:1505164671081123840> Yeni İçerik', value: `\`\`\`${newMessage.content?.substring(0, 500) || 'Boş'}\`\`\`` }
            )
            .setThumbnail(oldMessage.author.displayAvatarURL() || null).setColor('#f39c12').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('messageDeleteBulk', async (messages) => {
        const message = messages.first();
        if (!message?.guild) return;
        const logChan = await logKanalGetir(message.guild.id);
        if (!logChan) return;

        const botMesajlari = messages.filter(m => m.author?.bot).size;
        const insan = messages.filter(m => !m.author?.bot).size;

        const embed = new EmbedBuilder()
            .setTitle('<:sil:1505147967907037275> Toplu Mesaj Silindi!')
            .addFields(
                { name: '<:Discord_Link:1505166617426923661> Kanal', value: `${message.channel}`, inline: true },
                { name: '<:Paper:1505146388596391977> Toplam Mesaj', value: `\`${messages.size}\``, inline: true },
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Kullanıcı Mesajı', value: `\`${insan}\``, inline: true },
                { name: '<:rol:1505201454615629845> Bot Mesajı', value: `\`${botMesajlari}\``, inline: true }
            )
            .setColor('#c0392b').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    // =========================================================================
    // 📁 KANAL LOGLARI & ULTİ LOG KORUMASI
    // =========================================================================
    client.on('channelCreate', async (channel) => {
        if (!channel.guild) return;
        const logChan = await logKanalGetir(channel.guild.id);
        if (!logChan) return;

        const logEntry = await auditLogCek(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
        const olusturan = logEntry?.executor ? `${logEntry.executor}` : '`Bilinmiyor`';

        const embed = new EmbedBuilder()
            .setTitle('<:yeni:1505201065476362325> Yeni Kanal Oluşturuldu!')
            .addFields(
                { name: '<:Discord_Link:1505166617426923661> Kanal', value: `${channel} \`(${channel.id})\``, inline: true },
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Oluşturan', value: olusturan, inline: true },
                { name: '<:change:1505202806666170501> Tür', value: `\`${channel.type}\``, inline: true }
            )
            .setColor('#2ecc71').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('channelDelete', async (channel) => {
        if (!channel.guild) return;
        
        const korumaAktif = await ayarGetir(channel.guild.id, 'logKorumaDurum', false);
        const sistemLogId = await ayarGetir(channel.guild.id, 'logKanal', null);

        // 🔥 ULTİ LOG KORUMASI: Log kanalı silinirse darbecinin tüm rollerini sıfırla
        if (korumaAktif && sistemLogId && channel.id === sistemLogId) {
            const logEntry = await auditLogCek(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
            const hainYetkili = logEntry?.executor;

            if (hainYetkili && hainYetkili.id !== client.user.id) {
                const guildOwner = await channel.guild.fetchOwner().catch(() => null);
                if (guildOwner) {
                    guildOwner.send({
                        content: `🚨 TMF: Ana log kanalı (${channel.name}) ${hainYetkili.tag || hainYetkili.username} tarafından silindi. Otomatik rol silme yapılmadı; denetim kaydını inceleyin.`,
                        allowedMentions: { parse: [] }
                    }).catch(() => {});
                }
                return;
            }
        }

        const logChan = await logKanalGetir(channel.guild.id);
        if (!logChan) return;

        const logEntry = await auditLogCek(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
        const silen = logEntry?.executor ? `${logEntry.executor}` : '`Bilinmiyor`';

        const embed = new EmbedBuilder()
            .setTitle('<:sil:1505147967907037275> Bir Kanal Silindi!')
            .addFields(
                { name: '<:Discord_Link:1505166617426923661> Kanal Adı', value: `\`${channel.name}\``, inline: true },
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Silen', value: silen, inline: true },
                { name: '<:change:1505202806666170501> Tür', value: `\`${channel.type}\``, inline: true }
            )
            .setColor('#c0392b').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('channelUpdate', async (oldChannel, newChannel) => {
        if (!newChannel.guild) return;

        const korumaAktif = await ayarGetir(newChannel.guild.id, 'logKorumaDurum', false);
        const sistemLogId = await ayarGetir(newChannel.guild.id, 'logKanal', null);

        // 🔥 ULTİ LOG KORUMASI: Log kanalı izinleri kurcalanırsa müdahale et kanka
        if (korumaAktif && sistemLogId && newChannel.id === sistemLogId) {
            const logEntry = await auditLogCek(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);
            const kurcalayan = logEntry?.executor;

            if (kurcalayan && kurcalayan.id !== client.user.id) {
                const guildOwner = await newChannel.guild.fetchOwner().catch(() => null);
                if (guildOwner) {
                    guildOwner.send({
                        content: `⚠️ TMF: Ana log kanalı ayarları ${kurcalayan.tag || kurcalayan.username} tarafından değiştirildi. Otomatik rol silme yapılmadı; denetim kaydını inceleyin.`,
                        allowedMentions: { parse: [] }
                    }).catch(() => {});
                }
            }
        }

        if (oldChannel.name === newChannel.name && oldChannel.topic === newChannel.topic && oldChannel.nsfw === newChannel.nsfw && oldChannel.rateLimitPerUser === newChannel.rateLimitPerUser) return;
        const logChan = await logKanalGetir(newChannel.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setTitle('<a:acs_ayarlar:1505165015127162994> Kanal Güncellendi!')
            .setDescription(`<:Discord_Link:1505166617426923661> **Kanal:** ${newChannel}`).setColor('#3498db');

        if (oldChannel.name !== newChannel.name) embed.addFields({ name: '<:change:1505202806666170501> Ad Değiştirildi', value: `\`${oldChannel.name}\` → \`${newChannel.name}\`` });
        if (oldChannel.topic !== newChannel.topic) embed.addFields({ name: '📌 Konu Değiştirildi', value: `\`${oldChannel.topic || 'Boş'}\` → \`${newChannel.topic || 'Boş'}\`` });
        if (oldChannel.nsfw !== newChannel.nsfw) embed.addFields({ name: '🔞 NSFW Durumu', value: `\`${oldChannel.nsfw}\` → \`${newChannel.nsfw}\`` });
        if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) embed.addFields({ name: '<:Ses:1505164439505342484> Yavaş Mod', value: `\`${oldChannel.rateLimitPerUser}s\` → \`${newChannel.rateLimitPerUser}s\`` });

        embed.setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    // =========================================================================
    // 👑 ROL LOGLARI & ROL İZİNLERİ GÜVENLİĞİ
    // =========================================================================
    client.on('roleCreate', async (role) => {
        const logChan = await logKanalGetir(role.guild.id);
        if (!logChan) return;

        const logEntry = await auditLogCek(role.guild, AuditLogEvent.RoleCreate, role.id);
        const olusturan = logEntry?.executor ? `${logEntry.executor}` : '`Bilinmiyor`';

        const embed = new EmbedBuilder()
            .setTitle('<:rol:1505201454615629845> Yeni Rol Oluşturuldu!')
            .addFields(
                { name: '<:yeni:1505201065476362325> Rol', value: `${role} \`(${role.id})\``, inline: true },
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Oluşturan', value: olusturan, inline: true },
                { name: '🎨 Renk', value: `\`${role.hexColor}\``, inline: true },
                { name: '<:koruma1:1505143174190989352> Öne Çıkar', value: `\`${role.hoist}\``, inline: true },
                { name: '<:riva_kilit:1505203119427162192> Mentionlanabilir', value: `\`${role.mentionable}\``, inline: true }
            )
            .setColor('#3498db').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('roleDelete', async (role) => {
        const logChan = await logKanalGetir(role.guild.id);
        if (!logChan) return;

        const logEntry = await auditLogCek(role.guild, AuditLogEvent.RoleDelete, role.id);
        const silen = logEntry?.executor ? `${logEntry.executor}` : '`Bilinmiyor`';

        const embed = new EmbedBuilder()
            .setTitle('<:rol:1505201454615629845> Bir Rol Silindi!')
            .addFields(
                { name: '<:sil:1505147967907037275> Silinen Rol', value: `\`${role.name}\` \`(${role.id})\``, inline: true },
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Silen', value: silen, inline: true }
            )
            .setColor('#9b59b6').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('roleUpdate', async (oldRole, newRole) => {
        const logChan = await logKanalGetir(newRole.guild.id);
        if (!logChan) return;

        // 🔥 ULTİ ÖZELLİK: Gizli İzin Değişikliği Taraması (Backdoor Engeli)
        if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
            const logEntry = await auditLogCek(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
            const düzenleyen = logEntry?.executor ? `${logEntry.executor}` : '`Bilinmiyor`';

            const embed = new EmbedBuilder()
                .setTitle('<a:acs_ayarlar:1505165015127162994> Rol İzinleri Değiştirildi!')
                .setDescription(`⚠️ **${newRole.name}** rolünün kritik yetki ayarları kurcalandı kanka!`)
                .addFields({ name: '<:change:1505202806666170501> Düzenleyen Yetkili', value: düzenleyen })
                .setColor('#f39c12').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }

        if (oldRole.name === newRole.name && oldRole.color === newRole.color && oldRole.hoist === newRole.hoist && oldRole.mentionable === newRole.mentionable) return;

        const embed = new EmbedBuilder()
            .setTitle('<:yeni:1505201065476362325> Rol Güncellendi!')
            .setDescription(`<:rol:1505201454615629845> **Rol:** ${newRole}`).setColor('#e67e22');

        if (oldRole.name !== newRole.name) embed.addFields({ name: '<:change:1505202806666170501> Ad', value: `\`${oldRole.name}\` → \`${newRole.name}\`` });
        if (oldRole.color !== newRole.color) embed.addFields({ name: '🎨 Renk', value: `\`${oldRole.hexColor}\` → \`${newRole.hexColor}\`` });
        if (oldRole.hoist !== newRole.hoist) embed.addFields({ name: '<:koruma1:1505143174190989352> Öne Çıkar', value: `\`${oldRole.hoist}\` → \`${newRole.hoist}\`` });
        if (oldRole.mentionable !== newRole.mentionable) embed.addFields({ name: '<:riva_kilit:1505203119427162192> Mentionlanabilir', value: `\`${oldRole.mentionable}\` → \`${newRole.mentionable}\`` });

        embed.setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    // =========================================================================
    // 🔥 SİNSİ WEBHOOK TAKİP LOGU
    // =========================================================================
    client.on('webhookUpdate', async (channel) => {
        if (!channel.guild) return;
        const logChan = await logKanalGetir(channel.guild.id);
        if (!logChan) return;

        const logEntry = await auditLogCek(channel.guild, AuditLogEvent.WebhookCreate);
        if (!logEntry) return;

        const yapan = logEntry.executor;
        const embed = new EmbedBuilder()
            .setTitle('<:Discord_Link:1505166617426923661> Webhook Verisi Tetiklendi!')
            .setDescription(`⛓️ **#${channel.name}** kanalında Webhook oluşturuldu veya kurcalandı kanka!`)
            .addFields({ name: '<:uzaybot_kullanicilar:1505146190973505567> İşlem Sahibi', value: yapan ? `${yapan}` : '`Bilinmiyor`' })
            .setColor('#9b59b6').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    // =========================================================================
    // 🔊 SES ODALARI LOGLARI
    // =========================================================================
    client.on('voiceStateUpdate', async (oldState, newState) => {
        const logChan = await logKanalGetir(newState.guild.id);
        if (!logChan) return;

        const üye = newState.member?.user || oldState.member?.user;
        if (!üye || üye.bot) return;

        if (!oldState.channelId && newState.channelId) {
            const embed = new EmbedBuilder()
                .setTitle('<a:join_join:1505202309343215717> Ses Kanalına Giriş!')
                .setDescription(`<:uzaybot_kullanicilar:1505146190973505567> ${üye} → ${newState.channel} odasına girdi.`)
                .setThumbnail(üye.displayAvatarURL()).setColor('#1abc9c').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        } else if (oldState.channelId && !newState.channelId) {
            const embed = new EmbedBuilder()
                .setTitle('<a:Leave_Leave:1505202549706195004> Ses Kanalından Çıkış!')
                .setDescription(`<:uzaybot_kullanicilar:1505146190973505567> ${üye} → \`${oldState.channel?.name}\` odasından ayrıldı.`)
                .setThumbnail(üye.displayAvatarURL()).setColor('#95a5a6').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const embed = new EmbedBuilder()
                .setTitle('<:change:1505202806666170501> Ses Kanalı Değiştirildi!')
                .addFields(
                    { name: '<:uzaybot_kullanicilar:1505146190973505567> Üye', value: `${üye}`, inline: true },
                    { name: '<:Ofline:1505145553925832704> Eski Oda', value: `\`${oldState.channel?.name}\``, inline: true },
                    { name: '<a:online:1505145208046878730> Yeni Oda', value: `${newState.channel}`, inline: true }
                )
                .setThumbnail(üye.displayAvatarURL()).setColor('#3498db').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }

        if (oldState.selfVideo !== newState.selfVideo) {
            const embed = new EmbedBuilder().setDescription(`${newState.selfVideo ? '📷 Kamera Açıldı' : '📷 Kamera Kapatıldı'}: ${üye}`).setColor(newState.selfVideo ? '#2ecc71' : '#e74c3c').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }
        if (oldState.serverMute !== newState.serverMute) {
            const embed = new EmbedBuilder().setDescription(`${newState.serverMute ? '<:Ses:1505164439505342484> Yetkili Susturuldu' : '<:Ses:1505164439505342484> Yetkili Susturması Kaldırıldı'}: ${üye}`).setColor(newState.serverMute ? '#e74c3c' : '#2ecc71').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }
        if (oldState.selfMute !== newState.selfMute) {
            const embed = new EmbedBuilder().setDescription(`${newState.selfMute ? '<:Ses:1505164439505342484> Mikrofon Kapatıldı' : '<:Ses:1505164439505342484> Mikrofon Açıldı'}: ${üye}`).setColor(newState.selfMute ? '#e74c3c' : '#2ecc71').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }
        if (oldState.selfDeaf !== newState.selfDeaf) {
            const embed = new EmbedBuilder().setDescription(`${newState.selfDeaf ? '<:music:1505171382483550258> Kulaklıklar Kapatıldı' : '<:music:1505171382483550258> Kulaklıklar Açıldı'}: ${üye}`).setColor(newState.selfDeaf ? '#e74c3c' : '#2ecc71').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }
        if (oldState.streaming !== newState.streaming) {
            const embed = new EmbedBuilder().setDescription(`${newState.streaming ? '🖥️ Ekran Paylaşımı Başlatıldı' : '🖥️ Ekran Paylaşımı Durduruldu'}: ${üye}`).setColor(newState.streaming ? '#9b59b6' : '#95a5a6').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }
    });

    // =========================================================================
    // 🔨 CEZA LOGLARI & MASS BAN KORUMASI
    // =========================================================================
    client.on('guildBanAdd', async (ban) => {
        const logChan = await logKanalGetir(ban.guild.id);
        const logEntry = await auditLogCek(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
        const yapan = logEntry?.executor;
        const sebep = logEntry?.reason || ban.reason || 'Belirtilmemiş.';

        // Seri ban davranışını algıla ve bildir. Otomatik rol silme yapılmaz:
        // meşru moderasyon işlemleri yanlış pozitif üretebilir.
        if (yapan && yapan.id !== client.user.id) {
            const simdi = Date.now();
            const banGecmisi = banTakip.get(`${ban.guild.id}:${yapan.id}`) || [];
            banGecmisi.push(simdi);

            const aktifBanlar = banGecmisi.filter(ts => simdi - ts < 10000);
            banTakip.set(`${ban.guild.id}:${yapan.id}`, aktifBanlar);

            if (aktifBanlar.length >= 3 && aktifBanlar.length === 3 && logChan) {
                const panikEmbed = new EmbedBuilder()
                    .setTitle('📋 ⚠️ TMF | Seri Ban Uyarısı')
                    .setDescription(`**${yapan}** son 10 saniyede 3 üye banladı. Bu işlem otomatik olarak geri alınmadı; sunucu yöneticisinin incelemesi gerekiyor.`)
                    .setColor('#f39c12')
                    .setTimestamp();
                await logChan.send({ embeds: [panikEmbed] }).catch(() => {});
            }
        }

        if (!logChan) return;
        const embed = new EmbedBuilder()
            .setTitle('<:yasaklandi:1505146022588842095> Bir Üye Banlandı!')
            .addFields(
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Banlanan', value: `${ban.user.tag} \`(${ban.user.id})\``, inline: true },
                { name: '<:sil:1505147967907037275> Yapan Yetkili', value: yapan ? `${yapan} \`(${yapan.id})\`` : '`Bilinmiyor`', inline: true },
                { name: '<:Paper:1505146388596391977> Sebep', value: `\`${sebep}\`` }
            )
            .setThumbnail(ban.user.displayAvatarURL({ dynamic: true })).setColor('#960018').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });
};
