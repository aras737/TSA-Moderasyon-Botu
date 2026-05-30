const Storage = require('../services/storage');

/**
 * Ayarları kaydeder
 * @param {string} guildId - Sunucu ID
 * @param {string} anahtar - Ayar anahtarı
 * @param {any} deger - Ayar değeri
 */
function ayarKaydet(guildId, anahtar, deger) {
    Storage.setGuildSetting(guildId, anahtar, deger);
}

/**
 * Ayarları getirir
 * @param {string} guildId - Sunucu ID
 * @param {string} anahtar - Ayar anahtarı
 * @param {any} varsayilan - Varsayılan değer
 */
function ayarGetir(guildId, anahtar, varsayilan = null) {
    return Storage.getGuildSetting(guildId, anahtar, varsayilan);
}

/**
 * Sunucunun tüm ayarlarını getirir
 * @param {string} guildId - Sunucu ID
 */
function sunucuAyarlariniGetir(guildId) {
    return Storage.getGuildSettings(guildId);
}

/**
 * Sunucunun ayarlarını siler
 * @param {string} guildId - Sunucu ID
 */
function sunucuSil(guildId) {
    Storage.deleteGuild(guildId);
}

module.exports = {
    ayarKaydet,
    ayarGetir,
    sunucuAyarlariniGetir,
    sunucuSil
};
