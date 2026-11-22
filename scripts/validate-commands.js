const fs = require('node:fs');
const path = require('node:path');

const commandsDir = path.join(__dirname, '..', 'commands');
const names = new Set();
const errors = [];

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
        if (Array.isArray(command.requiredPerms) && command.requiredPerms.length > 0 &&
            json.default_member_permissions == null) {
            errors.push(`${file}: requiredPerms tanımlı ama varsayılan Discord izni ayarlanmamış`);
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
