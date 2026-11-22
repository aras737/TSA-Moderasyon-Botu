const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmf-storage-test-'));
process.env.DATA_DIR = dataDir;

const Storage = require('../services/storage');
const storageFile = path.join(dataDir, 'storage.json');
const backupFile = path.join(dataDir, 'storage.backup.json');

try {
    Storage.setGuildSetting('guild-1', 'guardAktif', true);
    assert.equal(Storage.getGuildSetting('guild-1', 'guardAktif', false), true);

    const nestedSetting = { enabled: true, nested: { safe: true } };
    Storage.setGuildSetting('guild-1', 'nested', nestedSetting);
    const readSetting = Storage.getGuildSetting('guild-1', 'nested');
    readSetting.nested.safe = false;
    assert.equal(Storage.getGuildSetting('guild-1', 'nested').nested.safe, true);

    Storage.set('object-test', { nested: { value: 7 } });
    const objectValue = Storage.get('object-test');
    objectValue.nested.value = 99;
    assert.equal(Storage.get('object-test').nested.value, 7);

    const allValues = Storage.getAll();
    allValues['object-test'].nested.value = 101;
    assert.equal(Storage.get('object-test').nested.value, 7);

    Storage.queueGuildUpsert({
        id: 'guild-1',
        name: 'Test Guild',
        ownerId: 'owner-1',
        memberCount: 12,
        iconURL: () => 'https://example.invalid/icon.png'
    });
    const testUser = {
        id: 'user-1',
        username: 'Tester',
        tag: 'Tester#0001',
        bot: false,
        displayAvatarURL: () => 'https://example.invalid/avatar.png'
    };
    Storage.queueUserUpsert(testUser, 'guild-1', { status: 'joined' });
    Storage.queueUserUpsert(testUser, 'guild-1');
    Storage.queueUserUpsert(testUser, 'guild-2', { rank: 'member' });
    Storage.queueLog('messageCreate', {
        guildId: 'guild-1',
        content: 'test message'
    });

    const flushed = Storage.flushQueuedLogs();
    assert.equal(flushed, 4);

    let database = Storage.getDatabase();
    assert.equal(database.guilds['guild-1'].name, 'Test Guild');
    assert.equal(database.users['user-1'].guilds['guild-1'].status, 'joined');
    assert.equal(database.users['user-1'].guilds['guild-2'].rank, 'member');
    assert.equal(database.logs.at(-1).content, 'test message');

    database.settings['guild-1'].guardAktif = false;
    assert.equal(Storage.getGuildSetting('guild-1', 'guardAktif'), true);

    const ticket = Storage.addTicket({
        guildId: 'guild-1',
        channelId: 'ticket-1',
        userId: 'user-1',
        status: 'open'
    });
    assert.ok(ticket.id);
    Storage.queueTicketUpdate(
        { guildId: 'guild-1', channelId: 'ticket-1', status: 'open' },
        { status: 'closed' }
    );
    assert.equal(
        Storage.getDatabase().tickets.find(item => item.channelId === 'ticket-1').status,
        'open',
        'Queued ticket updates must not mutate storage before flush'
    );
    assert.equal(Storage.flushQueuedLogs(), 1);
    assert.equal(
        Storage.getDatabase().tickets.find(item => item.channelId === 'ticket-1').status,
        'closed'
    );

    Storage.queuePunishment({
        type: 'ban',
        guildId: 'guild-1',
        userId: 'user-2',
        reason: 'test'
    });
    assert.equal(Storage.flushQueuedLogs(), 1);
    assert.equal(
        Storage.getDatabase().punishments.find(item => item.userId === 'user-2').active,
        true
    );
    Storage.queueClosePunishment(
        { type: 'ban', guildId: 'guild-1', userId: 'user-2', active: true },
        { removedUserId: 'user-2' }
    );
    assert.equal(Storage.flushQueuedLogs(), 1);
    const closedCase = Storage.getDatabase().punishments.find(item => item.userId === 'user-2');
    assert.equal(closedCase.active, false);
    assert.equal(closedCase.removedUserId, 'user-2');

    assert.ok(fs.existsSync(storageFile), 'Primary storage file should be written');
    assert.ok(fs.existsSync(backupFile), 'Previous valid storage should be backed up');

    // Recovery should restore the last known-good backup, not accept corrupted JSON.
    Storage.set('recovery-marker', 'known-good');
    Storage.set('backup-marker', 'create-backup');
    Storage.cache = null;
    fs.writeFileSync(storageFile, '{invalid json');
    const recovered = Storage.loadData();
    assert.equal(recovered.kv['recovery-marker'], 'known-good');

    console.log('✅ Storage tests passed: settings, defensive copies, queued writes, tickets, backup and recovery.');
} finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
}
