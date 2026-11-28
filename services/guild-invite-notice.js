'use strict';

const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

function notifiedKey(guildId) {
  return `owner-guild-invite-notified:${guildId}`;
}

async function createOwnerInvite(guild, client) {
  try {
    await guild.channels.fetch();
  } catch (error) {
    console.warn(`[GUILD-INVITE] ${guild.id} kanal listesi alınamadı:`, error?.message || error);
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
    const permissions = channel.permissionsFor(client.user);
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

async function notifyOwnerAboutGuild(guild, client, Storage) {
  const ownerId = process.env.BOT_OWNER_ID;
  if (!/^\d{17,20}$/.test(ownerId || '')) {
    console.warn('[GUILD-INVITE] BOT_OWNER_ID geçersiz; sunucu bildirimi atlandı.');
    return false;
  }

  const key = notifiedKey(guild.id);
  try {
    if (Storage.get(key)) return false;
  } catch (error) {
    console.warn('[GUILD-INVITE] Bildirim kaydı okunamadı:', error?.message || error);
  }

  try {
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

    const icon = guild.iconURL({ size: 256 });
    if (icon) embed.setThumbnail(icon);

    await owner.send({ embeds: [embed] });
    try {
      Storage.set(key, new Date().toISOString());
    } catch (error) {
      console.warn('[GUILD-INVITE] Bildirim gönderildi ancak tekrar bildirim kaydedilemedi:', error?.message || error);
    }

    console.log(`[GUILD-INVITE] ${guild.name} (${guild.id}) sunucu bildirimi sahibine gönderildi.`);
    return true;
  } catch (error) {
    console.warn(`[GUILD-INVITE] ${guild.id} bildirimi sahibine gönderilemedi:`, error?.message || error);
    return false;
  }
}

function registerGuildInviteNotifications(client, Storage) {
  client.on('guildCreate', guild => {
    void notifyOwnerAboutGuild(guild, client, Storage);
  });

  // Bot yeniden başlatıldığında daha önce bildirilememiş mevcut sunucuları da kontrol et.
  client.once('clientReady', async () => {
    for (const guild of client.guilds.cache.values()) {
      await notifyOwnerAboutGuild(guild, client, Storage);
    }
  });
}

module.exports = { registerGuildInviteNotifications, notifyOwnerAboutGuild };
