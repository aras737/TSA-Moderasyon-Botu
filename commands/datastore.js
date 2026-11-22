const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Storage = require('../services/storage');

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '../data');
const storagePath = path.join(dataDir, 'storage.json');
const backupPath = path.join(dataDir, 'storage.backup.json');

module.exports = {
    requiredPerms: [PermissionFlagsBits.Administrator],

    data: new SlashCommandBuilder()
        .setName('datastore')
        .setDescription('Botun PC icindeki kalici kayit durumunu gosterir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        Storage.flushQueuedLogs?.();
        const data = Storage.getDatabase();
        const storageExists = fs.existsSync(storagePath);
        const backupExists = fs.existsSync(backupPath);
        const stats = storageExists ? fs.statSync(storagePath) : null;

        const embed = new EmbedBuilder()
            .setTitle('TMF | Datastore Durumu')
            .setDescription('Bot ayarlari, kullanici gecmisi, komutlar, loglar, cezalar ve ticket kayitlari PC icindeki JSON dosyasina yaziliyor.')
            .addFields(
                { name: 'Ana Dosya', value: `\`${storagePath}\``, inline: false },
                { name: 'Yedek Dosya', value: backupExists ? `\`${backupPath}\`` : '`Henüz yedek oluşmadı`', inline: false },
                { name: 'Sunucular', value: `\`${Object.keys(data.guilds || {}).length}\``, inline: true },
                { name: 'Kullanicilar', value: `\`${Object.keys(data.users || {}).length}\``, inline: true },
                { name: 'Ayar Gruplari', value: `\`${Object.keys(data.settings || {}).length}\``, inline: true },
                { name: 'Log Kaydi', value: `\`${(data.logs || []).length}\``, inline: true },
                { name: 'Ceza Kaydi', value: `\`${(data.punishments || []).length}\``, inline: true },
                { name: 'Ticket Kaydi', value: `\`${(data.tickets || []).length}\``, inline: true },
                { name: 'Son Kayit', value: data.updatedAt ? `<t:${Math.floor(new Date(data.updatedAt).getTime() / 1000)}:R>` : '`Yok`', inline: true },
                { name: 'Dosya Boyutu', value: stats ? `\`${Math.ceil(stats.size / 1024)} KB\`` : '`Yok`', inline: true },
                { name: 'Veri Dizini', value: dataDir, inline: false },
                { name: 'Depolama Durumu', value: process.env.RENDER === 'true' && !process.env.DATA_DIR ? '⚠️ Render Free yerel depolaması kalıcı değildir.' : '✅ Özel DATA_DIR veya yerel depolama.', inline: false }
            )
            .setColor('#2ecc71')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
