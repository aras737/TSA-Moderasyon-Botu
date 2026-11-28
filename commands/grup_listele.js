const {
    
        SlashCommandBuilder,
        EmbedBuilder,
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
        ComponentType,
    MessageFlags
} = require('discord.js');

const { registerPanel, releasePanel } = require('../utils/interaction-registry');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('grup_listele')
        .setDescription('👥 Belirtilen Roblox kullanıcısının katıldığı grupları listeler.')
        .addStringOption(option =>
            option.setName('kullanici_adi')
                .setDescription('Sorgulamak istediğin Roblox kullanıcı adı')
                .setMinLength(3)
                .setMaxLength(20)
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const username = interaction.options.getString('kullanici_adi', true).trim();

        try {
            const userRes = await fetch('https://users.roblox.com/v1/usernames/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
                signal: AbortSignal.timeout(10000)
            });

            if (!userRes.ok) {
                throw new Error(`Roblox kullanıcı API HTTP ${userRes.status}`);
            }

            const userData = await userRes.json();
            const robloxUser = userData.data?.[0];

            if (!robloxUser?.id || !robloxUser?.name) {
                return interaction.editReply({
                    content: '❌ Bu kullanıcı adıyla eşleşen Roblox hesabı bulunamadı.'
                });
            }

            const groupRes = await fetch(
                `https://groups.roblox.com/v1/users/${robloxUser.id}/groups/roles`,
                { signal: AbortSignal.timeout(10000) }
            );

            if (!groupRes.ok) {
                throw new Error(`Roblox grup API HTTP ${groupRes.status}`);
            }

            const groupData = await groupRes.json();
            if (!Array.isArray(groupData.data)) {
                throw new Error('Roblox grup API geçerli bir grup listesi döndürmedi.');
            }

            const groups = groupData.data;
            if (groups.length === 0) {
                return interaction.editReply({
                    content: `👥 **${robloxUser.name}** herhangi bir Roblox grubuna üye değil.`
                });
            }

            const itemsPerPage = 8;
            const totalPages = Math.ceil(groups.length / itemsPerPage);
            let currentPage = 0;

            const buildEmbed = () => {
                const start = currentPage * itemsPerPage;
                const pageGroups = groups.slice(start, start + itemsPerPage);
                const embed = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle('👥 Roblox Grup Listesi')
                    .setDescription(
                        `**Kullanıcı:** ${robloxUser.name}\n` +
                        `**Roblox ID:** \`${robloxUser.id}\`\n` +
                        `**Toplam Grup:** ${groups.length}\n` +
                        `**Sayfa:** ${currentPage + 1} / ${totalPages}`
                    )
                    .setFooter({ text: 'TMF | Roblox Grup Sorgulama' })
                    .setTimestamp();

                for (const item of pageGroups) {
                    const groupName = String(item.group?.name || 'Bilinmeyen grup').slice(0, 200);
                    const groupId = item.group?.id || '—';
                    const memberCount = Number(item.group?.memberCount || 0);
                    const roleName = String(item.role?.name || 'Bilinmeyen rütbe').slice(0, 200);
                    const rank = Number(item.role?.rank || 0);

                    embed.addFields({
                        name: `🏷️ ${groupName}`,
                        value:
                            `**Rütbe:** ${roleName} (Rank: \`${rank}\`)\n` +
                            `**Üye:** ${Number.isFinite(memberCount) ? memberCount.toLocaleString('tr-TR') : 'Bilinmiyor'}\n` +
                            `**Grup ID:** \`${groupId}\``,
                        inline: false
                    });
                }

                return embed;
            };

            const buildComponents = () => {
                if (totalPages <= 1) return [];

                return [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('roblox_groups_previous')
                            .setLabel('Önceki')
                            .setEmoji('◀️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(currentPage === 0),
                        new ButtonBuilder()
                            .setCustomId('roblox_groups_next')
                            .setLabel('Sonraki')
                            .setEmoji('▶️')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage >= totalPages - 1)
                    )
                ];
            };

            const message = await interaction.editReply({
                embeds: [buildEmbed()],
                components: buildComponents()
            });

            if (totalPages <= 1) return;

            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 180000
            });

            collector.on('collect', async buttonInteraction => {
                if (buttonInteraction.user.id !== interaction.user.id) {
                    return buttonInteraction.reply({
                        content: '⛔ Bu sayfalama menüsünü yalnızca komutu kullanan kişi yönetebilir.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (buttonInteraction.customId === 'roblox_groups_previous') {
                    currentPage = Math.max(0, currentPage - 1);
                } else if (buttonInteraction.customId === 'roblox_groups_next') {
                    currentPage = Math.min(totalPages - 1, currentPage + 1);
                } else {
                    return buttonInteraction.deferUpdate();
                }

                try {
                    await buttonInteraction.update({
                        embeds: [buildEmbed()],
                        components: buildComponents()
                    });
                } catch (error) {
                    console.error('[ROBLOX GROUPS] Sayfa güncelleme hatası:', error);
                }
            });

            registerPanel(message.id, 180000);
            collector.on('end', () => {
                releasePanel(message.id);
                const disabledComponents = [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('roblox_groups_expired')
                            .setLabel('Menü süresi doldu')
                            .setEmoji('🔒')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    )
                ];
                message.edit({ components: disabledComponents }).catch(() => {});
            });
        } catch (error) {
            console.error('[ROBLOX GROUPS] Listeleme hatası:', error);
            await interaction.editReply({
                content: '❌ Roblox grupları alınamadı. API bağlantısını veya kullanıcı adını kontrol et.',
                embeds: [],
                components: []
            }).catch(() => {});
        }
    }
};
