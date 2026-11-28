'use strict';
const assert = require('node:assert/strict');
const { emoji, emojiData, loadApplicationEmojis, replaceLegacyEmojis, FALLBACKS } = require('../utils/emojis');
const { shouldSendOwnerNotice, THROTTLE_MS } = require('../utils/owner-notice');

async function run() {
  assert.equal(emoji('tik'), '✅');
  assert.equal(emoji('baarsz'), '❌');
  assert.equal(emoji('uyari'), '⚠️');
  assert.equal(emoji('unknown_name'), '🔹');
  assert.equal(emojiData('tik'), null);
  assert.equal(replaceLegacyEmojis('Durum: <:tik:1505164671081123840>'), 'Durum: ✅');
  assert.equal(Object.keys(FALLBACKS).length > 0, true);

  const fakeClient = { application: { emojis: { fetch: async () => new Map([
    ['one', { name: 'tik', id: '12345678901234567', toString: () => '<:tik:12345678901234567>' }]
  ]) } } };
  await loadApplicationEmojis(fakeClient);
  assert.equal(emoji('tik'), '<:tik:12345678901234567>');
  assert.deepEqual(emojiData('tik'), { id: '12345678901234567', name: 'tik' });

  const now = 1_800_000_000_000;
  assert.equal(shouldSendOwnerNotice(null, now), true);
  assert.equal(shouldSendOwnerNotice(now - THROTTLE_MS + 1, now), false);
  assert.equal(shouldSendOwnerNotice(now - THROTTLE_MS, now), true);
  console.log('✅ Emoji fallback/application mapping and owner-DM throttle tests passed.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
