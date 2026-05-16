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
    const kufurler = ['amk', 'aq', 'piç', 'orospu', 'sik', 'yarrak', 'pezevenk', 'göt']; // Burayı genişletebilirsin kanka
    const linkRegex = /(https?:\/\/[^\s]+)/g;

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // Yönetici yetkisi olanları engellemesin kanka rahat takılsınlar
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const icerik = message.content.toLowerCase();
        let tetiklendi = false;
        let sebep = '';

        // Küfür Kontrolü
        if (kufurler.some(kufur => icerik.includes(kufur))) {
            tetiklendi = true;
            sebep = 'Küfürlü İçerik';
        }

        // Link/Reklam Kontrolü
        if (linkRegex.test(message.content)) {
            tetiklendi = true;
            sebep = 'Link / Reklam Paylaşımı';
        }

        if (tetiklendi) {
            try {
                await message.delete();
                const uyariMsg = await message.channel.send(`<a:uyari:1505166167189487757> ${message.author}, bu sunucuda **${sebep}** yasaktır kanka!`);
                setTimeout(() => uyariMsg.delete().catch(() => {}), 5000); // Uyarıyı 5 saniye sonra siler

                // Log Kanalına Rapor Gönderme
                const logChan = logKanalGetir(message.guild.id);
                if (logChan) {
                    const embed = new EmbedBuilder()
                        .setTitle('<:koruma1:1505143174190989352> Koruma Sistemi: Mesaj Engellendi!')
                        .addFields(
                            { name: 'Üye', value: `${message.author} \`(${message.author.id})\``, inline: true },
                            { name: 'Kanal', value: `${message.channel}`, inline: true },
                            { name: 'Engellenme Sebebi', value: `\`${sebep}\`` },
                            { name: 'Silinen Mesaj', value: `\`\`\`${message.content}\`\`\`` }
                        )
                        .setColor('#e74c3c').setTimestamp();
                    logChan.send({ embeds: [embed] }).catch(() => {});
                }
            } catch (err) {
                console.error('Mesaj silme hatası:', err);
            }
        }
    });

    // =========================================================================
    // ⚡ KORUMA 3: ANTİ-RAİD / SAĞ-TIK KORUMASI (Rol Silme & Ban Koruması)
    // =========================================================================
    // Bir yetkili 10 saniye içinde birden fazla kritik işlem yaparsa patlatacağız
    const limits = new Map();

    const limitKontrol = async (guild, executorId, islemTipi) => {
        if (executorId === client.user.id) return false; // Botun kendisiyse geç

        const member = await guild.members.fetch(executorId).catch(() => null);
        if (!member || member.id === guild.ownerId) return false; // Sunucu sahibiyse geç

        const key = `${executorId}-${islemTipi}`;
        const simdi = Date.now();
        
        if (!limits.has(key)) {
            limits.set(key, [simdi]);
            return false;
        }

        const gecmis = limits.get(key).filter(zaman => simdi - zaman < 10000); // 10 saniyelik pencere
        gecmis.push(simdi);
        limits.set(key, gecmis);

        // 10 saniyede 3'ten fazla kritik işlem yaparsa alarm ver kanka!
        if (gecmis.length >= 3) {
            try {
                // Yetkilinin tüm rollerini elinden al (Yönetici yetkisini kırmak için)
                const alinacakRoller = member.roles.cache.filter(role => role.id !== guild.id && !role.managed);
                if (alinacakRoller.size > 0) {
                    await member.roles.remove(alinacakRoller, 'Anti-Raid: Şüpheli Sağ-tık Aktivitesi!');
                }

                const logChan = logKanalGetir(guild.id);
                if (logChan) {
                    const embed = new EmbedBuilder()
                        .setTitle('<a:alarme:1505209430319300718> ACİL DURUM: Sunucu Saldırı Altında Olabilir!')
                        .setDescription(`**Yetkili:** <@${executorId}> \`(${executorId})\` kısa süre içinde çok fazla sağ-tık işlemi (**${islemTipi}**) gerçekleştirdi!\n\n<:koruma1:1505143174190989352> **Alınan Önlem:** Kullanıcının tüm rolleri elinden alındı ve yetkileri sıfırlandı.`)
                        .setColor('#960018').setTimestamp();
                    logChan.send({ content: '@everyone <a:alarme:1505209430319300718> Güvenlik İhlali!', embeds: [embed] }).catch(() => {});
                }
                return true;
            } catch (err) {
                console.error('Anti-raid müdahale hatası:', err);
            }
        }
        return false;
    };

    // Sağ-tık Rol Silme Takibi
    client.on('roleDelete', async (role) => {
        const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null);
        if (!fetchedLogs) return;
        const logEntry = fetchedLogs.entries.first();
        if (!logEntry) return;

        await limitKontrol(role.guild, logEntry.executorId, 'Rol Silme');
    });

    // Sağ-tık Üye Banlama Takibi
    client.on('guildBanAdd', async (ban) => {
        const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
        if (!fetchedLogs) return;
        const logEntry = fetchedLogs.entries.first();
        if (!logEntry) return;

        await limitKontrol(ban.guild, logEntry.executorId, 'Sağ-tık Banlama');
    });
};
