const { AttachmentBuilder } = require('discord.js');
const { ayarGetir } = require('../utils/db');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

module.exports = {
    name: 'guildMemberRemove',
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

        ctx.strokeStyle = '#e74c3c'; // Çıkış için Kırmızı Çerçeve
        ctx.lineWidth = 4;
        ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

        ctx.fillStyle = '#e74c3c';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('🔴 SUNUCUDAN AYRILDI', 35, 40);

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
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2;
            ctx.stroke();
        } catch (e) {
            ctx.fillStyle = '#4f545c';
            ctx.beginPath();
            ctx.arc(100, 130, 55, 0, Math.PI * 2, true);
            ctx.fill();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText(member.user.username.toUpperCase(), 180, 110);

        ctx.fillStyle = '#95a5a6';
        ctx.font = '18px sans-serif';
        ctx.fillText('GÜLE GÜLE KANKA!', 180, 145);

        ctx.fillStyle = '#949ba4';
        ctx.font = '14px sans-serif';
        ctx.fillText(`Sunucuda geriye ${guild.memberCount} kişi kaldık kanka.`, 180, 185);

        const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'gulegule.png' });

        logChannel.send({
            content: `<a:baarsz:1505146967817326675> Bir Kan Sunucudan Ayrıldı! **${member.user.username}** aramizdan ayrildi.`,
            files: [attachment]
        }).catch(() => {});
    }
};
