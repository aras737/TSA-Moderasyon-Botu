const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {

    // =========================================================================
    // 🛠️ YARDIMCI FONKSİYONLAR
    // =========================================================================
    const logKanalGetir = async (guildId) => {
        const kanalId = await ayarGetir(guildId, 'logKanal', null);
        return kanalId ? client.channels.cache.get(kanalId) : null;
    };

    // Audit log çekme - retry mekanizmalı
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

    // =========================================================================
    // 💬 1. MESAJ LOGLARI
    // =========================================================================
    client.on('messageDelete', async (message) => {
        if (message.partial || message.author?.bot) return;
        const logChan = await logKanalGetir(message.guild?.id);
        if (!logChan) return;

        // Kim sildi? Audit log'dan bul
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
            .setThumbnail(message.author.displayAvatarURL())
            .setColor('#e74c3c').setTimestamp();

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
            .setThumbnail(oldMessage.author.displayAvatarURL())
            .setColor('#f39c12').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    // Toplu mesaj silme
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
    // 📁 2. KANAL LOGLARI
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
        if (oldChannel.name === newChannel.name && oldChannel.topic === newChannel.topic && oldChannel.nsfw === newChannel.nsfw && oldChannel.rateLimitPerUser === newChannel.rateLimitPerUser) return;
        const logChan = await logKanalGetir(newChannel.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setTitle('<a:acs_ayarlar:1505165015127162994> Kanal Güncellendi!')
            .setDescription(`<:Discord_Link:1505166617426923661> **Kanal:** ${newChannel}`)
            .setColor('#3498db');

        if (oldChannel.name !== newChannel.name)
            embed.addFields({ name: '<:change:1505202806666170501> Ad Değiştirildi', value: `\`${oldChannel.name}\` → \`${newChannel.name}\`` });
        if (oldChannel.topic !== newChannel.topic)
            embed.addFields({ name: '📌 Konu Değiştirildi', value: `\`${oldChannel.topic || 'Boş'}\` → \`${newChannel.topic || 'Boş'}\`` });
        if (oldChannel.nsfw !== newChannel.nsfw)
            embed.addFields({ name: '🔞 NSFW Durumu', value: `\`${oldChannel.nsfw}\` → \`${newChannel.nsfw}\`` });
        if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser)
            embed.addFields({ name: '<:Ses:1505164439505342484> Yavaş Mod', value: `\`${oldChannel.rateLimitPerUser}s\` → \`${newChannel.rateLimitPerUser}s\`` });

        embed.setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    // =========================================================================
    // 👑 3. ROL LOGLARI
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
        if (oldRole.name === newRole.name && oldRole.color === newRole.color && oldRole.hoist === newRole.hoist && oldRole.mentionable === newRole.mentionable) return;
        const logChan = await logKanalGetir(newRole.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setTitle('<:yeni:1505201065476362325> Rol Güncellendi!')
            .setDescription(`<:rol:1505201454615629845> **Rol:** ${newRole}`)
            .setColor('#e67e22');

        if (oldRole.name !== newRole.name)
            embed.addFields({ name: '<:change:1505202806666170501> Ad', value: `\`${oldRole.name}\` → \`${newRole.name}\`` });
        if (oldRole.color !== newRole.color)
            embed.addFields({ name: '🎨 Renk', value: `\`${oldRole.hexColor}\` → \`${newRole.hexColor}\`` });
        if (oldRole.hoist !== newRole.hoist)
            embed.addFields({ name: '<:koruma1:1505143174190989352> Öne Çıkar', value: `\`${oldRole.hoist}\` → \`${newRole.hoist}\`` });
        if (oldRole.mentionable !== newRole.mentionable)
            embed.addFields({ name: '<:riva_kilit:1505203119427162192> Mentionlanabilir', value: `\`${oldRole.mentionable}\` → \`${newRole.mentionable}\`` });

        embed.setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    // =========================================================================
    // 👤 4. ÜYE GÜNCELLEME LOGLARI
    // =========================================================================
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        const logChan = await logKanalGetir(newMember.guild.id);
        if (!logChan) return;

        // --- ROL DEĞİŞİKLİĞİ ---
        if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
            const verilenRoller = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
            const alinanRoller  = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

            const logEntry = await auditLogCek(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
            const yapan = logEntry?.executor ? `${logEntry.executor}` : '`Bilinmiyor`';

            const embed = new EmbedBuilder()
                .setTitle('<:koruma1:1505143174190989352> Üye Rol Güncellemesi!')
                .setDescription(`<:uzaybot_kullanicilar:1505146190973505567> **Üye:** ${newMember.user} \`(${newMember.user.tag})\``)
                .addFields({ name: '<:change:1505202806666170501> İşlemi Yapan', value: yapan })
                .setThumbnail(newMember.user.displayAvatarURL())
                .setColor('#34495e').setTimestamp();

            if (verilenRoller.size > 0)
                embed.addFields({ name: '<a:online:1505145208046878730> Verilen Rol(ler)', value: verilenRoller.map(r => `${r}`).join(', ') });
            if (alinanRoller.size > 0)
                embed.addFields({ name: '<:Ofline:1505145553925832704> Alınan Rol(ler)', value: alinanRoller.map(r => `${r}`).join(', ') });

            logChan.send({ embeds: [embed] }).catch(() => {});
        }

        // --- TIMEOUT LOGLARI ---
        const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
        const newTimeout = newMember.communicationDisabledUntilTimestamp;

        if (!oldTimeout && newTimeout) {
            const logEntry = await auditLogCek(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
            const yapan   = logEntry?.executor ? `${logEntry.executor}` : '`Bilinmiyor`';
            const sebep   = logEntry?.reason    || 'Belirtilmemiş.';

            const embed = new EmbedBuilder()
                .setTitle('<:Ses:1505164439505342484> Bir Üye Susturuldu! (Timeout)')
                .addFields(
                    { name: '<:uzaybot_kullanicilar:1505146190973505567> Susturulan', value: `${newMember.user}`, inline: true },
                    { name: '<:sil:1505147967907037275> Yapan Yetkili', value: yapan, inline: true },
                    { name: '⏳ Ceza Bitiş', value: `<t:${Math.round(newTimeout / 1000)}:R>`, inline: true },
                    { name: '<:Paper:1505146388596391977> Sebep', value: `\`${sebep}\`` }
                )
                .setThumbnail(newMember.user.displayAvatarURL())
                .setColor('#f1c40f').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});

        } else if (oldTimeout && !newTimeout) {
            const embed = new EmbedBuilder()
                .setTitle('<:Ses:1505164439505342484> Susturulma Kaldırıldı!')
                .setDescription(`<:uzaybot_kullanicilar:1505146190973505567> **Üye:** ${newMember.user} susturması bitti veya el ile kaldırıldı.`)
                .setThumbnail(newMember.user.displayAvatarURL())
                .setColor('#2ecc71').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }

        // --- NİCKNAME DEĞİŞİMİ ---
        if (oldMember.nickname !== newMember.nickname) {
            const embed = new EmbedBuilder()
                .setTitle('<:rol:1505201454615629845> Takma Ad Değiştirildi!')
                .addFields(
                    { name: '<:uzaybot_kullanicilar:1505146190973505567> Üye', value: `${newMember.user}`, inline: true },
                    { name: '<:change:1505202806666170501> Eski Ad', value: `\`${oldMember.nickname || 'Yok'}\``, inline: true },
                    { name: '<a:tik:1505164671081123840> Yeni Ad', value: `\`${newMember.nickname || 'Yok'}\``, inline: true }
                )
                .setThumbnail(newMember.user.displayAvatarURL())
                .setColor('#1abc9c').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }
    });

    // =========================================================================
    // 🔊 5. SES ODALARI LOGLARI
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
                .setThumbnail(üye.displayAvatarURL())
                .setColor('#1abc9c').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});

        } else if (oldState.channelId && !newState.channelId) {
            const embed = new EmbedBuilder()
                .setTitle('<a:Leave_Leave:1505202549706195004> Ses Kanalından Çıkış!')
                .setDescription(`<:uzaybot_kullanicilar:1505146190973505567> ${üye} → \`${oldState.channel?.name}\` odasından ayrıldı.`)
                .setThumbnail(üye.displayAvatarURL())
                .setColor('#95a5a6').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});

        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const embed = new EmbedBuilder()
                .setTitle('<:change:1505202806666170501> Ses Kanalı Değiştirildi!')
                .addFields(
                    { name: '<:uzaybot_kullanicilar:1505146190973505567> Üye', value: `${üye}`, inline: true },
                    { name: '<:Ofline:1505145553925832704> Eski Oda', value: `\`${oldState.channel?.name}\``, inline: true },
                    { name: '<a:online:1505145208046878730> Yeni Oda', value: `${newState.channel}`, inline: true }
                )
                .setThumbnail(üye.displayAvatarURL())
                .setColor('#3498db').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }

        // Kamera açma/kapama logu
        if (oldState.selfVideo !== newState.selfVideo) {
            const embed = new EmbedBuilder()
                .setDescription(`${newState.selfVideo ? '📷 Kamera Açıldı' : '📷 Kamera Kapatıldı'}: ${üye}`)
                .setColor(newState.selfVideo ? '#2ecc71' : '#e74c3c')
                .setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }

        // Sunucu susturma logu (yetkili tarafından)
        if (oldState.serverMute !== newState.serverMute) {
            const embed = new EmbedBuilder()
                .setDescription(`${newState.serverMute ? '<:Ses:1505164439505342484> Yetkili Tarafından Susturuldu' : '<:Ses:1505164439505342484> Yetkili Susturması Kaldırıldı'}: ${üye}`)
                .setColor(newState.serverMute ? '#e74c3c' : '#2ecc71')
                .setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }

        // Mikrofon aç/kapat
        if (oldState.selfMute !== newState.selfMute) {
            const embed = new EmbedBuilder()
                .setDescription(`${newState.selfMute ? '<:Ses:1505164439505342484> Mikrofon Kapatıldı' : '<:Ses:1505164439505342484> Mikrofon Açıldı'}: ${üye}`)
                .setColor(newState.selfMute ? '#e74c3c' : '#2ecc71')
                .setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }

        // Kulaklık aç/kapat
        if (oldState.selfDeaf !== newState.selfDeaf) {
            const embed = new EmbedBuilder()
                .setDescription(`${newState.selfDeaf ? '<:music:1505171382483550258> Kulaklıklar Kapatıldı' : '<:music:1505171382483550258> Kulaklıklar Açıldı'}: ${üye}`)
                .setColor(newState.selfDeaf ? '#e74c3c' : '#2ecc71')
                .setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }

        // Ekran paylaşımı
        if (oldState.streaming !== newState.streaming) {
            const embed = new EmbedBuilder()
                .setDescription(`${newState.streaming ? '🖥️ Ekran Paylaşımı Başlatıldı' : '🖥️ Ekran Paylaşımı Durduruldu'}: ${üye}`)
                .setColor(newState.streaming ? '#9b59b6' : '#95a5a6')
                .setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }
    });

    // =========================================================================
    // 🔨 6. CEZA LOGLARI (Ban, Kick, Unban)
    // =========================================================================
    client.on('guildBanAdd', async (ban) => {
        const logChan = await logKanalGetir(ban.guild.id);
        if (!logChan) return;

        const logEntry = await auditLogCek(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
        const yapan    = logEntry?.executor ? `${logEntry.executor} \`(${logEntry.executor.id})\`` : '`Bilinmiyor`';
        const sebep    = logEntry?.reason    || ban.reason || 'Belirtilmemiş.';

        const embed = new EmbedBuilder()
            .setTitle('<:yasaklandi:1505146022588842095> Bir Üye Banlandı!')
            .addFields(
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Banlanan', value: `${ban.user.tag} \`(${ban.user.id})\``, inline: true },
                { name: '<:sil:1505147967907037275> Yapan Yetkili', value: yapan, inline: true },
                { name: '<:Paper:1505146388596391977> Sebep', value: `\`${sebep}\`` }
            )
            .setThumbnail(ban.user.displayAvatarURL())
            .setColor('#960018').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('guildBanRemove', async (ban) => {
        const logChan = await logKanalGetir(ban.guild.id);
        if (!logChan) return;

        const logEntry = await auditLogCek(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
        const yapan    = logEntry?.executor ? `${logEntry.executor}` : '`Bilinmiyor`';

        const embed = new EmbedBuilder()
            .setTitle('<:riva_kilit:1505203119427162192> Bir Üyenin Banı Kaldırıldı!')
            .addFields(
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Banı Kaldırılan', value: `${ban.user.tag} \`(${ban.user.id})\``, inline: true },
                { name: '<a:tik:1505164671081123840> Yapan Yetkili', value: yapan, inline: true }
            )
            .setThumbnail(ban.user.displayAvatarURL())
            .setColor('#27ae60').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    // Kick logu
    client.on('guildMemberRemove', async (member) => {
        if (member.user.bot) return;
        const logChan = await logKanalGetir(member.guild.id);
        if (!logChan) return;

        // Ban mı kick mı ayrımı
        const banKontrol = await member.guild.bans.fetch(member.id).catch(() => null);
        if (banKontrol) return; // Ban atıldıysa guildBanAdd halleder

        const logEntry = await auditLogCek(member.guild, AuditLogEvent.MemberKick, member.id);

        if (logEntry && logEntry.target?.id === member.id) {
            // Kick
            const yapan = logEntry.executor ? `${logEntry.executor}` : '`Bilinmiyor`';
            const sebep = logEntry.reason || 'Belirtilmemiş.';

            const embed = new EmbedBuilder()
                .setTitle('<:yasaklandi:1505146022588842095> Bir Üye Atıldı! (Kick)')
                .addFields(
                    { name: '<:uzaybot_kullanicilar:1505146190973505567> Atılan', value: `${member.user.tag} \`(${member.user.id})\``, inline: true },
                    { name: '<:sil:1505147967907037275> Yapan Yetkili', value: yapan, inline: true },
                    { name: '<:Paper:1505146388596391977> Sebep', value: `\`${sebep}\`` }
                )
                .setThumbnail(member.user.displayAvatarURL())
                .setColor('#e67e22').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        } else {
            // Kendi ayrıldı
            const embed = new EmbedBuilder()
                .setTitle('<a:Leave_Leave:1505202549706195004> Bir Üye Sunucudan Ayrıldı!')
                .addFields(
                    { name: '<:uzaybot_kullanicilar:1505146190973505567> Üye', value: `${member.user.tag} \`(${member.user.id})\``, inline: true },
                    { name: '<:change:1505202806666170501> Katılış Tarihi', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL())
                .setColor('#e74c3c').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }
    });

    // =========================================================================
    // 👤 7. ÜYE GİRİŞ LOGU
    // =========================================================================
    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return;
        const logChan = await logKanalGetir(member.guild.id);
        if (!logChan) return;

        const hesapYasi = Date.now() - member.user.createdTimestamp;
        const gunCinsinden = Math.floor(hesapYasi / (1000 * 60 * 60 * 24));
        const yeniHesapUyarisi = gunCinsinden < 7 ? '\n⚠️ **Yeni hesap! Dikkatli olun.**' : '';

        const embed = new EmbedBuilder()
            .setTitle('<a:join_join:1505202309343215717> Yeni Üye Katıldı!')
            .addFields(
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Üye', value: `${member.user} \`(${member.user.id})\``, inline: true },
                { name: '<:Ranch_Sunucu:1505442356000985239> Toplam Üye', value: `\`${member.guild.memberCount}\``, inline: true },
                { name: '<:change:1505202806666170501> Hesap Yaşı', value: `\`${gunCinsinden} gün\`${yeniHesapUyarisi}`, inline: true },
                { name: '📅 Hesap Açılışı', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` }
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setColor('#2ecc71').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    // =========================================================================
    // ⚙️ 8. SUNUCU LOGLARI
    // =========================================================================
    client.on('guildUpdate', async (oldGuild, newGuild) => {
        const logChan = await logKanalGetir(newGuild.id);
        if (!logChan) return;

        if (oldGuild.name !== newGuild.name) {
            const embed = new EmbedBuilder()
                .setTitle('<:Ranch_Sunucu:1505442356000985239> Sunucu Adı Değiştirildi!')
                .addFields(
                    { name: '<:change:1505202806666170501> Eski Ad', value: `\`${oldGuild.name}\``, inline: true },
                    { name: '<a:tik:1505164671081123840> Yeni Ad', value: `\`${newGuild.name}\``, inline: true }
                )
                .setColor('#3498db').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }

        if (oldGuild.icon !== newGuild.icon) {
            const embed = new EmbedBuilder()
                .setTitle('<:Ranch_Sunucu:1505442356000985239> Sunucu İkonu Değiştirildi!')
                .setDescription('<a:acs_ayarlar:1505165015127162994> Sunucunun profil resmi güncellendi.')
                .setThumbnail(newGuild.iconURL())
                .setColor('#9b59b6').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }

        if (oldGuild.description !== newGuild.description) {
            const embed = new EmbedBuilder()
                .setTitle('<:Ranch_Sunucu:1505442356000985239> Sunucu Açıklaması Değiştirildi!')
                .addFields(
                    { name: '<:change:1505202806666170501> Eski Açıklama', value: `\`${oldGuild.description || 'Boş'}\`` },
                    { name: '<a:tik:1505164671081123840> Yeni Açıklama', value: `\`${newGuild.description || 'Boş'}\`` }
                )
                .setColor('#e67e22').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }

        if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
            const embed = new EmbedBuilder()
                .setTitle('<:riva_kilit:1505203119427162192> Doğrulama Seviyesi Değiştirildi!')
                .addFields(
                    { name: '<:change:1505202806666170501> Eski Seviye', value: `\`${oldGuild.verificationLevel}\``, inline: true },
                    { name: '<a:tik:1505164671081123840> Yeni Seviye', value: `\`${newGuild.verificationLevel}\``, inline: true }
                )
                .setColor('#f39c12').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }
    });

    // =========================================================================
    // 🎤 9. İNVİTE LOGLARI
    // =========================================================================
    client.on('inviteCreate', async (invite) => {
        const logChan = await logKanalGetir(invite.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setTitle('<:Discord_Link:1505166617426923661> Yeni İnvite Oluşturuldu!')
            .addFields(
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Oluşturan', value: `${invite.inviter || 'Bilinmiyor'}`, inline: true },
                { name: '<:Discord_Link:1505166617426923661> Kod', value: `\`${invite.code}\``, inline: true },
                { name: '<:change:1505202806666170501> Kanal', value: `${invite.channel}`, inline: true },
                { name: '⏳ Süre', value: `\`${invite.maxAge ? invite.maxAge + 's' : 'Sınırsız'}\``, inline: true },
                { name: '<:koruma1:1505143174190989352> Max Kullanım', value: `\`${invite.maxUses || 'Sınırsız'}\``, inline: true }
            )
            .setColor('#3498db').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('inviteDelete', async (invite) => {
        const logChan = await logKanalGetir(invite.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setTitle('<:Discord_Link:1505166617426923661> İnvite Silindi!')
            .addFields(
                { name: '<:sil:1505147967907037275> Kod', value: `\`${invite.code}\``, inline: true },
                { name: '<:change:1505202806666170501> Kanal', value: `${invite.channel}`, inline: true }
            )
            .setColor('#e74c3c').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    // =========================================================================
    // 🎯 10. EMOJİ & STİCKER LOGLARI
    // =========================================================================
    client.on('emojiCreate', async (emoji) => {
        const logChan = await logKanalGetir(emoji.guild.id);
        if (!logChan) return;
        const logEntry = await auditLogCek(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);
        const yapan = logEntry?.executor ? `${logEntry.executor}` : '`Bilinmiyor`';
        const embed = new EmbedBuilder()
            .setTitle('<:yeni:1505201065476362325> Yeni Emoji Eklendi!')
            .addFields(
                { name: '<:blurple_sticker:1505441457941512346> Emoji', value: `${emoji} \`(${emoji.id})\``, inline: true },
                { name: '<:Paper:1505146388596391977> İsim', value: `\`${emoji.name}\``, inline: true },
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Ekleyen', value: yapan, inline: true },
                { name: '<:riva_kilit:1505203119427162192> Animasyonlu mu?', value: `\`${emoji.animated}\``, inline: true }
            )
            .setColor('#2ecc71').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('emojiDelete', async (emoji) => {
        const logChan = await logKanalGetir(emoji.guild.id);
        if (!logChan) return;
        const logEntry = await auditLogCek(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);
        const yapan = logEntry?.executor ? `${logEntry.executor}` : '`Bilinmiyor`';
        const embed = new EmbedBuilder()
            .setTitle('<:sil:1505147967907037275> Emoji Silindi!')
            .addFields(
                { name: '<:Paper:1505146388596391977> Emoji İsmi', value: `\`${emoji.name}\` \`(${emoji.id})\``, inline: true },
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Silen', value: yapan, inline: true }
            )
            .setColor('#e74c3c').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('stickerCreate', async (sticker) => {
        const logChan = await logKanalGetir(sticker.guild.id);
        if (!logChan) return;
        const embed = new EmbedBuilder()
            .setTitle('<:blurple_sticker:1505441457941512346> Yeni Sticker Eklendi!')
            .addFields(
                { name: '<:Paper:1505146388596391977> İsim', value: `\`${sticker.name}\` \`(${sticker.id})\``, inline: true },
                { name: '<:change:1505202806666170501> Açıklama', value: `\`${sticker.description || 'Yok'}\``, inline: true }
            )
            .setThumbnail(sticker.url)
            .setColor('#2ecc71').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('stickerDelete', async (sticker) => {
        const logChan = await logKanalGetir(sticker.guild.id);
        if (!logChan) return;
        const embed = new EmbedBuilder()
            .setTitle('<:blurple_sticker:1505441457941512346> Sticker Silindi!')
            .addFields({ name: '<:sil:1505147967907037275> İsim', value: `\`${sticker.name}\` \`(${sticker.id})\`` })
            .setColor('#e74c3c').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    // =========================================================================
    // 🧵 11. THREAD LOGLARI (YENİ)
    // =========================================================================
    client.on('threadCreate', async (thread) => {
        const logChan = await logKanalGetir(thread.guild.id);
        if (!logChan) return;
        const embed = new EmbedBuilder()
            .setTitle('<:yeni:1505201065476362325> Yeni Thread Oluşturuldu!')
            .addFields(
                { name: '<:Discord_Link:1505166617426923661> Thread', value: `${thread} \`(${thread.id})\``, inline: true },
                { name: '<:change:1505202806666170501> Ana Kanal', value: `${thread.parent}`, inline: true }
            )
            .setColor('#2ecc71').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('threadDelete', async (thread) => {
        const logChan = await logKanalGetir(thread.guild.id);
        if (!logChan) return;
        const embed = new EmbedBuilder()
            .setTitle('<:sil:1505147967907037275> Thread Silindi!')
            .addFields(
                { name: '<:Paper:1505146388596391977> Thread Adı', value: `\`${thread.name}\``, inline: true },
                { name: '<:change:1505202806666170501> Ana Kanal', value: `${thread.parent || 'Bilinmiyor'}`, inline: true }
            )
            .setColor('#e74c3c').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    // =========================================================================
    // 📌 12. SABİTLENEN MESAJ LOGU (YENİ)
    // =========================================================================
    client.on('channelPinsUpdate', async (channel, time) => {
        if (!channel.guild) return;
        const logChan = await logKanalGetir(channel.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setTitle('📌 Sabitlenen Mesaj Güncellendi!')
            .addFields(
                { name: '<:Discord_Link:1505166617426923661> Kanal', value: `${channel}`, inline: true },
                { name: '<:change:1505202806666170501> Güncelleme', value: `<t:${Math.floor(time.getTime() / 1000)}:R>`, inline: true }
            )
            .setColor('#f39c12').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    // =========================================================================
    // 🤖 13. UYGULAMA KOMUTU LOGU (YENİ)
    // =========================================================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (!interaction.guild) return;
        const logChan = await logKanalGetir(interaction.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setDescription(`<a:acs_ayarlar:1505165015127162994> **/${interaction.commandName}** komutu kullanıldı | <:uzaybot_kullanicilar:1505146190973505567> ${interaction.user} | <:Discord_Link:1505166617426923661> ${interaction.channel}`)
            .setColor('#3498db')
            .setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });
};
