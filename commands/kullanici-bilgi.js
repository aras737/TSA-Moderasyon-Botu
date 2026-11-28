'use strict';
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const Storage = require('../services/storage');
const { emoji } = require('../utils/emojis');

function safe(value, max = 900) {
    const text = String(value ?? 'Bilinmiyor').replace(/@/g, '@\u200b');
    return text.length > max ? text.slice(0, max - 3) + '...' : text;
}
function stamp(value) {
    const ms = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(ms) ? '<t:' + Math.floor(ms / 1000) + ':F>' : 'Bilinmiyor';
}
function targetIdOf(entry) {
    return entry?.userId || entry?.targetId || entry?.author?.id || entry?.user?.id || null;
}

module.exports = {
    requiredPerms: [PermissionFlagsBits.ManageMessages],
    data: new SlashCommandBuilder()
        .setName('kullanici-bilgi')
        .setDescription('Bir üyenin profilini, mesaj etkinliğini ve moderasyon geçmişini analiz eder.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(option => option.setName('kullanici').setDescription('İncelenecek kullanıcı').setRequired(true)),

    async execute(interaction) {
        const target = interaction.options.getUser('kullanici', true);
        const guild = interaction.guild;
        await interaction.deferReply({ ephemeral: true });
        await interaction.editReply({
            content: emoji('loading') + ' **' + safe(target.tag || target.username, 80) +
                '** taranıyor. Profil, roller, mesaj etkinliği ve moderasyon kayıtları inceleniyor...'
        });

        try {
            const member = await guild.members.fetch(target.id).catch(() => null);
            Storage.flushQueuedLogs();
            const db = Storage.getDatabase();
            const logs = (db.logs || []).filter(log => log.guildId === guild.id && targetIdOf(log) === target.id);
            const punishments = (db.punishments || []).filter(item =>
                item.guildId === guild.id && targetIdOf(item) === target.id
            );

            const messages = logs.filter(log => log.type === 'messageCreate');
            const deleted = logs.filter(log => log.type === 'messageDelete').sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
            const edited = logs.filter(log => log.type === 'messageUpdate').sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
            const commands = logs.filter(log => log.type === 'commandRun');
            const warnings = logs.filter(log => /warn|uyari|warning/i.test(String(log.type || '')));

            const kvWarnings = Object.entries(db.kv || {}).flatMap(([key, value]) => {
                if (!key.includes(target.id) || !/(warn|uyari|warning)/i.test(key)) return [];
                return (Array.isArray(value) ? value : [value]).map(row => ({ key, row }));
            });

            let recentMessages = [];
            let channelScan = 'Komut kanalı taranamadı.';
            if (interaction.channel?.messages?.fetch) {
                try {
                    const fetched = await interaction.channel.messages.fetch({ limit: 100 });
                    recentMessages = [...fetched.values()]
                        .filter(m => m.author?.id === target.id && !m.author.bot)
                        .sort((a,b) => b.createdTimestamp - a.createdTimestamp).slice(0,5);
                    channelScan = 'Komut kanalındaki son 100 mesaj tarandı.';
                } catch {
                    channelScan = 'Mesaj geçmişi izni yok veya kanal geçmişi okunamadı.';
                }
            }

            let auditMatches = [];
            let auditNote = 'Denetim kaydı okunamadı.';
            if (interaction.memberPermissions?.has(PermissionFlagsBits.ViewAuditLog)) {
                try {
                    const audit = await guild.fetchAuditLogs({ limit: 100 });
                    auditMatches = [...audit.entries.values()].filter(entry =>
                        entry.target?.id === target.id &&
                        [AuditLogEvent.MemberBanAdd, AuditLogEvent.MemberKick, AuditLogEvent.MemberUpdate].includes(entry.action)
                    ).slice(0,5);
                    auditNote = 'Son 100 Discord denetim kaydı incelendi.';
                } catch {
                    auditNote = 'Denetim kaydı izni yok.';
                }
            } else {
                auditNote = 'Komutu kullanan yetkilide Denetim Kaydını Görüntüle izni yok.';
            }

            const roleList = member
                ? member.roles.cache.filter(r => r.id !== guild.id).sort((a,b) => b.position-a.position).map(r => '<@&' + r.id + '>')
                : [];
            const timeout = member?.communicationDisabledUntilTimestamp;
            const punishmentList = punishments.slice(-4).reverse().map(item =>
                '• **' + safe(item.type, 40) + '** — ' + (item.active === false ? 'Tamamlandı' : 'Aktif') +
                '\nSebep: ' + safe(item.reason || 'Kayıt yok', 140) + '\nTarih: ' + stamp(item.createdAt)
            );
            const auditList = auditMatches.map(entry => {
                const type = entry.action === AuditLogEvent.MemberBanAdd ? 'Ban' :
                    entry.action === AuditLogEvent.MemberKick ? 'Kick' : 'Üye güncelleme / Timeout olabilir';
                return '• **' + type + '** — ' + stamp(entry.createdAt) +
                    '\nYetkili: ' + (entry.executor ? '<@' + entry.executor.id + '>' : 'Bilinmiyor') +
                    '\nSebep: ' + safe(entry.reason || 'Belirtilmemiş', 130);
            });
            const warningList = [
                ...warnings.slice(-4).reverse().map(log => '• ' + safe(log.type, 40) + ' — ' + stamp(log.createdAt)),
                ...kvWarnings.slice(0,4).map(row => '• ' + safe(row.key, 60) + ': ' + safe(JSON.stringify(row.row), 130))
            ].slice(0,4);
            const recentList = recentMessages.map(message =>
                '• ' + stamp(message.createdAt) + ' — #' + safe(message.channel?.name || 'kanal', 40) +
                '\n' + safe(message.content || '[Metin yok / ek içeriyor]', 150) +
                ((message.attachments?.size || 0) ? ' (+' + message.attachments.size + ' ek)' : '')
            );
            const changeList = [
                ...deleted.slice(0,2).map(log => '**Silindi** (' + stamp(log.createdAt) + '): ' + safe(log.content || 'İçerik arşivlenmemiş', 130)),
                ...edited.slice(0,2).map(log => '**Düzenlendi** (' + stamp(log.createdAt) + '): ' +
                    safe(log.before || 'Önceki içerik yok', 60) + ' → ' + safe(log.after || 'Yeni içerik yok', 60))
            ];

            const embed = new EmbedBuilder()
                .setColor(member?.displayColor || 0x5865f2)
                .setTitle('🔎 TMF | Kullanıcı Profil Analizi')
                .setDescription('**' + safe(target.tag || target.username, 100) + '** ' +
                    (member ? '(<@' + target.id + '>)' : '(bu sunucuda üye değil)') + '\nID: ' + target.id)
                .setThumbnail(target.displayAvatarURL({ size: 512 }))
                .addFields(
                    { name: '👤 Hesap Bilgileri', value: [
                        'Kullanıcı adı: **' + safe(target.username, 70) + '**',
                        'Görünen ad: **' + safe(target.globalName || member?.displayName || target.username, 70) + '**',
                        'Bot hesabı: **' + (target.bot ? 'Evet' : 'Hayır') + '**',
                        'Hesap oluşturma: ' + stamp(target.createdAt),
                        'Sunucuya katılma: ' + stamp(member?.joinedAt),
                        'Takma ad: **' + safe(member?.nickname || 'Yok', 70) + '**',
                        'Sunucu sahibi: **' + (target.id === guild.ownerId ? 'Evet' : 'Hayır') + '**',
                        'Sunucu boost: **' + (member?.premiumSince ? stamp(member.premiumSince) : 'Hayır') + '**'
                    ].join('\n'), inline: false },
                    { name: '🎭 Roller (' + roleList.length + ')', value: safe(roleList.join(' ') || 'Rol yok / üye sunucuda değil.', 1000), inline: false },
                    { name: '🛡️ Yetki ve Durum', value: member ? [
                        'En yüksek rol: **' + safe(member.roles.highest.name, 70) + '**',
                        'Yönetici: **' + (member.permissions.has(PermissionFlagsBits.Administrator) ? 'Evet' : 'Hayır') + '**',
                        'Timeout: **' + (timeout && timeout > Date.now() ? '<t:' + Math.floor(timeout/1000) + ':R>' : 'Yok') + '**',
                        'Üyelik doğrulaması bekliyor: **' + (member.pending ? 'Evet' : 'Hayır') + '**'
                    ].join('\n') : 'Üye sunucuda bulunamadı.', inline: true },
                    { name: '💬 Mesaj ve Etkinlik', value: [
                        'Kaydedilmiş mesaj etkinliği: **' + messages.length + '**',
                        'Silinen mesaj kaydı: **' + deleted.length + '**',
                        'Düzenlenen mesaj kaydı: **' + edited.length + '**',
                        'Slash komut kullanımı: **' + commands.length + '**',
                        'Son kanal taramasında: **' + recentMessages.length + '**',
                        channelScan
                    ].join('\n'), inline: true },
                    { name: '⚠️ Uyarı Kayıtları', value: warningList.length ? warningList.join('\n').slice(0,1000) :
                        'Storage içinde bu kullanıcıya bağlı uyarı kaydı bulunamadı. Uyarı sistemi kayıt tutmuyorsa eski uyarılar görüntülenemez.', inline: false },
                    { name: '📋 Ceza Geçmişi (' + punishments.length + ')', value: punishmentList.length ? punishmentList.join('\n').slice(0,1000) :
                        'Storage ceza geçmişinde bu kullanıcıya ait kayıt yok.', inline: false },
                    { name: '📑 Discord Denetim Kayıtları', value:
                        (auditList.length ? auditList.join('\n').slice(0,850) : 'Son 100 denetim kaydında eşleşen ban/kick/üye güncellemesi bulunamadı.') +
                        '\n\n_' + auditNote + '_', inline: false },
                    { name: '🗨️ Son Mesaj Önizlemesi', value: recentList.length ? recentList.join('\n').slice(0,1000) :
                        'Komut kanalının son 100 mesajında bu kullanıcıya ait mesaj yok veya geçmiş okunamadı.', inline: false },
                    { name: '🧾 Son Silinen / Düzenlenen Kayıtlar', value: changeList.length ? changeList.join('\n').slice(0,1000) :
                        'Silme/düzenleme kaydı yok.', inline: false }
                )
                .setFooter({ text: 'TMF Profil Tarayıcı • ' + guild.name + ' • Botun erişebildiği kayıtlar gösterilir' })
                .setTimestamp();

            await interaction.editReply({ content: '', embeds: [embed] });
        } catch (error) {
            console.error('[KULLANICI-BILGI] Profil tarama hatası:', error);
            await interaction.editReply({ content: '❌ Kullanıcı taranırken hata oluştu. Botun rol ve kanal izinlerini kontrol et.' }).catch(() => null);
        }
    }
};
