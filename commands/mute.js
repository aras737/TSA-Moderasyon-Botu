const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const ms = require('ms');

module.exports = {
    requiredPerms: [PermissionsBitField.Flags.ModerateMembers],

    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Belirtilen kullanıcıyı sunucuda susturur (Timeout).')
        .addUserOption(option => 
            option.setName('kullanıcı').setDescription('Susturulacak üyeyi seçin.').setRequired(true))
        .addStringOption(option => 
            option.setName('süre').setDescription('Süre girin (Örn: 10m, 1h, 1d)').setRequired(true))
        .addStringOption(option => 
            option.setName('sebep').setDescription('Susturma sebebini yazın.').setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('kullanıcı');
        const durationString = interaction.options.getString('süre');
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmemiş kanka.';

        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: '<a:uyari:1505166167189487757> Bu kullanıcı sunucuda bulunamadı kanka.', ephemeral: true });
        }

        // Hiyerarşi Kontrolü
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: '<a:uyari:1505166167189487757> Bu üyenin yetkisi senden yüksek veya seninle eşit, susturamazsın!', ephemeral: true });
        }
        if (!member.moderatable) {
            return interaction.reply({ content: '<a:uyari:1505166167189487757> Botun yetkisi bu kullanıcıyı susturmaya yetmiyor.', ephemeral: true });
        }

        // Süre Hesaplama
        const durationMs = ms(durationString);
        if (!durationMs || durationMs < 5000 || durationMs > 2419200000) { // En fazla 28 gün
            return interaction.reply({ content: '<a:uyari:1505166167189487757> Geçersiz süre! Doğru formatlar: `10m` (10 dk), `1h` (1 saat), `1d` (1 gün)', ephemeral: true });
        }

        try {
            await member.timeout(durationMs, reason);

            const embed = new EmbedBuilder()
                .setTitle('<:Ses:1505164439505342484> TSA | Kullanıcı Susturuldu')
                .setDescription(`**${target.tag}** adlı üye başarıyla cezalandırıldı.`)
                .addFields(
                    { name: '<:uzaybot_kullanicilar:1505146190973505567> Susturulan', value: `${member}`, inline: true },
                    { name: '<:Yetkili:1505192912680390827> Yetkili', value: `${interaction.user}`, inline: true },
                    { name: '<:duration:1505171054497370275> Süre', value: `\`${durationString}\``, inline: true },
                    { name: '<:Paper:1505146388596391977> Sebep', value: `*${reason}*`, inline: false }
                )
                .setColor('#f1c40f')
                .setThumbnail(target.displayAvatarURL())
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '<a:baarsz:1505146967817326675> Susturma işlemi sırasında teknik bir hata oluştu!', ephemeral: true });
        }
    }
};