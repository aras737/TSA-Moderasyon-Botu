const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const STORAGE_FILE = path.join(DATA_DIR, 'storage.json');
const BACKUP_FILE = path.join(DATA_DIR, 'storage.backup.json');

const DEFAULT_DATA = {
  version: 2,
  createdAt: null,
  updatedAt: null,
  settings: {},
  guilds: {},
  users: {},
  punishments: [],
  tickets: [],
  logs: [],
  kv: {}
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function now() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

class Storage {
  static normalize(data) {
    const normalized = {
      ...clone(DEFAULT_DATA),
      ...(data && typeof data === 'object' ? data : {})
    };

    normalized.settings = normalized.settings || {};
    normalized.guilds = normalized.guilds || {};
    normalized.users = normalized.users || {};
    normalized.punishments = Array.isArray(normalized.punishments) ? normalized.punishments : [];
    normalized.tickets = Array.isArray(normalized.tickets) ? normalized.tickets : [];
    normalized.logs = Array.isArray(normalized.logs) ? normalized.logs : [];
    normalized.kv = normalized.kv || {};

    // Eski düz key-value storage.json verisini kaybetmeden yeni yapıya taşır.
    Object.keys(data || {}).forEach((key) => {
      if (!(key in DEFAULT_DATA)) {
        normalized.kv[key] = data[key];
      }
    });

    if (!normalized.createdAt) normalized.createdAt = now();
    normalized.version = 2;
    return normalized;
  }

  static loadData() {
    ensureDir();

    try {
      if (!fs.existsSync(STORAGE_FILE)) {
        const fresh = this.normalize({});
        this.saveData(fresh);
        return fresh;
      }

      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      return this.normalize(raw.trim() ? JSON.parse(raw) : {});
    } catch (error) {
      console.error('Veri yükleme hatası, yedek deneniyor:', error.message);

      try {
        if (fs.existsSync(BACKUP_FILE)) {
          const backupRaw = fs.readFileSync(BACKUP_FILE, 'utf-8');
          return this.normalize(JSON.parse(backupRaw));
        }
      } catch (backupError) {
        console.error('Yedek veri de okunamadı:', backupError.message);
      }

      return this.normalize({});
    }
  }

  static saveData(data) {
    ensureDir();

    const normalized = this.normalize(data);
    normalized.updatedAt = now();

    try {
      if (fs.existsSync(STORAGE_FILE)) {
        fs.copyFileSync(STORAGE_FILE, BACKUP_FILE);
      }

      const tempFile = `${STORAGE_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(normalized, null, 2));
      fs.renameSync(tempFile, STORAGE_FILE);
    } catch (error) {
      console.error('Veri kayıt hatası:', error.message);
    }
  }

  static update(mutator) {
    const data = this.loadData();
    const result = mutator(data);
    this.saveData(data);
    return result;
  }

  static set(key, value) {
    this.update((data) => {
      data.kv[key] = value;
    });
  }

  static get(key) {
    const data = this.loadData();
    return Object.prototype.hasOwnProperty.call(data.kv, key) ? data.kv[key] : null;
  }

  static delete(key) {
    this.update((data) => {
      delete data.kv[key];
    });
  }

  static getAll() {
    return this.loadData().kv;
  }

  static getDatabase() {
    return this.loadData();
  }

  static clear() {
    this.saveData(clone(DEFAULT_DATA));
  }

  static setGuildSetting(guildId, key, value) {
    this.update((data) => {
      if (!data.settings[guildId]) data.settings[guildId] = {};
      data.settings[guildId][key] = value;
      data.kv[`guild_${guildId}_${key}`] = value;
    });
  }

  static getGuildSetting(guildId, key, fallback = null) {
    const data = this.loadData();
    if (data.settings[guildId] && Object.prototype.hasOwnProperty.call(data.settings[guildId], key)) {
      return data.settings[guildId][key];
    }

    const legacyKey = `guild_${guildId}_${key}`;
    return Object.prototype.hasOwnProperty.call(data.kv, legacyKey) ? data.kv[legacyKey] : fallback;
  }

  static getGuildSettings(guildId) {
    const data = this.loadData();
    const settings = { ...(data.settings[guildId] || {}) };
    const guildPrefix = `guild_${guildId}_`;

    Object.keys(data.kv).forEach((key) => {
      if (key.startsWith(guildPrefix)) {
        settings[key.replace(guildPrefix, '')] = data.kv[key];
      }
    });

    return settings;
  }

  static deleteGuild(guildId) {
    this.update((data) => {
      delete data.settings[guildId];
      delete data.guilds[guildId];

      const guildPrefix = `guild_${guildId}_`;
      Object.keys(data.kv).forEach((key) => {
        if (key.startsWith(guildPrefix)) delete data.kv[key];
      });
    });
  }

  static upsertGuild(guild) {
    if (!guild) return;

    this.update((data) => {
      const previous = data.guilds[guild.id] || {};
      data.guilds[guild.id] = {
        ...previous,
        id: guild.id,
        name: guild.name,
        ownerId: guild.ownerId,
        memberCount: guild.memberCount,
        iconURL: typeof guild.iconURL === 'function' ? guild.iconURL() : null,
        lastSeenAt: now()
      };
    });
  }

  static upsertUser(user, guildId = null, extra = {}) {
    if (!user) return;

    this.update((data) => {
      const previous = data.users[user.id] || { guilds: {} };
      data.users[user.id] = {
        ...previous,
        id: user.id,
        username: user.username,
        tag: user.tag,
        bot: Boolean(user.bot),
        avatarURL: typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL({ dynamic: true }) : null,
        guilds: previous.guilds || {},
        lastSeenAt: now(),
        ...extra
      };

      if (guildId) {
        data.users[user.id].guilds[guildId] = {
          ...(data.users[user.id].guilds[guildId] || {}),
          lastSeenAt: now(),
          ...extra
        };
      }
    });
  }

  static addLog(type, payload = {}) {
    return this.update((data) => {
      const entry = {
        id: makeId('log'),
        type,
        createdAt: now(),
        ...payload
      };

      data.logs.push(entry);
      if (data.logs.length > 5000) data.logs = data.logs.slice(-5000);
      return entry;
    });
  }

  static addPunishment(payload = {}) {
    return this.update((data) => {
      const entry = {
        id: makeId('case'),
        createdAt: now(),
        active: true,
        ...payload
      };

      data.punishments.push(entry);
      return entry;
    });
  }

  static closePunishment(filter = {}, payload = {}) {
    return this.update((data) => {
      const entry = [...data.punishments].reverse().find((item) => {
        return Object.entries(filter).every(([key, value]) => item[key] === value);
      });

      if (!entry) return null;
      entry.active = false;
      entry.closedAt = now();
      Object.assign(entry, payload);
      return entry;
    });
  }

  static addTicket(payload = {}) {
    return this.update((data) => {
      const entry = {
        id: makeId('ticket'),
        createdAt: now(),
        status: 'open',
        ...payload
      };

      data.tickets.push(entry);
      return entry;
    });
  }

  static updateTicket(filter = {}, payload = {}) {
    return this.update((data) => {
      const entry = [...data.tickets].reverse().find((item) => {
        return Object.entries(filter).every(([key, value]) => item[key] === value);
      });

      if (!entry) return null;
      Object.assign(entry, payload, { updatedAt: now() });
      return entry;
    });
  }
}

module.exports = Storage;
