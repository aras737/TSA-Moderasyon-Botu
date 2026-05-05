const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Kullanıcıyı banlar')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Banlanacak kişi')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Sebep')
        ),

    requiredPerms: [PermissionFlagsBits.BanMembers],

    async execute(interaction) {
        const user = interaction.options.getUser('kullanici');
        const reason = interaction.options.getString('sebep') || 'Sebep yok';

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: '❌ Kullanıcı yok.', ephemeral: true });
        }

        if (!member.bannable) {
            return interaction.reply({ content: '❌ Banlanamaz (rol yüksek).', ephemeral: true });
        }

        await member.ban({ reason });

        await interaction.reply({
            content: `✅ ${user.tag} banlandı. Sebep: ${reason}`
        });
    }
};
