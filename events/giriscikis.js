const { EmbedBuilder } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {
    // =========================================================================
    // 📥 ÜYELER GİRİŞ YAPINCA
    // =========================================================================
    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return;

        try {
            const kanalId = ayarGetir(member.guild.id, 'girisCikisKanal', null);
            const durum = ayarGetir(member.guild.id, 'girisCikisDurum', false);

            if (!kanalId || !durum) return;

            const kanal = member.guild.channels.cache.get(kanalId);
            if (!kanal) return;

            // Hoşgeldiniz embed'i
            const avatar = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const memberCount = member.guild.memberCount;
            const resimUrl = `https://dummyimage.com/800x350/2b2d31/f2f3f5.png?text=HOSGELDINIZ+${encodeURIComponent(member.user.username)}%0A%0ASunucuda+${memberCount}.+Uyesi`;

            const girisBilgisi = new EmbedBuilder()
                .setTitle('📥 Yeni Bir Kan Sunucuya Katıldı!')
                .setDescription(`**${member.user}** aramıza hoş geldi!\n\n🎉 Sunucu Üye Sayısı: **${memberCount}**\n⏰ Hesap Açılış Tarihi: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
                .setThumbnail(avatar)
                .setImage(resimUrl)
                .setColor('#2ecc71')
                .setTimestamp();

            await kanal.send({ embeds: [girisBilgisi] });
            console.log(`✅ [GİRİŞ LOG] ${member.user.tag} sunucuya katıldı`);
        } catch (error) {
            console.error('❌ Giriş logu hatası:', error);
        }
    });

    // =========================================================================
    // 📤 ÜYELER ÇIKTIKÇA
    // =========================================================================
    client.on('guildMemberRemove', async (member) => {
        if (member.user.bot) return;

        try {
            const kanalId = ayarGetir(member.guild.id, 'girisCikisKanal', null);
            const durum = ayarGetir(member.guild.id, 'girisCikisDurum', false);

            if (!kanalId || !durum) return;

            const kanal = member.guild.channels.cache.get(kanalId);
            if (!kanal) return;

            // Ayrılış embed'i
            const avatar = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const memberCount = member.guild.memberCount;
            const resimUrl = `https://dummyimage.com/800x350/2b2d31/f2f3f5.png?text=GULE+GULE+${encodeURIComponent(member.user.username)}%0A%0ASunucuda+${memberCount}.+Uyesi+Kaldi`;

            const cikisBilgisi = new EmbedBuilder()
                .setTitle('📤 Bir Kan Sunucudan Ayrıldı!')
                .setDescription(`**${member.user.tag}** sunucudan ayrıldı...\n\n😢 Sunucu Üye Sayısı: **${memberCount}**\n⏰ Ayrılış Tarihi: <t:${Math.floor(Date.now() / 1000)}:F>`)
                .setThumbnail(avatar)
                .setImage(resimUrl)
                .setColor('#e74c3c')
                .setTimestamp();

            await kanal.send({ embeds: [cikisBilgisi] });
            console.log(`❌ [ÇIKIŞ LOG] ${member.user.tag} sunucudan ayrıldı`);
        } catch (error) {
            console.error('❌ Çıkış logu hatası:', error);
        }
    });
};
