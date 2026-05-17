const fs = require('fs');
const path = require('path');

const STORAGE_FILE = path.join(__dirname, '../data/storage.json');

// data klasörü yoksa oluştur
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class Storage {
  // Verileri yükle
  static loadData() {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
      }
    } catch (error) {
      console.error('❌ Veri yükleme hatası:', error);
    }
    return {};
  }

  // Verileri kaydet
  static saveData(data) {
    try {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
      console.log('💾 Veriler kaydedildi');
    } catch (error) {
      console.error('❌ Veri kayıt hatası:', error);
    }
  }

  // Veri ekle/güncelle
  static set(key, value) {
    const data = this.loadData();
    data[key] = value;
    this.saveData(data);
  }

  // Veri oku
  static get(key) {
    const data = this.loadData();
    return data[key] || null;
  }

  // Tüm verileri getir
  static getAll() {
    return this.loadData();
  }

  // Veri sil
  static delete(key) {
    const data = this.loadData();
    delete data[key];
    this.saveData(data);
  }

  // Tüm verileri temizle
  static clear() {
    this.saveData({});
  }
}

module.exports = Storage;
