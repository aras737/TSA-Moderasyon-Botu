const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {
    const userActions = new Map();
    const WINDOW = 1000; // 1 saniye
    const THRESHOLD = 3; // 3 işlem = saldırı

    const guardKontrol = async (guild, executorId, eylem) => {
        if (!executorId || executorId === client.user.id || executorId === guild.ownerId) return;
        if (!ayarGetir(guild.id, 'guardAktif', true)) return;

        const key = `${guild.id}-${executorId}`;
        const now = Date.now();

        if (!userActions.has(key)) userActions.set(key, []);
        
        let actions = userActions.get(key).filter(t => now - t < WINDOW);
        actions.push(now);
        userActions.set(key, actions);

        if (actions.length >= THRESHOLD) {
            await lockdown(guild, executorId, eylem, actions.length);
            userActions.delete(key);
        }
    };

    const lockdown = async (guild, executorId, eylem, count) => {
        try {
            await guild.members.ban(executorId, { reason: `🚨 GUARD: ${count}x ${eylem}` }).catch(() => {});

            const role = guild.roles.everyone;
            await role.setPermissions(role.permissions.remove(PermissionFlagsBits.SendMessages), '🚨 GUARD');

            const logId = ayarGetir(guild.id, 'logKanal', null);
            const log = logId ? client.channels.cache.get(logId) : null;

            if (log) {
                const embed = new EmbedBuilder()
                    .setTitle('🚨 GUARD MÜDAHALESİ')
                    .setDescription(`**Saldırgan:** \`${executorId}\`\n**İşlem:** ${count}x ${eylem}\n**Aksiyon:** BAN + LOCKDOWN`)
                    .setColor('#960018').setTimestamp();
                log.send({ content: '@everyone 🚨 SALDIRI ENGELLENDI!', embeds: [embed] }).catch(() => {});
            }

            setTimeout(() => role.setPermissions(role.permissions.add(PermissionFlagsBits.SendMessages), '✅ AUTO'), 300000);
        } catch (err) {
            console.error('Guard Error:', err);
        }
    };

    client.on('roleDelete', async (role) => {
        const entry = (await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null))?.entries.first();
        if (entry?.executorId) await guardKontrol(role.guild, entry.executorId, 'Rol Silme');
    });

    client.on('channelDelete', async (channel) => {
        if (!channel.guild) return;
        const entry = (await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(() => null))?.entries.first();
        if (entry?.executorId) await guardKontrol(channel.guild, entry.executorId, 'Kanal Silme');
    });

    client.on('guildBanAdd', async (ban) => {
        const entry = (await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null))?.entries.first();
        if (entry?.executorId) await guardKontrol(ban.guild, entry.executorId, 'Üye Banlama');
    });

    client.on('webhookUpdate', async (channel) => {
        if (!channel.guild) return;
        const entry = (await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookDelete }).catch(() => null))?.entries.first();
        if (entry?.executorId) await guardKontrol(channel.guild, entry.executorId, 'Webhook Silme');
    });
};