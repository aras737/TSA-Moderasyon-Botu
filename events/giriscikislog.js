const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {

    // =========================================================================
    // 🟩 RESİMLİ GİRİŞ LOGU (WELCOME)
    // =========================================================================
    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return;

        const guild = member.guild;
        const gCikisKanalId = ayarGetir(guild.id, 'girisCikisKanal', null);
        const logChan = gCikisKanalId ? client.channels.cache.get(gCikisKanalId) : null;

        if (!logChan) return;

        const avatar = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const username = encodeURIComponent(member.user.username);
        const guildName = encodeURIComponent(guild.name);

        // 🎨 Erensi Tarzı Dinamik Hoş Geldin Görseli Oluşturucu (API)
        // Kullanıcının avatarını, adını ve sunucu adını şık bir arka plana gömer kanka
        const hosgeldinResimUrl = `https://dummyimage.com/800x350/2b2d31/f2f3f5.png&text=HOŞ+GELDİN+KANKA!%0A${username}%0A%0ASunucu:+${guildName}`;

        const kurulusZamani = member.user.createdAt;
        const hesapYasiGunu = Math.floor((Date.now() - kurulusZamani) / (1000 * 60 * 60 * 24));
        const guvenlikDurumu = hesapYasiGunu > 7 ? '🟢 Güvenli Hesap' : '⚠️ ŞÜPHELİ / YENİ HESAP!';

        const girisEmbed = new EmbedBuilder()
            .setTitle(`📥 Sunucuya Yeni Bir Kan Katıldı!`)
            .setDescription(`Aramıza hoş geldin ${member}! Seninle birlikte **${guild.memberCount}** kişi olduk kanka.\n\n📅 **Hesap Yaşı:** <t:${Math.floor(kurulusZamani / 1000)}:R> (${hesapYasiGunu} gün önce açılmış)\n🛡️ **Güvenlik:** **${guvenlikDurumu}**`)
            .setThumbnail(avatar) // Sağ üstte üyenin kendi küçük fotosu
            .setImage(hosgeldinResimUrl) // Ortada devasa Erensi tarzı bilgi resmi
            .setColor(hesapYasiGunu > 7 ? '#2ecc71' : '#e67e22')
            .setFooter({ text: `${guild.name} Yönetim Sistemi`, iconURL: guild.iconURL() })
            .setTimestamp();

        logChan.send({ content: `👋 Hoş geldin ${member}!`, embeds: [girisEmbed] }).catch(() => {});
    });

    // =========================================================================
    // 🟥 RESİMLİ ÇIKIŞ LOGU (LEAVE)
    // =========================================================================
    client.on('guildMemberRemove', async (member) => {
        if (member.user.bot) return;

        const guild = member.guild;
        const gCikisKanalId = ayarGetir(guild.id, 'girisCikisKanal', null);
        const logChan = gCikisKanalId ? client.channels.cache.get(gCikisKanalId) : null;

        if (!logChan) return;

        const avatar = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const username = encodeURIComponent(member.user.username);

        // 🎨 Erensi Tarzı Dinamik Görüşürüz Görseli
        const guleguleResimUrl = `https://dummyimage.com/800x350/2b2d31/f2f3f5.png&text=GÜLE+GÜLE+KANKA...%0A${username}%0A%0AAramızdan+Ayrıldı`;

        const cikisEmbed = new EmbedBuilder()
            .setTitle(`📤 Bir Kişi Eksildik...`)
            .setDescription(`**${member.user.username}** sunucudan çıkış yaptı. Geride **${guild.memberCount}** kişi kaldık kanka.`)
            .setThumbnail(avatar)
            .setImage(guleguleResimUrl) // Ortada devasa gitme resmi
            .setColor('#e74c3c')
            .setFooter({ text: `${guild.name} Hoşçakal Sistemi`, iconURL: guild.iconURL() })
            .setTimestamp();

        logChan.send({ embeds: [cikisEmbed] }).catch(() => {});
    });
};
