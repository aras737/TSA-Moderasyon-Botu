const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { ayarGetir, ayarKaydet } = require('../utils/db');
const { yedekAl, yedektenGeriYukle } = require('../services/sunucuYedek');

module.exports = client => {
    const userActions = new Map();
    const activeGuilds = new Set();
    const suspectGuildUntil = new Map();
    const auditCache = new Map();
    const auditInflight = new Map();
    const consumedAuditEntries = new Map();

    const YEDEK_ARALIGI_MS = 60 * 1000;
    const WINDOW_MS = 1000;
    const THRESHOLD = 5;
    const AUDIT_MAX_AGE_MS = 10000;
    const AUDIT_RETRIES = 3;
    const AUDIT_RETRY_DELAY_MS = 250;
    const AUDIT_CACHE_MS = 200;
    const GUILD_COOLDOWN_MS = 15000;
    const SUSPECT_BACKUP_PAUSE_MS = 30000;

    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    async function tumSunuculariYedekle() {
        for (const guild of client.guilds.cache.values()) {
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
    }

    client.once('ready', () => {
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

    async function fetchAuditLogsCached(guild, type) {
        const key = guild.id + ':' + String(type);
        const cached = auditCache.get(key);
        if (cached && Date.now() - cached.loadedAt < AUDIT_CACHE_MS) return cached.logs;

        const pending = auditInflight.get(key);
        if (pending) return pending;

        const request = guild.fetchAuditLogs({ limit: 50, type }).then(logs => {
            auditCache.set(key, { loadedAt: Date.now(), logs });
            return logs;
        }).catch(error => {
            console.error('[GUARD] Denetim kayıtları alınamadı:', error.message);
            return null;
        }).finally(() => auditInflight.delete(key));

        auditInflight.set(key, request);
        return request;
    }

    async function getRecentExecutor(guild, type, targetId) {
        const botMember = guild.members.me;
        if (botMember && !botMember.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
            console.error('[GUARD] ' + guild.name + ': Botta Denetim Kaydını Görüntüle izni yok.');
            return null;
        }

        for (let attempt = 0; attempt < AUDIT_RETRIES; attempt++) {
            const logs = await fetchAuditLogsCached(guild, type);
            if (logs) {
                const now = Date.now();
                const entry = logs.entries.find(item => {
                    const age = now - item.createdTimestamp;
                    return item.target?.id === targetId && item.executorId &&
                        !consumedAuditEntries.has(item.id) &&
                        age >= 0 && age <= AUDIT_MAX_AGE_MS;
                });
                if (entry?.executorId) {
                    consumedAuditEntries.set(entry.id, Date.now());
                    return entry.executorId;
                }
            }
            if (attempt < AUDIT_RETRIES - 1) await wait(AUDIT_RETRY_DELAY_MS);
        }

        console.warn('[GUARD] ' + guild.name + ': ' + type + ' işlemini yapan kişi denetim kaydında bulunamadı.');
        return null;
    }

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

    async function guardKontrol(guild, executorId, eylem) {
        if (!executorId || executorId === client.user.id || executorId === guild.ownerId) return;
        if (ayarGetir(guild.id, 'guardAktif', false) !== true) return;
        if (activeGuilds.has(guild.id)) return;

        const now = Date.now();
        suspectGuildUntil.set(guild.id, now + SUSPECT_BACKUP_PAUSE_MS);

        const key = guild.id + ':' + executorId;
        const actions = (userActions.get(key) || []).filter(timestamp => now - timestamp < WINDOW_MS);
        actions.push(now);
        userActions.set(key, actions);

        if (actions.length >= THRESHOLD) {
            userActions.delete(key);
            await lockdown(guild, executorId, eylem, actions.length);
        }
    }

    function markPotentialRaid(guild) {
        if (ayarGetir(guild.id, 'guardAktif', false) === true) {
            suspectGuildUntil.set(guild.id, Date.now() + SUSPECT_BACKUP_PAUSE_MS);
        }
    }

    client.on('roleDelete', async role => {
        markPotentialRaid(role.guild);
        const executorId = await getRecentExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
        if (executorId) await guardKontrol(role.guild, executorId, 'Rol silme');
    });

    client.on('roleCreate', async role => {
        markPotentialRaid(role.guild);
        const executorId = await getRecentExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
        if (executorId) await guardKontrol(role.guild, executorId, 'Rol oluşturma');
    });

    client.on('roleUpdate', async (_oldRole, newRole) => {
        markPotentialRaid(newRole.guild);
        const executorId = await getRecentExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
        if (executorId) await guardKontrol(newRole.guild, executorId, 'Rol düzenleme/izin değiştirme');
    });

    client.on('channelDelete', async channel => {
        if (!channel.guild) return;
        markPotentialRaid(channel.guild);
        const executorId = await getRecentExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
        if (executorId) await guardKontrol(channel.guild, executorId, 'Kanal silme');
    });

    client.on('channelCreate', async channel => {
        if (!channel.guild) return;
        markPotentialRaid(channel.guild);
        const executorId = await getRecentExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
        if (executorId) await guardKontrol(channel.guild, executorId, 'Kanal oluşturma');
    });

    client.on('channelUpdate', async (_oldChannel, newChannel) => {
        if (!newChannel.guild) return;
        markPotentialRaid(newChannel.guild);
        const executorId = await getRecentExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);
        if (executorId) await guardKontrol(newChannel.guild, executorId, 'Kanal/izin düzenleme');
    });

    client.on('guildBanAdd', async ban => {
        markPotentialRaid(ban.guild);
        const executorId = await getRecentExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
        if (executorId) await guardKontrol(ban.guild, executorId, 'Üye banlama');
    });

    client.on('webhookUpdate', async channel => {
        if (!channel.guild) return;
        markPotentialRaid(channel.guild);

        const eventTypes = [
            AuditLogEvent.WebhookDelete,
            AuditLogEvent.WebhookUpdate,
            AuditLogEvent.WebhookCreate
        ];

        const entries = await Promise.all(eventTypes.map(async type => {
            const logs = await channel.guild.fetchAuditLogs({ limit: 10, type }).catch(() => null);
            return logs?.entries.find(item =>
                item.target?.channelId === channel.id &&
                item.executorId &&
                !consumedAuditEntries.has(item.id) &&
                Date.now() - item.createdTimestamp >= 0 &&
                Date.now() - item.createdTimestamp <= AUDIT_MAX_AGE_MS
            ) || null;
        }));

        const latest = entries.filter(Boolean).sort((a, b) => b.createdTimestamp - a.createdTimestamp)[0];
        if (latest?.executorId) {
            consumedAuditEntries.set(latest.id, Date.now());
            await guardKontrol(channel.guild, latest.executorId, 'Webhook işlemi');
        }
    });
};