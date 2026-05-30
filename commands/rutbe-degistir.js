const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');
const Storage = require('../services/storage');

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const ROWIFI_API_KEY = process.env.ROWIFI_API_KEY; // RoWifi API Anahtarı kanka
const ROBLOX_GRUP_ID = process.env.ROBLOX_GRUP_ID || '33389098';
const CLOUD_BASE_URL = 'https://apis.roblox.com/cloud/v2';

function robloxHeaders() {
    return {
        'x-api-key': ROBLOX_API_KEY,
        'Content-Type': 'application/json'
    };
}

// 🌐 ROWIFI API'SİNDEN DOĞRULAMA VERİSİ ÇEKEN FONKSİYON
async function getRoWifiUser(guildId, discordId) {
    if (!ROWIFI_API_KEY) return null;
    try {
        const response = await axios.get(`https://api.rowifi.xyz/v2/guilds/${guildId}/users/${discordId}`, {
            headers: {
                'Authorization': `Bearer ${ROWIFI_API_KEY}`
            }
        });
        return {
            username: response.data?.username || response.data?.roblox_username || null,
            robloxId: response.data?.robloxId || response.data?.roblox_id || null
        };
    } catch (error) {
        console.error('RoWifi API bağlantı hatası kanka:', error.message);
        return null;
    }
}

function parseRobloxError(error) {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401 || status === 403) {
        return 'Roblox API key yetkisiz. API key icin group:read ve group:write izinlerini, ayrica grup erisimini kontrol et.';
    }
    if (status === 404) {
        return 'Roblox tarafinda kullanici, grup uyeligi veya rutbe bulunamadi.';
    }
    if (data?.message) return data.message;
    if (data?.errors?.[0]?.message) return data.errors[0].message;
    return error.message || 'Bilinmeyen Roblox hatasi.';
}

async function getRobloxUser(username) {
    const response = await axios.post('https://users.roblox.com/v1/usernames/users', {
        usernames: [username],
        excludeBannedUsers: false
    });
    return response.data?.data?.[0] || null;
}

async function getGroupRoles() {
    const response = await axios.get(`${CLOUD_BASE_URL}/groups/${ROBLOX_GRUP_ID}/roles`, {
        headers: robloxHeaders()
    });
    return response.data?.groupRoles || response.data?.roles || [];
}

async function getPublicGroupRoles() {
    const response = await axios.get(`https://groups.roblox.com/v1/groups/${ROBLOX_GRUP_ID}/roles`);
    return response.data?.roles || [];
}

async function getMembershipByUserId(userId) {
    const params = new URLSearchParams({
        filter: `user == 'users/${userId}'`,
        maxPageSize: '10'
    });
    const response = await axios.get(`${CLOUD_BASE_URL}/groups/${ROBLOX_GRUP_ID}/memberships?${params.toString()}`, {
        headers: robloxHeaders()
    });
    const memberships = response.data?.groupMemberships || response.data?.memberships || [];
    return memberships.find((membership) => membership.user === `users/${userId}`) || memberships[0] || null;
}

function roleIdFromPath(rolePath) {
    return String(rolePath || '').split('/').pop();
}

function membershipIdFromPath(membershipPath) {
    return String(membershipPath || '').split('/').pop();
}

function publicRoleByIdOrRank(publicRoles, input) {
    return publicRoles.find((role) => String(role.id) === input || String(role.rank) === input) || null;
}

function publicRoleByCloudRole(publicRoles, cloudRolePath) {
    const roleId = roleIdFromPath(cloudRolePath);
    return publicRoles.find((role) => String(role.id) === roleId) || null;
}

function cloudRoleByPublicRole(cloudRoles, publicRole) {
    if (!publicRole) return null;
    return cloudRoles.find((role) => {
        const cloudRoleId = roleIdFromPath(role.path || role.name);
        return cloudRoleId === String(publicRole.id) || String(role.id) === String(publicRole.id);
    }) || null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rutbe-degistir')
        .setDescription('Roblox grubundaki bir kullanicinin rutbesini degistirir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption(option =>
            option.setName('isim')
                .setDescription('Rutbesi degistirilecek Roblox kullanici adi.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('rutbe_id')
                .setDescription('Verilecek Roblox rol ID veya rank. /grup_listele ile gorebilirsin.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('yetkili_roblox')
                .setDescription('Komutu kullanan yetkilinin Roblox kullanici adi.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Rutbe degisim sebebi.')
                .setRequired(true)
                .addChoices(
                    { name: 'Transfer', value: 'Transfer' },
                    { name: 'Terfi', value: 'Terfi' },
                    { name: 'Atama', value: 'Atama' },
                    { name: 'Tenzil', value: 'Tenzil' },
                    { name: 'Duzeltme', value: 'Duzeltme' }
                )
        ),

    async execute(interaction) {
        const robloxAdiInput = interaction.options.getString('isim', true).trim();
        const yeniRutbeId = interaction.options.getString('rutbe_id', true).trim();
        const yetkiliRobloxInput = interaction.options.getString('yetkili_roblox', true).trim();
        const sebep = interaction.options.getString('sebep', true);
        const yetkili = interaction.user;

        if (!ROBLOX_API_KEY) {
            return interaction.reply({
                content: 'ROBLOX_API_KEY .env icinde ayarli degil kanka. Once API key eklenmeli.',
                ephemeral: true
            });
        }

        if (!ROWIFI_API_KEY) {
            return interaction.reply({
                content: '⚠️ ROWIFI_API_KEY .env içinde tanımlı değil kanka! Güvenlik doğrulaması yapılamıyor.',
                ephemeral: true
            });
        }

        if (!/^\d+$/.test(yeniRutbeId)) {
            return interaction.reply({
                content: 'Rutbe ID sadece rakamlardan olusmali. ID listesini `/grup_listele` ile kontrol et.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            // 🛡️ ROWIFI GÜVENLİK SORGUSU VE KONTROLÜ
            const rowifiData = await getRoWifiUser(interaction.guild.id, yetkili.id);

            if (!rowifiData || !rowifiData.username || rowifiData.username.toLowerCase() !== yetkiliRobloxInput.toLowerCase()) {
                const rowifiHataEmbed = new EmbedBuilder()
                    .setTitle('<a:uyari:1505166167189487757> TSA | RoWifi Güvenlik Duvarı')
                    .setDescription(
                        `Kanka, girdiğin **${yetkiliRobloxInput}** hesabı ile RoWifi üzerindeki doğrulanmış hesabın eşleşmedi!\n\n` +
                        `### 🤖 RoWifi Veri Analizi:\n` +
                        `• RoWifi'da Kayıtlı Hesabın: **${rowifiData?.username ? `\`${rowifiData.username}\`` : '*Bulunamadı / Doğrulanmamış*'}**\n` +
                        `• Komuta Yazdığın Hesap: \`${yetkiliRobloxInput}\`\n\n` +
                        `┗ *Lütfen RoWifi botuna hangi hesapla kayıt olduysan, komuttaki yetkili alanına da o ismi yaz kanka.*`
                    )
                    .setColor('#7a0010')
                    .setTimestamp();

                return interaction.editReply({ embeds: [rowifiHataEmbed] });
            }

            // ANA SİSTEM AKIŞI
            const robloxUser = await getRobloxUser(robloxAdiInput);
            const yetkiliRobloxUser = await getRobloxUser(yetkiliRobloxInput);

            if (!robloxUser) {
                const kayitsizEmbed = new EmbedBuilder()
                    .setTitle('Roblox Hesabi Bulunamadi')
                    .setDescription(`<a:baarsz:1505146967817326675> **${robloxAdiInput}** adinda bir Roblox kullanicisi bulunamadi.`)
                    .setColor('#7a0010');
                return interaction.editReply({ embeds: [kayitsizEmbed] });
            }

            if (!yetkiliRobloxUser) {
                const yetkiliYokEmbed = new EmbedBuilder()
                    .setTitle('Yetkili Roblox Hesabi Bulunamadi')
                    .setDescription(`<a:baarsz:1505146967817326675> **${yetkiliRobloxInput}** adinda bir Roblox kullanicisi bulunamadi.`)
                    .setColor('#7a0010');
                return interaction.editReply({ embeds: [yetkiliYokEmbed] });
            }

            const [membership, yetkiliMembership, roles, publicRoles] = await Promise.all([
                getMembershipByUserId(robloxUser.id),
                getMembershipByUserId(yetkiliRobloxUser.id),
                getGroupRoles(),
                getPublicGroupRoles()
            ]);

            if (!membership) {
                const uyeDegilEmbed = new EmbedBuilder()
                    .setTitle('Grup Uyeligi Bulunamadi')
                    .setDescription(`<a:uyari:1505166167189487757> **${robloxUser.name}** kullanicisi \`${ROBLOX_GRUP_ID}\` ID'li grupta bulunmuyor.`)
                    .setColor('#7a0010');
                return interaction.editReply({ embeds: [uyeDegilEmbed] });
            }

            if (!yetkiliMembership) {
                const yetkiliUyeDegilEmbed = new EmbedBuilder()
                    .setTitle('Yetkili Grup Uyeligi Bulunamadi')
                    .setDescription(`<a:uyari:1505166167189487757> **${yetkiliRobloxUser.name}** kullanicisi \`${ROBLOX_GRUP_ID}\` ID'li grupta bulunmuyor.`)
                    .setColor('#7a0010');
                return interaction.editReply({ embeds: [yetkiliUyeDegilEmbed] });
            }

            const hedefPublicRol = publicRoleByIdOrRank(publicRoles, yeniRutbeId);
            const hedefRol = cloudRoleByPublicRole(roles, hedefPublicRol);
            if (!hedefRol) {
                const rolYokEmbed = new EmbedBuilder()
                    .setTitle('Rutbe Bulunamadi')
                    .setDescription(`\`${yeniRutbeId}\` ID/rank degerine sahip rutbe bu grupta bulunamadi. Dogru deger icin \`/grup_listele\` kullan.`)
                    .setColor('#7a0010');
                return interaction.editReply({ embeds: [rolYokEmbed] });
            }

            const membershipId = membershipIdFromPath(membership.path || membership.name);
            const eskiRutbeId = roleIdFromPath(membership.role);
            const eskiPublicRol = publicRoleByCloudRole(publicRoles, membership.role);
            const yetkiliPublicRol = publicRoleByCloudRole(publicRoles, yetkiliMembership.role);
            const hedefRoleId = String(hedefPublicRol.id);
            const eskiRutbeAdi = eskiPublicRol?.name || eskiRutbeId || 'Bilinmiyor';
            const yeniRutbeAdi = hedefPublicRol.name || hedefRoleId;
            const yetkiliRutbeAdi = yetkiliPublicRol?.name || 'Bilinmiyor';
            const yetkiliRank = Number(yetkiliPublicRol?.rank ?? -1);
            const hedefRank = Number(hedefPublicRol.rank ?? -1);

            if (hedefRank > yetkiliRank) {
                const yetkiEmbed = new EmbedBuilder()
                    .setTitle('Rutbe Yetkisi Yetersiz')
                    .setDescription(`<a:baarsz:1505146967817326675> **${yetkiliRobloxUser.name}** Roblox grubunda kendi rutbesinden yuksek bir rutbe veremez.`)
                    .addFields(
                        { name: 'Yetkilinin Roblox Rutbesi', value: `\`${yetkiliRutbeAdi}\` [Rank: \`${yetkiliRank}\`]`, inline: false },
                        { name: 'Verilmek Istenen Rutbe', value: `\`${yeniRutbeAdi}\` [Rank: \`${hedefRank}\`]`, inline: false }
                    )
                    .setColor('#7a0010');

                return interaction.editReply({ embeds: [yetkiEmbed] });
            }

            await axios.patch(
                `${CLOUD_BASE_URL}/groups/${ROBLOX_GRUP_ID}/memberships/${membershipId}`,
                { role: `groups/${ROBLOX_GRUP_ID}/roles/${hedefRoleId}` },
                { headers: robloxHeaders() }
            );

            Storage.addLog('robloxRankChange', {
                guildId: interaction.guild.id,
                channelId: interaction.channelId,
                groupId: ROBLOX_GRUP_ID,
                robloxUser: { id: robloxUser.id, name: robloxUser.name },
                oldRole: { id: eskiRutbeId, name: eskiRutbeAdi },
                newRole: { id: hedefRoleId, name: yeniRutbeAdi, rank: hedefRank },
                executorRoblox: { id: yetkiliRobloxUser.id, name: yetkiliRobloxUser.name, roleName: yetkiliRutbeAdi, rank: yetkiliRank },
                reason: sebep,
                executor: { id: yetkili.id, username: yetkili.username, tag: yetkili.tag }
            });

            const basariEmbed = new EmbedBuilder()
                .setTitle('<a:tik:1505164671081123840> Roblox Grubunda Rütbe Değiştirildi')
                .setDescription(`**${robloxUser.name}** adlı kişinin Roblox grubundaki rütbesi başarıyla güncellendi kanka.`)
                .addFields(
                    { name: '┗ <:uzaybot_kullanicilar:1505146190973505567> Roblox Adı / ID', value: `\`${robloxUser.name}\` (${robloxUser.id})`, inline: true },
                    { name: '┗ <:Paper:1505146388596391977> Eski Rütbe', value: `\`${eskiRutbeAdi}\``, inline: true },
                    { name: '┗ <:Paper:1505146388596391977> Yeni Rütbe', value: `\`${yeniRutbeAdi}\` *[Rank: ${hedefRank}]*`, inline: true },
                    { name: '┗ 👑 İşlem Yapan Yetkili', value: `${yetkili} — RoWifi Onaylı: \`${yetkiliRobloxUser.name}\` *(${yetkiliRutbeAdi})*`, inline: false },
                    { name: '┗ ✨ Değişim Sebebi', value: `\`${sebep}\``, inline: false }
                )
                .setColor('#107a29')
                .setFooter({
                    text: `TSA Güvenlik Departmanı • RoWifi Entegre Sistemi`,
                    iconURL: yetkili.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            return interaction.editReply({ embeds: [basariEmbed] });
        } catch (error) {
            console.error('Roblox rutbe degisim hatasi:', error.response ? error.response.data : error.message);

            const apiHataEmbed = new EmbedBuilder()
                .setTitle('Rutbe Degistirilemedi')
                .setDescription(parseRobloxError(error))
                .setColor('#7a0010');

            return interaction.editReply({ embeds: [apiHataEmbed] });
        }
    }
};
