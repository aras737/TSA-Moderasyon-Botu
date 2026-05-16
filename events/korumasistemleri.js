const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { ayarGetir } = require('../utils/db');

const HAFIZA_YOLU = path.join(__dirname, '../ayarlar/guardHafiza.json');

module.exports = (client) => {
    const guardKontrol = async (guild, executorId, eylem) => {
        if (!executorId || executorId === client.user.id || executorId === guild.ownerId) return;

        // Merkezi veritabanından guard durumunu kontrol et kanka (Varsayılan olarak true yaptık!)
        const guardDurum = ayarGetir(guild.id, 'guardAktif', true);
        if (!guardDurum) return; 

        const simdi = Date.now();
        let hafiza = fs.existsSync(HAFIZA_YOLU) ? JSON.parse(fs.readFileSync(HAFIZA_YOLU, 'utf8')) : {};
        if (!hafiza[executorId]) hafiza[executorId] = [];

        const islemler = hafiza[executorId].filter(zaman => simdi - zaman < 5000);
        islemler.push(simdi);
        
        hafiza[executorId] = islemler;
        fs.writeFileSync(HAFIZA_YOLU, JSON.stringify(hafiza, null, 2));

        if (islemler.length >= 2) {
            try {
                await guild.members.ban(executorId, { reason: `🚨 GUARD: Peş peşe işlem ihlali (${eylem})` });

                const everyoneRole = guild.roles.everyone;
                if (everyoneRole.permissions.has(PermissionFlagsBits.SendMessages)) {
                    await everyoneRole.setPermissions(everyoneRole.permissions.missing(PermissionFlagsBits.SendMessages), '🚨 GUARD LOCKDOWN');
                }

                delete hafiza[executorId];
                fs.writeFileSync(HAFIZA_YOLU, JSON.stringify(hafiza, null, 2));

                // Merkezi veritabanından log kanalını çekiyoruz kanka
                const logKanalId = ayarGetir(guild.id, 'logKanal', null);
                const logChan = logKanalId ? client.channels.cache.get(logKanalId) : null;

                if (logChan) {
                    const embed = new EmbedBuilder()
                        .setTitle('<a:alarme:1505209430319300718> GUARD MÜDAHALESİ')
                        .setDescription(`⚠️ **Saldırgan ID:** \`${executorId}\`\n**Eylem:** Kalıcı hafızada peş peşe **${eylem}** tespiti!\n\nHain kullanıcı banlandı ve sunucu kilitlendi.`)
                        .setColor('#960018').setTimestamp();
                    logChan.send({ content: '@everyone 🚨 **SUNUCU KORUNDU!**', embeds: [embed] }).catch(() => {});
                }
            } catch (err) {
                console.error(err);
            }
        }
    };

    client.on('roleDelete', async (role) => {
        const logs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null);
        const entry = logs?.entries.first();
        if (entry) await guardKontrol(role.guild, entry.executorId, 'Rol Silme');
    });

    client.on('channelDelete', async (channel) => {
        if (!channel.guild) return;
        const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(() => null);
        const entry = logs?.entries.first();
        if (entry) await guardKontrol(channel.guild, entry.executorId, 'Kanal Silme');
    });

    client.on('guildBanAdd', async (ban) => {
        const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
        const entry = logs?.entries.first();
        if (entry) await guardKontrol(ban.guild, entry.executorId, 'Sağ-tık Üye Banlama');
    });
};
