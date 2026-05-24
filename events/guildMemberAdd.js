const { AttachmentBuilder } = require('discord.js');
const { ayarGetir } = require('../utils/db');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        const guild = member.guild;
        const client = member.client;

        if (!client.girisCikisCache) client.girisCikisCache = new Map();
        let hafiza = client.girisCikisCache.get(guild.id);

        if (!hafiza) {
            const kanalId = await ayarGetir(guild.id, 'girisCikisKanal', null);
            const durum = await ayarGetir(guild.id, 'girisCikisDurum', false);
            hafiza = { kanalId, durum };
            client.girisCikisCache.set(guild.id, hafiza);
        }

        if (!hafiza.durum || !hafiza.kanalId) return;
        const logChannel = guild.channels.cache.get(hafiza.kanalId);
        if (!logChannel) return;

        // Canvas Tasarımı
        const canvas = createCanvas(700, 250);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#1e1f22';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#2ecc71'; // Giriş için Yeşil Çerçeve
        ctx.lineWidth = 4;
        ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

        ctx.fillStyle = '#2ecc71';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('🟢 YENİ KULLANICI', 35, 40);

        ctx.fillStyle = '#4e5058';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('ERENSİBOT', canvas.width - 100, canvas.height - 25);

        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        try {
            const avatarImg = await loadImage(avatarURL);
            ctx.save();
            ctx.beginPath();
            ctx.arc(100, 130, 55, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImg, 45, 75, 110, 110);
            ctx.restore();

            ctx.beginPath();
            ctx.arc(100, 130, 56, 0, Math.PI * 2, true);
            ctx.strokeStyle = '#2ecc71';
            ctx.lineWidth = 2;
            ctx.stroke();
        } catch (e) {
            ctx.fillStyle = '#5865f2';
            ctx.beginPath();
            ctx.arc(100, 130, 55, 0, Math.PI * 2, true);
            ctx.fill();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText(member.user.username.toUpperCase(), 180, 110);

        ctx.fillStyle = '#e67e22';
        ctx.font = '16px sans-serif';
        ctx.fillText('Aramıza hoş geldin kanka!', 180, 145);

        ctx.fillStyle = '#949ba4';
        ctx.font = '14px sans-serif';
        ctx.fillText(`Seninle birlikte ${guild.memberCount} kişiyiz.`, 180, 185);

        const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'hosgeldin.png' });
        
        logChannel.send({
            content: `<a:join_join:1505202309343215717> Sunucuya Yeni Bir Kan Katıldı! Aramıza hoş geldin ${member} kanka.`,
            files: [attachment]
        }).catch(() => {});
    }
};
