const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const ROBLOX_GRUP_ID = process.env.ROBLOX_GRUP_ID || '33389098';
const CLOUD_BASE_URL = 'https://apis.roblox.com/cloud/v2';

function robloxHeaders() {
    return {
        'x-api-key': ROBLOX_API_KEY,
        'Content-Type': 'application/json'
    };
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
                .setDescription('Verilecek Roblox rol/rutbe ID. /grup_listele ile gorebilirsin.')
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
        const sebep = interaction.options.getString('sebep', true);
        const yetkili = interaction.user;

        if (!ROBLOX_API_KEY) {
            return interaction.reply({
                content: 'ROBLOX_API_KEY .env icinde ayarli degil kanka. Once API key eklenmeli.',
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
            const robloxUser = await getRobloxUser(robloxAdiInput);

            if (!robloxUser) {
                const kayitsizEmbed = new EmbedBuilder()
                    .setTitle('Roblox Hesabi Bulunamadi')
                    .setDescription(`**${robloxAdiInput}** adinda bir Roblox kullanicisi bulunamadi.`)
                    .setColor('#7a0010');
                return interaction.editReply({ embeds: [kayitsizEmbed] });
            }

            const [membership, roles] = await Promise.all([
                getMembershipByUserId(robloxUser.id),
                getGroupRoles()
            ]);

            if (!membership) {
                const uyeDegilEmbed = new EmbedBuilder()
                    .setTitle('Grup Uyeligi Bulunamadi')
                    .setDescription(`**${robloxUser.name}** kullanicisi \`${ROBLOX_GRUP_ID}\` ID'li grupta bulunmuyor.`)
                    .setColor('#7a0010');
                return interaction.editReply({ embeds: [uyeDegilEmbed] });
            }

            const hedefRol = roles.find((role) => roleIdFromPath(role.path || role.name) === yeniRutbeId || String(role.id) === yeniRutbeId);
            if (!hedefRol) {
                const rolYokEmbed = new EmbedBuilder()
                    .setTitle('Rutbe Bulunamadi')
                    .setDescription(`\`${yeniRutbeId}\` ID'li rutbe bu grupta bulunamadi. Dogru ID icin \`/grup_listele\` kullan.`)
                    .setColor('#7a0010');
                return interaction.editReply({ embeds: [rolYokEmbed] });
            }

            const membershipId = membershipIdFromPath(membership.path || membership.name);
            const eskiRutbeId = roleIdFromPath(membership.role);
            const eskiRol = roles.find((role) => roleIdFromPath(role.path || role.name) === eskiRutbeId || String(role.id) === eskiRutbeId);
            const eskiRutbeAdi = eskiRol?.displayName || eskiRol?.name || eskiRutbeId || 'Bilinmiyor';
            const yeniRutbeAdi = hedefRol.displayName || hedefRol.name || yeniRutbeId;

            await axios.patch(
                `${CLOUD_BASE_URL}/groups/${ROBLOX_GRUP_ID}/memberships/${membershipId}`,
                { role: `groups/${ROBLOX_GRUP_ID}/roles/${yeniRutbeId}` },
                { headers: robloxHeaders() }
            );

            const basariEmbed = new EmbedBuilder()
                .setTitle('Roblox Grubunda Rutbe Degistirildi')
                .setDescription(`**${robloxUser.name}** adli kisinin Roblox grubundaki rutbesi degistirildi.`)
                .addFields(
                    { name: 'Roblox Adi', value: `\`${robloxUser.name}\``, inline: true },
                    { name: 'Roblox ID', value: `\`${robloxUser.id}\``, inline: true },
                    { name: 'Eski Rutbe', value: `\`${eskiRutbeAdi}\``, inline: true },
                    { name: 'Yeni Rutbe', value: `\`${yeniRutbeAdi}\``, inline: true },
                    { name: 'Sebep', value: `\`${sebep}\``, inline: false },
                    { name: 'Yetkili', value: `${yetkili}`, inline: true }
                )
                .setColor('#107a29')
                .setFooter({
                    text: `Islemi yapan: ${yetkili.username}`,
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
