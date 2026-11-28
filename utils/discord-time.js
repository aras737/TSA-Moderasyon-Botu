'use strict';

const DISCORD_EPOCH = 1420070400000n;
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

// Snowflake ID'sinden oluşturulma zamanını (ms) hesaplar; geçersizse null.
function snowflakeToTimestamp(id) {
    const text = String(id ?? '');
    if (!/^\d{17,20}$/.test(text)) return null;
    try {
        return Number((BigInt(text) >> 22n) + DISCORD_EPOCH);
    } catch {
        return null;
    }
}

function isPlausibleTimestamp(ms, now = Date.now()) {
    return Number.isFinite(ms) && ms >= Number(DISCORD_EPOCH) && ms <= now + MAX_FUTURE_SKEW_MS;
}

// Önce nesnenin kendi alanlarını (createdTimestamp/createdAt), olmazsa ID'yi dener.
function createdTimestampOf(entity, now = Date.now()) {
    if (!entity) return null;

    const direct = Number(entity.createdTimestamp);
    if (isPlausibleTimestamp(direct, now)) return direct;

    const fromDate = entity.createdAt instanceof Date ? entity.createdAt.getTime() : NaN;
    if (isPlausibleTimestamp(fromDate, now)) return fromDate;

    const fromId = snowflakeToTimestamp(entity.id);
    return isPlausibleTimestamp(fromId, now) ? fromId : null;
}

// Geçersiz tarih embed'e asla "NaN" yazmasın: <t:...> yerine fallback döner.
function discordTimestamp(ms, style = 'R', fallback = 'Bilinmiyor') {
    return Number.isFinite(ms) ? `<t:${Math.floor(ms / 1000)}:${style}>` : fallback;
}

module.exports = { snowflakeToTimestamp, isPlausibleTimestamp, createdTimestampOf, discordTimestamp };
