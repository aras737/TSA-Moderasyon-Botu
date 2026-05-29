const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tamyasakla')
        .setDescription('Bir Discord kullanıcısını bilgilendirerek botun olduğu TÜM sunuculardan kalıcı olarak yasaklar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option =>
            option.setName('kisi')
                .setDescription('Yasaklanacak kişinin Discord ID\'sini veya etiketini girin kanka.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Yasaklama sebebini belirtin.')
                .setRequired(true)
        ),

    async execute(interaction) {
        const kisiInput = interaction.options.getString('kisi');
        const sebep = interaction.options.getString('sebep');
        const yetkili = interaction.user;

        // 🧹 Etiket parantezlerini temizleyip saf ID'yi alıyoruz
        const targetId = kisiInput.replace(/[<@!>]/g, '');

        if (!/^\d+$/.test(targetId)) {
            const hataEmbed = new EmbedBuilder()
                .setTitle('❌ Geçersiz Kullanıcı')
                .setDescription('Lütfen geçerli bir Discord ID\'si veya kullanıcı etiketi gir kanka!')
                .setColor('#7a0010');
            return interaction.reply({ embeds: [hataEmbed], ephemeral: true });
        }

        await interaction.deferReply();

        let targetUser = null;
        let dmDurumu = "❌ **DM İletilemedi** *(Kullanıcı bulunamadı)*";

        try {
            targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
        } catch (err) {
            console.log("Kullanıcı verisi çekilemedi.");
        }

        // ✉️ 1. ADIM: BANLANMADAN ÖNCE KULLANICIYA DM ATMA SİSTEMİ
        if (targetUser) {
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🚨 KÜRESEL YASAKLAMA BİLDİRİMİ 🚨')
                    .setDescription(`Merhaba **${targetUser.username}**,\nTHT Yönetim Sistemi kararıyla botun bağlı olduğu tüm askeri ve sivil sunuculardan kalıcı olarak uzaklaştırıldınız.`)
                    .addFields(
                        { name: '💬 Yasaklama Sebebi:', value: `\`${sebep}\``, inline: false },
                        { name: '👑 İşlemi Yapan Yetkili:', value: `\`${yetkili.username}\``, inline: false }
                    )
                    .setColor('#7a0010')
                    .setFooter({ text: 'THT Küresel Sıkıyönetim Sistemi' })
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
                dmDurumu = "📩 **DM Başarıyla İletildi**";
            } catch (dmError) {
                dmDurumu = "🔒 **DM İletilemedi** *(Kullanıcının DM'leri kapalı veya botu engellemiş)*";
            }
        }

        const targetName = targetUser ? `${targetUser.tag}` : `Bilinmeyen Kullanıcı (${targetId})`;
        const banlananSunucular = [];

        // ⚡ 2. ADIM: BOTUN OLDUĞU TÜM SUNUCULARDAN TEMİZLEME DÖNGÜSÜ
        const tumSunucular = interaction.client.guilds.cache;

        for (const [guildId, sunucu] of tumSunucular) {
            try {
                await sunucu.members.ban(targetId, { 
                    reason: `Küresel Sıkıyönetim | Yetkili: ${yetkili.username} | Sebep: ${sebep}` 
                });
                banlananSunucular.push(sunucu.name);
            } catch (error) {
                console.error(`${sunucu.name} sunucusunda ban hatası:`, error.message);
            }
        }

        // 🟥 HİÇBİR YERDEN BANLANAMADIYSA HATA DÖNDÜR
        if (banlananSunucular.length === 0) {
            const basarisizEmbed = new EmbedBuilder()
                .setTitle('❌ İşlem Başarısız')
                .setDescription(`**${targetName}** kişisi hiçbir sunucudan banlanamadı. Yetkileri kontrol et kanka!`)
                .setColor('#7a0010');
            return interaction.editReply({ embeds: [basarisizEmbed] });
        }

        // 🟩 3. ADIM: YETKİLİYE EMOJİLİ DETAYLI OPERASYON RAPORU
        let sunucuListesiMetni = banlananSunucular.map(s => `🔹 ${s}`).join('\n');

        const basariEmbed = new EmbedBuilder()
            .setTitle('🛡️ KÜRESEL SIKIYÖNETİM OPERASYONU TIKIRINDA 🛡️')
            .setDescription(
                `### 👤 Kullanıcı Bilgileri\n` +
                `• **Kullanıcı:** ${targetName}\n` +
                `• **ID:** \`${targetId}\`\n\n` +
                `### 👮 Yetkili Bilgileri\n` +
                `• **İşlemi Yapan:** ${yetkili}\n` +
                `• **Kullanıcı Adı:** \`${yetkili.username}\`\n\n` +
                `### 📄 İşlem Detayları\n` +
                `• **Sebep:** \`${sebep}\`\n` +
                `• **DM Durumu:** ${dmDurumu}\n\n` +
                `### 🌐 Yasaklandığı Discord Sunucuları (${banlananSunucular.length})\n` +
                `${sunucuListesiMetni}`
            )
            .setColor('#7a0010')
            .setThumbnail(targetUser ? targetUser.displayAvatarURL({ dynamic: true }) : null)
            .setFooter({ 
                text: `THT Güvenlik Departmanı • Raporlayan: ${yetkili.username}`, 
                iconURL: interaction.guild.iconURL({ dynamic: true }) 
            })
            .setTimestamp();

        return interaction.editReply({ embeds: [basariEmbed] });
    },
};
