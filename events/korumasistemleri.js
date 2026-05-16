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

        // Yönetici yetkisi olanları engellemesin kanka rahat takılsınlar
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
    // 🚨 KORUMA 2: GLOBAL YAPAY SENSÖRLÜ ANTİ-RAİD & OTO-KARANTİNA (EN İYİSİ)
    // =========================================================================
    const globalSayac = new Map(); 

    const otomatikDefans = async (guild, executorId, islemTipi) => {
        if (executorId === client.user.id) return; // Bot kendi yaptıysa geç
        if (executorId === guild.ownerId) return;  // Sunucu sahibiyse geç

        const simdi = Date.now();
        const guildId = guild.id;

        if (!globalSayac.has(guildId)) {
            globalSayac.set(guildId, []);
        }

        // ⏱️ Zaman filtresi: Son 4 saniye içindeki TÜM yıkıcı sağ-tık hareketlerini topluyoruz kanka
        const gecmisIslemler = globalSayac.get(guildId).filter(zaman => simdi - zaman < 4000);
        gecmisIslemler.push(simdi);
        globalSayac.set(guildId, gecmisIslemler);

        // 🔥 ANORMALLİK KRİTERİ: 4 saniye içinde sunucuda 2 veya daha fazla yıkım (rol/kanal/ban) olursa alarm!
        if (gecmisIslemler.length >= 2) {
            try {
                // 1. ÖNLEM: Saldırganı (kim olursa olsun) rekor sürede SUNUCUDAN BANLA kanka!
                await guild.members.ban(executorId, { reason: `🚨 YAPAY SENSÖR: Saniyeler içinde peş peşe sunucuyu patlatma teşebbüsü!` });

                // 2. ÖNLEM: Sunucuya sızmış başka botlar/hesaplar varsa diye @everyone rolünün konuşma iznini anında KİLİTLE!
                const everyoneRole = guild.roles.everyone;
                if (everyoneRole.permissions.has(PermissionFlagsBits.SendMessages)) {
                    await everyoneRole.setPermissions(everyoneRole.permissions.missing(PermissionFlagsBits.SendMessages), '🚨 OTO-KARANTİNA: Sunucu Saldırı Altında!');
                }

                // 3. ÖNLEM: Gelişmiş Log Kanalına anında raporu fırlatıp @everyone duyurusu geç
                const logChan = logKanalGetir(guildId);
                if (logChan) {
                    const embed = new EmbedBuilder()
                        .setTitle('<a:alarme:1505209430319300718> OTO-DEFANS SİSTEMİ SUNUCUYU KURTARDI!')
                        .setDescription(`⚠️ Sunucuda saniyeler içinde peş peşe şüpheli eylemler (**${islemTipi}**) algılandı ve yapay zeka sensörü tetiklendi!\n\n🛡️ **Uygulanan Acil Müdahaleler:**\n• Saldırıyı başlatan yetkili (\`${executorId}\`) **DİREKT SUNUCUDAN BANLANDI!**\n• İkinci bir emre kadar sunucudaki tüm kanallar yazmaya **OTOMATİK KİLİTLENDİ!**`)
                        .setColor('#960018')
                        .setTimestamp();
                    
                    logChan.send({ content: '@everyone <a:alarme:1505209430319300718> **SUNUCUYA YAPILAN ABUSE/RAID SALDIRISI ENGELLENDİ VE KAPILAR KİLİTLENDİ!**', embeds: [embed] }).catch(() => {});
                }
            } catch (err) {
                console.error('Otomatik defans sistemi hatası:', err);
            }
        }
    };

    // 1. Sağ-tık Rol Silme Takibi
    client.on('roleDelete', async (role) => {
        const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null);
        if (!fetchedLogs) return;
        const logEntry = fetchedLogs.entries.first();
        if (!logEntry) return;

        await otomatikDefans(role.guild, logEntry.executorId, 'Rol Silme');
    });

    // 2. Sağ-tık Kanal/Kategori Silme Takibi
    client.on('channelDelete', async (channel) => {
        if (!channel.guild) return;
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(() => null);
        if (!fetchedLogs) return;
        const logEntry = fetchedLogs.entries.first();
        if (!logEntry) return;

        await otomatikDefans(channel.guild, logEntry.executorId, 'Kanal/Kategori Silme');
    });

    // 3. Sağ-tık Üye Banlama Takibi
    client.on('guildBanAdd', async (ban) => {
        const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
        if (!fetchedLogs) return;
        const logEntry = fetchedLogs.entries.first();
        if (!logEntry) return;

        await otomatikDefans(ban.guild, logEntry.executorId, 'Sağ-tık Üye Banlama');
    });
};
