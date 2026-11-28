'use strict';
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const Storage = require('../services/storage');
const KEY = id => 'panel:roblox-groups:' + id;
const IDS = new Set(['roblox_groups_previous', 'roblox_groups_next']);

function embedFor(data, page) {
  const perPage = 8;
  const totalPages = Math.max(1, Math.ceil(data.groups.length / perPage));
  const current = Math.max(0, Math.min(page, totalPages - 1));
  const embed = new EmbedBuilder().setColor('#2b2d31').setTitle('👥 Roblox Grup Listesi')
    .setDescription('**Kullanıcı:** ' + data.username + '\n**Roblox ID:** \`' + data.robloxId + '\`\n**Toplam Grup:** ' + data.groups.length + '\n**Sayfa:** ' + (current + 1) + ' / ' + totalPages)
    .setFooter({ text: 'TMF | Roblox Grup Sorgulama' }).setTimestamp();
  for (const item of data.groups.slice(current * perPage, current * perPage + perPage)) {
    embed.addFields({ name: '🏷️ ' + String(item.group?.name || 'Bilinmeyen grup').slice(0, 200),
      value: '**Rütbe:** ' + String(item.role?.name || 'Bilinmeyen rütbe').slice(0, 100) + ' (Rank: \`' + Number(item.role?.rank || 0) + '\`)\n' +
        '**Üye:** ' + Number(item.group?.memberCount || 0).toLocaleString('tr-TR') + '\n**Grup ID:** \`' + (item.group?.id || '—') + '\`',
      inline: false });
  }
  return { embed, page: current, totalPages };
}
function components(page, totalPages) {
  if (totalPages <= 1) return [];
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('roblox_groups_previous').setLabel('Önceki').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId('roblox_groups_next').setLabel('Sonraki').setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1)
  )];
}
module.exports = {
  data: new SlashCommandBuilder().setName('grup_listele').setDescription('Belirtilen Roblox kullanıcısının katıldığı grupları listeler.')
    .addStringOption(o => o.setName('kullanici_adi').setDescription('Roblox kullanıcı adı').setMinLength(3).setMaxLength(20).setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const username = interaction.options.getString('kullanici_adi', true).trim();
      const userRes = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }), signal: AbortSignal.timeout(10000)
      });
      if (!userRes.ok) throw new Error('Roblox kullanıcı API HTTP ' + userRes.status);
      const user = (await userRes.json()).data?.[0];
      if (!user?.id || !user?.name) return interaction.editReply({ content: '❌ Roblox hesabı bulunamadı.' });
      const groupRes = await fetch('https://groups.roblox.com/v1/users/' + user.id + '/groups/roles', { signal: AbortSignal.timeout(10000) });
      if (!groupRes.ok) throw new Error('Roblox grup API HTTP ' + groupRes.status);
      const groups = (await groupRes.json()).data;
      if (!Array.isArray(groups)) throw new Error('Roblox grup API geçersiz yanıt döndürdü.');
      if (!groups.length) return interaction.editReply({ content: '👥 **' + user.name + '** herhangi bir Roblox grubuna üye değil.' });
      const data = { ownerId: interaction.user.id, username: user.name, robloxId: user.id, groups };
      const result = embedFor(data, 0);
      const message = await interaction.editReply({ embeds: [result.embed], components: components(result.page, result.totalPages) });
      if (result.totalPages > 1) Storage.set(KEY(message.id), { ...data, page: 0 });
    } catch (error) {
      console.error('[ROBLOX GROUPS] Listeleme hatası:', error);
      await interaction.editReply({ content: '❌ Roblox grupları alınamadı. API bağlantısını veya kullanıcı adını kontrol et.', embeds: [], components: [] }).catch(() => {});
    }
  },
  async interactionHandler(interaction) {
    if (!interaction.isButton() || !IDS.has(interaction.customId)) return;
    const data = Storage.get(KEY(interaction.message.id));
    if (!data) return;
    if (interaction.user.id !== data.ownerId) return interaction.reply({ content: 'Bu sayfalama menüsünü yalnızca komutu kullanan kişi yönetebilir.', flags: MessageFlags.Ephemeral });
    data.page = Math.max(0, Math.min(Math.ceil(data.groups.length / 8) - 1, data.page + (interaction.customId === 'roblox_groups_next' ? 1 : -1)));
    const result = embedFor(data, data.page);
    await interaction.update({ embeds: [result.embed], components: components(result.page, result.totalPages) });
    Storage.set(KEY(interaction.message.id), data);
  }
};
