const Storage = require('../services/storage');

/**
 * Ayarları kaydeder
 * @param {string} guildId - Sunucu ID
 * @param {string} anahtar - Ayar anahtarı
 * @param {any} deger - Ayar değeri
 */
function ayarKaydet(guildId, anahtar, deger) {
    const key = `guild_${guildId}_${anahtar}`;
    Storage.set(key, deger);
}

/**
 * Ayarları getirir
 * @param {string} guildId - Sunucu ID
 * @param {string} anahtar - Ayar anahtarı
 * @param {any} varsayilan - Varsayılan değer
 */
function ayarGetir(guildId, anahtar, varsayilan = null) {
    const key = `guild_${guildId}_${anahtar}`;
    return Storage.get(key) || varsayilan;
}

/**
 * Sunucunun tüm ayarlarını getirir
 * @param {string} guildId - Sunucu ID
 */
function sunucuAyarlariniGetir(guildId) {
    const allData = Storage.getAll();
    const guildPrefix = `guild_${guildId}_`;
    const guildData = {};
    
    Object.keys(allData).forEach(key => {
        if (key.startsWith(guildPrefix)) {
            const cleanKey = key.replace(guildPrefix, '');
            guildData[cleanKey] = allData[key];
        }
    });
    
    return guildData;
}

/**
 * Sunucunun ayarlarını siler
 * @param {string} guildId - Sunucu ID
 */
function sunucuSil(guildId) {
    const allData = Storage.getAll();
    const guildPrefix = `guild_${guildId}_`;
    
    Object.keys(allData).forEach(key => {
        if (key.startsWith(guildPrefix)) {
            Storage.delete(key);
        }
    });
}

module.exports = {
    ayarKaydet,
    ayarGetir,
    sunucuAyarlariniGetir,
    sunucuSil
};
