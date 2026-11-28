const fs = require('node:fs');
const path = require('node:path');

const commandsDir = path.join(__dirname, '..', 'commands');
const { AuditLogEvent } = require('discord.js');
const names = new Set();
const errors = [];

const requiredAuditEvents = [
    'ChannelCreate',
    'ChannelUpdate',
    'ChannelDelete',
    'ChannelOverwriteCreate',
    'ChannelOverwriteUpdate',
    'ChannelOverwriteDelete',
    'ChannelPositionUpdate',
    'RoleCreate',
    'RoleUpdate',
    'RoleDelete',
    'RolePositionUpdate',
    'MemberKick',
    'MemberPrune',
    'MemberBanAdd',
    'MemberRoleUpdate',
    'WebhookCreate',
    'WebhookUpdate',
    'WebhookDelete',
    'GuildUpdate',
    'EmojiDelete',
    'StickerDelete',
    'MessageBulkDelete',
    'AutoModerationRuleCreate',
    'AutoModerationRuleUpdate',
    'AutoModerationRuleDelete'
];

for (const eventName of requiredAuditEvents) {
    if (!Number.isInteger(AuditLogEvent[eventName])) {
        console.error('Anti-Raid: Discord.js denetim olayı bulunamadı: ' + eventName);
        errors.push('Anti-Raid AuditLogEvent.' + eventName + ' tanımlı değil');
    }
}

function validateOption(option, file) {
    if (!/^[a-z0-9_-]{1,32}$/.test(option.name || '')) {
        errors.push(`${file}: geçersiz seçenek adı "${option.name}"`);
    }
    if (typeof option.description !== 'string' || option.description.length < 1 || option.description.length > 100) {
        errors.push(`${file}: "${option.name}" açıklaması 1-100 karakter olmalı`);
    }
    for (const child of option.options || []) validateOption(child, file);
}

for (const file of fs.readdirSync(commandsDir).filter(name => name.endsWith('.js'))) {
    try {
        const command = require(path.join(commandsDir, file));
        if (!command.data || typeof command.execute !== 'function') {
            errors.push(`${file}: data veya execute eksik`);
            continue;
        }

        const json = command.data.toJSON();
        if (typeof json.description !== 'string' || json.description.length < 1 || json.description.length > 100) {
            errors.push(`${file}: komut açıklaması 1-100 karakter olmalı`);
        }
        const hasRuntimePermissions = Array.isArray(command.requiredPerms) && command.requiredPerms.length > 0;
        const hasDiscordDefaultPermissions = json.default_member_permissions != null;

        if (hasRuntimePermissions && !hasDiscordDefaultPermissions) {
            errors.push(`${file}: requiredPerms tanımlı ama varsayılan Discord izni ayarlanmamış`);
        }
        if (hasDiscordDefaultPermissions && !hasRuntimePermissions) {
            errors.push(`${file}: varsayılan Discord izni tanımlı ama index.js runtime yetki kontrolü için requiredPerms eksik`);
        }
        if (hasRuntimePermissions &&
            command.requiredPerms.includes(require('discord.js').PermissionFlagsBits.Administrator) &&
            command.requiredPerms.length > 1) {
            errors.push(`${file}: Administrator diğer requiredPerms değerleriyle birleştirilmemeli; index.js yönetici yetkisini zaten ayrı ele alır`);
        }
        if (!/^[a-z0-9_-]{1,32}$/.test(json.name || '')) {
            errors.push(`${file}: geçersiz komut adı "${json.name}"`);
        }
        if (names.has(json.name)) errors.push(`${file}: yinelenen komut adı "${json.name}"`);
        names.add(json.name);

        for (const option of json.options || []) validateOption(option, file);
    } catch (error) {
        errors.push(`${file}: ${error.message}`);
    }
}

if (errors.length) {
    console.error('Komut şeması doğrulaması başarısız:');
    for (const error of errors) console.error(' - ' + error);
    process.exitCode = 1;
} else {
    console.log(`✅ ${names.size} slash komut şeması doğrulandı.`);
}
