const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

const { emoji } = require('../utils/emojis');
const ONAY_YETKILISI_ID = () => process.env.BOT_OWNER_ID || '';
const Storage = require('../services/storage');
const pendingKey = requestId => `tamyasakla:pending:${requestId}`;
const ONAY_SURESI_MS = 10 * 60 * 1000;

function temizleSuresiDolmusTalepler() {
    const now = Date.now();
    for (const [key, request] of Object.entries(Storage.getAll())) {
        if (key.startsWith('tamyasakla:pending:') && (!request?.expiresAt || request.expiresAt <= now)) {
            Storage.delete(key);
        }
    }
}

function kullaniciIdAyikla(input) {
    return String(input || '').replace(/[<@!>]/g, '').trim();
}

function satirlaraBol(items, formatter, limit = 950) {
    const chunks = [];
    let current = '';
    for (const item of items) {
        const line = formatter(item).replace(/[\r\n]+/g, ' ').slice(0, 500);
        const next = current ? `${current}\n${line}` : line;
        if (next.length > limit && current) {
            chunks.push(current);
            current = line;
        } else {
            current = next;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

function kureselYasakRaporuOlustur(request, basarili, basarisiz) {
    const tik = emoji('tik');
    const hata = emoji('baarsz');
    const basariliParcalar = satirlaraBol(basarili, name => `${tik} ${name}`);
    const basarisizParcalar = satirlaraBol(basarisiz, item => `${hata} ${item.guild} — ${item.reason || 'Bilinmeyen hata'}`);

    const fields = [
        { name: `${emoji('n_id')} Kullanıcı`, value: `**${request.targetTag}**\nID: \`${request.targetId}\`\n<@${request.targetId}>`.slice(0, 1024), inline: true },
        { name: `${emoji('Yetkili')} Talep eden`, value: `<@${request.requesterId}>\nID: \`${request.requesterId}\``.slice(0, 1024), inline: true },
        { name: `${emoji('tac')} Onaylayan`, value: `<@${ONAY_YETKILISI_ID()}>\nID: \`${ONAY_YETKILISI_ID()}\``.slice(0, 1024), inline: true },
        { name: `📝 Yasaklama sebebi`, value: String(request.sebep || 'Belirtilmedi').slice(0, 1024), inline: false },
        { name: `${tik} Başarılı`, value: `**${basarili.length}** sunucu`, inline: true },
        { name: `${hata} Başarısız`, value: `**${basarisiz.length}** sunucu`, inline: true }
    ];

    const listFields = [
        ...basariliParcalar.map((value, index) => ({
            name: `${emoji('global')} Yasaklandığı sunucular (${index + 1}/${basariliParcalar.length})`,
            value,
            inline: false
        })),
        ...basarisizParcalar.map((value, index) => ({
            name: `${hata} İşlem yapılamayan sunucular (${index + 1}/${basarisizParcalar.length})`,
            value,
            inline: false
        }))
    ];

    const embeds = [];
    let first = true;
    while (first || listFields.length) {
        const embed = new EmbedBuilder()
            .setColor(basarisiz.length ? 0xe0a12b : 0x35b779)
            .setTitle(`${emoji('koruma1')} TMF | Küresel Yasaklama Raporu`)
            .setTimestamp();

        if (first) {
            embed.setDescription('Küresel yasaklama işlemi tamamlandı. Aşağıda işlem özeti ve sunucu sonuçları yer almaktadır.')
                .addFields(fields);
            first = false;
        }

        const room = 25 - embed.data.fields.length;
        if (room > 0 && listFields.length) embed.addFields(listFields.splice(0, room));
        embeds.push(embed);

        // Her embed 25 field ve 6000 toplam karakter sınırının altında tutulur.
        if (embeds.length > 100) break;
    }
    return embeds;
}

async function raporuGonder(channel, embeds, logLabel) {
    for (let i = 0; i < embeds.length; i += 10) {
        try {
            await channel.send({
                embeds: embeds.slice(i, i + 10),
                allowedMentions: { parse: [] }
            });
        } catch (error) {
            console.error(`[TAMYASAKLA] ${logLabel} rapor gönderilemedi:`, error?.message || error);
            throw error;
        }
    }
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
    cleanupExpiredRequests: temizleSuresiDolmusTalepler,
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
                content: `${emoji('baarsz')} Bu komutu kullanmak için Yönetici yetkisi gerekiyor.`,
                flags: MessageFlags.Ephemeral
            });
        }

        temizleSuresiDolmusTalepler();
        const ownerId = ONAY_YETKILISI_ID();
        if (!/^\d{17,20}$/.test(ownerId)) {
            console.warn('[TAMYASAKLA] BOT_OWNER_ID boş veya geçersiz; onay talebi oluşturulmadı.');
            return interaction.reply({ content: `${emoji('baarsz')} Bot sahibi onay hesabı yapılandırılmamış. Yöneticiye bildirin.`, flags: MessageFlags.Ephemeral });
        }

        const targetId = kullaniciIdAyikla(interaction.options.getString('kisi'));
        const sebep = interaction.options.getString('sebep', true).trim();
        if (!/^\d{17,20}$/.test(targetId)) {
            return interaction.reply({ content: `${emoji('baarsz')} Geçerli bir Discord kullanıcı ID veya etiketi gir.`, flags: MessageFlags.Ephemeral });
        }
        if (targetId === interaction.user.id || targetId === interaction.client.user.id) {
            return interaction.reply({ content: `${emoji('uyari')} Kendini veya botu yasaklama talebi oluşturamazsın.`, flags: MessageFlags.Ephemeral });
        }
        if (!sebep) {
            return interaction.reply({ content: `${emoji('baarsz')} Yasaklama sebebi boş olamaz.`, flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let targetUser;
        try {
            targetUser = await interaction.client.users.fetch(targetId);
        } catch (error) {
            console.warn('[TAMYASAKLA] Hedef kullanıcı alınamadı:', error?.message || error);
            return interaction.editReply(`${emoji('baarsz')} Bu Discord kullanıcısı bulunamadı. ID bilgisini kontrol et.`);
        }

        let approver;
        try {
            approver = await interaction.client.users.fetch(ownerId);
        } catch (error) {
            console.error('[TAMYASAKLA] Onay yetkilisi alınamadı:', error?.message || error);
            return interaction.editReply(`${emoji('baarsz')} Onay yetkilisi hesabına ulaşılamadı. İşlem başlatılmadı.`);
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
            .setTitle(`${emoji('uyari')} TMF | Küresel Yasaklama Onayı`)
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
            return interaction.editReply(`${emoji('tik')} Küresel yasaklama talebi <@${ownerId}> kullanıcısına DM ile gönderildi. Onay gelmeden hiçbir sunucuda yasaklama yapılmayacak. Talep 10 dakika geçerli.`);
        } catch (error) {
            Storage.delete(pendingKey(requestId));
            console.error('[TAMYASAKLA] Onay DM gönderilemedi:', error?.message);
            return interaction.editReply(`${emoji('baarsz')} Onay yetkilisine DM gönderilemedi. DM kapalı olabilir. Hiçbir sunucuda yasaklama yapılmadı.`);
        }
    },

    async interactionHandler(interaction) {
        if (!interaction.isButton()) return;
        const [prefix, action, requestId] = interaction.customId.split(':');
        if (prefix !== 'tamyasakla' || !['approve', 'deny'].includes(action) || !requestId) return;

        if (interaction.user.id !== ONAY_YETKILISI_ID()) {
            return interaction.reply({ content: `${emoji('uyari')} Bu onay butonlarını yalnızca belirlenmiş onay yetkilisi kullanabilir.`, flags: MessageFlags.Ephemeral });
        }

        const request = Storage.get(pendingKey(requestId));
        if (!request) {
            return interaction.update({ content: `${emoji('uyari')} Bu talep bulunamadı, daha önce işlendi veya bot yeniden başlatıldı. Yeni talep oluşturulmalı.`, embeds: [], components: [] });
        }
        if (Date.now() > request.expiresAt) {
            Storage.delete(pendingKey(requestId));
            return interaction.update({ content: `${emoji('uyari')} Talebin 10 dakikalık süresi doldu. Yeni talep oluşturulmalı.`, embeds: [], components: [] });
        }

        Storage.delete(pendingKey(requestId));
        if (action === 'deny') {
            return interaction.update({
                content: `${emoji('baarsz')} Küresel yasaklama talebi reddedildi. Kullanıcı: ${request.targetTag} (${request.targetId}). Hiçbir sunucuda işlem yapılmadı.`,
                embeds: [],
                components: []
            });
        }

        await interaction.update({
            content: `${emoji('loading')} Onay verildi. ${request.targetTag} için botun bulunduğu sunucularda yasaklama işlemi başlatılıyor...`,
            embeds: [],
            components: []
        });

        const { basarili, basarisiz } = await tumSunuculardanYasakla(
            interaction.client,
            request.targetId,
            request.sebep,
            request.requesterTag
        );

        const embeds = kureselYasakRaporuOlustur(request, basarili, basarisiz);

        // Onaylayana (bu DM etkileşiminin sahibi) ve talep sahibine aynı embed raporunu ilet.
        try {
            await raporuGonder(interaction.channel, embeds, 'onaylayan');
        } catch (error) {
            console.error('[TAMYASAKLA] Onaylayana rapor teslimi tamamlanamadı.');
        }

        try {
            const requester = await interaction.client.users.fetch(request.requesterId);
            await raporuGonder(requester, embeds, 'talep sahibi');
        } catch (error) {
            console.warn('[TAMYASAKLA] Talep sahibine sonuç DM gönderilemedi:', error?.message || error);
        }
    }
};
