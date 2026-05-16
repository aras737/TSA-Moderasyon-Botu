const fs = require('fs');
const path = require('path');
const DB_YOLU = path.join(__dirname, '../ayarlar/tsaDatabase.json');

// Veritabanını oku
function dbOku() {
    if (!fs.existsSync(path.dirname(DB_YOLU))) {
        fs.mkdirSync(path.dirname(DB_YOLU), { recursive: true });
    }
    if (!fs.existsSync(DB_YOLU)) {
        fs.writeFileSync(DB_YOLU, JSON.stringify({}, null, 2));
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(DB_YOLU, 'utf8'));
    } catch (e) {
        return {};
    }
}

// Veritabanına yaz
function dbYaz(veri) {
    fs.writeFileSync(DB_YOLU, JSON.stringify(veri, null, 2));
}

// Sunucuya özel ayar getir
function ayarGetir(guildId, anahtar, varsayilan) {
    const db = dbOku();
    if (!db[guildId]) return varsayilan;
    return db[guildId][anahtar] !== undefined ? db[guildId][anahtar] : varsayilan;
}

// Sunucuya özel ayar kaydet
function ayarKaydet(guildId, anahtar, deger) {
    const db = dbOku();
    if (!db[guildId]) db[guildId] = {};
    db[guildId][anahtar] = deger;
    dbYaz(db);
}

module.exports = { ayarGetir, ayarKaydet };
