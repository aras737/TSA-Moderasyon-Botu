const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { ayarGetir, ayarKaydet } = require('../utils/db');
const { yedekAl, yedektenGeriYukle } = require('../services/sunucuYedek');

module.exports = client => {
    const userActions = new Map();
    const activeGuilds = new Set();
    const suspectGuildUntil = new Map();
    const consumedAuditEntries = new Map();

    const YEDEK_ARALIGI_MS = 60 * 1000;
    const WINDOW_MS = 1000;
    const THRESHOLD = 5;
    const GUILD_COOLDOWN_MS = 15000;
    const SUSPECT_BACKUP_PAUSE_MS = 30000;

    let backupRunActive = false;

    async function tumSunuculariYedekle() {
        if (backupRunActive) return;
        backupRunActive = true;
        try {
        for (const guild of client.guilds.cache.values()) {
            // Guard kapalı sunucular için sürekli yedek almak hem gereksiz API
            // çağrısı hem de komut yanıtlarını geciktiren disk yazımı oluşturur.
            if (ayarGetir(guild.id, 'guardAktif', false) !== true) continue;
            const now = Date.now();
            const suspectUntil = suspectGuildUntil.get(guild.id) || 0;

            if (
                activeGuilds.has(guild.id) ||
                ayarGetir(guild.id, 'guardYedekBloke', false) === true ||
                suspectUntil > now
            ) continue;

            const backup = await yedekAl(guild, {
                shouldAbort: () => activeGuilds.has(guild.id) ||
                    ayarGetir(guild.id, 'guardYedekBloke', false) === true ||
                    (suspectGuildUntil.get(guild.id) || 0) > Date.now()
            });
            if (backup) {
                console.log(
                    '[GUARD] ' + guild.name + ': otomatik sunucu yedeği alındı (' +
                    backup.roller.length + ' rol, ' + backup.kanallar.length + ' kanal).'
                );
            }
        }
        } finally {
            backupRunActive = false;
        }
    }

    client.once('clientReady', () => {
        tumSunuculariYedekle().catch(error =>
            console.error('[GUARD] İlk yedekleme başlatılamadı:', error)
        );
    });

    const backupInterval = setInterval(() => {
        tumSunuculariYedekle().catch(error =>
            console.error('[GUARD] Otomatik yedekleme hatası:', error)
        );
    }, YEDEK_ARALIGI_MS);
    backupInterval.unref?.();

    const cleanupInterval = setInterval(() => {
        const now = Date.now();

        for (const [key, timestamps] of userActions.entries()) {
            const active = timestamps.filter(timestamp => now - timestamp < WINDOW_MS);
            if (active.length) userActions.set(key, active);
            else userActions.delete(key);
        }

        for (const [guildId, until] of suspectGuildUntil.entries()) {
            if (until <= now) suspectGuildUntil.delete(guildId);
        }
        for (const [entryId, timestamp] of consumedAuditEntries.entries()) {
            if (now - timestamp > 60000) consumedAuditEntries.delete(entryId);
        }
    }, 10000);
    cleanupInterval.unref?.();

    function yoneticiRolleriniBul(guild) {
        return guild.roles.cache.filter(role =>
            role.id !== guild.id &&
            !role.managed &&
            role.permissions.has(PermissionFlagsBits.Administrator)
        );
    }

    async function sendGuardLog(guild, executorId, eylem, count, status, restoreResult = null) {
        const warnings = restoreResult?.warnings?.length
            ? '\n**Uyarılar:**\n' + restoreResult.warnings.slice(0, 5).map(item => '• ' + item).join('\n')
            : '';

        const embed = new EmbedBuilder()
            .setTitle('🚨 TMF | GUARD MÜDAHALESİ')
            .setDescription(
                '**Saldırgan:** `' + executorId + '`\n' +
                '**İşlem:** ' + count + ' kez ' + eylem + '\n' +
                '**Son güvenli yedek:** ' + (restoreResult?.alinmaZamani || 'Kullanılamadı') + '\n' +
                '**Geri yükleme:** ' + status + warnings
            )
            .setColor('#960018')
            .setTimestamp();

        const logId = ayarGetir(guild.id, 'logKanal', null);
        const botMember = guild.members.me;

        if (logId) {
            const log = await client.channels.fetch(logId).catch(() => null);
            if (
                log?.isTextBased?.() &&
                botMember &&
                log.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages)
            ) {
                const adminRoles = yoneticiRolleriniBul(guild);
                const mentions = adminRoles.map(role => role.id);
                await log.send({
                    content: mentions.length ? adminRoles.map(role => role.toString()).join(' ') : undefined,
                    embeds: [embed],
                    allowedMentions: { roles: mentions }
                }).catch(error => console.error('[GUARD] Log gönderilemedi:', error.message));
            }
        }

        // Sunucu sahibi DM'i yanında, BOT_OWNER_ID ayarlıysa geliştiriciye de rapor ilet.
        const serverOwner = await guild.fetchOwner().catch(() => null);
        if (serverOwner) {
            await serverOwner.send({ embeds: [embed] }).catch(error => {
                console.warn('[GUARD] Sunucu sahibine DM gönderilemedi:', error.message);
            });
        }

        const botOwnerId = (process.env.BOT_OWNER_ID || '1389930042200559706').trim();
        if (/^\d{17,20}$/.test(botOwnerId) &&
            botOwnerId !== serverOwner?.id &&
            botOwnerId !== client.user.id) {
            const botOwner = await client.users.fetch(botOwnerId).catch(error => {
                console.error('[GUARD] BOT_OWNER_ID kullanıcısı bulunamadı:', error.message);
                return null;
            });
            if (botOwner) {
                await botOwner.send({
                    content: '🚨 TMF botunun bulunduğu bir sunucuda Anti-Raid müdahalesi gerçekleşti.',
                    embeds: [embed]
                }).catch(error => {
                    console.warn('[GUARD] Bot sahibine DM gönderilemedi:', error.message);
                });
            }
        } else if (!botOwnerId) {
            console.warn('[GUARD] BOT_OWNER_ID ayarlı değil; bot geliştiricisine DM raporu gönderilmedi.');
        } else if (!/^\d{17,20}$/.test(botOwnerId)) {
            console.error('[GUARD] BOT_OWNER_ID geçersiz; Discord kullanıcı ID olmalı.');
        }
    }

    async function removeAttacker(guild, executorId) {
        if (executorId === guild.ownerId || executorId === client.user.id) {
            return 'Sunucu sahibi veya bot olduğu için otomatik uzaklaştırma uygulanmadı.';
        }

        const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
        if (!botMember) return 'Bot üyelik bilgisi alınamadığı için saldırgan uzaklaştırılamadı.';

        const targetMember = await guild.members.fetch(executorId).catch(() => null);

        if (targetMember && botMember.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) {
            return 'Saldırganın rolü botun rolüne eşit/yüksek. Discord rol hiyerarşisi nedeniyle uzaklaştırılamadı.';
        }

        if (botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
            try {
                await guild.members.ban(executorId, {
                    reason: 'TMF Anti-Raid: ' + THRESHOLD + ' veya daha fazla korunan işlem / ' + WINDOW_MS + ' ms'
                });
                return 'Saldırgan sunucudan yasaklandı.';
            } catch (error) {
                console.error('[GUARD] Ban başarısız:', error.message);
            }
        }

        if (targetMember?.kickable && botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
            try {
                await targetMember.kick('TMF Anti-Raid: şüpheli toplu sunucu işlemi');
                return 'Ban başarısız olduğu için saldırgan sunucudan atıldı (kick).';
            } catch (error) {
                console.error('[GUARD] Kick başarısız:', error.message);
                return 'Ban/kick başarısız: ' + error.message;
            }
        }

        return 'Saldırgan tespit edildi ancak botta yeterli Ban/Kick izni veya rol üstünlüğü yok.';
    }

    async function lockdown(guild, executorId, eylem, count) {
        if (activeGuilds.has(guild.id)) return;
        activeGuilds.add(guild.id);
        ayarKaydet(guild.id, 'guardYedekBloke', true);

        let removalStatus = 'Uzaklaştırma denenmedi.';
        let restoreResult = null;
        let restoreStatus = 'Geri yükleme başlatılamadı.';

        try {
            removalStatus = await removeAttacker(guild, executorId);

            restoreResult = await yedektenGeriYukle(
                guild,
                'TMF Anti-Raid: ' + eylem + ' sonrası otomatik geri yükleme'
            ).catch(error => {
                console.error('[GUARD] Geri yükleme başarısız:', error);
                return {
                    calisti: false,
                    hata: error.message,
                    roller: 0,
                    kanallar: 0,
                    warnings: []
                };
            });

            if (!restoreResult?.calisti) {
                restoreStatus = 'Başarısız: ' + (restoreResult?.hata || 'bilinmeyen hata');
            } else {
                restoreStatus =
                    restoreResult.roller + ' rol ve ' + restoreResult.kanallar +
                    ' kanal yeniden oluşturuldu; ' +
                    (restoreResult.silinenRoller || 0) + ' yeni rol ve ' +
                    (restoreResult.silinenKanallar || 0) + ' yeni kanal temizlendi.';

                if (restoreResult.warnings?.length) {
                    restoreStatus += ' ' + restoreResult.warnings.length +
                        ' uyarı oluştu; güvenli yedek üzerine yazılmadı.';
                } else {
                    const freshBackup = await yedekAl(guild);
                    if (freshBackup) {
                        ayarKaydet(guild.id, 'guardYedekBloke', false);
                        restoreStatus += ' Yeni temiz yedek kaydedildi.';
                    } else {
                        restoreStatus += ' Yeni yedek kaydedilemedi; önceki yedek korundu.';
                    }
                }
            }
        } catch (error) {
            restoreStatus = 'Kurtarma sırasında hata: ' + error.message;
            console.error('[GUARD] Müdahale hatası:', error);
        } finally {
            const status = removalStatus + '\n' + restoreStatus;
            await sendGuardLog(guild, executorId, eylem, count, status, restoreResult);

            setTimeout(() => {
                activeGuilds.delete(guild.id);
            }, GUILD_COOLDOWN_MS).unref?.();
        }
    }

    async function guardKontrol(guild, executorId, eylem, actionWeight = 1) {
        if (!executorId || executorId === client.user.id || executorId === guild.ownerId) return;
        if (ayarGetir(guild.id, 'guardAktif', false) !== true) return;
        if (activeGuilds.has(guild.id)) return;

        const now = Date.now();
        suspectGuildUntil.set(guild.id, now + SUSPECT_BACKUP_PAUSE_MS);

        const key = guild.id + ':' + executorId;
        const actions = (userActions.get(key) || []).filter(timestamp => now - timestamp < WINDOW_MS);
        const weight = Math.max(1, Math.min(THRESHOLD, Number(actionWeight) || 1));
        for (let i = 0; i < weight; i++) actions.push(now);
        userActions.set(key, actions);

        if (actions.length >= THRESHOLD) {
            userActions.delete(key);
            await lockdown(guild, executorId, eylem, actions.length);
        }
    }

    const GUARD_ACTION_LABELS = new Map([
        [AuditLogEvent.ChannelDelete, 'Kanal silme'],
        [AuditLogEvent.ChannelCreate, 'Kanal oluşturma'],
        [AuditLogEvent.ChannelUpdate, 'Kanal düzenleme'],
        [AuditLogEvent.ChannelOverwriteCreate, 'Kanal izni oluşturma'],
        [AuditLogEvent.ChannelOverwriteUpdate, 'Kanal izni değiştirme'],
        [AuditLogEvent.ChannelOverwriteDelete, 'Kanal izni silme'],
        [AuditLogEvent.ChannelPositionUpdate, 'Kanal sırası değiştirme'],
        [AuditLogEvent.RoleDelete, 'Rol silme'],
        [AuditLogEvent.RoleCreate, 'Rol oluşturma'],
        [AuditLogEvent.RoleUpdate, 'Rol/izin düzenleme'],
        [AuditLogEvent.RolePositionUpdate, 'Rol sırası değiştirme'],
        [AuditLogEvent.MemberBanAdd, 'Üye banlama'],
        [AuditLogEvent.MemberKick, 'Üye atma'],
        [AuditLogEvent.MemberPrune, 'Toplu üye temizleme'],
        [AuditLogEvent.MemberRoleUpdate, 'Üye rol değiştirme'],
        [AuditLogEvent.WebhookCreate, 'Webhook oluşturma'],
        [AuditLogEvent.WebhookUpdate, 'Webhook düzenleme'],
        [AuditLogEvent.WebhookDelete, 'Webhook silme'],
        [AuditLogEvent.GuildUpdate, 'Sunucu ayarı değiştirme'],
        [AuditLogEvent.EmojiDelete, 'Emoji silme'],
        [AuditLogEvent.StickerDelete, 'Çıkartma silme'],
        [AuditLogEvent.MessageBulkDelete, 'Toplu mesaj silme'],
        [AuditLogEvent.AutoModerationRuleCreate, 'Otomatik moderasyon kuralı oluşturma'],
        [AuditLogEvent.AutoModerationRuleUpdate, 'Otomatik moderasyon kuralı değiştirme'],
        [AuditLogEvent.AutoModerationRuleDelete, 'Otomatik moderasyon kuralı silme']
    ]);

    // Discord'un Audit Log Entry gateway olayı, her işlem için API'yi tekrar
    // sorgulamaktan daha hızlı ve güvenilir bir kaynak sağlar. GuildModeration
    // intent'i ve ViewAuditLog izni gereklidir.
    client.on('guildAuditLogEntryCreate', async (entry, guild) => {
        try {
            const eylem = GUARD_ACTION_LABELS.get(entry.action);
            if (!eylem || !guild) return;

            const executorId = entry.executorId || entry.executor?.id;
            if (!executorId || !entry.id) {
                console.warn('[GUARD] Denetim olayı geldi ancak yapan kullanıcı/olay ID bilgisi eksik.');
                return;
            }

            if (consumedAuditEntries.has(entry.id)) return;
            consumedAuditEntries.set(entry.id, Date.now());

            if (ayarGetir(guild.id, 'guardAktif', false) !== true) return;
            suspectGuildUntil.set(guild.id, Date.now() + SUSPECT_BACKUP_PAUSE_MS);

            const removedMembers = eylem === 'Toplu üye temizleme'
                ? Number(entry.extra?.membersRemoved || 1)
                : 1;
            await guardKontrol(guild, executorId, eylem, removedMembers);
        } catch (error) {
            console.error('[GUARD] Audit gateway olayı işlenemedi:', error);
        }
    });
};