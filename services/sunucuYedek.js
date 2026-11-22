const { ChannelType } = require('discord.js');
const { ayarKaydet, ayarGetir } = require('../utils/db');

// Sadece "yapısal" kanal tiplerini yedekliyoruz (thread'ler kalıcı yapı değil, atlanıyor).
const YEDEKLENECEK_TIPLER = new Set([
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildCategory,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildStageVoice,
    ChannelType.GuildForum
]);

const YEDEK_ANAHTARI = 'sunucuYedek';

function overwriteleriDisariAktar(channel) {
    const liste = [];
    channel.permissionOverwrites?.cache?.forEach((ow) => {
        if (ow.type === 0) {
            // Rol bazlı izin (type 0). ID'ler nuke sonrası değişeceği için isimle saklıyoruz.
            const rolAdi = ow.id === channel.guild.id ? '@everyone' : channel.guild.roles.cache.get(ow.id)?.name;
            if (!rolAdi) return;
            liste.push({
                tip: 'role',
                ad: rolAdi,
                allow: ow.allow.bitfield.toString(),
                deny: ow.deny.bitfield.toString()
            });
        } else {
            // Üye bazlı izin (type 1). Kullanıcı ID'si nuke'tan etkilenmez, direkt saklanabilir.
            liste.push({
                tip: 'member',
                userId: ow.id,
                allow: ow.allow.bitfield.toString(),
                deny: ow.deny.bitfield.toString()
            });
        }
    });
    return liste;
}

// Sunucunun o anki rol + kanal yapısını kalıcı depoya yazar.
async function yedekAl(guild) {
    try {
        const roller = guild.roles.cache
            .filter(r => r.id !== guild.id && !r.managed)
            .map(r => ({
                ad: r.name,
                renk: r.color,
                hoist: r.hoist,
                mentionable: r.mentionable,
                permissions: r.permissions.bitfield.toString()
            }));

        const kanallar = guild.channels.cache
            .filter(c => YEDEKLENECEK_TIPLER.has(c.type))
            .map(c => ({
                ad: c.name,
                tip: c.type,
                ustKategori: c.parent ? c.parent.name : null,
                konu: typeof c.topic === 'string' ? c.topic : null,
                nsfw: Boolean(c.nsfw),
                yavasMod: c.rateLimitPerUser || 0,
                bitrate: c.bitrate || null,
                kullaniciLimiti: c.userLimit || null,
                overwrites: overwriteleriDisariAktar(c)
            }));

        const yedek = {
            alinmaZamani: new Date().toISOString(),
            roller,
            kanallar
        };

        ayarKaydet(guild.id, YEDEK_ANAHTARI, yedek);
        return yedek;
    } catch (err) {
        console.error('❌ Sunucu yedeği alınamadı:', err.message || err);
        return null;
    }
}

// Son yedekte olup şu an sunucuda olmayan rol/kanalları yeniden oluşturur.
// Sadece EKSİK olanları ekler; hâlâ duran kanal/rollere dokunmaz.
async function yedektenGeriYukle(guild, sebep = 'GUARD: otomatik geri yükleme') {
    const yedek = ayarGetir(guild.id, YEDEK_ANAHTARI, null);
    if (!yedek) return { calisti: false, roller: 0, kanallar: 0, hata: 'Henüz hiç yedek alınmamış.' };

    let olusturulanRol = 0;
    let olusturulanKanal = 0;

    await guild.roles.fetch().catch(() => {});
    await guild.channels.fetch().catch(() => {});

    // 1) EKSİK ROLLERİ GERİ YARAT (kanal izinleri rollere referans verdiği için önce roller)
    for (const r of yedek.roller) {
        const varMi = guild.roles.cache.find(role => role.name === r.ad && !role.managed);
        if (varMi) continue;
        try {
            await guild.roles.create({
                name: r.ad,
                color: r.renk,
                hoist: r.hoist,
                mentionable: r.mentionable,
                permissions: BigInt(r.permissions || '0'),
                reason: sebep
            });
            olusturulanRol++;
        } catch (err) {
            console.error(`❌ Rol geri yüklenemedi (${r.ad}):`, err.message || err);
        }
    }

    if (olusturulanRol > 0) await guild.roles.fetch().catch(() => {});

    const rolBul = (ad) => {
        if (ad === '@everyone') return guild.roles.everyone;
        return guild.roles.cache.find(role => role.name === ad && !role.managed) || null;
    };

    // 2) ÖNCE KATEGORİLERİ GERİ YARAT (diğer kanallar kategoriye bağlanacak)
    const kategoriler = yedek.kanallar.filter(k => k.tip === ChannelType.GuildCategory);
    for (const k of kategoriler) {
        const varMi = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === k.ad);
        if (varMi) continue;
        try {
            await guild.channels.create({ name: k.ad, type: ChannelType.GuildCategory, reason: sebep });
            olusturulanKanal++;
        } catch (err) {
            console.error(`❌ Kategori geri yüklenemedi (${k.ad}):`, err.message || err);
        }
    }

    if (olusturulanKanal > 0) await guild.channels.fetch().catch(() => {});

    // 3) DİĞER KANALLARI (metin/ses/forum vb.) GERİ YARAT
    const digerKanallar = yedek.kanallar.filter(k => k.tip !== ChannelType.GuildCategory);
    for (const k of digerKanallar) {
        const ustKategoriKanal = k.ustKategori
            ? guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === k.ustKategori)
            : null;

        const varMi = guild.channels.cache.find(c =>
            c.type === k.tip &&
            c.name === k.ad &&
            (ustKategoriKanal ? c.parentId === ustKategoriKanal.id : true)
        );
        if (varMi) continue;

        const overwrites = [];
        for (const ow of (k.overwrites || [])) {
            if (ow.tip === 'role') {
                const rol = rolBul(ow.ad);
                if (!rol) continue;
                overwrites.push({ id: rol.id, allow: BigInt(ow.allow || '0'), deny: BigInt(ow.deny || '0') });
            } else {
                overwrites.push({ id: ow.userId, allow: BigInt(ow.allow || '0'), deny: BigInt(ow.deny || '0') });
            }
        }

        try {
            await guild.channels.create({
                name: k.ad,
                type: k.tip,
                parent: ustKategoriKanal ? ustKategoriKanal.id : undefined,
                topic: k.konu || undefined,
                nsfw: k.nsfw,
                rateLimitPerUser: k.yavasMod || undefined,
                bitrate: k.bitrate || undefined,
                userLimit: k.kullaniciLimiti || undefined,
                permissionOverwrites: overwrites,
                reason: sebep
            });
            olusturulanKanal++;
        } catch (err) {
            console.error(`❌ Kanal geri yüklenemedi (${k.ad}):`, err.message || err);
        }
    }

    return { calisti: true, roller: olusturulanRol, kanallar: olusturulanKanal, alinmaZamani: yedek.alinmaZamani };
}

module.exports = { yedekAl, yedektenGeriYukle };
