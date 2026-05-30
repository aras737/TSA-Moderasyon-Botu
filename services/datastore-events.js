const Storage = require('./storage');

function serializeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    tag: user.tag,
    bot: Boolean(user.bot)
  };
}

function serializeGuild(guild) {
  if (!guild) return null;

  return {
    id: guild.id,
    name: guild.name,
    memberCount: guild.memberCount,
    ownerId: guild.ownerId
  };
}

function serializeChannel(channel) {
  if (!channel) return null;

  return {
    id: channel.id,
    name: channel.name,
    type: channel.type
  };
}

function safeContent(content) {
  if (!content) return '';
  return String(content).slice(0, 1500);
}

module.exports = function registerDatastoreEvents(client) {
  client.on('guildCreate', (guild) => {
    Storage.upsertGuild(guild);
    Storage.addLog('guildCreate', { guild: serializeGuild(guild) });
  });

  client.on('guildDelete', (guild) => {
    Storage.addLog('guildDelete', { guild: serializeGuild(guild) });
  });

  client.on('guildMemberAdd', (member) => {
    Storage.upsertGuild(member.guild);
    Storage.upsertUser(member.user, member.guild.id, {
      joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
      status: 'joined'
    });

    Storage.addLog('memberJoin', {
      guildId: member.guild.id,
      user: serializeUser(member.user),
      joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null
    });
  });

  client.on('guildMemberRemove', (member) => {
    Storage.upsertGuild(member.guild);
    Storage.upsertUser(member.user, member.guild.id, {
      leftAt: new Date().toISOString(),
      status: 'left'
    });

    Storage.addLog('memberLeave', {
      guildId: member.guild.id,
      user: serializeUser(member.user)
    });
  });

  client.on('guildMemberUpdate', (oldMember, newMember) => {
    Storage.upsertUser(newMember.user, newMember.guild.id, {
      nickname: newMember.nickname,
      roles: newMember.roles.cache.map((role) => role.id)
    });

    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    const addedRoles = newRoles.filter((role) => !oldRoles.has(role.id)).map((role) => ({ id: role.id, name: role.name }));
    const removedRoles = oldRoles.filter((role) => !newRoles.has(role.id)).map((role) => ({ id: role.id, name: role.name }));

    if (addedRoles.length || removedRoles.length || oldMember.nickname !== newMember.nickname) {
      Storage.addLog('memberUpdate', {
        guildId: newMember.guild.id,
        user: serializeUser(newMember.user),
        oldNickname: oldMember.nickname,
        newNickname: newMember.nickname,
        addedRoles,
        removedRoles
      });
    }
  });

  client.on('messageCreate', (message) => {
    if (!message.guild || message.author.bot) return;

    Storage.upsertUser(message.author, message.guild.id);
    Storage.addLog('messageCreate', {
      guildId: message.guild.id,
      channel: serializeChannel(message.channel),
      messageId: message.id,
      author: serializeUser(message.author),
      content: safeContent(message.content),
      attachments: message.attachments.map((attachment) => attachment.url)
    });
  });

  client.on('messageDelete', (message) => {
    if (!message.guild || message.author?.bot) return;

    Storage.addLog('messageDelete', {
      guildId: message.guild.id,
      channel: serializeChannel(message.channel),
      messageId: message.id,
      author: serializeUser(message.author),
      content: safeContent(message.content),
      attachments: message.attachments?.map((attachment) => attachment.url) || []
    });
  });

  client.on('messageUpdate', (oldMessage, newMessage) => {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    Storage.addLog('messageUpdate', {
      guildId: newMessage.guild.id,
      channel: serializeChannel(newMessage.channel),
      messageId: newMessage.id,
      author: serializeUser(newMessage.author),
      before: safeContent(oldMessage.content),
      after: safeContent(newMessage.content)
    });
  });

  client.on('interactionCreate', (interaction) => {
    if (!interaction.guild || !interaction.isChatInputCommand()) return;

    Storage.upsertUser(interaction.user, interaction.guild.id);
    Storage.addLog('commandRun', {
      guildId: interaction.guild.id,
      channel: serializeChannel(interaction.channel),
      commandName: interaction.commandName,
      user: serializeUser(interaction.user)
    });
  });

  client.on('guildBanAdd', (ban) => {
    Storage.upsertUser(ban.user, ban.guild.id, { status: 'banned' });
    Storage.addPunishment({
      type: 'ban',
      guildId: ban.guild.id,
      userId: ban.user.id,
      user: serializeUser(ban.user),
      reason: ban.reason || null
    });
  });

  client.on('guildBanRemove', (ban) => {
    Storage.upsertUser(ban.user, ban.guild.id, { status: 'unbanned' });
    Storage.closePunishment(
      { type: 'ban', guildId: ban.guild.id, userId: ban.user.id, active: true },
      { removedUserId: ban.user.id }
    );
    Storage.addLog('guildBanRemove', {
      guildId: ban.guild.id,
      user: serializeUser(ban.user)
    });
  });

  client.on('channelCreate', (channel) => {
    if (!channel.guild) return;
    Storage.addLog('channelCreate', {
      guildId: channel.guild.id,
      channel: serializeChannel(channel)
    });
  });

  client.on('channelDelete', (channel) => {
    if (!channel.guild) return;
    Storage.addLog('channelDelete', {
      guildId: channel.guild.id,
      channel: serializeChannel(channel)
    });
  });

  client.on('roleCreate', (role) => {
    Storage.addLog('roleCreate', {
      guildId: role.guild.id,
      role: { id: role.id, name: role.name }
    });
  });

  client.on('roleDelete', (role) => {
    Storage.addLog('roleDelete', {
      guildId: role.guild.id,
      role: { id: role.id, name: role.name }
    });
  });
};
