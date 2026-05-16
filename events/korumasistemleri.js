const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Kalıcı yerel veritabanı dosyalarının yolları
const HAFIZA_YOLU = path.join(__dirname, '../ayarlar/guardHafiza.json');
const LOG_YOLU = path.join(__dirname, '../ayarlar/gelismisLog.json');

module.exports = (client) => {
    // Yardımcı Fonksiyon: Log kanalını çekme
    const logKanalGetir = (guildId) => {
        if (!fs.existsSync(LOG_YOLU)) return null;
        const ayarlar = JSON.parse(fs.readFileSync(LOG_YOLU, 'utf8'));
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
        if (kufurler.some(kufur => icerik.includes(kufur)) || linkRegex.test(message.content)) {
            try { await message.delete(); } catch (err) {}
        }
    });

    // =========================================================================
    // 🚨 KORUMA 2: %100 OTOMATİK VERİTABANI DESTEKLİ GUARD MOTORU (KOMUTSUZ)
    // =========================================================================
    const otomatikGuardKontrol = async (guild, executorId, eylem) => {
        // Botun kendisiyse veya sunucu sahibiyse koruma tetiklenmesin kanka
        if (!executorId || executorId === client.user.id || executorId === guild.ownerId) return;

        const simdi = Date.now();

        // Ayarlar klasörü yoksa otomatik oluştur kanka
        if (!fs.existsSync(path.dirname(HAFIZA_YOLU))) {
            fs.mkdirSync(path.dirname(HAFIZA_YOLU), { recursive: true });
        }

        // Hafıza veritabanı dosyasını oku, yoksa boş obje başlat
        let hafiza = {};
        if (fs.existsSync(HAFIZA_YOLU)) {
            try {
                hafiza = JSON.parse(fs.readFileSync(HAFIZA_YOLU, 'utf8'));
            } catch (e) {
                hafiza = {};
            }
        }

        // Saldırganın daha önceki kayıtları yoksa dizi oluştur
        if (!hafiza[executorId]) hafiza[executorId] = [];

        // ⏱️ 5 Saniyelik Güvenlik Filtresi: Son 5 saniyede yapılan işlemleri çek
        const islemler = hafiza[executorId].filter(zaman => simdi - zaman < 5000);
        islemler.push(simdi);
        
        // Güncel listeyi anlık olarak JSON veritabanına yaz (Restart koruması)
        hafiza[executorId] = islemler;
        fs.writeFileSync(HAFIZA_YOLU, JSON.stringify(hafiza, null, 2));

        // 🎯 TEHLİKE LİMİTİ: 5 saniye içinde 2. şüpheli işlem yapıldığı an (Bot kapansa bile kaybolmaz) ANINDA BAN!
        if (islemler.length >= 2) {
            try {
                // Saldırganı (yetkiliyi) rekor sürede sunucudan BANLA kanka
                await guild.members.ban(executorId, { reason: `🚨 OTOMATİK GUARD: Saniyeler içinde peş peşe sunucuya zarar verme teşebbüsü! (${eylem})` });

                // Diğer sızan botlar veya hesaplar korumayı aşamasın diye @everyone rolünün konuşmasını anında kapat
                const everyoneRole = guild.roles.everyone;
                if (everyoneRole.permissions.has(PermissionFlagsBits.SendMessages)) {
                    await everyoneRole.setPermissions(everyoneRole.permissions.missing(PermissionFlagsBits.SendMessages), '🚨 OTOMATİK GUARD KARANTİNASI');
                }

                // Banlanan hainin verisini veritabanından temizle
                delete hafiza[executorId];
                fs.writeFileSync(HAFIZA_YOLU, JSON.stringify(hafiza, null, 2));

                // Gelişmiş log kanalına bombayı bırak
                const logChan = logKanalGetir(guild.id);
                if (logChan) {
                    const embed = new EmbedBuilder()
                        .setTitle('<a:alarme:1505209430319300718> OTOMATİK GUARD SUNUCUYU PATLAMAKTAN KURTARDI!')
                        .setDescription(`⚠️ **Saldırgan Yetkili ID:** \`${executorId}\`\n**Yıkım Eylemi:** Kalıcı veritabanında peş peşe **${eylem}** tespiti!\n\n🛡️ **Alınan Önlemler:**\n• Bot restart yese bile hafızası silinmeyen hain **ANINDA BANLANDI!**\n• Sunucu güvenliği için tüm kanallar yazmaya **OTOMATİK KİLİTLENDİ!**`)
                        .setColor('#960018').setTimestamp();
                    
                    logChan.send({ content: '@everyone 🚨 **SUNUCUYA YAPILAN SALDIRI VERİTABANI DESTEKLİ OTOMATİK GUARD TARAFINDAN ENGELLENDİ!**', embeds: [embed] }).catch(() => {});
                }
            } catch (err) {
                console.error('Otomatik guard banlama hatası:', err);
            }
        }
    };

    // ─── 1. Sağ-Tık Rol Silindiğinde Tetiklenir ───
    client.on('roleDelete', async (role) => {
        const logs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null);
        const entry = logs?.entries.first();
        if (entry) await otomatikGuardKontrol(role.guild, entry.executorId, 'Rol Silme');
    });

    // ─── 2. Sağ-Tık Kanal/Kategori Silindiğinde Tetiklenir ───
    client.on('channelDelete', async (channel) => {
        if (!channel.guild) return;
        const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(() => null);
        const entry = logs?.entries.first();
        if (entry) await otomatikGuardKontrol(channel.guild, entry.executorId, 'Kanal/Kategori Silme');
    });

    // ─── 3. Sağ-Tık Bir Yetkili Başkasını Banladığında Tetiklenir ───
    client.on('guildBanAdd', async (ban) => {
        const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
        const entry = logs?.entries.first();
        if (entry) await otomatikGuardKontrol(ban.guild, entry.executorId, 'Sağ-tık Üye Banlama');
    });
};
