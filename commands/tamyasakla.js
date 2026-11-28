const {
    
        SlashCommandBuilder,
        EmbedBuilder,
        PermissionFlagsBits,
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
    MessageFlags
} = require('discord.js');

const ONAY_YETKILISI_ID = '1488957424009216010';
const Storage = require('../services/storage');
const pendingKey = requestId => `tamyasakla:pending:${requestId}`;
const ONAY_SURESI_MS = 10 * 60 * 1000;

function kullaniciIdAyikla(input) {
    return String(input || '').replace(/[<@!>]/g, '').trim();
}

async function tumSunuculardanYasakla(client, targetId, sebep, yetkiliTag) {
    const basarili = [];
    const basarisiz = [];

    for (const guild of client.guilds.cache.values()) {
        try {
            await guild.members.ban(targetId, {
                reason: `TMF Küresel Yasaklama | Talep eden: ${yetkiliTag} | Sebep: ${sebep}`.slice(0, 500)
            });
            basarili.push(guild.name);
        } catch (error) {
            basarisiz.push({ guild: guild.name, reason: error?.message || 'Bilinmeyen hata' });
            console.warn(`[TAMYASAKLA] ${guild.name} sunucusunda ban başarısız:`, error?.message);
        }
    }

    return { basarili, basarisiz };
}

module.exports = {
    requiredPerms: [PermissionFlagsBits.Administrator],

    data: new SlashCommandBuilder()
        .setName('tamyasakla')
        .setDescription('Yasaklama talebini onay yetkilisine gönderir; onayla tüm sunucularda yasaklar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('kisi')
                .setDescription('Yasaklanacak kişinin Discord ID veya etiketi.')
                .setMaxLength(25)
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Yasaklama sebebi.')
                .setMaxLength(400)
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '⛔ Bu komutu kullanmak için Yönetici yetkisi gerekiyor.',
                flags: MessageFlags.Ephemeral
            });
        }

        const targetId = kullaniciIdAyikla(interaction.options.getString('kisi'));
        const sebep = interaction.options.getString('sebep', true).trim();
        if (!/^\d{17,20}$/.test(targetId)) {
            return interaction.reply({ content: '❌ Geçerli bir Discord kullanıcı ID veya etiketi gir.', flags: MessageFlags.Ephemeral });
        }
        if (targetId === interaction.user.id || targetId === interaction.client.user.id) {
            return interaction.reply({ content: '⛔ Kendini veya botu yasaklama talebi oluşturamazsın.', flags: MessageFlags.Ephemeral });
        }
        if (!sebep) {
            return interaction.reply({ content: '❌ Yasaklama sebebi boş olamaz.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let targetUser;
        try {
            targetUser = await interaction.client.users.fetch(targetId);
        } catch {
            return interaction.editReply('❌ Bu Discord kullanıcısı bulunamadı. ID bilgisini kontrol et.');
        }

        let approver;
        try {
            approver = await interaction.client.users.fetch(ONAY_YETKILISI_ID);
        } catch {
            return interaction.editReply('❌ Onay yetkilisi hesabına ulaşılamadı. İşlem başlatılmadı.');
        }

        const requestId = require('node:crypto').randomUUID();
        const expiresAt = Date.now() + ONAY_SURESI_MS;
        const request = {
            requestId,
            targetId,
            targetTag: targetUser.tag || targetUser.username,
            sebep,
            requesterId: interaction.user.id,
            requesterTag: interaction.user.tag || interaction.user.username,
            guildId: interaction.guild.id,
            expiresAt
        };

        const embed = new EmbedBuilder()
            .setTitle('⚠️ TMF | Küresel Yasaklama Onayı')
            .setDescription('Bir sunucu yöneticisi küresel yasaklama talebi oluşturdu. **Yalnızca bu DM hesabının sahibi** işlemi onaylayabilir veya reddedebilir.')
            .addFields(
                { name: 'Yasaklanacak kullanıcı', value: `<@${targetId}> (${targetUser.tag || targetUser.username})\nID: ${targetId}` },
                { name: 'Talep eden yönetici', value: `<@${interaction.user.id}>\n${interaction.user.tag || interaction.user.username}` },
                { name: 'Talep edilen sunucu', value: interaction.guild.name.slice(0, 100) },
                { name: 'Sebep', value: sebep.slice(0, 1000) },
                { name: 'Son geçerlilik', value: `<t:${Math.floor(expiresAt / 1000)}:R>` }
            )
            .setColor('#d35400')
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`tamyasakla:approve:${requestId}`)
                .setLabel('Onayla ve tüm sunucularda yasakla')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`tamyasakla:deny:${requestId}`)
                .setLabel('Reddet')
                .setStyle(ButtonStyle.Secondary)
        );

        try {
            Storage.set(pendingKey(requestId), request);
            await approver.send({ embeds: [embed], components: [row] });
            return interaction.editReply(`✅ Küresel yasaklama talebi <@${ONAY_YETKILISI_ID}> kullanıcısına DM ile gönderildi. Onay gelmeden hiçbir sunucuda yasaklama yapılmayacak. Talep 10 dakika geçerli.`);
        } catch (error) {
            Storage.delete(pendingKey(requestId));
            console.error('[TAMYASAKLA] Onay DM gönderilemedi:', error?.message);
            return interaction.editReply('❌ Onay yetkilisine DM gönderilemedi. DM kapalı olabilir. Hiçbir sunucuda yasaklama yapılmadı.');
        }
    },

    async interactionHandler(interaction) {
        if (!interaction.isButton()) return;
        const [prefix, action, requestId] = interaction.customId.split(':');
        if (prefix !== 'tamyasakla' || !['approve', 'deny'].includes(action) || !requestId) return;

        if (interaction.user.id !== ONAY_YETKILISI_ID) {
            return interaction.reply({ content: '⛔ Bu onay butonlarını yalnızca belirlenmiş onay yetkilisi kullanabilir.', flags: MessageFlags.Ephemeral });
        }

        const request = Storage.get(pendingKey(requestId));
        if (!request) {
            return interaction.update({ content: '⌛ Bu talep bulunamadı, daha önce işlendi veya bot yeniden başlatıldı. Yeni talep oluşturulmalı.', embeds: [], components: [] });
        }
        if (Date.now() > request.expiresAt) {
            Storage.delete(pendingKey(requestId));
            return interaction.update({ content: '⌛ Talebin 10 dakikalık süresi doldu. Yeni talep oluşturulmalı.', embeds: [], components: [] });
        }

        Storage.delete(pendingKey(requestId));
        if (action === 'deny') {
            return interaction.update({
                content: `❎ Küresel yasaklama talebi reddedildi. Kullanıcı: ${request.targetTag} (${request.targetId}). Hiçbir sunucuda işlem yapılmadı.`,
                embeds: [],
                components: []
            });
        }

        await interaction.update({
            content: `⏳ Onay verildi. ${request.targetTag} için botun bulunduğu sunucularda yasaklama işlemi başlatılıyor...`,
            embeds: [],
            components: []
        });

        const { basarili, basarisiz } = await tumSunuculardanYasakla(
            interaction.client,
            request.targetId,
            request.sebep,
            request.requesterTag
        );

        const rapor = [
            '🛡️ **TMF | Küresel Yasaklama Sonucu**',
            `Kullanıcı: **${request.targetTag}** (${request.targetId})`,
            `Talep eden: <@${request.requesterId}>`,
            `Onaylayan: <@${ONAY_YETKILISI_ID}>`,
            `Sebep: ${request.sebep}`,
            `Başarılı: **${basarili.length}** sunucu`,
            `Başarısız: **${basarisiz.length}** sunucu`,
            basarili.length ? `\n**Yasaklandığı sunucular:**\n${basarili.slice(0, 15).map(name => `• ${name}`).join('\n')}` : '',
            basarisiz.length ? `\n**İşlem yapılamayan sunucular:**\n${basarisiz.slice(0, 10).map(item => `• ${item.guild}`).join('\n')}` : ''
        ].filter(Boolean).join('\n');

        await interaction.followUp({ content: rapor.slice(0, 1900), allowedMentions: { users: [request.requesterId, ONAY_YETKILISI_ID] } }).catch(() => null);

        try {
            const requester = await interaction.client.users.fetch(request.requesterId);
            await requester.send(rapor.slice(0, 1900));
        } catch {
            // Talep sahibinin DM'leri kapalıysa onay DM'indeki rapor yine görünür.
        }
    }
};
