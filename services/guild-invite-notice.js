'use strict';

const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

// Aynı sunucu için aynı anda yalnızca tek bildirim süreci (guildCreate ↔ başlangıç taraması yarışı).
const inFlight = new Set();
// Başarısız bildirimler için bellek içi yeniden deneme zamanlayıcıları (guildId -> Timeout).
const retryTimers = new Map();

// n. başarısızlıktan sonra beklenecek süre. Liste bitince otomatik deneme durur.
const RETRY_DELAYS_MS = [5 * 60 * 1000, 30 * 60 * 1000, 2 * 60 * 60 * 1000, 12 * 60 * 60 * 1000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
// DATA_DIR yoksa (kalıcı depo yok) başlangıç taramasında sadece bu süre içinde katılınan sunucular bildirilir.
const RECENT_JOIN_MS = 15 * 60 * 1000;
const SCAN_SPACING_MS = 1500;

function notifiedKey(guildId) {
  return `owner-guild-invite-notified:${guildId}`;
}

function attemptKey(guildId) {
  return `owner-guild-invite-attempt:${guildId}`;
}

function isValidOwnerId(ownerId) {
  return /^\d{17,20}$/.test(ownerId || '');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readSafe(Storage, key) {
  try {
    return Storage.get(key);
  } catch (error) {
    console.warn(`[GUILD-INVITE] Kayıt okunamadı (${key}):`, error?.message || error);
    return null;
  }
}

function writeSafe(Storage, key, value) {
  try {
    Storage.set(key, value);
    return true;
  } catch (error) {
    console.warn(`[GUILD-INVITE] Kayıt yazılamadı (${key}):`, error?.message || error);
    return false;
  }
}

function retryDelayFor(failedAttempts) {
  if (failedAttempts <= 0) return 0;
  return RETRY_DELAYS_MS[Math.min(failedAttempts, RETRY_DELAYS_MS.length) - 1];
}

// Bu sunucu için şu an bildirim denenmeli mi? (başlangıç taramasının boşuna beklememesi için ayrı)
function needsNotification(guild, Storage, now = Date.now()) {
  if (!guild?.id || guild.available === false) return false;
  if (readSafe(Storage, notifiedKey(guild.id))) return false;

  const attempt = readSafe(Storage, attemptKey(guild.id));
  const count = Number(attempt?.count) || 0;
  if (count >= MAX_ATTEMPTS) return false;

  const lastAt = Number(attempt?.lastAt) || 0;
  return now - lastAt >= retryDelayFor(count);
}

async function createOwnerInvite(guild, client) {
  try {
    await guild.channels.fetch();
  } catch (error) {
    console.warn(`[GUILD-INVITE] ${guild.id} kanal listesi alınamadı:`, error?.message || error);
  }

  // permissionsFor(client.user) botun üye kaydı önbellekte yoksa null döner; üye nesnesini açıkça al.
  const me = guild.members?.me || await guild.members?.fetchMe?.().catch(() => null);
  if (!me) {
    console.warn(`[GUILD-INVITE] ${guild.id} için botun üye kaydı alınamadı; davet oluşturulmadı.`);
    return null;
  }

  const channels = [...guild.channels.cache.values()]
    .filter(channel =>
      [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)
    )
    .sort((a, b) => {
      if (a.id === guild.systemChannelId) return -1;
      if (b.id === guild.systemChannelId) return 1;
      return 0;
    });

  for (const channel of channels) {
    const permissions = channel.permissionsFor(me);
    if (!permissions?.has(PermissionFlagsBits.CreateInstantInvite)) continue;

    try {
      const invite = await channel.createInvite({
        maxAge: 86400,
        maxUses: 1,
        unique: true,
        reason: 'TMF botu sunucuya katıldı; bot sahibine katılım daveti gönderiliyor.'
      });
      return invite.url;
    } catch (error) {
      console.warn(`[GUILD-INVITE] ${guild.id} için davet oluşturulamadı:`, error?.message || error);
    }
  }

  return null;
}

function scheduleRetry(guild, client, Storage, failedAttempts) {
  if (failedAttempts >= MAX_ATTEMPTS || retryTimers.has(guild.id)) return;

  const delay = retryDelayFor(failedAttempts);
  const timer = setTimeout(() => {
    retryTimers.delete(guild.id);
    void notifyOwnerAboutGuild(guild, client, Storage);
  }, delay);
  timer.unref?.();
  retryTimers.set(guild.id, timer);
}

function recordFailure(guild, client, Storage) {
  const previous = readSafe(Storage, attemptKey(guild.id));
  const count = (Number(previous?.count) || 0) + 1;
  writeSafe(Storage, attemptKey(guild.id), { count, lastAt: Date.now() });
  scheduleRetry(guild, client, Storage, count);
}

async function notifyOwnerAboutGuild(guild, client, Storage) {
  const ownerId = process.env.BOT_OWNER_ID;
  if (!isValidOwnerId(ownerId)) {
    console.warn('[GUILD-INVITE] BOT_OWNER_ID geçersiz; sunucu bildirimi atlandı.');
    return false;
  }

  if (!guild?.id || guild.available === false) return false;

  // Aynı sunucu için eşzamanlı ikinci çağrı (guildCreate + tarama) DM'i çoğaltmasın.
  if (inFlight.has(guild.id)) return false;
  inFlight.add(guild.id);

  try {
    if (readSafe(Storage, notifiedKey(guild.id))) return false;

    const inviteUrl = await createOwnerInvite(guild, client);
    const owner = await client.users.fetch(ownerId);
    const embed = new EmbedBuilder()
      .setTitle('🆕 TMF | Bot yeni bir sunucuda')
      .setColor('#57d9c0')
      .setDescription(
        `**Sunucu:** ${guild.name}\n` +
        `**Sunucu ID:** \`${guild.id}\`\n` +
        `**Üye sayısı:** ${guild.memberCount ?? 'Bilinmiyor'}\n` +
        `**Sunucu sahibi:** <@!${guild.ownerId}> (\`${guild.ownerId}\`)`
      )
      .addFields({
        name: 'Sunucuya katıl',
        value: inviteUrl
          ? `[Davet bağlantısını aç](${inviteUrl}) — bağlantı 24 saat geçerli ve 1 kullanımlık.`
          : 'Botta **Davet Oluştur (Create Invite)** izni olan bir metin kanalı bulunamadı. Sunucu bilgileri gönderildi ancak davet bağlantısı oluşturulamadı.',
        inline: false
      })
      .setTimestamp();

    const icon = guild.iconURL?.({ size: 256 });
    if (icon) embed.setThumbnail(icon);

    await owner.send({ embeds: [embed] });

    if (!writeSafe(Storage, notifiedKey(guild.id), new Date().toISOString())) {
      console.warn('[GUILD-INVITE] Bildirim gönderildi ancak tekrar bildirim kaydedilemedi.');
    }
    writeSafe(Storage, attemptKey(guild.id), null);

    const pending = retryTimers.get(guild.id);
    if (pending) {
      clearTimeout(pending);
      retryTimers.delete(guild.id);
    }

    console.log(`[GUILD-INVITE] ${guild.name} (${guild.id}) sunucu bildirimi sahibine gönderildi.`);
    return true;
  } catch (error) {
    console.warn(`[GUILD-INVITE] ${guild.id} bildirimi sahibine gönderilemedi:`, error?.message || error);
    recordFailure(guild, client, Storage);
    return false;
  } finally {
    inFlight.delete(guild.id);
  }
}

function registerGuildInviteNotifications(client, Storage) {
  client.on('guildCreate', guild => {
    void notifyOwnerAboutGuild(guild, client, Storage).catch(error => {
      console.warn('[GUILD-INVITE] Beklenmeyen hata:', error?.message || error);
    });
  });

  // Bot yeniden başlatıldığında daha önce bildirilememiş mevcut sunucuları da kontrol et.
  client.once('clientReady', async () => {
    const persistent = Boolean(process.env.DATA_DIR);
    if (!persistent) {
      console.warn(
        '[GUILD-INVITE] DATA_DIR ayarlı değil: "bildirildi" kayıtları yeniden başlatmada silinebilir. ' +
        `Tekrar DM yağmasını önlemek için açılış taraması yalnızca son ${RECENT_JOIN_MS / 60000} dakikada katılınan sunucularla sınırlandı.`
      );
    }

    for (const guild of client.guilds.cache.values()) {
      try {
        if (!persistent) {
          const joinedAt = Number(guild.joinedTimestamp);
          if (!Number.isFinite(joinedAt) || Date.now() - joinedAt > RECENT_JOIN_MS) continue;
        }
        if (!needsNotification(guild, Storage)) continue;

        await notifyOwnerAboutGuild(guild, client, Storage);
        await sleep(SCAN_SPACING_MS);
      } catch (error) {
        console.warn(`[GUILD-INVITE] ${guild?.id} taranırken hata:`, error?.message || error);
      }
    }
  });
}

module.exports = {
  registerGuildInviteNotifications,
  notifyOwnerAboutGuild,
  needsNotification,
  retryDelayFor,
  MAX_ATTEMPTS
};
