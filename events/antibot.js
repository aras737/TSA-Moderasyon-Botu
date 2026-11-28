const {
    EmbedBuilder,
    AuditLogEvent,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');
const { registerPrefix } = require('../utils/interaction-registry');

// Sahip karar butonlarını bu dosyadaki dinleyici ACK eder (genel yönetici dokunmaz).
registerPrefix('antibot_');
const { ayarGetir, ayarKaydet } = require('../utils/db');

const AUDIT_MAX_AGE_MS = 15000;

module.exports = client => {
    async function getBotAdder(guild, botId) {
        for (let attempt = 0; attempt < 3; attempt++) {
            const auditLogs = await guild.fetchAuditLogs({
                limit: 10,
                type: AuditLogEvent.BotAdd
            }).catch(() => null);

            const entry = auditLogs?.entries.find(item => {
                const createdAt = Number(item?.createdTimestamp);
                const age = Date.now() - createdAt;
                return item?.target?.id === botId &&
                    item?.executorId &&
                    Number.isFinite(createdAt) &&
                    age >= 0 &&
                    age <= AUDIT_MAX_AGE_MS;
            });

            if (entry?.executorId) {
                return entry.executor ||
                    await client.users.fetch(entry.executorId).catch(() => null);
            }
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500));
        }
        return null;
    }

    async function getLogChannel(guild) {
        const channelId = ayarGetir(guild.id, 'logKanal', null);
        if (!channelId) return null;
        const channel = await client.channels.fetch(channelId).catch(() => null);
        return channel?.isTextBased?.() ? channel : null;
    }

    async function logMessage(guild, content) {
        const channel = await getLogChannel(guild);
        if (!channel) return;
        await channel.send({ content, allowedMentions: { parse: [] } }).catch(error => {
            console.error('Anti-bot log gönderilemedi:', error.message);
        });
    }

    client.on('guildMemberAdd', async member => {
        if (!member.user?.bot) return;

        try {
            const guild = member.guild;

            // Bot kendi sunucuya katılışını asla yabancı bot gibi değerlendirmemeli.
            if (client.user && member.id === client.user.id) return;

            const safeBots = ayarGetir(guild.id, 'guvenliBotlar', []);
            if (Array.isArray(safeBots) && safeBots.includes(member.id)) return;

            const inviter = await getBotAdder(guild, member.id);

            // Audit log henüz oluşmadıysa yanlış kişiyi suçlamamak için otomatik atma yapma.
            if (!inviter) {
                await logMessage(
                    guild,
                    `⚠️ TMF Anti-Bot: ${member.user.tag} (${member.id}) sunucuya eklendi ancak davet eden denetim kaydından doğrulanamadı. Otomatik işlem uygulanmadı.`
                );
                return;
            }

            // Sunucu sahibinin eklediği botları otomatik engelleme.
            if (inviter.id === guild.ownerId) return;

            const owner = await guild.fetchOwner().catch(() => null);
            if (!owner) {
                await logMessage(guild, `⚠️ TMF Anti-Bot: Sunucu sahibi bulunamadığı için ${member.user.tag} hakkında karar paneli gönderilemedi.`);
                return;
            }

            const wasKicked = member.kickable;
            if (wasKicked) {
                await member.kick('TMF Anti-Bot: Sunucu sahibi onayı bekleniyor.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🛡️ TMF | Bot Güvenlik Kararı')
                .setDescription(
                    `Sunucuya sunucu sahibi dışındaki bir yetkili tarafından bot eklendi.\n\n` +
                    `**Bot:** ${member.user.tag} (\`${member.id}\`)\n` +
                    `**Davet eden:** ${inviter.tag || inviter.username} (\`${inviter.id}\`)\n\n` +
                    (wasKicked
                        ? 'Bot, karar verilene kadar sunucudan çıkarıldı. Onaylarsan botu yeniden davet etmen gerekir.'
                        : 'Botu çıkarma yetkisi bulunamadı. Reddet seçeneği botu yasaklamayı dener.')
                )
                .setColor('#f1c40f')
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`antibot_approve_${member.id}_${guild.id}`)
                    .setLabel('Botu Güvenli Listeye Ekle')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`antibot_reject_${member.id}_${guild.id}`)
                    .setLabel('Botu Reddet ve Yasakla')
                    .setStyle(ButtonStyle.Danger)
            );

            try {
                await owner.send({ embeds: [embed], components: [row] });
            } catch (dmError) {
                await logMessage(
                    guild,
                    `🚨 TMF Anti-Bot: ${member.user.tag} (${member.id}) eklendi. Davet eden: ${inviter.tag || inviter.username} (${inviter.id}). Sunucu sahibinin DM kutusuna erişilemedi; karar paneli gönderilemedi.`
                );
            }
        } catch (error) {
            console.error('TMF Anti-Bot olay hatası:', error);
        }
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('antibot_')) return;

        const [, decision, botId, guildId] = interaction.customId.split('_');
        if (!['approve', 'reject'].includes(decision) || !botId || !guildId) return;

        try {
            // This decision panel is intentionally sent to the owner by DM.
            // DM component interactions have no interaction.guild, so ACK first
            // and resolve the guild from the ID stored in the signed customId.
            await interaction.deferUpdate();

            const guild = await client.guilds.fetch(guildId).catch(() => null);
            if (!guild) {
                return interaction.followUp({
                    content: '⚠️ İlgili sunucu bulunamadı veya bot artık sunucuda değil.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Bu kritik kararları yalnızca gerçek sunucu sahibi verebilir.
            const owner = await guild.fetchOwner().catch(() => null);
            if (!owner || interaction.user.id !== owner.id || interaction.user.id !== guild.ownerId) {
                return interaction.followUp({
                    content: '⛔ Anti-Bot kararını yalnızca ilgili sunucunun sahibi verebilir.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (decision === 'approve') {
                const safeBots = ayarGetir(guild.id, 'guvenliBotlar', []);
                const updatedSafeBots = Array.isArray(safeBots) ? safeBots : [];
                if (!updatedSafeBots.includes(botId)) updatedSafeBots.push(botId);

                ayarKaydet(guild.id, 'guvenliBotlar', updatedSafeBots);

                const approvedEmbed = new EmbedBuilder()
                    .setTitle('🤖 ✅ TMF | Bot Onaylandı')
                    .setDescription(
                        `\`${botId}\` ID'li bot güvenli listeye eklendi. Bot daha önce çıkarıldıysa sunucuya yeniden davet etmelisin.`
                    )
                    .setColor('#2ecc71')
                    .setTimestamp();

                await interaction.editReply({ embeds: [approvedEmbed], components: [] });
                await logMessage(guild, `✅ Sunucu sahibi \`${botId}\` ID'li botu TMF güvenli listesine ekledi.`);
                return;
            }

            // Davet eden yetkilinin rollerine dokunulmaz; yalnızca onaylanmayan bot yasaklanır.
            let banned = false;
            try {
                await guild.bans.create(botId, {
                    reason: 'TMF Anti-Bot: Sunucu sahibi bot eklenmesini reddetti.'
                });
                banned = true;
            } catch (error) {
                console.error('Reddedilen bot yasaklanamadı:', error);
            }

            const rejectedEmbed = new EmbedBuilder()
                .setTitle(banned ? '⛔ TMF | Bot Reddedildi' : '⚠️ TMF | Bot Reddedildi, Yasaklama Başarısız')
                .setDescription(
                    banned
                        ? `\`${botId}\` ID'li bot sunucudan yasaklandı. Davet eden kişinin rolleri değiştirilmedi.`
                        : `\`${botId}\` ID'li bot reddedildi ancak yasaklanamadı. Botun Ban Members yetkisini kontrol et.`
                )
                .setColor(banned ? '#da373c' : '#f1c40f')
                .setTimestamp();

            await interaction.editReply({ embeds: [rejectedEmbed], components: [] });
            await logMessage(guild, `⛔ Sunucu sahibi ${botId} ID'li botu reddetti. Yasaklama durumu: ${banned ? 'başarılı' : 'başarısız'}.`);
        } catch (error) {
            console.error('TMF Anti-Bot karar hatası:', error);
            const response = { content: '❌ Anti-Bot kararı uygulanırken hata oluştu.', embeds: [], components: [] };
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(response).catch(() => {});
            } else if (interaction.isRepliable()) {
                await interaction.reply({ ...response, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    });
};
