const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tamyasakla')
        .setDescription('Bir Discord kullanıcısını bilgilendirerek botun olduğu TÜM sunuculardan kalıcı olarak yasaklar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('kisi')
                .setDescription('Yasaklanacak kişinin Discord ID\'sini veya etiketini girin kanka.')
                .setMaxLength(25)
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Yasaklama sebebini belirtin.')
                .setMaxLength(500)
                .setRequired(true)
        ),

    requiredPerms: [PermissionFlagsBits.Administrator],

    async execute(interaction) {
        const kisiInput = interaction.options.getString('kisi');
        const sebep = interaction.options.getString('sebep');
        const yetkili = interaction.user;

        // 🧹 Etiket parantezlerini temizleyip saf ID'yi alıyoruz kanka
        const targetId = kisiInput.replace(/[<@!>]/g, '');

        if (!/^\d{17,20}$/.test(targetId)) {
            const hataEmbed = new EmbedBuilder()
                .setTitle('❌ Geçersiz Kullanıcı')
                .setDescription('<a:baarsz:1505146967817326675> Lütfen geçerli bir Discord ID\'si veya kullanıcı etiketi gir kanka!')
                .setColor('#7a0010');
            return interaction.reply({ embeds: [hataEmbed], ephemeral: true });
        }

        await interaction.deferReply();

        let targetUser = null;
        let dmDurumu = "<a:baarsz:1505146967817326675> **DM İletilemedi** *(Kullanıcı bulunamadı)*";

        try {
            targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
        } catch (err) {
            console.log("Kullanıcı verisi çekilemedi.");
        }

        // ✉️ 1. ADIM: BANLANMADAN ÖNCE KULLANICIYA DM ATMA SİSTEMİ
        if (targetUser) {
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('<:yasaklandi:1505146022588842095> KÜRESEL YASAKLAMA BİLDİRİMİ')
                    .setDescription(`Merhaba **${targetUser.username}**,\nTMF Yönetim Sistemi kararıyla botun bağlı olduğu tüm sunuculardan kalıcı olarak uzaklaştırıldınız.`)
                    .addFields(
                        { name: '┗ <:Paper:1505146388596391977> Yasaklama Sebebi:', value: `\`${sebep}\``, inline: false },
                        { name: '┗ <:uzaybot_kullanicilar:1505146190973505567> İşlemi Yapan Yetkili:', value: `\`${yetkili.username}\``, inline: false }
                    )
                    .setColor('#7a0010')
                    .setFooter({ text: 'TMF Küresel Sıkıyönetim Sistemi' })
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
                dmDurumu = "<a:tik:1505164671081123840> **DM Başarıyla İletildi**";
            } catch (dmError) {
                dmDurumu = "<a:uyari:1505166167189487757> **DM İletilemedi** *(Kullanıcının DM'leri kapalı veya botu engellemiş)*";
            }
        }

        const targetName = targetUser ? `${targetUser.tag}` : `Bilinmeyen Kullanıcı (${targetId})`;
        const banlananSunucular = [];

        // ⚡ 2. ADIM: BOTUN OLDUĞU TÜM SUNUCULARDAN TEMİZLEME DÖNGÜSÜ
        const tumSunucular = interaction.client.guilds.cache;

        for (const [guildId, sunucu] of tumSunucular) {
            try {
                // Ban listesindeki arama algoritmasının tanıması için sebebi "Küresel Sıkıyönetim" olarak işaretliyoruz
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
                .setDescription(`<a:baarsz:1505146967817326675> **${targetName}** kişisi hiçbir sunucudan banlanamadı. Yetkileri kontrol et kanka!`)
                .setColor('#7a0010');
            return interaction.editReply({ embeds: [basarisizEmbed] });
        }

        // 🟩 3. ADIM: YETKİLİYE SANA ÖZEL EMOJİLERLE RAPORLAMA
        const gosterilenSunucular = banlananSunucular.slice(0, 15);
        let sunucuListesiMetni = gosterilenSunucular.map(s => `<a:tik:1505164671081123840> ${s}`).join('\n');
        if (banlananSunucular.length > gosterilenSunucular.length) {
            sunucuListesiMetni += `\n… ve ${banlananSunucular.length - gosterilenSunucular.length} sunucu daha.`;
        }

        const basariEmbed = new EmbedBuilder()
            .setTitle('<:yasaklandi:1505146022588842095> TMF | Küresel Sıkıyönetim Operasyonu')
            .setDescription(
                `### <:uzaybot_kullanicilar:1505146190973505567> Kullanıcı Bilgileri\n` +
                `• **Kullanıcı:** ${targetName}\n` +
                `• **ID:** \`${targetId}\`\n\n` +
                `### 👑 Yetkili Bilgileri\n` +
                `• **İşlemi Yapan:** ${yetkili}\n` +
                `• **Kullanıcı Adı:** \`${yetkili.username}\`\n\n` +
                `### <:Paper:1505146388596391977> İşlem Detayları\n` +
                `• **Sebep:** *${sebep}*\n` +
                `• **DM Durumu:** ${dmDurumu}\n\n` +
                `### 🌐 Yasaklandığı Discord Sunucuları (${banlananSunucular.length})\n` +
                `${sunucuListesiMetni}`
            )
            .setColor('#7a0010')
            .setFooter({ text: `TMF Güvenlik Departmanı • Raporlayan: ${yetkili.username}`, iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined })
            .setTimestamp();

        if (targetUser) basariEmbed.setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

        return interaction.editReply({ embeds: [basariEmbed] });
    },
};
