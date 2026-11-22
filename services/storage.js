const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '../data');
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
  static cache = null;
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
    if (this.cache) return this.cache;
    ensureDir();

    try {
      if (!fs.existsSync(STORAGE_FILE)) {
        const fresh = this.normalize({});
        this.saveData(fresh);
        return this.cache || fresh;
      }

      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      this.cache = this.normalize(raw.trim() ? JSON.parse(raw) : {});
      return this.cache;
    } catch (error) {
      console.error('Veri yükleme hatası, yedek deneniyor:', error.message);

      try {
        if (fs.existsSync(BACKUP_FILE)) {
          const backupRaw = fs.readFileSync(BACKUP_FILE, 'utf-8');
          const restored = this.normalize(JSON.parse(backupRaw));

          // Restore the primary file before returning. Otherwise the next save
          // would copy the corrupt primary over the last known-good backup.
          const restoreFile = `${STORAGE_FILE}.restore.tmp`;
          fs.writeFileSync(restoreFile, JSON.stringify(restored, null, 2));
          fs.renameSync(restoreFile, STORAGE_FILE);
          this.cache = restored;
          return this.cache;
        }
      } catch (backupError) {
        console.error('Yedek veri de okunamadı:', backupError.message);
      }

      this.cache = this.normalize({});
      return this.cache;
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
      this.cache = normalized;
      return true;
    } catch (error) {
      console.error('Veri kayıt hatası:', error.message);
      return false;
    }
  }

  static update(mutator) {
    // Mutators work on a private copy so a failed disk write cannot corrupt
    // the in-memory read cache.
    const data = clone(this.loadData());
    const result = mutator(data);
    if (!this.saveData(data)) {
      throw new Error('TMF veri dosyasına yazılamadı; değişiklik kaydedilmedi.');
    }
    return result;
  }

  static set(key, value) {
    this.update((data) => {
      data.kv[key] = value;
    });
  }

  static get(key) {
    const data = this.loadData();
    const value = Object.prototype.hasOwnProperty.call(data.kv, key) ? data.kv[key] : null;
    return value && typeof value === 'object' ? clone(value) : value;
  }

  static delete(key) {
    this.update((data) => {
      delete data.kv[key];
    });
  }

  static getAll() {
    return clone(this.loadData().kv);
  }

  static getDatabase() {
    return clone(this.loadData());
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
      const value = data.settings[guildId][key];
      return value && typeof value === 'object' ? clone(value) : value;
    }

    const legacyKey = `guild_${guildId}_${key}`;
    const value = Object.prototype.hasOwnProperty.call(data.kv, legacyKey) ? data.kv[legacyKey] : fallback;
    return value && typeof value === 'object' ? clone(value) : value;
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

    return clone(settings);
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

  static pendingLogs = [];
  static pendingUsers = new Map();
  static pendingGuilds = new Map();

  // Batch high-volume gateway logs so every Discord message does not cause
  // multiple synchronous full-file reads, copies and writes on the event loop.
  static queueGuildUpsert(guild) {
    if (!guild?.id) return;
    this.pendingGuilds.set(guild.id, {
      id: guild.id,
      name: guild.name || null,
      ownerId: guild.ownerId || null,
      memberCount: guild.memberCount ?? null,
      iconURL: typeof guild.iconURL === 'function' ? guild.iconURL() : null
    });
    if (this.pendingGuilds.size > 250) {
      const oldestId = this.pendingGuilds.keys().next().value;
      if (oldestId) this.pendingGuilds.delete(oldestId);
    }
  }

  static queueUserUpsert(user, guildId = null, extra = {}) {
    if (!user?.id) return;
    this.pendingUsers.set(user.id, {
      id: user.id,
      username: user.username || null,
      tag: user.tag || null,
      bot: Boolean(user.bot),
      avatarURL: typeof user.displayAvatarURL === 'function'
        ? user.displayAvatarURL({ dynamic: true })
        : null,
      guildId,
      extra: { ...extra }
    });
    if (this.pendingUsers.size > 2000) {
      const oldestId = this.pendingUsers.keys().next().value;
      if (oldestId) this.pendingUsers.delete(oldestId);
    }
  }

  static queueLog(type, payload = {}) {
    const entry = {
      id: makeId('log'),
      type,
      createdAt: now(),
      ...payload
    };

    this.pendingLogs.push(entry);
    if (this.pendingLogs.length > 2000) {
      this.pendingLogs.splice(0, this.pendingLogs.length - 2000);
    }

    return entry;
  }

  static flushQueuedLogs() {
    if (!this.pendingLogs?.length && !this.pendingUsers?.size && !this.pendingGuilds?.size) return 0;

    const batch = this.pendingLogs.splice(0, this.pendingLogs.length);
    const users = [...this.pendingUsers.values()];
    const guilds = [...this.pendingGuilds.values()];
    this.pendingUsers.clear();
    this.pendingGuilds.clear();
    try {
      this.update((data) => {
      for (const guild of guilds) {
        const previous = data.guilds[guild.id] || {};
        data.guilds[guild.id] = { ...previous, ...guild, lastSeenAt: now() };
      }
      for (const update of users) {
        const previous = data.users[update.id] || { guilds: {} };
        data.users[update.id] = {
          ...previous,
          id: update.id,
          username: update.username,
          tag: update.tag,
          bot: update.bot,
          avatarURL: update.avatarURL,
          guilds: previous.guilds || {},
          lastSeenAt: now(),
          ...update.extra
        };
        if (update.guildId) {
          data.users[update.id].guilds[update.guildId] = {
            ...(data.users[update.id].guilds[update.guildId] || {}),
            lastSeenAt: now(),
            ...update.extra
          };
        }
      }
      data.logs.push(...batch);
        if (data.logs.length > 5000) data.logs = data.logs.slice(-5000);
      });
      return batch.length + users.length + guilds.length;
    } catch (error) {
      this.pendingLogs.unshift(...batch);
      for (const user of users) {
        if (!this.pendingUsers.has(user.id)) this.pendingUsers.set(user.id, user);
      }
      for (const guild of guilds) {
        if (!this.pendingGuilds.has(guild.id)) this.pendingGuilds.set(guild.id, guild);
      }
      throw error;
    }
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
      if (data.punishments.length > 10000) data.punishments = data.punishments.slice(-10000);
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
      if (data.tickets.length > 10000) data.tickets = data.tickets.slice(-10000);
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
