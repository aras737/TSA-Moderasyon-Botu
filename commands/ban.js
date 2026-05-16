const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Kullanıcıyı sunucudan yasaklar (ID veya Etiket ile).')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Banlanacak kullanıcıyı seçin veya doğrudan ID yazın')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Banlanma sebebini belirtin')
                .setRequired(false)
        ),

    requiredPerms: [PermissionFlagsBits.BanMembers],

    async execute(interaction) {
        const user = interaction.options.getUser('kullanici');
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi.';
        
        // --- SABİT ÖZEL EMOJİ SİSTEMİ ---
        // Attığın emoji ID'sini bura direkt gömdük kanka, asla sekmez.
        const korumaEmoji = '<:koruma1:1505143174190989352>';

        // Sunucuda var mı yok mu kontrol etmek için çekiyoruz
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        // --- 1. SUNUCUDAKİ ÜYE İÇİN KONTROLLER ---
        if (member) {
            if (!member.bannable) {
                return interaction.reply({ content: '<a:baarsz:1505146967817326675> Bu üyeyi banlamaya yetkim yetmiyor (Rolü benim üstümde olabilir).', ephemeral: true });
            }

            // Üye sunucuda varsa banlanmadan önce DM atmayı dene
            const dmEmbed = new EmbedBuilder()
                .setTitle('🚫 TSA | Sunucudan Yasaklandınız')
                .setDescription(`**${interaction.guild.name}** sunucusundan kalıcı olarak uzaklaştırıldınız.`)
                .addFields(
                    { name: '<:Paper:1505146388596391977> Sebep', value: `\`${reason}\`` },
                    { name: `${korumaEmoji} Banlayan Yetkili`, value: `${interaction.user.tag}` }
                )
                .setColor('#ff4d4d')
                .setTimestamp()
                .setFooter({ text: 'Adil bir topluluk için kurallara uymanız gerekir.' });

            try {
                await user.send({ embeds: [dmEmbed] });
            } catch (err) {
                console.log(`${user.tag} kullanıcısının DM'leri kapalı, bildirim gönderilemedi.`);
            }
        }

        // --- 2. BANLAMA İŞLEMİ (ID BAN VE ETİKET BAN DESTEKLİ) ---
        try {
            // Kullanıcı sunucuda olmasa bile guild.bans.create ile ID üzerinden ban atabiliyoruz
            await interaction.guild.bans.create(user.id, { reason: `${interaction.user.tag} tarafından: ${reason}` });

            const banEmbed = new EmbedBuilder()
                .setTitle('<:yasaklandi:1505146022588842095> TSA | Ban İşlemi Başarılı')
                .setDescription(`**${user.tag}** başarıyla sunucudan uzaklaştırıldı.`)
                .addFields(
                    { name: '<:uzaybot_kullanicilar:1505146190973505567> Kullanıcı', value: `${user.tag} \`(${user.id})\``, inline: true },
                    { name: `${korumaEmoji} Yetkili`, value: `${interaction.user}`, inline: true },
                    { name: '<:Paper:1505146388596391977> Sebep', value: `\`${reason}\``, inline: false },
                    { name: '<:global:1505146647221374977> Durum', value: member ? '<a:online:1505145208046878730> Sunucudaydı (DM Denendi)' : '<:Ofline:1505145553925832704> Sunucuda Değildi (ID Ban/Forceban Atıldı)', inline: false }
                )
                .setThumbnail(user.displayAvatarURL({ dynamic: true }) || interaction.guild.iconURL())
                .setColor('#ff3333')
                .setFooter({ text: `Sorgulayan: ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.reply({ embeds: [banEmbed] });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '<a:baarsz:1505146967817326675> Ban işlemi gerçekleştirilirken teknik bir hata oluştu!', ephemeral: true });
        }
    }
};