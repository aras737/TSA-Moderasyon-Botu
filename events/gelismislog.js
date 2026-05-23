const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {

    // =========================================================================
    // 🛠️ YARDIMCI FONKSİYONLAR & BELLEK YAPILARI
    // =========================================================================
    const logKanalGetir = async (guildId) => {
        const kanalId = await ayarGetir(guildId, 'logKanal', null);
        return kanalId ? client.channels.cache.get(kanalId) : null;
    };

    const auditLogCek = async (guild, type, hedefId = null) => {
        for (let i = 0; i < 3; i++) {
            await new Promise(r => setTimeout(r, 800));
            const logs = await guild.fetchAuditLogs({ limit: 5, type }).catch(() => null);
            if (!logs) continue;
            const entry = hedefId
                ? logs.entries.find(e => e.target?.id === hedefId)
                : logs.entries.first();
            if (entry) return entry;
        }
        return null;
    };

    const kufurRegex = /(amcık|yarrak|sik|piç|orospu|sikiş|göt|meme|orospu çocuğu|amk|aq|pç|skm|amına)/i;
    
    // Ulti Koruma RAM Bellekleri kanka
    const mesajTakip = new Map();
    const banTakip = new Map(); // Mass Ban takibi için

    // =========================================================================
    // 🛡️ ANA MESAJ KORUMALARI (Küfür, Spam, Caps, Bahsetme)
    // =========================================================================
    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot || message.partial) return;

        // Yönetici yetkisi olanları koruma filtrelerinden muaf tutuyoruz
        if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

        // Botun RAM belleğinden ayarı kontrol ediyoruz
        if (!client.sistemBellegi) client.sistemBellegi = new Map();
        let durum = client.sistemBellegi.get(message.guild.id)?.kufur;
        if (durum === undefined) {
            const dbDurum = await ayarGetir(message.guild.id, 'kufurEngelDurum', false);
            if (!client.sistemBellegi.has(message.guild.id)) {
                client.sistemBellegi.set(message.guild.id, { kufur: dbDurum });
            } else {
                client.sistemBellegi.get(message.guild.id).kufur = dbDurum;
            }
            durum = dbDurum;
        }
        if (!durum) return;

        const logChan = await logKanalGetir(message.guild.id);
        const simdi = Date.now();

        // 1. KÜFÜR ENGEL SİSTEMİ
        if (kufurRegex.test(message.content)) {
            await message.delete().catch(() => null);
            const uyariMsg = await message.channel.send({ content: `🤬 Temiz bir dil kullanalım lütfen ${message.author}! Bu sunucuda küfür etmek yasak kanka.` }).catch(() => null);
            if (uyariMsg) setTimeout(() => uyariMsg.delete().catch(() => null), 4000);

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
        const kullaniciLog = mesajTakip.get(message.author.id) || [];
        kullaniciLog.push(simdi);
        const filtrelenmisLog = kullaniciLog.filter(ts => simdi - ts < 3000);
        mesajTakip.set(message.author.id, filtrelenmisLog);

        if (filtrelenmisLog.length >= 5) {
            await message.delete().catch(() => null);
            await message.member.timeout(5 * 60 * 1000, 'Spam Koruması Tetiklendi').catch(() => null);
            
            message.channel.send({ content: `⚠️ ${message.author} dur kanka! Çok hızlı mesaj attığın için 5 dakika susturuldun.` }).catch(() => null);

            if (logChan) {
                const embed = new EmbedBuilder()
                    .setTitle('<:sil:1505147967907037275> Otomatik Spam Koruması!')
                    .setDescription(`🛑 **${message.author.tag}** serisinden spam yaptığı için otomatik olarak **5 dakika** susturuldu!`)
                    .setColor('#c0392b').setTimestamp();
                logChan.send({ embeds: [embed] }).catch(() => {});
            }
            return;
        }

        // 3. MASS MENTION (TOPLU ETİKET) KORUMASI
        const toplamEtiket = message.mentions.users.size + message.mentions.roles.size;
        if (toplamEtiket > 5) {
            await message.delete().catch(() => null);
            await message.member.timeout(10 * 60 * 1000, 'Toplu Etiket Koruması Tetiklendi').catch(() => null);
            
            message.channel.send({ content: `⚠️ ${message.author} Tek bir mesajda çok fazla kişiyi etiketlediğin için 10 dakika susturuldun kanka!` }).catch(() => null);

            if (logChan) {
                const embed = new EmbedBuilder()
                    .setTitle('<:riva_kilit:1505203119427162192> Toplu Etiket Koruması!')
                    .setDescription(`🚨 **${message.author.tag}** tam \`${toplamEtiket}\` adet etiket atarak milleti darladı ve **10 dakika** susturuldu.`)
                    .setColor('#e67e22').setTimestamp();
                logChan.send({ embeds: [embed] }).catch(() => {});
            }
            return;
        }

        // 4. BÜYÜK HARF (CAPS LOCK) ENGELLEYİCİ
        if (message.content.length > 10) {
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

    // =========================================================================
    // 🤖 5. ANTIRAID / ILLEGAL BOT KORUMASI
    // =========================================================================
    client.on('guildMemberAdd', async (member) => {
        if (!member.user.bot) return; 
        
        const logChan = await logKanalGetir(member.guild.id);
        const logEntry = await auditLogCek(member.guild, AuditLogEvent.BotAdd, member.id);
        const ekleyen = logEntry?.executor;

        await member.kick('İzinsiz/Kaçak Bot Girişi Engellendi').catch(() => null);

        if (logChan) {
            const embed = new EmbedBuilder()
                .setTitle('<:yasaklandi:1505146022588842095> Sunucuya Kaçak Bot Sokuldu!')
                .setDescription(`🚨 Sunucuya izinsiz bir bot eklenmeye çalışıldı ve sistem tarafından anında imha edildi!`)
                .addFields(
                    { name: '🤖 Engellenen Bot', value: `\`${member.user.tag}\` \`(${member.id})\``, inline: true },
                    { name: '👤 Ekleyen Yetkili', value: ekleyen ? `${ekleyen} \`(${ekleyen.id})\`` : '`Bilinmiyor`', inline: true }
                )
                .setColor('#960018').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }
    });

    // =========================================================================
    // 🛡️ 6. SAĞ TIK ROL/YÖNETİCİ VERME KORUMASI
    // =========================================================================
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        const logChan = await logKanalGetir(newMember.guild.id);
        
        if (oldMember.roles.cache.size < newMember.roles.cache.size) {
            const eklenenRol = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id)).first();
            if (!eklenenRol) return;

            const tehlikeliYetkiler = [
                PermissionFlagsBits.Administrator,
                PermissionFlagsBits.BanMembers,
                PermissionFlagsBits.KickMembers,
                PermissionFlagsBits.ManageRoles
            ];

            const tehlikeliMi = tehlikeliYetkiler.some(yetki => eklenenRol.permissions.has(yetki));

            if (tehlikeliMi) {
                const logEntry = await auditLogCek(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
                const işlemiYapan = logEntry?.executor;

                if (işlemiYapan && işlemiYapan.id !== client.user.id) {
                    await newMember.roles.remove(eklenenRol, 'Tehlikeli Rol Verme Koruması').catch(() => null);

                    if (logChan) {
                        const embed = new EmbedBuilder()
                            .setTitle('<:koruma1:1505143174190989352> Tehlikeli Yetki Verme Engellendi!')
                            .setDescription(`🚨 Sunucuda sağ tık ile kritik yetkili bir rol verilmeye çalışıldı, sistem rolü anında geri aldı!`)
                            .addFields(
                                { name: '<:rol:1505201454615629845> Verilmeye Çalışılan Rol', value: `${eklenenRol} \`(${eklenenRol.id})\`` },
                                { name: '<:uzaybot_kullanicilar:1505146190973505567> Rol Verilen Üye', value: `${newMember.user}`, inline: true },
                                { name: '<:sil:1505147967907037275> Rolü Vermeye Çalışan', value: `${işlemiYapan}`, inline: true }
                            )
                            .setColor('#c0392b').setTimestamp();
                        logChan.send({ embeds: [embed] }).catch(() => {});
                    }
                }
            }
        }

        // STANDART ROL LOGLARI
        if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
            const verilenRoller = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
            const alinanRoller  = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
            
            if (verilenRoller.size > 0 && verilenRoller.first().permissions.has(PermissionFlagsBits.Administrator) && (await auditLogCek(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id))?.executor?.id !== client.user.id) return;

            const logEntry = await auditLogCek(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
            const yapan = logEntry?.executor ? `${logEntry.executor}` : '`Bilinmiyor`';

            if (!logChan) return;
            const embed = new EmbedBuilder()
                .setTitle('<:koruma1:1505143174190989352> Üye Rol Güncellemesi!')
                .setDescription(`<:uzaybot_kullanicilar:1505146190973505567> **Üye:** ${newMember.user} \`(${newMember.user.tag})\``)
                .addFields({ name: '<:change:1505202806666170501> İşlemi Yapan', value: yapan })
                .setThumbnail(newMember.user.displayAvatarURL()).setColor('#34495e').setTimestamp();

            if (verilenRoller.size > 0) embed.addFields({ name: '<a:online:1505145208046878730> Verilen Rol(ler)', value: verilenRoller.map(r => `${r}`).join(', ') });
            if (alinanRoller.size > 0) embed.addFields({ name: '<:Ofline:1505145553925832704> Alınan Rol(ler)', value: alinanRoller.map(r => `${r}`).join(', ') });
            logChan.send({ embeds: [embed] }).catch(() => {});
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
                    { name: '⏳ Ceza Bitiş', value: `<t:${Math.round(newTimeout / 1000)}:R>`, inline: true },
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
        if (message.partial || message.author?.bot) return;
        const logChan = await logKanalGetir(message.guild?.id);
        if (!logChan) return;

        const logEntry = await auditLogCek(message.guild, AuditLogEvent.MessageDelete, message.author.id);
        const silenKisi = logEntry?.executor ? `${logEntry.executor} \`(${logEntry.executor.id})\`` : '`Kendi sildi`';

        const embed = new EmbedBuilder()
            .setTitle('<:sil:1505147967907037275> Bir Mesaj Silindi!')
            .addFields(
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Yazan Üye', value: `${message.author} \`(${message.author.id})\``, inline: true },
                { name: '<:sil:1505147967907037275> Silen Kişi', value: silenKisi, inline: true },
                { name: '<:Discord_Link:1505166617426923661> Kanal', value: `${message.channel}`, inline: true },
                { name: '<:Paper:1505146388596391977> Silinen İçerik', value: message.content ? `\`\`\`${message.content.substring(0, 1000)}\`\`\`` : '*İçerik boş veya görsel/dosya.*' }
            )
            .setThumbnail(message.author.displayAvatarURL()).setColor('#e74c3c').setTimestamp();

        if (message.attachments.size > 0) {
            embed.addFields({ name: '📎 Ek Dosyalar', value: message.attachments.map(a => `[${a.name}](${a.url})`).join('\n').substring(0, 500) });
        }
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (oldMessage.partial || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
        const logChan = await logKanalGetir(oldMessage.guild?.id);
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
            .setThumbnail(oldMessage.author.displayAvatarURL()).setColor('#f39c12').setTimestamp();
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

        // 🔥 ULTİ LOG KORUMASI: Eğer silinen kanal ana log kanalıysa patlat kanka!
        if (korumaAktif && sistemLogId && channel.id === sistemLogId) {
            const logEntry = await auditLogCek(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
            const hainYetkili = logEntry?.target?.id === channel.id ? logEntry.executor : null;

            if (hainYetkili && hainYetkili.id !== client.user.id) {
                const member = await channel.guild.members.fetch(hainYetkili.id).catch(() => null);
                if (member) {
                    await member.roles.set([], 'Ulti Log Kanalını Silmeye Çalıştı!').catch(() => null);
                }

                const guildOwner = await channel.guild.fetchOwner().catch(() => null);
                if (guildOwner) {
                    const acilEmbed = new EmbedBuilder()
                        .setTitle('🚨 ACİL DURUM: LOG KANALI SABOTE EDİLDİ!')
                        .setDescription(`⚠️ Sunucunuzdaki ana log kanalı (\`${channel.name}\`), **${hainYetkili.tag}** tarafından silindi! Bot anında yetkileri kesti!`)
                        .setColor('#960018').setTimestamp();
                    guildOwner.send({ embeds: [acilEmbed] }).catch(() => {});
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

        // 🔥 ULTİ LOG KORUMASI: Biri log kanalı izinlerini kurcalarsa yetkisini al kanka!
        if (korumaAktif && sistemLogId && newChannel.id === sistemLogId) {
            const logEntry = await auditLogCek(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);
            const kurcalayan = logEntry?.executor;

            if (kurcalayan && kurcalayan.id !== client.user.id) {
                const member = await newChannel.guild.members.fetch(kurcalayan.id).catch(() => null);
                if (member && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                    await member.roles.set([], 'Ulti Log Kanalı Ayarlarını Kurcaladı!').catch(() => null);
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
        const logChan = await logKanalGetir(channel.guild.id);
        if (!logChan) return;

        const logEntry = await auditLogCek(channel.guild, AuditLogEvent.WebhookCreate);
        if (!logEntry) return;

        const yapan = logEntry.executor;
        const embed = new EmbedBuilder()
            .setTitle('<:Discord_Link:1505166617426923661> Webhook Verisi Tetiklendi!')
            .setDescription(`⛓️ **#${channel.name}** kanalında Webhook oluşturuldu veya kurcalandı kanka!`)
            .addFields({ name: '<:uzaybot_kullanicilar:1505146190973505567> İşlem Sahibi', value: `${yapan}` })
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

        // 🔥 ULTİ ÖZELLİK: Sağ Tık Mass Ban Saldırı Engeli
        if (yapan && yapan.id !== client.user.id) {
            const simdi = Date.now();
            const banGecmisi = banTakip.get(yapan.id) || [];
            banGecmisi.push(simdi);
            
            const aktifBanlar = banGecmisi.filter(ts => simdi - ts < 10000); // 10 saniye limit
            banTakip.set(yapan.id, aktifBanlar);

            if (aktifBanlar.length >= 3) { // 10 saniyede 3 ban atarsa darbecidir kanka!
                const member = await ban.guild.members.fetch(yapan.id).catch(() => null);
                if (member) {
                    await member.roles.set([], 'Mass Ban Saldırısı Tespit Edildi!').catch(() => null);
                }

                if (logChan) {
                    const panikEmbed = new EmbedBuilder()
                        .setTitle('<:yasaklandi:1505146022588842095> MASS BAN SALDIRISI ENGELLENDİ!')
                        .setDescription(`🚨 **${yapan}** isimli yetkili ardı ardına seri ban attığı için sunucuyu korumak amacıyla **bütün yetkileri ve rolleri alındı**!`)
                        .setColor('#960018').setTimestamp();
                    return logChan.send({ embeds: [panikEmbed] }).catch(() => {});
                }
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
