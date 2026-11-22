const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {
    const userActions = new Map();
    const activeGuilds = new Set();

    // Discord audit-log entries can appear shortly after the gateway event.
    // A low threshold is intentional: a raid must be stopped before many more
    // destructive actions are completed.
    const WINDOW_MS = 1000;
    const THRESHOLD = 5;
    const AUDIT_MAX_AGE_MS = 15000;
    const AUDIT_RETRIES = 4;
    const AUDIT_RETRY_DELAY_MS = 300;
    const GUILD_COOLDOWN_MS = 10000;

    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    async function getRecentExecutor(guild, type, targetId) {
        const botMember = guild.members.me;
        if (botMember && !botMember.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
            console.error(`[GUARD] ${guild.name}: Botta Denetim Kaydını Görüntüle izni yok.`);
            return null;
        }

        for (let attempt = 0; attempt < AUDIT_RETRIES; attempt++) {
            const logs = await guild.fetchAuditLogs({ limit: 25, type }).catch(error => {
                console.error('[GUARD] Denetim kayıtları alınamadı:', error.message);
                return null;
            });

            if (logs) {
                const now = Date.now();
                const entry = logs.entries.find(item => {
                    const age = now - item.createdTimestamp;
                    return item.target?.id === targetId &&
                        item.executorId &&
                        age >= 0 &&
                        age <= AUDIT_MAX_AGE_MS;
                });

                if (entry?.executorId) return entry.executorId;
            }

            if (attempt < AUDIT_RETRIES - 1) await wait(AUDIT_RETRY_DELAY_MS);
        }

        console.warn(`[GUARD] ${guild.name}: ${type} işlemi için saldırgan denetim kaydında bulunamadı. Gerekli izin ve kayıtları kontrol edin.`);
        return null;
    }

    async function sendGuardLog(guild, executorId, eylem, count, status) {
        const logId = ayarGetir(guild.id, 'logKanal', null);
        if (!logId) return;

        const log = await client.channels.fetch(logId).catch(() => null);
        const botMember = guild.members.me;
        if (!log?.isTextBased?.() ||
            !botMember ||
            !log.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages)) return;

        const embed = new EmbedBuilder()
            .setTitle('🚨 TMF | GUARD MÜDAHALESİ')
            .setDescription(
                `**Saldırgan:** \`${executorId}\`\n**İşlem:** ${count} kez ${eylem}\n**Durum:** ${status}`
            )
            .setColor('#960018')
            .setTimestamp();

        await log.send({ embeds: [embed] }).catch(error => {
            console.error('Guard log gönderilemedi:', error.message);
        });
    }

    async function lockdown(guild, executorId, eylem, count) {
        if (activeGuilds.has(guild.id)) return;
        activeGuilds.add(guild.id);

        let status;
        try {
            if (executorId === guild.ownerId || executorId === client.user.id) return;

            const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
            if (!botMember?.permissions.has(PermissionFlagsBits.BanMembers)) {
                status = 'Saldırgan tespit edildi ancak botta Üyeleri Yasakla izni yok. Bot rolü ve izinleri kontrol edilmeli.';
                return;
            }

            const targetMember = await guild.members.fetch(executorId).catch(() => null);
            if (!targetMember) {
                status = 'Saldırgan sunucuda bulunamadı; tekrar işlem yapması beklenmiyor.';
                return;
            }

            if (botMember.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) {
                status = 'Saldırgan tespit edildi ancak botun rolü saldırganın rolünden yüksek değil. Bot rolünü yükseltin.';
                return;
            }

            await guild.members.ban(executorId, {
                reason: `TMF Anti-Raid: ${count} kez / ${WINDOW_MS} ms içinde ${eylem}`.slice(0, 500)
            });

            status = 'Saldırgan otomatik olarak banlandı.';
        } catch (error) {
            status = `Otomatik ban başarısız: ${error.message}`;
            console.error('[GUARD] Saldırgana müdahale edilemedi:', error);
        } finally {
            await sendGuardLog(guild, executorId, eylem, count, status || 'Müdahale tamamlanamadı.');
            // Prevent a burst of concurrent event handlers from repeatedly
            // trying to ban the same actor while Discord processes the ban.
            setTimeout(() => activeGuilds.delete(guild.id), GUILD_COOLDOWN_MS).unref?.();
        }
    }

    async function guardKontrol(guild, executorId, eylem) {
        if (!executorId || executorId === client.user.id || executorId === guild.ownerId) return;
        if (ayarGetir(guild.id, 'guardAktif', false) !== true) return;
        if (activeGuilds.has(guild.id)) return;

        const key = `${guild.id}:${executorId}`;
        const now = Date.now();
        const actions = (userActions.get(key) || []).filter(timestamp => now - timestamp < WINDOW_MS);
        actions.push(now);
        userActions.set(key, actions);

        if (actions.length >= THRESHOLD) {
            userActions.delete(key);
            await lockdown(guild, executorId, eylem, actions.length);
        }
    }

    client.on('roleDelete', async role => {
        const executorId = await getRecentExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
        if (executorId) await guardKontrol(role.guild, executorId, 'Rol silme');
    });

    client.on('roleCreate', async role => {
        const executorId = await getRecentExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
        if (executorId) await guardKontrol(role.guild, executorId, 'Rol oluşturma');
    });

    client.on('channelDelete', async channel => {
        if (!channel.guild) return;
        const executorId = await getRecentExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
        if (executorId) await guardKontrol(channel.guild, executorId, 'Kanal silme');
    });

    client.on('channelCreate', async channel => {
        if (!channel.guild) return;
        const executorId = await getRecentExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
        if (executorId) await guardKontrol(channel.guild, executorId, 'Kanal oluşturma');
    });

    client.on('guildBanAdd', async ban => {
        const executorId = await getRecentExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
        if (executorId) await guardKontrol(ban.guild, executorId, 'Üye banlama');
    });

    client.on('webhookUpdate', async channel => {
        if (!channel.guild) return;

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
                Date.now() - item.createdTimestamp >= 0 &&
                Date.now() - item.createdTimestamp <= AUDIT_MAX_AGE_MS
            ) || null;
        }));

        const latest = entries.filter(Boolean).sort((a, b) => b.createdTimestamp - a.createdTimestamp)[0];
        if (latest?.executorId) await guardKontrol(channel.guild, latest.executorId, 'Webhook işlemi');
    });

    // Remove expired counters so this map cannot grow indefinitely.
    const cleanup = setInterval(() => {
        const now = Date.now();
        for (const [key, timestamps] of userActions.entries()) {
            const active = timestamps.filter(timestamp => now - timestamp < WINDOW_MS);
            if (active.length) userActions.set(key, active);
            else userActions.delete(key);
        }
    }, 60000);
    cleanup.unref?.();
};
