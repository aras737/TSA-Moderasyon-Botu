const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const AYAR_DOSYA = path.join(__dirname, '../ayarlar/kufurEngel.json');

// DOSYA YOKSA OLUŞTUR
if (!fs.existsSync(AYAR_DOSYA)) {
    fs.writeFileSync(AYAR_DOSYA, JSON.stringify({}));
}

// KÜFÜR LİSTESİ
const kufurler = [
    'amk',
    'aq',
    'orospu',
    'piç',
    'sik',
    'yarrak',
    'göt',
    'ananı',
    'amına',
    'ibne',
    'salak',
    'gerizekalı'
];

module.exports = {

    data: new SlashCommandBuilder()
        .setName('küfürengel')
        .setDescription('Küfür engel sistemini açar veya kapatır.')
        .addStringOption(option =>
            option
                .setName('durum')
                .setDescription('Aç veya kapat')
                .setRequired(true)
                .addChoices(
                    { name: 'Aç', value: 'ac' },
                    { name: 'Kapat', value: 'kapat' }
                )
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction, client) {

        let data = JSON.parse(
            fs.readFileSync(AYAR_DOSYA)
        );

        const durum =
            interaction.options.getString('durum');

        // AÇ
        if (durum === 'ac') {

            data[interaction.guild.id] = true;

            fs.writeFileSync(
                AYAR_DOSYA,
                JSON.stringify(data, null, 2)
            );

            return interaction.reply({
                content: '✅ Küfür engeli açıldı.',
                ephemeral: true
            });
        }

        // KAPAT
        if (durum === 'kapat') {

            data[interaction.guild.id] = false;

            fs.writeFileSync(
                AYAR_DOSYA,
                JSON.stringify(data, null, 2)
            );

            return interaction.reply({
                content: '❌ Küfür engeli kapatıldı.',
                ephemeral: true
            });
        }
    },

    // MESAJ EVENTİ
    async messageCreate(message) {

        try {

            if (!message.guild) return;
            if (message.author.bot) return;

            let data = JSON.parse(
                fs.readFileSync(AYAR_DOSYA)
            );

            // SİSTEM KAPALIYSA DUR
            if (!data[message.guild.id]) return;

            // ADMİN BYPASS
            if (
                message.member.permissions.has(
                    PermissionFlagsBits.Administrator
                )
            ) return;

            const mesaj =
                message.content.toLowerCase();

            const kufurVar = kufurler.some(kelime =>
                mesaj.includes(kelime)
            );

            // KÜFÜR VARSA
            if (kufurVar) {

                await message.delete().catch(() => {});

                const uyari =
                    await message.channel.send({
                        content:
                            `🚫 ${message.author}, küfür yasak.`
                    });

                setTimeout(() => {
                    uyari.delete().catch(() => {});
                }, 5000);
            }

        } catch (err) {

            console.error(
                'Küfür engel sistemi hata:',
                err
            );
        }
    }
};
