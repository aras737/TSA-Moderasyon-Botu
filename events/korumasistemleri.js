const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = (client) => {
    // Yardımcı Fonksiyon: Log kanalını çekme
    const logKanalGetir = (guildId) => {
        if (!fs.existsSync('./ayarlar/gelismisLog.json')) return null;
        const ayarlar = JSON.parse(fs.readFileSync('./ayarlar/gelismisLog.json', 'utf8'));
        return ayarlar[guildId] ? client.channels.cache.get(ayarlar[guildId]) : null;
    };

    // =========================================================================
    // 🤬 KORUMA 1: KÜFÜR VE LİNK ENGELLEME SİSTEMİ
    // =========================================================================
    const kufurler = ['amk', 'aq', 'piç', 'orospu', 'sik', 'yarrak', 'pezevenk', 'göt'];
    const linkRegex = /(https?:\/\/[^\s]+)/g;

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

        const icerik = message.content.toLowerCase();
        let tetiklendi = false;
        let sebep = '';

        if (kufurler.some(kufur => icerik.includes(kufur))) {
            tetiklendi = true;
            sebep = 'Küfürlü İçerik';
        }

        if (linkRegex.test(message.content)) {
            tetiklendi = true;
            sebep = 'Link / Reklam Paylaşımı';
        }

        if (tetiklendi) {
            try {
                await message.delete();
                const uyariMsg = await message.channel.send(`<a:uyari:1505166167189487757> ${message.author}, bu sunucuda **${sebep}** yasaktır kanka!`);
                setTimeout(() => uyariMsg.delete().catch(() => {}), 5000);
            } catch (err) {}
        }
    });

    // =========================================================================
    // 🚨 KORUMA 2: SLASH KOMUT DESTEKLİ PROFESYONEL GUARD MOTORU
    // =========================================================================
    const yetkiliHafizasi = new Map(); 

    const guardDenetim = async (guild, executorId, eylemTipi) => {
        if (!executorId || executorId === client.user.id) return; 
        if (executorId === guild.ownerId) return;  

        // Slash komut ayarını kontrol et kanka, açık değilse sistemi çalıştırma
        let guardAcikMi = false;
        if (fs.existsSync('./ayarlar/guardAyari.json')) {
            const gAyar = JSON.parse(fs.readFileSync('./ayarlar/guardAyari.json', 'utf8'));
            if (gAyar[guild.id] === true) guardAcikMi = true;
        }

        if (!guardAcikMi) return; // Komutla açılmadıysa işlem yapma kanka

        const simdi = Date.now();
        
        if (!yetkiliHafizasi.has(executorId)) {
            yetkiliHafizasi.set(executorId, []);
        }

        // ⏱️ 5 saniye filtresi
        const sonIslemler = yetkiliHafizasi.get(executorId).filter(zaman => simdi - zaman < 5000);
        sonIslemler.push(simdi);
        yetkiliHafizasi.set(executorId, sonIslemler);

        // 🎯 GUARD ALARMI: 5 saniyede 2. hasar verildiği an ANINDA MÜDAHALE
        if (sonIslemler.length >= 2) {
            try {
                // Saldırganı direkt sunucudan banla
                await guild.members.ban(executorId, { reason: `🚨 GUARD LOCKDOWN: Peş peşe şüpheli sağ-tık işlemleri (Abuse/Raid)!` });

                // @everyone rolünü kapat ve kanalları kilitle
                const everyoneRole = guild.roles.everyone;
                if (everyoneRole.permissions.has(PermissionFlagsBits.SendMessages)) {
                    await everyoneRole.setPermissions(everyoneRole.permissions.missing(PermissionFlagsBits.SendMessages), '🚨 GUARD LOCKDOWN: Sunucu Karantinaya Alındı!');
                }

                const logChan = logKanalGetir(guild.id);
                if (logChan) {
                    const embed = new EmbedBuilder()
                        .setTitle('<a:alarme:1505209430319300718> GUARD GÜVENLİK DUVARI TETİKLENDİ!')
                        .setDescription(`⚠️ Sunucuda acil durum! Bir yetkilinin peş peşe zarar verici işlemleri (**${eylemTipi}**) guard log hafızası tarafından yakalandı!\n\n🛡 *Uygulanan Önlemler:*\n• Şüpheli kullanıcı (\`${executorId}\`) **DİREKT BANLANDI!**\n• Sunucu güvenliği için tüm kanallar **OTOMATİK KİLİTLENDİ!**`)
                        .setColor('#960018')
                        .setTimestamp();
                    
                    logChan.send({ content: '@everyone <a:alarme:1505209430319300718> **SUNUCUYA YAPILAN ABUSE GÜVENLİK DUVARI TARAFINDAN ENGELLENDİ!**', embeds: [embed] }).catch(() => {});
                }
            } catch (err) {
                console.error('Guard müdahale hatası:', err);
            }
        }
    };

    // ─── 1. ROL SİLME TAKİBİ ───
    client.on('roleDelete', async (role) => {
        const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null);
        const logEntry = fetchedLogs?.entries.first();
        if (!logEntry) return;
        await guardDenetim(role.guild, logEntry.executorId, 'Rol Silme');
    });

    // ─── 2. KANAL SİLME TAKİBİ ───
    client.on('channelDelete', async (channel) => {
        if (!channel.guild) return;
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(() => null);
        const logEntry = fetchedLogs?.entries.first();
        if (!logEntry) return;
        await guardDenetim(channel.guild, logEntry.executorId, 'Kanal/Kategori Silme');
    });

    // ─── 3. SAĞ-TIK BANLAMA TAKİBİ ───
    client.on('guildBanAdd', async (ban) => {
        const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
        const logEntry = fetchedLogs?.entries.first();
        if (!logEntry) return;
        await guardDenetim(ban.guild, logEntry.executorId, 'Sağ-tık Üye Banlama');
    });
};
