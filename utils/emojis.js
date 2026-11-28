'use strict';

const FALLBACKS = Object.freeze({
  tik: '✅', baarsz: '❌', basarisiz: '❌', uyari: '⚠️',
  koruma1: '🛡️', sil: '🗑️', yasaklandi: '🔨', bilet: '🎫',
  Ses: '🔊', online: '🟢', Ofline: '⚫', megafon: '📢',
  tac: '👑', change: '🔄', Discord_Link: '🔗', global: '🌐',
  Ping_Pong: '🏓', last_yildirim: '⚡', antena: '📡'
});

const ALIASES = Object.freeze({
  '1505164671081123840': 'tik',
  '1505146967817326675': 'baarsz',
  '1505166167189487757': 'uyari',
  '1505143174190989352': 'koruma1',
  '1505147967907037275': 'sil',
  '1505146022588842095': 'yasaklandi',
  '1505453733969006602': 'bilet',
  '1505164439505342484': 'Ses',
  '1505167107338535003': 'Ses',
  '1505145208046878730': 'online',
  '1505145553925832704': 'Ofline',
  '1505454906176176241': 'megafon',
  '1505158450538352670': 'tac',
  '1505202806666170501': 'change',
  '1505166617426923661': 'Discord_Link',
  '1505146647221374977': 'global',
  '1505191883603710077': 'Ping_Pong',
  '1505192115565760564': 'last_yildirim',
  '1505192362270527518': 'antena',
  '1505146190973505567': 'uzaybot_kullanicilar',
  '1505146388596391977': 'Paper',
  '1505157853994815530': 'takviye',
  '1505159567879966811': 'appEmoji_kategori',
  '1505171054497370275': 'duration',
  '1505203119427162192': 'riva_kilit',
  '1505159120074833931': 'uzaybot_kanal',
  '1505192912680390827': 'Yetkili',
  '1505158932270813254': 'Logo_Boosts',
  '1505158205460844565': 'elner_tarih',
  '1505158042738491464': 'n_id',
  '1505162349026344970': 'uzaybot_mesaj',
  '1505162557009432626': 'RolsimgesiMasterNetworkz172',
  '1505162201273729044': 'mor_yildiz',
  '1505160480325632020': 'clip_board',
  '1505201454615629845': 'rol',
  '1505201065476362325': 'yeni',
  '1505202309343215717': 'join_join',
  '1505202549706195004': 'Leave_Leave',
  '1505171382483550258': 'music'
});

let emojis = new Map();

async function loadApplicationEmojis(client) {
  const next = new Map();

  // Önce botun bulunduğu sunuculardaki mevcut özel emojileri al.
  // Slash komutlarında kullanılan eski emoji ID'leri böylece korunur.
  for (const guild of client.guilds.cache.values()) {
    for (const customEmoji of guild.emojis.cache.values()) {
      if (customEmoji.name) next.set(customEmoji.name, customEmoji);
    }
  }

  // Uygulama emojileri aynı ada sahipse öncelik onlarda olsun.
  try {
    const fetched = await client.application.emojis.fetch();
    for (const customEmoji of fetched.values()) {
      if (customEmoji.name) next.set(customEmoji.name, customEmoji);
    }
  } catch (error) {
    console.warn('[EMOJI] Application Emojis alınamadı; sunucu emojileri kullanılmaya devam edecek:', error.message);
  }

  emojis = next;
  return emojis.size;
}

function emoji(name) {
  const found = emojis.get(name);
  if (found) return found.toString();
  return FALLBACKS[name] || '🔹';
}

function emojiData(name) {
  const found = emojis.get(name);
  return found ? { id: found.id, name: found.name } : null;
}

function replaceLegacyEmojis(text) {
  return String(text).replace(/<a?:([A-Za-z0-9_]+):(\d+)>/g, (match, oldName, id) => {
    const name = ALIASES[id] || oldName;
    return emoji(name);
  });
}

module.exports = { emoji, emojiData, loadApplicationEmojis, replaceLegacyEmojis, FALLBACKS, ALIASES };
