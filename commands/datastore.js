const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Storage = require('../services/storage');

const storagePath = path.join(__dirname, '../data/storage.json');
const backupPath = path.join(__dirname, '../data/storage.backup.json');

module.exports = {
    requiredPerms: [PermissionFlagsBits.Administrator],

    data: new SlashCommandBuilder()
        .setName('datastore')
        .setDescription('Botun PC icindeki kalici kayit durumunu gosterir.'),

    async execute(interaction) {
        const data = Storage.getDatabase();
        const storageExists = fs.existsSync(storagePath);
        const backupExists = fs.existsSync(backupPath);
        const stats = storageExists ? fs.statSync(storagePath) : null;

        const embed = new EmbedBuilder()
            .setTitle('TSA | Datastore Durumu')
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
                { name: 'Dosya Boyutu', value: stats ? `\`${Math.ceil(stats.size / 1024)} KB\`` : '`Yok`', inline: true }
            )
            .setColor('#2ecc71')
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
