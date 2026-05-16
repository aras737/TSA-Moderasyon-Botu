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
        if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

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
    // 🚨 KORUMA 3: ULTRA ANTİ-RAİD / ANINDA BANLAMA SİSTEMİ (Geliştirildi)
    // =========================================================================
    const limits = new Map();

    const acilMudahele = async (guild, executorId, islemTipi) => {
        if (executorId === client.user.id) return; // Botun kendisiyse es geç
        if (executorId === guild.ownerId) return;  // Sunucu sahibiyse es geç

        const key = `${executorId}-${islemTipi}`;
        const simdi = Date.now();

        if (!limits.has(key)) {
            limits.set(key, [simdi]);
            return;
        }

        // Güvenlik duvarını daralttık: 5 saniye içindeki işlemleri sayıyoruz kanka
        const gecmis = limits.get(key).filter(zaman => simdi - zaman < 5000);
        gecmis.push(simdi);
        limits.set(key, gecmis);

        // 5 saniye içinde 3 veya daha fazla kritik işlem algılanırsa ACIMAK YOK, ANINDA BAN!
        if (gecmis.length >= 3) {
            try {
                // Zaman kaybettiren rol silme aşamasını atlayıp, saldırganı kökten BANLIYORUZ!
                await guild.members.ban(executorId, { reason: `🚨 Anti-Raid: Üst üste çok hızlı ${islemTipi} işlemi yapıldı!` });

                const logChan = logKanalGetir(guild.id);
                if (logChan) {
                    const embed = new EmbedBuilder()
                        .setTitle('<a:alarme:1505209430319300718> REKOR HIZDA MÜDAHALE: Sunucu Korundu!')
                        .setDescription(`**Saldırgan Yetkili ID:** \`${executorId}\`\n**Gerçekleştirdiği Eylem:** 5 saniye içinde birden fazla **${islemTipi}**!\n\n<:koruma1:1505143174190989352> **Alınan Önlem:** Kullanıcı daha fazla zarar veremeden **DİREKT SUNUCUDAN BANLANDI!**`)
                        .setColor('#960018').setTimestamp();
                    logChan.send({ content: '@everyone <a:alarme:1505209430319300718> Sunucuya yapılan saldırı engellendi ve saldırgan banlandı!', embeds: [embed] }).catch(() => {});
                }
            } catch (err) {
                console.error('Anında anti-raid banlama hatası:', err);
            }
        }
    };

    // 1. Sağ-tık Rol Silme Takibi
    client.on('roleDelete', async (role) => {
        const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null);
        if (!fetchedLogs) return;
        const logEntry = fetchedLogs.entries.first();
        if (!logEntry) return;

        await acilMudahele(role.guild, logEntry.executorId, 'Rol Silme');
    });

    // 2. Sağ-tık Kanal/Kategori Silme Takibi (Bunu da ekledim, kanalları uçuramasınlar kanka)
    client.on('channelDelete', async (channel) => {
        if (!channel.guild) return;
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(() => null);
        if (!fetchedLogs) return;
        const logEntry = fetchedLogs.entries.first();
        if (!logEntry) return;

        await acilMudahele(channel.guild, logEntry.executorId, 'Kanal/Kategori Silme');
    });

    // 3. Sağ-tık Üye Banlama Takibi (Yetkili önüne geleni sağ tıkla banlıyorsa)
    client.on('guildBanAdd', async (ban) => {
        const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
        if (!fetchedLogs) return;
        const logEntry = fetchedLogs.entries.first();
        if (!logEntry) return;

        await acilMudahele(ban.guild, logEntry.executorId, 'Sağ-tık Banlama');
    });
};
