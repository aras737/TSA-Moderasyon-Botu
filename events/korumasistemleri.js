const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {
    const userActions = new Map();
    const lockedGuilds = new Set();
    const WINDOW_MS = 1000;
    const THRESHOLD = 3;
    const AUDIT_MAX_AGE_MS = 10000;

    async function getRecentExecutor(guild, type, targetId) {
        const logs = await guild.fetchAuditLogs({ limit: 5, type }).catch(() => null);
        if (!logs) return null;

        const now = Date.now();
        const entry = logs.entries.find(item =>
            item.target?.id === targetId &&
            item.executorId &&
            now - item.createdTimestamp <= AUDIT_MAX_AGE_MS
        );

        return entry?.executorId || null;
    }

    async function sendGuardLog(guild, executorId, eylem, count, status) {
        const logId = ayarGetir(guild.id, 'logKanal', null);
        if (!logId) return;

        const log = await client.channels.fetch(logId).catch(() => null);
        if (!log?.isTextBased?.() || !log.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) return;

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
        if (lockedGuilds.has(guild.id)) return;
        lockedGuilds.add(guild.id);

        const everyoneRole = guild.roles.everyone;
        const originalPermissions = everyoneRole.permissions.bitfield;

        try {
            const banResult = await guild.members.ban(executorId, {
                reason: `TMF Guard: ${count} kez ${eylem}`.slice(0, 500)
            }).then(() => true).catch(error => {
                console.error('Guard saldırgan banlanamadı:', error.message);
                return false;
            });

            // Mevcut @everyone izinlerini koru; yalnızca geçici olarak mesaj göndermeyi kapat.
            await everyoneRole.setPermissions(
                everyoneRole.permissions.remove(PermissionFlagsBits.SendMessages),
                'TMF Guard geçici saldırı kilidi'
            );

            await sendGuardLog(
                guild,
                executorId,
                eylem,
                count,
                banResult ? 'Saldırgan banlandı; yazma izni 5 dakika kilitlendi.' : 'Ban başarısız; yazma izni 5 dakika kilitlendi.'
            );

            const timer = setTimeout(async () => {
                try {
                    const currentRole = await guild.roles.fetch(guild.id).catch(() => null);
                    if (currentRole) {
                        await currentRole.setPermissions(originalPermissions, 'TMF Guard geçici kilidi kaldırıldı');
                    }
                } catch (error) {
                    console.error('Guard izinleri geri yüklenemedi:', error);
                } finally {
                    lockedGuilds.delete(guild.id);
                }
            }, 5 * 60 * 1000);

            timer.unref?.();
        } catch (error) {
            lockedGuilds.delete(guild.id);
            console.error('Guard müdahale hatası:', error);
            await sendGuardLog(guild, executorId, eylem, count, `Müdahale tamamlanamadı: ${error.message}`);
        }
    }

    async function guardKontrol(guild, executorId, eylem) {
        // Koruma, yönetici panelinden açıkça etkinleştirilmedikçe devreye girmez.
        if (!executorId || executorId === client.user.id || executorId === guild.ownerId) return;
        if (ayarGetir(guild.id, 'guardAktif', false) !== true) return;
        if (lockedGuilds.has(guild.id)) return;

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

    client.on('channelDelete', async channel => {
        if (!channel.guild) return;
        const executorId = await getRecentExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
        if (executorId) await guardKontrol(channel.guild, executorId, 'Kanal silme');
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
            const logs = await channel.guild.fetchAuditLogs({ limit: 5, type }).catch(() => null);
            const entry = logs?.entries.find(item =>
                item.target?.channelId === channel.id &&
                item.executorId &&
                Date.now() - item.createdTimestamp <= AUDIT_MAX_AGE_MS
            );
            return entry;
        }));

        const latest = entries.filter(Boolean).sort((a, b) => b.createdTimestamp - a.createdTimestamp)[0];
        if (latest?.executorId) await guardKontrol(channel.guild, latest.executorId, 'Webhook işlemi');
    });

    // Bellek sınırsız büyümesin; eski sayaç anahtarlarını temizle.
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
