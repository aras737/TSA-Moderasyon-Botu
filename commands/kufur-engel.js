const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { ayarGetir } = require('../utils/db');

module.exports = (client) => {
    const kufurler = ['amk', 'aq', 'piç', 'orospu', 'sik', 'yarrak', 'pezevenk', 'göt', 'sktir', 'sg'];

    // ⚠️ linkRegex her test() çağrısında yeniden oluşturulmalı!
    // Regex'i sabit tanımlayıp .test() ile kullanmak lastIndex sorununa yol açar.
    const getLinkRegex = () => /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,})/gi;

    // Uyarı sayacı (RAM'de tutuluyor, bot yeniden başlarsa sıfırlanır)
    // Map<userId, uyariSayisi>
    const uyariSayaci = client.sistemBellegi ?? new Map();

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // 🛡️ Bot'un ManageMessages yetkisi var mı?
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        // 🛡️ Sunucu sahibi, yönetici veya moderatörleri atla
        if (
            message.author.id === message.guild.ownerId ||
            message.member.permissions.has(PermissionFlagsBits.Administrator) ||
            message.member.permissions.has(PermissionFlagsBits.ManageMessages)
        ) return;

        // ✅ Ayarları async olarak çek (ayarGetir async ise await gerekli)
        const kufurDurum = await ayarGetir(message.guild.id, 'kufurEngelDurum', true);
        const linkDurum  = await ayarGetir(message.guild.id, 'linkEngelDurum', true);
        const logKanalId = await ayarGetir(message.guild.id, 'logKanal', null);

        const icerik = message.content.toLowerCase();
        let tetiklendi = false;
        let sebep = '';

        // Küfür kontrolü
        if (kufurDurum && kufurler.some(kufur => icerik.includes(kufur))) {
            tetiklendi = true;
            sebep = 'Küfür / Argo Kullanımı';
        }

        // Link kontrolü — her seferinde yeni regex örneği (lastIndex sıfır olur)
        if (!tetiklendi && linkDurum && getLinkRegex().test(message.content)) {
            tetiklendi = true;
            sebep = 'Link / Reklam Paylaşımı';
        }

        if (!tetiklendi) return;

        // Mesajı sil
        await message.delete().catch(() => {});

        // Uyarı sayacını artır
        const userId     = message.author.id;
        const mevcutUyari = (uyariSayaci.get(userId) ?? 0) + 1;
        uyariSayaci.set(userId, mevcutUyari);

        // Uyarı embed'i
        const uyariEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription(
                `<a:alarme:1505209430319300718> **${message.author}**, bu sunucuda **${sebep}** kesinlikle yasaktır!\n` +
                `*Kurallar herkes için geçerlidir.* | Uyarı sayısı: **${mevcutUyari}**`
            );

        const uyariMsg = await message.channel.send({ embeds: [uyariEmbed] }).catch(() => null);
        if (uyariMsg) setTimeout(() => uyariMsg.delete().catch(() => {}), 7000);

        // 3 uyarıda timeout uygula
        if (mevcutUyari >= 3) {
            const timeoutSuresi = 10 * 60 * 1000; // 10 dakika
            await message.member.timeout(timeoutSuresi, `Oto-Moderasyon: ${mevcutUyari} uyarı — ${sebep}`)
                .catch(() => {});

            const timeoutEmbed = new EmbedBuilder()
                .setColor('#e67e22')
                .setDescription(
                    `<a:alarme:1505209430319300718> **${message.author}**, ${mevcutUyari} uyarı aldığın için **10 dakika** susturuldun!`
                );

            const timeoutMsg = await message.channel.send({ embeds: [timeoutEmbed] }).catch(() => null);
            if (timeoutMsg) setTimeout(() => timeoutMsg.delete().catch(() => {}), 10000);

            uyariSayaci.set(userId, 0); // Sayacı sıfırla
        }

        // Log kanalına gönder
        const logChan = logKanalId ? client.channels.cache.get(logKanalId) : null;
        if (!logChan) return;

        const silinenMesaj = message.content.length > 1000
            ? message.content.substring(0, 1000) + '...'
            : message.content;

        const logEmbed = new EmbedBuilder()
            .setAuthor({ name: 'Sohbet Koruması', iconURL: message.guild.iconURL() })
            .setTitle('<:koruma1:1505143174190989352> İhlal Temizlendi')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '<:uzaybot_kullanicilar:1505146190973505567> Kullanıcı', value: `${message.author}\n\`ID: ${message.author.id}\``, inline: true },
                { name: '<:uzaybot_kanal:1505159120074833931> Kanal', value: `${message.channel}`, inline: true },
                { name: '<a:alarme:1505209430319300718> İhlal Sebebi', value: `\`${sebep}\``, inline: true },
                { name: '<a:uyari:1505166167189487757> Uyarı Sayısı', value: `\`${mevcutUyari}\``, inline: true },
                { name: '<:uzaybot_mesaj:1505162349026344970> Silinen Mesaj', value: `\`\`\`${silinenMesaj}\`\`\`` }
            )
            .setColor('#960018')
            .setTimestamp();

        logChan.send({ embeds: [logEmbed] }).catch(() => {});
    });
};
