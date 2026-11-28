'use strict';

const THROTTLE_KEY = 'owner-startup-notice:last-sent-at';
const THROTTLE_MS = 10 * 60 * 1000;

function shouldSendOwnerNotice(lastSentAt, now = Date.now()) {
  return !Number.isFinite(Number(lastSentAt)) || now - Number(lastSentAt) >= THROTTLE_MS;
}

async function sendOwnerStartupNotice(client, Storage, commandCount, now = Date.now()) {
  const ownerId = process.env.BOT_OWNER_ID;
  if (!/^\d{17,20}$/.test(ownerId || '')) {
    console.warn('[OWNER-DM] BOT_OWNER_ID boş veya geçersiz; açılış bildirimi atlandı.');
    return false;
  }

  const lastSentAt = Storage.get(THROTTLE_KEY);
  if (!shouldSendOwnerNotice(lastSentAt, now)) {
    console.log('[OWNER-DM] Son 10 dakika içinde bildirim gönderilmiş; tekrar gönderilmedi.');
    return false;
  }

  try {
    const owner = await client.users.fetch(ownerId);
    const { EmbedBuilder } = require('discord.js');
    const dataDirSet = Boolean(process.env.DATA_DIR);
    const embed = new EmbedBuilder()
      .setTitle('TMF | Bot Başlatıldı')
      .setColor('#57d9c0')
      .addFields(
        { name: 'Bot', value: client.user?.tag || client.user?.username || 'Bilinmiyor', inline: true },
        { name: 'Açılış zamanı', value: new Date(now).toISOString(), inline: true },
        { name: 'Sunucu sayısı', value: String(client.guilds.cache.size), inline: true },
        { name: 'Yüklenen komut', value: String(commandCount), inline: true },
        { name: 'Git commit', value: process.env.RENDER_GIT_COMMIT ? process.env.RENDER_GIT_COMMIT.slice(0, 7) : 'Bilinmiyor', inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        { name: 'Kalıcı depo', value: dataDirSet ? 'DATA_DIR ayarlı' : '⚠️ DATA_DIR ayarlı değil; Render dosyaları kalıcı olmayabilir.', inline: false }
      )
      .setTimestamp(new Date(now));
    await owner.send({ embeds: [embed] });
    Storage.set(THROTTLE_KEY, now);
    console.log('[OWNER-DM] Bot açılış bildirimi gönderildi.');
    return true;
  } catch (error) {
    console.warn('[OWNER-DM] Sahibe DM gönderilemedi:', error?.message || error);
    return false;
  }
}

module.exports = { sendOwnerStartupNotice, shouldSendOwnerNotice, THROTTLE_MS, THROTTLE_KEY };
