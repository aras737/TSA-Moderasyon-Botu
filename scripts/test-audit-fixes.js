'use strict';

// Denetim düzeltmeleri için testler: etkileşim sahipliği, güvenli tarih, giriş/çıkış logu,
// sunucu daveti bildirimi (yarış/yeniden deneme/izin) ve storage yedek kurtarma.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ChannelType } = require('discord.js');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmf-audit-'));
process.env.DATA_DIR = tmpDir;
process.env.BOT_OWNER_ID = '123456789012345678';

const registry = require('../utils/interaction-registry');
const { snowflakeToTimestamp, createdTimestampOf, discordTimestamp } = require('../utils/discord-time');
const Storage = require('../services/storage');
const { ayarKaydet } = require('../utils/db');
const invite = require('../services/guild-invite-notice');
const registerJoinLeave = require('../events/giriscikis');

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(`ok  ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

(async () => {
  // ---------- A) Buton / interaction sahipliği ----------
  await test('registry: kayıtlı önek ve aktif panel sahiplenilir, bilinmeyen sahiplenilmez', () => {
    registry._resetForTests();
    registry.registerPrefix('antibot_');
    registry.registerPanel('msg1', 1000, 0);

    assert.equal(registry.isHandledElsewhere({ customId: 'antibot_approve_1_2' }, 0), true);
    assert.equal(registry.isHandledElsewhere({ customId: 'onceki_sayfa', message: { id: 'msg1' } }, 500), true);
    assert.equal(registry.isHandledElsewhere({ customId: 'tmf_ticket_open', message: { id: 'other' } }, 500), false);
    assert.equal(registry.isHandledElsewhere(null), false);
  });

  await test('registry: süresi dolan / bırakılan panel artık sahiplenilmez', () => {
    registry._resetForTests();
    registry.registerPanel('msg2', 1000, 0);
    assert.equal(registry.isHandledElsewhere({ customId: 'x', message: { id: 'msg2' } }, 7000), false);

    registry.registerPanel('msg3', 100000, 0);
    registry.releasePanel('msg3');
    assert.equal(registry.isHandledElsewhere({ customId: 'x', message: { id: 'msg3' } }, 10), false);
  });

  await test('index.js: genel yönetici bileşen döngüsünden ÖNCE sahiplik kontrolü yapıyor', () => {
    const src = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
    const guard = src.indexOf('isHandledElsewhere(interaction)');
    const loop = src.indexOf('command.interactionHandler(interaction)');
    assert.ok(guard > -1 && loop > -1 && guard < loop);
  });

  // ---------- B) Tarih / null güvenliği ----------
  await test('discord-time: snowflake, null ve geçersiz değerler', () => {
    const id = '175928847299117063';
    assert.equal(snowflakeToTimestamp(id), 1462015105796);
    assert.equal(snowflakeToTimestamp('abc'), null);
    assert.equal(snowflakeToTimestamp(null), null);

    assert.equal(createdTimestampOf({ id, createdTimestamp: null }), 1462015105796);
    assert.equal(createdTimestampOf({ id: 'bozuk', createdTimestamp: NaN }), null);
    assert.equal(createdTimestampOf(null), null);
    assert.equal(discordTimestamp(NaN), 'Bilinmiyor');
    assert.equal(discordTimestamp(null), 'Bilinmiyor');
    assert.match(discordTimestamp(1462015105796, 'R'), /^<t:1462015105:R>$/);
  });

  await test('giriscikis: createdTimestamp null olsa da embed\'e NaN yazılmaz', async () => {
    const guildId = '222222222222222222';
    ayarKaydet(guildId, 'girisCikisKanal', 'chan1');
    ayarKaydet(guildId, 'girisCikisDurum', true);

    const handlers = {};
    registerJoinLeave({ on: (event, fn) => { handlers[event] = fn; } });

    const sent = [];
    const guild = {
      id: guildId,
      memberCount: 5,
      channels: { fetch: async () => ({ isTextBased: () => true, send: async payload => sent.push(payload) }) }
    };
    const user = {
      id: '175928847299117063',
      createdTimestamp: null,
      bot: false,
      username: 'deneme',
      tag: 'deneme#0',
      toString: () => '<@175928847299117063>',
      displayAvatarURL: () => 'https://cdn.example/avatar.png'
    };

    await handlers.guildMemberAdd({ user, guild });
    assert.equal(sent.length, 1);
    const description = sent[0].embeds[0].data.description;
    assert.ok(!/NaN|undefined/.test(description), description);
    assert.match(description, /<t:\d+:R>/);

    // Kullanıcısı olmayan (partial) üye çökmemeli.
    await handlers.guildMemberAdd({ guild });
    await handlers.guildMemberRemove({ guild });
    assert.equal(sent.length, 1);
  });

  // ---------- C) Sunucu daveti bildirimi ----------
  const makeStorage = () => {
    const map = new Map();
    return { map, get: key => (map.has(key) ? map.get(key) : null), set: (key, value) => { map.set(key, value); } };
  };
  const makeGuild = ({ canInvite = true, id = '333333333333333333' } = {}) => {
    const channel = {
      id: 'c1',
      type: ChannelType.GuildText,
      permissionsFor: member => ({ has: () => canInvite && member?.isMe === true }),
      createInvite: async () => ({ url: 'https://discord.gg/test' })
    };
    return {
      id,
      name: 'Deneme',
      ownerId: '444444444444444444',
      memberCount: 3,
      available: true,
      iconURL: () => null,
      channels: { fetch: async () => {}, cache: new Map([['c1', channel]]) },
      members: { me: { isMe: true } }
    };
  };
  const makeClient = ({ failSend = false } = {}) => {
    const sends = [];
    return {
      sends,
      users: {
        fetch: async () => ({
          send: async payload => {
            if (failSend) throw new Error('DM kapalı');
            await new Promise(resolve => setTimeout(resolve, 10));
            sends.push(payload);
          }
        })
      }
    };
  };

  await test('davet: guildCreate + tarama aynı anda çalışsa da tek DM gider', async () => {
    const Store = makeStorage();
    const client = makeClient();
    const guild = makeGuild();
    const [a, b] = await Promise.all([
      invite.notifyOwnerAboutGuild(guild, client, Store),
      invite.notifyOwnerAboutGuild(guild, client, Store)
    ]);
    assert.deepEqual([a, b].sort(), [false, true]);
    assert.equal(client.sends.length, 1);
    assert.ok(Store.get('owner-guild-invite-notified:333333333333333333'));
    assert.equal(await invite.notifyOwnerAboutGuild(guild, client, Store), false); // tekrar yok
    assert.equal(client.sends.length, 1);
  });

  await test('davet: DM başarısızsa kayıt tutulur, bekleme sonrası yeniden denenebilir', async () => {
    const Store = makeStorage();
    const guild = makeGuild({ id: '555555555555555555' });
    const failing = makeClient({ failSend: true });

    assert.equal(await invite.notifyOwnerAboutGuild(guild, failing, Store), false);
    const attempt = Store.get('owner-guild-invite-attempt:555555555555555555');
    assert.equal(attempt.count, 1);
    assert.equal(Store.get('owner-guild-invite-notified:555555555555555555'), null);

    const now = attempt.lastAt;
    assert.equal(invite.needsNotification(guild, Store, now + 1000), false); // bekleme süresi dolmadı
    assert.equal(invite.needsNotification(guild, Store, now + invite.retryDelayFor(1) + 1), true);

    const working = makeClient();
    assert.equal(await invite.notifyOwnerAboutGuild(guild, working, Store), true);
    assert.equal(working.sends.length, 1);
    assert.equal(Store.get('owner-guild-invite-attempt:555555555555555555'), null);
  });

  await test('davet: deneme sınırı aşılınca otomatik deneme durur', () => {
    const Store = makeStorage();
    Store.set('owner-guild-invite-attempt:666666666666666666', { count: invite.MAX_ATTEMPTS, lastAt: 0 });
    assert.equal(invite.needsNotification({ id: '666666666666666666', available: true }, Store, Date.now()), false);
  });

  await test('davet: Davet Oluştur izni yoksa çökmeden bilgi DM\'i gider', async () => {
    const Store = makeStorage();
    const client = makeClient();
    const guild = makeGuild({ canInvite: false, id: '777777777777777777' });
    assert.equal(await invite.notifyOwnerAboutGuild(guild, client, Store), true);
    const field = client.sends[0].embeds[0].data.fields[0].value;
    assert.match(field, /Create Invite/);
  });

  await test('davet: geçersiz BOT_OWNER_ID veya erişilemeyen sunucuda DM gitmez', async () => {
    const Store = makeStorage();
    const client = makeClient();
    assert.equal(await invite.notifyOwnerAboutGuild({ ...makeGuild(), available: false }, client, Store), false);

    const saved = process.env.BOT_OWNER_ID;
    process.env.BOT_OWNER_ID = 'bozuk';
    assert.equal(await invite.notifyOwnerAboutGuild(makeGuild({ id: '888888888888888888' }), client, Store), false);
    process.env.BOT_OWNER_ID = saved;
    assert.equal(client.sends.length, 0);
  });

  // ---------- E) Storage ----------
  await test('storage: ana dosya silinirse yedekten geri yüklenir, boş veriyle yedek ezilmez', () => {
    const file = path.join(tmpDir, 'storage.json');
    const backup = path.join(tmpDir, 'storage.backup.json');

    Storage.set('kritik', 'deger-1');
    Storage.set('kritik', 'deger-2'); // yedek artık deger-1'i içerir
    fs.unlinkSync(file);
    Storage.cache = null;
    Storage.lastGoodSerialized = null;

    assert.equal(Storage.get('kritik'), 'deger-1');
    assert.ok(fs.existsSync(file));
    Storage.set('baska', 1);
    assert.equal(JSON.parse(fs.readFileSync(backup, 'utf8')).kv.kritik, 'deger-1');
  });

  await test('storage: diskte bozulan ana dosya bir sonraki kayıtta yedeğin üzerine kopyalanmaz', () => {
    const file = path.join(tmpDir, 'storage.json');
    const backup = path.join(tmpDir, 'storage.backup.json');

    Storage.set('a', 'iyi');
    fs.writeFileSync(file, '{bozuk json'); // dışarıdan bozuldu
    Storage.set('b', 'yeni');

    const backupData = JSON.parse(fs.readFileSync(backup, 'utf8')); // parse edilebilmeli
    assert.equal(backupData.kv.a, 'iyi');
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).kv.b, 'yeni');
  });

  console.log(results.join('\n'));
  console.log(`✅ Denetim düzeltme testleri geçti (${results.length} test).`);
  fs.rmSync(tmpDir, { recursive: true, force: true });
})().catch(error => {
  console.error(error);
  process.exit(1);
});
