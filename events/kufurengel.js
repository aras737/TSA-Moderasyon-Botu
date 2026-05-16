const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// =========================================================================
// 🔥 TSA GELİŞMİŞ KÜFÜR ENGELLEME MOTORU v2
// =========================================================================
// Bu modül TSA-Moderasyon-Botu'nun events klasörüne aittir.
// index.js'deki client.sistemBellegi ile entegre çalışır.
// /küfür-engel slash komutu ile açılıp kapatılır.
// =========================================================================

const LOG_YOLU = path.join(__dirname, '../ayarlar/gelismisLog.json');

// ── Yardımcı: Log Kanalı Getir ──────────────────────────────────────────
const logKanalGetir = (guildId, client) => {
    if (fs.existsSync(LOG_YOLU)) {
        try {
            const ayarlar = JSON.parse(fs.readFileSync(LOG_YOLU, 'utf8'));
            if (ayarlar[guildId]) return client.channels.cache.get(ayarlar[guildId]);
        } catch (_) {}
    }
    return null;
};

// ── Yardımcı: Sistem Belleğinden Log Kanalı Getir ────────────────────────
const sistemLogGetir = (guildId, client) => {
    const bellek = client.sistemBellegi?.get(guildId);
    if (bellek?.logKanalId) return client.channels.cache.get(bellek.logKanalId);
    return null;
};

// =========================================================================
// 📚 KAPSAMLI KÜFÜR LİSTESİ
// =========================================================================
const kufurListesi = [
    // ── Temel Küfürler ──
    'amk', 'aq', 'am', 'amcık', 'amcıgıl', 'amına', 'amina', 'amq',
    'piç', 'pç', 'orospu', 'orospçocuğu', 'oc', 'oç',
    'sik', 'siktir', 'siktirgit', 'sikik', 'sikerim', 'sikem', 'sıkerım',
    'yarrak', 'yarram', 'yarrag', 'yarrağım', 'yarragım',
    'göt', 'götten', 'götüne', 'götüm',
    'pezevenk', 'pezevenği', 'pezo',
    'gavat', 'kavat',
    'kerata', 'kerataçocuğu',
    'ibne', 'ibnegğ', 'ibnem',
    'top', 'topçu', // dikkat: çok kısa, aşağıda filtreleniyor
    'salak', 'gerizekalı', 'mal',
    'orosbu', 'orospucocugu', 'orospçocugu',

    // ── Argo / Hakaret ──
    'puşt', 'kast', 'esek', 'eqşek', 'şerefsiz', 'şerefsizler',
    'kahpe', 'kape', 'karihga',
    'aylak', 'dangalak', 'aptal', 'salak', 'embesil',
    'sürtük', 'sürtengeri',

    // ── İngilizce Küfürler ──
    'fuck', 'fucking', 'fucker', 'motherfucker', 'mf', 'fck', 'fcuk',
    'shit', 'shitty', 'bullshit', 'bs', 'sht',
    'bitch', 'bich', 'btch', 'bch',
    'asshole', 'ass', 'ashole', 'ashl',
    'dick', 'dickhead', 'dickh', 'dck',
    'bastard', 'bstrd', 'bstrd',
    'cunt', 'cnt',
    'whore', 'hoe', 'ho', 'slut', 'slt',
    'nigga', 'nigger', 'ngga', 'nigr',

    // ── Leet Speak Varyantları ──
    '4mk', '4q', 'p1ç', 'p1c', '51k', '51kt1r', 'y4rr4k',
    '81tch', 'fuuck', 'fck', 'fcuk',
    '5h1t', '4ss', 'd1ck',
];

// ── Çok kısa (2 harf ve altı) küfürleri ayır — yanlış eşleşme riski yüksek ──
const kisaKufurler = kufurListesi.filter(k => k.length <= 2);
const uzunKufurler = kufurListesi.filter(k => k.length > 2);

// =========================================================================
// 🔧 NORMALİZASYON MOTORU
// =========================================================================
// Amaç: Kullanıcıların kandırmaca yöntemleriyle küfürü atlatmasını engellemek
// 1. Türkçe karakter normalizasyonu (ı→i, ş→s, vb.)
// 2. Leet speak çevirisi (4→a, 5→s, 1→i, 3→e, 0→o, 7→t)
// 3. Benzer harf değiştirme (@→a, $→s, !→i, vb.)
// 4. Tüm özel karakterleri/sayıları sil
// 5. Harf tekrarlarını sadeleştir (amkkkk → amk)
// =========================================================================

const karakterNorm = {
    'ı': 'i', 'İ': 'i', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u',
    'ş': 's', 'Ş': 's', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c',
};

const leetDonusum = {
    '4': 'a', '5': 's', '1': 'i', '3': 'e', '0': 'o', '7': 't',
    '@': 'a', '$': 's', '!': 'i', '£': 'l', '€': 'e',
    '#': 'h', '8': 'b', '9': 'g', '6': 'g', '2': 'z',
};

function normalizeEt(metin) {
    let sonuc = metin.toLowerCase();

    // 1. Türkçe karakter normalizasyonu
    for (const [kaynak, hedef] of Object.entries(karakterNorm)) {
        sonuc = sonuc.replaceAll(kaynak, hedef);
    }

    // 2. Leet speak + sembol değiştirme
    for (const [kaynak, hedef] of Object.entries(leetDonusum)) {
        sonuc = sonuc.replaceAll(kaynak, hedef);
    }

    // 3. Tüm harf olmayanları sil (sadece a-z kalır)
    sonuc = sonuc.replace(/[^a-z]/g, '');

    // 4. Harf tekrarlarını sadeleştir (amkkkk → amk)
    sonuc = sonuc.replace(/(.)\1+/g, '$1');

    return sonuc;
}

// ── Alternatif normalize: boşlukları koruyan versiyon ──
function normalizeEtBosluklu(metin) {
    let sonuc = metin.toLowerCase();

    for (const [kaynak, hedef] of Object.entries(karakterNorm)) {
        sonuc = sonuc.replaceAll(kaynak, hedef);
    }
    for (const [kaynak, hedef] of Object.entries(leetDonusum)) {
        sonuc = sonuc.replaceAll(kaynak, hedef);
    }

    // Boşlukları koru ama diğer özel karakterleri sil
    sonuc = sonuc.replace(/[^a-z ]/g, '');

    // Boşlukları sil → kelimeleri birleştir (a m k → amk)
    sonuc = sonuc.replace(/\s+/g, '');

    // Harf tekrarlarını sadeleştir
    sonuc = sonuc.replace(/(.)\1+/g, '$1');

    return sonuc;
}

// =========================================================================
// 🔍 KÜFÜR TESPİT MOTORU
// =========================================================================

function kufurTespit(icerik) {
    const ham = icerik.toLowerCase();
    const norm = normalizeEt(icerik);
    const normBosluklu = normalizeEtBosluklu(icerik);

    const bulgular = [];

    // ── 1. Uzun küfürler: substring arama ──
    // normalize edilmiş metin içinde direkt arar
    for (const kufur of uzunKufurler) {
        const normKufur = normalizeEt(kufur);
        if (normKufur.length < 2) continue;

        if (
            ham.includes(kufur) ||
            norm.includes(normKufur) ||
            normBosluklu.includes(normKufur)
        ) {
            bulgular.push(kufur);
        }
    }

    // ── 2. Kısa küfürler: sadece normalize edilmiş metinde arama ──
    // Ham metinde aramak false positive verir (ör: "oc" → "doktor", "rekor")
    for (const kufur of kisaKufurler) {
        const normKufur = normalizeEt(kufur);
        if (normKufur.length < 2) continue;

        // Sadece normalize edilmiş metinde kelime sınırı benzeri kontrol
        if (norm.includes(normKufur) || normBosluklu.includes(normKufur)) {
            // Kısa küfürler için ek kontrol: normalize metinde bağımsız kelime mi?
            // Metnin tamamı kısa küfürden ibaretse veya sonunda/başındaysa
            if (norm === normKufur || norm.startsWith(normKufur) || norm.endsWith(normKufur)) {
                bulgular.push(kufur);
            }
        }
    }

    // ── 3. Özel Desen Eşleştirmeleri ──
    // a.m.k, a_m_k, a-m-k gibi desenler zaten normalize ile yakalanır
    // Ama ek olarak: "amınko", "siktirgit" gibi birleşik kelimeler

    // Tekrar eden bulguları temizle
    return [...new Set(bulgular)];
}

// =========================================================================
// 🛡️ OTOMATİK UYARI SİSTEMİ (5 UYARI = OTOMATİK MUTE)
// =========================================================================

const uyariTakibi = new Map(); // guildId-userId => { sayi: Number, sonUyari: Timestamp }

function uyariKaydet(guildId, userId) {
    const anahtar = `${guildId}-${userId}`;
    const mevcut = uyariTakibi.get(anahtar) || { sayi: 0, sonUyari: 0 };
    mevcut.sayi += 1;
    mevcut.sonUyari = Date.now();
    uyariTakibi.set(anahtar, mevcut);
    return mevcut.sayi;
}

function uyariSifirla(guildId, userId) {
    uyariTakibi.delete(`${guildId}-${userId}`);
}

function uyariGetir(guildId, userId) {
    return uyariTakibi.get(`${guildId}-${userId}`)?.sayi || 0;
}

// ── Süresi dolmuş uyarıları temizle (6 saat) ──
setInterval(() => {
    const simdi = Date.now();
    const altiSaat = 6 * 60 * 60 * 1000;

    for (const [anahtar, veri] of uyariTakibi.entries()) {
        if (simdi - veri.sonUyari > altiSaat) {
            uyariTakibi.delete(anahtar);
        }
    }
}, 30 * 60 * 1000); // Her 30 dakikada bir temizle

// =========================================================================
// 📤 MODÜL EXPORT
// =========================================================================

module.exports = (client) => {

    // Uyarı takibini client üzerinden erişilebilir yap (komutlar için)
    client.kufurUyariTakibi = uyariTakibi;

    client.on('messageCreate', async (message) => {
        // ── Temel Kontroller ──
        if (message.author.bot || !message.guild) return;

        // Yetkili bypass: Yönetici veya Mesajları Yönet
        if (message.member.permissions.has(PermissionFlagsBits.Administrator) ||
            message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        // ── Sistem Aktif mi? (sistemBellegi kontrolü) ──
        const sunucuAyari = client.sistemBellegi?.get(message.guild.id);
        if (!sunucuAyari || !sunucuAyari.durum) return;

        // Botun yetkisi var mı?
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        // ── Küfür Tespiti ──
        const tespitEdilenler = kufurTespit(message.content);
        if (tespitEdilenler.length === 0) return;

        try {
            // ═══════════════════════════════════════════
            // 1️⃣  MESAJI SİL
            // ═══════════════════════════════════════════
            await message.delete().catch(() => {});

            // ═══════════════════════════════════════════
            // 2️⃣  UYARI TAKİBİ
            // ═══════════════════════════════════════════
            const uyariSayisi = uyariKaydet(message.guild.id, message.author.id);
            const maxUyari = 5;

            // ═══════════════════════════════════════════
            // 3️⃣  KANALA UYARI MESAJI
            // ═══════════════════════════════════════════
            const uyariMesaji = uyariSayisi >= maxUyari
                ? `🚫 ${message.author}, **küfür sınırına ulaştın! (${uyariSayisi}/${maxUyari}) Otomatik susturuluyorsun.**`
                : `⚠️ ${message.author}, **bu sunucuda küfür yasaktır!** (${uyariSayisi}/${maxUyari} uyarı)`;

            const kanalUyarisi = await message.channel.send({ content: uyariMesaji });
            setTimeout(() => kanalUyarisi.delete().catch(() => {}), 5000);

            // ═══════════════════════════════════════════
            // 4️⃣  OTOMATİK MUTE (5 uyarıda)
            // ═══════════════════════════════════════════
            if (uyariSayisi >= maxUyari) {
                const muteSuresi = 10 * 60 * 1000; // 10 dakika

                if (message.member.moderatable) {
                    await message.member.timeout(muteSuresi, 'TSA Otomatik: Küfür sınırı aşıldı');

                    // Uyarı sayacını sıfırla
                    uyariSifirla(message.guild.id, message.author.id);

                    // Mute bilgisini kanala gönder
                    const muteMsj = await message.channel.send(
                        `🔇 **${message.author.tag}** küfür sınırını aştığı için **10 dakika** susturuldu.`
                    );
                    setTimeout(() => muteMsj.delete().catch(() => {}), 8000);
                }
            }

            // ═══════════════════════════════════════════
            // 5️⃣  LOG KANALINA DETAYLI EMBED
            // ═══════════════════════════════════════════
            // Önce sistem belleğinden, yoksa gelismisLog.json'dan al
            const logKanali = sistemLogGetir(message.guild.id, client)
                            || logKanalGetir(message.guild.id, client);

            if (logKanali) {
                const embed = new EmbedBuilder()
                    .setColor('#ff3333')
                    .setTitle('🛡️ TSA Küfür Filtresi — Yakalama Raporu')
                    .setThumbnail(message.author.displayAvatarURL({ size: 128 }))
                    .addFields(
                        {
                            name: '👤 Kullanıcı',
                            value: `${message.author} \`(${message.author.tag} — ${message.author.id})\``,
                            inline: true
                        },
                        {
                            name: '📺 Kanal',
                            value: `${message.channel} \`(#${message.channel.name})\``,
                            inline: true
                        },
                        {
                            name: '🔤 Tespit Edilen',
                            value: `\`${tespitEdilenler.join('`, `')}\``,
                            inline: false
                        },
                        {
                            name: '💬 Orijinal Mesaj',
                            value: `\`\`\`${message.content.slice(0, 1000)}\`\`\``,
                            inline: false
                        },
                        {
                            name: '📊 Uyarı Durumu',
                            value: `**${uyariSayisi}/${maxUyari}** uyarı${uyariSayisi >= maxUyari ? ' — ⚡ Otomatik mute uygulandı!' : ''}`,
                            inline: false
                        },
                        {
                            name: '🔬 Normalize Görünüm',
                            value: `\`${normalizeEt(message.content).slice(0, 200)}\``,
                            inline: false
                        }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'TSA Gelişmiş Küfür Filtre Sistemi v2', iconURL: client.user.displayAvatarURL() });

                await logKanali.send({ embeds: [embed] }).catch(() => {});
            }

        } catch (err) {
            console.error('❌ [TSA Küfür Motoru] Hata:', err);
        }
    });

    // =========================================================================
    // 🔄 MESAJ DÜZENLEME KORUMASI
    // =========================================================================
    // Kullanıcı mesajı düzenleyerek küfür yazmaya çalışırsa da yakala
    // =========================================================================

    client.on('messageUpdate', async (oldMessage, newMessage) => {
        // Temel kontroller
        if (!newMessage.guild || newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        // Yetkili bypass
        const uye = newMessage.member;
        if (!uye) return;
        if (uye.permissions.has(PermissionFlagsBits.Administrator) ||
            uye.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        // Sistem aktif mi?
        const sunucuAyari = client.sistemBellegi?.get(newMessage.guild.id);
        if (!sunucuAyari || !sunucuAyari.durum) return;

        // Botun yetkisi var mı?
        if (!newMessage.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        // Küfür tespiti
        const tespitEdilenler = kufurTespit(newMessage.content || '');
        if (tespitEdilenler.length === 0) return;

        try {
            // Mesajı sil
            await newMessage.delete().catch(() => {});

            // Uyarı kaydet
            const uyariSayisi = uyariKaydet(newMessage.guild.id, newMessage.author.id);
            const maxUyari = 5;

            // Kanala uyarı
            const uyariMsj = await newMessage.channel.send(
                `⚠️ ${newMessage.author}, **mesaj düzenleyerek küfür yazmaya çalıştın!** (${uyariSayisi}/${maxUyari} uyarı)`
            );
            setTimeout(() => uyariMsj.delete().catch(() => {}), 5000);

            // Otomatik mute
            if (uyariSayisi >= maxUyari && uye.moderatable) {
                await uye.timeout(10 * 60 * 1000, 'TSA Otomatik: Küfür sınırı (mesaj düzenleme)');
                uyariSifirla(newMessage.guild.id, newMessage.author.id);

                const muteMsj = await newMessage.channel.send(
                    `🔇 **${newMessage.author.tag}** küfür sınırını aştığı için **10 dakika** susturuldu.`
                );
                setTimeout(() => muteMsj.delete().catch(() => {}), 8000);
            }

            // Log
            const logKanali = sistemLogGetir(newMessage.guild.id, client)
                            || logKanalGetir(newMessage.guild.id, client);

            if (logKanali) {
                const embed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('🛡️ TSA Küfür Filtresi — Mesaj Düzenleme Yakalaması')
                    .setThumbnail(newMessage.author.displayAvatarURL({ size: 128 }))
                    .addFields(
                        {
                            name: '👤 Kullanıcı',
                            value: `${newMessage.author} \`(${newMessage.author.tag} — ${newMessage.author.id})\``,
                            inline: true
                        },
                        {
                            name: '📺 Kanal',
                            value: `${newMessage.channel} \`(#${newMessage.channel.name})\``,
                            inline: true
                        },
                        {
                            name: '🔄 Eski Mesaj',
                            value: `\`\`\`${(oldMessage.content || '*Boş*').slice(0, 500)}\`\`\``,
                            inline: false
                        },
                        {
                            name: '🔄 Yeni Mesaj',
                            value: `\`\`\`${(newMessage.content || '*Boş*').slice(0, 500)}\`\`\``,
                            inline: false
                        },
                        {
                            name: '🔤 Tespit Edilen',
                            value: `\`${tespitEdilenler.join('`, `')}\``,
                            inline: false
                        },
                        {
                            name: '📊 Uyarı Durumu',
                            value: `**${uyariSayisi}/${maxUyari}** uyarı`,
                            inline: false
                        }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'TSA Küfür Filtresi v2 — Düzenleme Koruması', iconURL: client.user.displayAvatarURL() });

                await logKanali.send({ embeds: [embed] }).catch(() => {});
            }

        } catch (err) {
            console.error('❌ [TSA Küfür Motoru — Düzenleme] Hata:', err);
        }
    });

    // ── Hazır mesajı ──
    console.log('🛡️ [TSA] Gelişmiş Küfür Engel Motoru v2 yüklendi.');
};
