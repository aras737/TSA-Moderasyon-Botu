'use strict';
const {
  SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const Storage = require('../services/storage');

const KEY = id => 'panel:banlist:' + id;
const IDS = new Set(['onceki_sayfa', 'sonraki_sayfa', 'filtre_hepsi', 'filtre_tam', 'filtre_standart']);

function splitBans(bans) {
  const all = [...bans.values()];
  return {
    all,
    global: all.filter(x => (x.reason || '').includes('TMF Küresel Yasaklama')),
    standard: all.filter(x => !(x.reason || '').includes('TMF Küresel Yasaklama'))
  };
}
function makeEmbed(guild, user, state, lists) {
  const selected = state.filter === 'tam' ? lists.global : state.filter === 'standart' ? lists.standard : lists.all;
  const pages = Math.max(1, Math.ceil(selected.length / 10));
  state.page = Math.min(Math.max(0, state.page), pages - 1);
  const rows = selected.slice(state.page * 10, state.page * 10 + 10);
  const title = state.filter === 'tam' ? 'TMF | Tam Yasaklananlar Bölümü'
    : state.filter === 'standart' ? 'TMF | Standart Sunucu Yasakları Bölümü' : 'TMF | Genel Yasaklı Listesi';
  const description = rows.length ? rows.map((ban, i) => {
    const global = (ban.reason || '').includes('TMF Küresel Yasaklama');
    return '**' + (state.page * 10 + i + 1) + '.** **' + (ban.user?.tag || 'Bilinmeyen') +
      '** \`(' + ban.user?.id + ')\` — ' + (global ? '🔴 \`[KÜRESEL TAM YASAK]\`' : '🟡 \`[SUNUCU YASAĞI]\`') +
      '\n┗ **Sebep:** ' + String(ban.reason || 'Sebep belirtilmemiş.').slice(0, 180);
  }).join('\n\n') : '*Bu bölümde listelenecek herhangi bir yasaklı üye bulunmuyor.*';
  return new EmbedBuilder().setTitle(title).setDescription(
    '📊 **Bölüm İstatistikleri:**\n' +
    '• Toplam Yasaklı: **' + lists.all.length + '**\n' +
    '• Tam Yasaklananlar: **' + lists.global.length + '**\n' +
    '• Standart Yasaklananlar: **' + lists.standard.length + '**\n\n' +
    '• Şu an gösterilen: **' + selected.length + '** üye\n\n' + description
  ).setColor(state.filter === 'tam' ? '#7a0010' : state.filter === 'standart' ? '#f1c40f' : '#ff4d4d')
   .setThumbnail(guild.iconURL() || undefined)
   .setFooter({ text: 'Sayfa: ' + (state.page + 1) + '/' + pages + ' | Bölüm: ' + state.filter.toUpperCase() })
   .setTimestamp();
}
function makeComponents(state, lists) {
  const selected = state.filter === 'tam' ? lists.global : state.filter === 'standart' ? lists.standard : lists.all;
  const pages = Math.max(1, Math.ceil(selected.length / 10));
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('onceki_sayfa').setLabel('Geri').setEmoji('◀️').setStyle(ButtonStyle.Primary).setDisabled(state.page <= 0),
      new ButtonBuilder().setCustomId('sonraki_sayfa').setLabel('İleri').setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(state.page >= pages - 1)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('filtre_hepsi').setLabel('Tümü').setStyle(state.filter === 'hepsi' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('filtre_tam').setLabel('Tam Yasaklılar').setStyle(state.filter === 'tam' ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('filtre_standart').setLabel('Sunucu Yasakları').setStyle(state.filter === 'standart' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    )
  ];
}
module.exports = {
  requiredPerms: [PermissionsBitField.Flags.BanMembers],
  data: new SlashCommandBuilder().setName('banlist')
    .setDescription('TMF sunucusundaki yasaklıları bölümlere ayırarak listeler.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const lists = splitBans(await interaction.guild.bans.fetch());
      const state = { ownerId: interaction.user.id, guildId: interaction.guildId, filter: 'hepsi', page: 0 };
      const message = await interaction.editReply({ embeds: [makeEmbed(interaction.guild, interaction.user, state, lists)], components: makeComponents(state, lists) });
      Storage.set(KEY(message.id), state);
    } catch (error) {
      console.error('[BANLIST] Panel oluşturulamadı:', error);
      await interaction.editReply({ content: '❌ Yasaklı listesi alınamadı.', embeds: [], components: [] }).catch(() => {});
    }
  },
  async interactionHandler(interaction) {
    if (!interaction.isButton() || !IDS.has(interaction.customId)) return;
    const state = Storage.get(KEY(interaction.message.id));
    if (!state) return;
    if (interaction.guildId !== state.guildId) return interaction.reply({ content: 'Bu panel artık geçerli değil.', flags: MessageFlags.Ephemeral });
    if (interaction.user.id !== state.ownerId) return interaction.reply({ content: 'Bu listeyi yalnızca komutu kullanan kişi yönetebilir.', flags: MessageFlags.Ephemeral });
    await interaction.deferUpdate();
    if (interaction.customId === 'onceki_sayfa') state.page = Math.max(0, state.page - 1);
    else if (interaction.customId === 'sonraki_sayfa') state.page += 1;
    else { state.filter = interaction.customId === 'filtre_tam' ? 'tam' : interaction.customId === 'filtre_standart' ? 'standart' : 'hepsi'; state.page = 0; }
    try {
      const guild = await interaction.client.guilds.fetch(state.guildId);
      const lists = splitBans(await guild.bans.fetch());
      await interaction.editReply({ embeds: [makeEmbed(guild, interaction.user, state, lists)], components: makeComponents(state, lists) });
      Storage.set(KEY(interaction.message.id), state);
    } catch (error) {
      console.error('[BANLIST] Kalıcı panel hatası:', error);
      await interaction.followUp({ content: 'Liste yenilenemedi. Botun Ban Members iznini kontrol et.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
};
