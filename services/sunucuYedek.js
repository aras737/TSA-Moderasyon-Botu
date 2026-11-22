const { ChannelType } = require('discord.js');
const { ayarKaydet, ayarGetir } = require('../utils/db');

const YEDEK_ANAHTARI = 'sunucuYedek';
const YEDEK_SCHEMA = 2;
const MAX_GUVENLI_GERI_ALMA_YASI_MS = 2 * 60 * 60 * 1000;

const YEDEKLENECEK_TIPLER = new Set([
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildCategory,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildStageVoice,
    ChannelType.GuildForum
]);

const zaman = () => new Date().toISOString();

function serializeOverwrites(channel) {
    return channel.permissionOverwrites.cache.map(overwrite => ({
        id: overwrite.id,
        type: overwrite.type,
        roleName: overwrite.type === 0
            ? (overwrite.id === channel.guild.id
                ? '@everyone'
                : channel.guild.roles.cache.get(overwrite.id)?.name || null)
            : null,
        allow: overwrite.allow.bitfield.toString(),
        deny: overwrite.deny.bitfield.toString()
    }));
}

function serializeRole(role) {
    return {
        id: role.id,
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: role.permissions.bitfield.toString(),
        position: role.position,
        unicodeEmoji: role.unicodeEmoji || null
    };
}

function serializeChannel(channel) {
    return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        parentId: channel.parentId || null,
        parentName: channel.parent?.name || null,
        position: channel.position,
        topic: typeof channel.topic === 'string' ? channel.topic : null,
        nsfw: Boolean(channel.nsfw),
        rateLimitPerUser: channel.rateLimitPerUser || 0,
        bitrate: channel.bitrate || null,
        userLimit: channel.userLimit || null,
        rtcRegion: channel.rtcRegion || null,
        videoQualityMode: channel.videoQualityMode ?? null,
        defaultAutoArchiveDuration: channel.defaultAutoArchiveDuration || null,
        defaultThreadRateLimitPerUser: channel.defaultThreadRateLimitPerUser || 0,
        availableTags: Array.isArray(channel.availableTags)
            ? channel.availableTags.map(tag => ({
                name: tag.name,
                moderated: Boolean(tag.moderated),
                emojiId: tag.emojiId || null,
                emojiName: tag.emojiName || null
            }))
            : [],
        defaultReactionEmoji: channel.defaultReactionEmoji
            ? {
                emojiId: channel.defaultReactionEmoji.emojiId || null,
                emojiName: channel.defaultReactionEmoji.emojiName || null
            }
            : null,
        overwrites: serializeOverwrites(channel)
    };
}

function normalizeBackup(backup) {
    const roller = (Array.isArray(backup.roller) ? backup.roller : []).map(role => ({
        ...role,
        id: role.id || null,
        name: role.name || role.ad || 'Recovered role',
        color: role.color ?? role.renk ?? 0,
        hoist: Boolean(role.hoist),
        mentionable: Boolean(role.mentionable),
        permissions: role.permissions || '0'
    }));

    const kanallar = (Array.isArray(backup.kanallar) ? backup.kanallar : []).map(channel => ({
        ...channel,
        id: channel.id || null,
        name: channel.name || channel.ad || 'recovered-channel',
        type: channel.type ?? channel.tip,
        parentId: channel.parentId || null,
        parentName: channel.parentName || channel.ustKategori || null,
        topic: channel.topic ?? channel.konu ?? null,
        nsfw: Boolean(channel.nsfw),
        rateLimitPerUser: channel.rateLimitPerUser ?? channel.yavasMod ?? 0,
        bitrate: channel.bitrate ?? channel.bitrate ?? null,
        userLimit: channel.userLimit ?? channel.kullaniciLimiti ?? null,
        overwrites: (channel.overwrites || []).map(overwrite => {
            const type = overwrite.type ?? (overwrite.tip === 'role' ? 0 : 1);
            return {
                id: overwrite.id || (type === 1 ? overwrite.userId : null),
                type,
                roleName: overwrite.roleName || (type === 0 ? overwrite.ad : null),
                userId: overwrite.userId || (type === 1 ? overwrite.id : null),
                allow: overwrite.allow || '0',
                deny: overwrite.deny || '0'
            };
        })
    }));

    return { ...backup, roller, kanallar };
}

async function yedekAl(guild) {
    try {
        // Cache eksikse yedek boş/eksik çıkmasın diye Discord'dan güncel yapıyı çek.
        await Promise.all([
            guild.roles.fetch().catch(error => {
                throw new Error('Roller getirilemedi: ' + error.message);
            }),
            guild.channels.fetch().catch(error => {
                throw new Error('Kanallar getirilemedi: ' + error.message);
            })
        ]);

        const everyone = guild.roles.everyone;
        const roller = guild.roles.cache
            .filter(role => role.id !== guild.id && !role.managed)
            .map(serializeRole);

        const kanallar = guild.channels.cache
            .filter(channel => YEDEKLENECEK_TIPLER.has(channel.type))
            .map(serializeChannel);

        const backup = {
            schema: YEDEK_SCHEMA,
            alinmaZamani: zaman(),
            guildId: guild.id,
            guildName: guild.name,
            everyonePermissions: everyone.permissions.bitfield.toString(),
            roller,
            kanallar
        };

        ayarKaydet(guild.id, YEDEK_ANAHTARI, backup);
        return backup;
    } catch (error) {
        console.error('[GUARD] Sunucu yedeği alınamadı: ' + (error.message || error));
        return null;
    }
}

function resolveRoleOverwrites(guild, overwrites, roleMap, warnings) {
    const resolved = [];

    for (const overwrite of (overwrites || [])) {
        let targetId = overwrite.id;

        if (overwrite.type === 0) {
            if (overwrite.id === guild.id || overwrite.roleName === '@everyone') {
                targetId = guild.id;
            } else {
                targetId = roleMap.get(overwrite.id) || null;

                // Eski yedek biçimi roleName saklıyordu, ID saklamıyordu.
                if (!targetId && overwrite.roleName) {
                    const role = guild.roles.cache.find(item =>
                        item.name === overwrite.roleName && !item.managed
                    );
                    targetId = role?.id || null;
                }
            }

            if (!targetId) {
                warnings.push('Bir kanal izin kaydı, karşılık gelen rol bulunamadığı için atlandı.');
                continue;
            }
        }

        resolved.push({
            id: targetId,
            type: overwrite.type,
            allow: BigInt(overwrite.allow || '0'),
            deny: BigInt(overwrite.deny || '0')
        });
    }

    return resolved;
}

function channelEditOptions(snapshot, parentId, overwrites, includePosition) {
    const options = {
        name: snapshot.name,
        permissionOverwrites: overwrites
    };

    if (includePosition && Number.isInteger(snapshot.position)) {
        options.position = snapshot.position;
    }

    if (snapshot.type !== ChannelType.GuildCategory) {
        options.parent = parentId || null;
    }

    if ([
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildForum
    ].includes(snapshot.type)) {
        options.topic = snapshot.topic;
        options.nsfw = Boolean(snapshot.nsfw);
        options.rateLimitPerUser = snapshot.rateLimitPerUser || 0;
    }

    if ([ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(snapshot.type)) {
        if (snapshot.bitrate) options.bitrate = snapshot.bitrate;
        if (snapshot.userLimit != null) options.userLimit = snapshot.userLimit;
        options.rtcRegion = snapshot.rtcRegion || null;
        if (snapshot.videoQualityMode != null) options.videoQualityMode = snapshot.videoQualityMode;
    }

    if (snapshot.type === ChannelType.GuildForum) {
        if (snapshot.defaultAutoArchiveDuration) {
            options.defaultAutoArchiveDuration = snapshot.defaultAutoArchiveDuration;
        }
        options.defaultThreadRateLimitPerUser = snapshot.defaultThreadRateLimitPerUser || 0;
        options.availableTags = (snapshot.availableTags || []).map(tag => ({
            name: tag.name,
            moderated: Boolean(tag.moderated),
            emojiId: tag.emojiId || undefined,
            emojiName: tag.emojiName || undefined
        }));
        if (snapshot.defaultReactionEmoji) {
            options.defaultReactionEmoji = snapshot.defaultReactionEmoji;
        }
    }

    return options;
}

async function yedektenGeriYukle(guild, sebep = 'TMF Anti-Raid: son güvenli yedekten geri yükleme') {
    const rawBackup = ayarGetir(guild.id, YEDEK_ANAHTARI, null);
    const backup = rawBackup ? normalizeBackup(rawBackup) : null;

    if (!backup || !Array.isArray(backup.roller) || !Array.isArray(backup.kanallar)) {
        return {
            calisti: false,
            roller: 0,
            kanallar: 0,
            hata: 'Geçerli sunucu yedeği bulunamadı.'
        };
    }

    if (backup.guildId && backup.guildId !== guild.id) {
        return { calisti: false, roller: 0, kanallar: 0, hata: 'Yedek başka bir sunucuya ait.' };
    }

    const snapshotTime = Date.parse(backup.alinmaZamani || '');
    if (!Number.isFinite(snapshotTime)) {
        return { calisti: false, roller: 0, kanallar: 0, hata: 'Yedek tarihi geçersiz.' };
    }

    const backupAge = Date.now() - snapshotTime;
    if (backupAge < 0 || backupAge > 7 * 24 * 60 * 60 * 1000) {
        return { calisti: false, roller: 0, kanallar: 0, hata: 'Yedek 7 günden eski; otomatik geri alma güvenli değil.' };
    }

    const warnings = [];
    let restoredRoles = 0;
    let restoredChannels = 0;
    let removedRoles = 0;
    let removedChannels = 0;

    await Promise.all([
        guild.roles.fetch().catch(error => warnings.push('Roller yenilenemedi: ' + error.message)),
        guild.channels.fetch().catch(error => warnings.push('Kanallar yenilenemedi: ' + error.message))
    ]);

    const roleMap = new Map();
    const usedRoleIds = new Set([guild.id]);
    const snapshotRoleIds = new Set(backup.roller.map(role => role.id).filter(Boolean));

    // 1. Önce mevcut rolleri ID ile bul, silinmiş olanları yeniden oluştur.
    for (const snapshot of backup.roller) {
        let role = snapshot.id ? guild.roles.cache.get(snapshot.id) : null;

        if (!role) {
            role = guild.roles.cache.find(item =>
                item.name === snapshot.name && !item.managed && !usedRoleIds.has(item.id)
            );
        }

        try {
            if (!role) {
                role = await guild.roles.create({
                    name: snapshot.name,
                    color: snapshot.color || 0,
                    hoist: Boolean(snapshot.hoist),
                    mentionable: Boolean(snapshot.mentionable),
                    permissions: BigInt(snapshot.permissions || '0'),
                    unicodeEmoji: snapshot.unicodeEmoji || undefined,
                    reason: sebep
                });
                restoredRoles++;
            } else {
                const changed =
                    role.name !== snapshot.name ||
                    role.color !== (snapshot.color || 0) ||
                    role.hoist !== Boolean(snapshot.hoist) ||
                    role.mentionable !== Boolean(snapshot.mentionable) ||
                    role.permissions.bitfield !== BigInt(snapshot.permissions || '0');

                if (changed) {
                    await role.edit({
                        name: snapshot.name,
                        color: snapshot.color || 0,
                        hoist: Boolean(snapshot.hoist),
                        mentionable: Boolean(snapshot.mentionable),
                        permissions: BigInt(snapshot.permissions || '0'),
                        unicodeEmoji: snapshot.unicodeEmoji || null,
                        reason: sebep
                    });
                }
            }

            roleMap.set(snapshot.id || ('name:' + snapshot.name), role.id);
            if (snapshot.id) roleMap.set(snapshot.id, role.id);
            usedRoleIds.add(role.id);
        } catch (error) {
            warnings.push('Rol geri yüklenemedi (' + snapshot.name + '): ' + error.message);
        }
    }

    // @everyone rolünün izinleri de saldırıda değişmiş olabilir.
    if (backup.everyonePermissions != null) {
        try {
            const wanted = BigInt(backup.everyonePermissions);
            if (guild.roles.everyone.permissions.bitfield !== wanted) {
                await guild.roles.everyone.setPermissions(wanted, sebep);
            }
        } catch (error) {
            warnings.push('@everyone izinleri geri yüklenemedi: ' + error.message);
        }
    }

    await guild.roles.fetch().catch(() => {});

    // 2. Kategorileri önce oluştur; diğer kanallar bu kategorilere bağlanır.
    const channelMap = new Map();
    const usedChannelIds = new Set();
    const snapshotChannelIds = new Set(backup.kanallar.map(channel => channel.id).filter(Boolean));
    const categories = backup.kanallar.filter(channel => channel.type === ChannelType.GuildCategory);
    const otherChannels = backup.kanallar.filter(channel => channel.type !== ChannelType.GuildCategory);
    const orderedSnapshots = categories.concat(otherChannels);

    for (const snapshot of orderedSnapshots) {
        if (!YEDEKLENECEK_TIPLER.has(snapshot.type)) {
            warnings.push('Desteklenmeyen kanal tipi atlandı: ' + snapshot.name);
            continue;
        }

        const parentId = snapshot.parentId
            ? (channelMap.get(snapshot.parentId) || snapshot.parentId)
            : null;

        let channel = snapshot.id ? guild.channels.cache.get(snapshot.id) : null;

        if (!channel) {
            channel = guild.channels.cache.find(item =>
                item.type === snapshot.type &&
                item.name === snapshot.name &&
                (snapshot.type === ChannelType.GuildCategory || (item.parentId || null) === parentId) &&
                !usedChannelIds.has(item.id)
            );
        }

        const overwrites = resolveRoleOverwrites(
            guild,
            snapshot.overwrites || [],
            roleMap,
            warnings
        );
        const options = channelEditOptions(snapshot, parentId, overwrites, true);

        try {
            if (!channel) {
                channel = await guild.channels.create({
                    ...options,
                    type: snapshot.type,
                    reason: sebep
                });
                restoredChannels++;
            } else {
                await channel.edit({ ...options, reason: sebep });
            }

            channelMap.set(snapshot.id || ('name:' + snapshot.name), channel.id);
            if (snapshot.id) channelMap.set(snapshot.id, channel.id);
            usedChannelIds.add(channel.id);
        } catch (error) {
            warnings.push('Kanal geri yüklenemedi (' + snapshot.name + '): ' + error.message);
        }
    }

    // 3. Geri yüklenen rollerin ve kanalların sırasını mümkün olduğunca eski haline getir.
    for (const snapshot of backup.roller.slice().sort((a, b) => a.position - b.position)) {
        const mappedId = roleMap.get(snapshot.id) || roleMap.get('name:' + snapshot.name);
        const role = mappedId ? guild.roles.cache.get(mappedId) : null;
        if (!role || !Number.isInteger(snapshot.position)) continue;
        try {
            await role.setPosition(snapshot.position);
        } catch (error) {
            warnings.push('Rol sırası ayarlanamadı (' + snapshot.name + '): ' + error.message);
        }
    }

    // 4. Yedekten sonra oluşturulmuş saldırı kanallarını/rollerini temizle.
    // Yedek iki saatten eskiyse meşru yeni yapıları silmemek için temizlik yapılmaz.
    const mayPrune = backupAge <= MAX_GUVENLI_GERI_ALMA_YASI_MS;
    if (mayPrune) {
        await guild.channels.fetch().catch(() => {});
        const extraChannels = guild.channels.cache.filter(channel =>
            YEDEKLENECEK_TIPLER.has(channel.type) &&
            !snapshotChannelIds.has(channel.id) &&
            !usedChannelIds.has(channel.id) &&
            channel.createdTimestamp >= snapshotTime
        );

        const extras = [...extraChannels.values()].sort((a, b) =>
            Number(a.type === ChannelType.GuildCategory) - Number(b.type === ChannelType.GuildCategory)
        );

        for (const channel of extras) {
            try {
                await channel.delete(sebep);
                removedChannels++;
            } catch (error) {
                warnings.push('Yeni kanal temizlenemedi (' + channel.name + '): ' + error.message);
            }
        }

        await guild.roles.fetch().catch(() => {});
        const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
        const botRoleIds = new Set(botMember ? botMember.roles.cache.map(role => role.id) : []);
        const extraRoles = guild.roles.cache.filter(role =>
            role.id !== guild.id &&
            !role.managed &&
            !snapshotRoleIds.has(role.id) &&
            !usedRoleIds.has(role.id) &&
            !botRoleIds.has(role.id) &&
            role.createdTimestamp >= snapshotTime
        );

        for (const role of extraRoles.values()) {
            try {
                await role.delete(sebep);
                removedRoles++;
            } catch (error) {
                warnings.push('Yeni rol temizlenemedi (' + role.name + '): ' + error.message);
            }
        }
    } else {
        warnings.push('Yedek iki saatten eski olduğu için sonradan oluşturulan kanal/roller otomatik silinmedi.');
    }

    return {
        calisti: true,
        roller: restoredRoles,
        kanallar: restoredChannels,
        silinenRoller: removedRoles,
        silinenKanallar: removedChannels,
        alinmaZamani: backup.alinmaZamani,
        warnings: warnings.slice(0, 30)
    };
}

module.exports = { yedekAl, yedektenGeriYukle };
