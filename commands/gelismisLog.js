const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const fs = require('fs');

module.exports = (client) => {
    // Yardımcı Fonksiyon: Kanala güvenli veri gönderme ve kontrolü
    const logKanalGetir = (guildId) => {
        if (!fs.existsSync('./ayarlar/gelismisLog.json')) return null;
        const ayarlar = JSON.parse(fs.readFileSync('./ayarlar/gelismisLog.json', 'utf8'));
        return ayarlar[guildId] ? client.channels.cache.get(ayarlar[guildId]) : null;
    };

    // =========================================================================
    // 💬 1. MESAJ LOGLARI (Düzenleme ve Silme)
    // =========================================================================
    client.on('messageDelete', async (message) => {
        if (message.partial || message.author?.bot) return;
        const logChan = logKanalGetir(message.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Bir Mesaj Silindi!')
            .addFields(
                { name: 'Yazan Üye', value: `${message.author} \`(${message.author.id})\``, inline: true },
                { name: 'Kanal', value: `${message.channel}`, inline: true },
                { name: 'Silinen İçerik', value: message.content ? `\`\`\`${message.content}\`\`\`` : '*İçerik boş veya görsel.*' }
            )
            .setColor('#e74c3c').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (oldMessage.partial || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
        const logChan = logKanalGetir(oldMessage.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setTitle('📝 Bir Mesaj Düzenlendi!')
            .addFields(
                { name: 'Yazan Üye', value: `${oldMessage.author}`, inline: true },
                { name: 'Kanal', value: `${oldMessage.channel}`, inline: true },
                { name: 'Eski İçerik', value: `\`\`\`${oldMessage.content || 'Boş'}\`\`\`` },
                { name: 'Yeni İçerik', value: `\`\`\`${newMessage.content || 'Boş'}\`\`\`` }
            )
            .setColor('#f39c12').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    // =========================================================================
    // 📁 2. KANAL LOGLARI (Oluşturma, Silme, Güncelleme)
    // =========================================================================
    client.on('channelCreate', async (channel) => {
        if (!channel.guild) return;
        const logChan = logKanalGetir(channel.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setTitle('🆕 Yeni Kanal Oluşturuldu!')
            .setDescription(`**Kanal Adı:** ${channel.name}\n**Kanal Türü:** \`${channel.type}\` (${channel})`)
            .setColor('#2ecc71').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('channelDelete', async (channel) => {
        if (!channel.guild) return;
        const logChan = logKanalGetir(channel.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setTitle('❌ Bir Kanal Silindi!')
            .setDescription(`**Silinen Kanal:** \`${channel.name}\` (Tür ID: ${channel.type})`)
            .setColor('#c0392b').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    // =========================================================================
    // 👑 3. ROL LOGLARI (Oluşturma, Silme, Üyeye Rol Ekleme/Çıkarma)
    // =========================================================================
    client.on('roleCreate', async (role) => {
        const logChan = logKanalGetir(role.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setTitle('🎨 Yeni Rol Oluşturuldu!')
            .setDescription(`**Rol:** ${role} \`(${role.id})\``)
            .setColor('#3498db').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('roleDelete', async (role) => {
        const logChan = logKanalGetir(role.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setTitle('🔥 Bir Rol Silindi!')
            .setDescription(`**Silinen Rol Adı:** \`${role.name}\` \`(${role.id})\``)
            .setColor('#9b59b6').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        const logChan = logKanalGetir(newMember.guild.id);
        if (!logChan) return;

        // Rol değişikliklerini izleme kısmı kanka
        if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Üye Rol Güncellemesi!')
                .setDescription(`👤 **Üye:** ${newMember.user} \`(${newMember.user.tag})\``)
                .setColor('#34495e').setTimestamp();

            // Rol mi verildi rol mü alındı kontrolü
            const verilenRoller = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
            const alinanRoller = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

            if (verilenRoller.size > 0) {
                embed.addFields({ name: '🟢 Verilen Rol(ler)', value: verilenRoller.map(r => `${r}`).join(', ') });
            }
            if (alinanRoller.size > 0) {
                embed.addFields({ name: '🔴 Alınan Rol(ler)', value: alinanRoller.map(r => `${r}`).join(', ') });
            }
            logChan.send({ embeds: [embed] }).catch(() => {});
        }

        // --- TIMEOUT (MUTE) LOGLARI ---
        const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
        const newTimeout = newMember.communicationDisabledUntilTimestamp;

        if (!oldTimeout && newTimeout) {
            const embed = new EmbedBuilder()
                .setTitle('🔇 Bir Üye Susturuldu! (Timeout)')
                .setDescription(`👤 **Susturulan:** ${newMember.user}\n⏳ **Ceza Bitiş:** <t:${Math.round(newTimeout / 1000)}:R>`)
                .setColor('#f1c40f').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        } else if (oldTimeout && !newTimeout) {
            const embed = new EmbedBuilder()
                .setTitle('🔊 Susturulma Kaldırıldı!')
                .setDescription(`👤 **Üye:** ${newMember.user} ceza süresi bitti veya el ile kaldırıldı kanka.`)
                .setColor('#2ecc71').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }
    });

    // =========================================================================
    // 🔊 4. SES ODALARI LOGLARI (Giriş, Çıkış, Oda Değiştirme)
    // =========================================================================
    client.on('voiceStateUpdate', async (oldState, newState) => {
        const logChan = logKanalGetir(newState.guild.id);
        if (!logChan) return;

        const üye = newState.member.user;

        if (!oldState.channelId && newState.channelId) {
            // Sese giriş yaptı kanka
            const embed = new EmbedBuilder()
                .setTitle('📥 Ses Kanalına Giriş Yapıldı!')
                .setDescription(`👤 ${üye} -> ${newState.channel} odasına giriş yaptı.`)
                .setColor('#1abc9c').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        } else if (oldState.channelId && !newState.channelId) {
            // Sesten tamamen çıktı kanka
            const embed = new EmbedBuilder()
                .setTitle('📤 Ses Kanalından Çıkış Yapıldı!')
                .setDescription(`👤 ${üye} -> \`${oldState.channel.name}\` odasından ayrıldı.`)
                .setColor('#95a5a6').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            // Oda değiştirdi kanka
            const embed = new EmbedBuilder()
                .setTitle('🔀 Ses Kanalı Değiştirildi!')
                .setDescription(`👤 ${üye}\n**Eski Oda:** \`${oldState.channel.name}\`\n**Yeni Oda:** ${newState.channel}`)
                .setColor('#3498db').setTimestamp();
            logChan.send({ embeds: [embed] }).catch(() => {});
        }
    });

    // =========================================================================
    // 🔨 5. CEZA LOGLARI (Ban Atılması ve Ban Kaldırılması)
    // =========================================================================
    client.on('guildBanAdd', async (ban) => {
        const logChan = logKanalGetir(ban.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setTitle('🔨 Sunucudan Biri Yasaklandı! (Ban)')
            .setDescription(`👤 **Yasaklanan:** **${ban.user.tag}** \`(${ban.user.id})\`\n📄 **Sebep:** *${ban.reason || 'Belirtilmemiş.'}*`)
            .setThumbnail(ban.user.displayAvatarURL())
            .setColor('#960018').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('guildBanRemove', async (ban) => {
        const logChan = logKanalGetir(ban.guild.id);
        if (!logChan) return;

        const embed = new EmbedBuilder()
            .setTitle('🔓 Sunucudan Ban Kaldırıldı!')
            .setDescription(`👤 **Banı Kaldırılan:** **${ban.user.tag}** \`(${ban.user.id})\``)
            .setThumbnail(ban.user.displayAvatarURL())
            .setColor('#27ae60').setTimestamp();
        logChan.send({ embeds: [embed] }).catch(() => {});
    });
};
