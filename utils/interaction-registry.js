'use strict';

// Genel interaction yöneticisi (index.js) ile kendi dinleyicisini/collector'ını
// kullanan sistemler arasında "bu etkileşimi kim ACK edecek?" sözleşmesi.
// Bir buton yalnızca TEK sistem tarafından yanıtlanmalıdır; burada kayıtlı olan
// etkileşimlere genel yönetici dokunmaz.

const ownedPrefixes = new Set();
const activePanels = new Map(); // messageId -> bitiş zamanı (ms)

function registerPrefix(prefix) {
    if (typeof prefix === 'string' && prefix.length > 0) ownedPrefixes.add(prefix);
}

// Collector kullanan paneller: collector ömrü + küçük pay kadar sahiplenir.
function registerPanel(messageId, ttlMs, now = Date.now()) {
    if (!messageId) return;
    activePanels.set(String(messageId), now + Math.max(0, Number(ttlMs) || 0) + 5000);
}

function releasePanel(messageId) {
    if (messageId) activePanels.delete(String(messageId));
}

function pruneExpired(now = Date.now()) {
    for (const [id, expiresAt] of activePanels) {
        if (expiresAt <= now) activePanels.delete(id);
    }
}

function isHandledElsewhere(interaction, now = Date.now()) {
    if (!interaction) return false;

    const customId = typeof interaction.customId === 'string' ? interaction.customId : '';
    for (const prefix of ownedPrefixes) {
        if (customId.startsWith(prefix)) return true;
    }

    pruneExpired(now);
    const messageId = interaction.message?.id;
    return Boolean(messageId && activePanels.has(String(messageId)));
}

function _resetForTests() {
    ownedPrefixes.clear();
    activePanels.clear();
}

module.exports = { registerPrefix, registerPanel, releasePanel, isHandledElsewhere, _resetForTests };
