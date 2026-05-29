const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios'); 

// =========================================================================
// ⚙️ ROBLOX OPEN CLOUD CONFIG (Render .env Bağlantılı)
// =========================================================================
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY; 
const ROBLOX_GRUP_ID = "33389098"; // Grubunun ID'si sabit kanka

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rütbe')
        .setDescription('Roblox grubundaki üyelerin rütbelerini güvenli şekilde yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(subcommand =>
            subcommand
                .setName('değiştir')
                .setDescription('Bir üyenin Roblox gruptaki rütbesini günceller.')
                .addUserOption(option => 
                    option.setName('kişi') 
                        .setDescription('Rütbesi değiştirilecek Discord üyesini etiketleyin.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('sebep')
                        .setDescription('Rütbe değişim sebebini belirtin.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Transfer', value: 'Transfer' },
                            { name: 'Terfi', value: 'Terfi' },
                            { name: 'Atama', value: 'Atama' }
                        )
                )
                .addStringOption(option =>
                    option.setName('orta_rütbeler') 
                        .setDescription('Verilecek yeni rütbeyi seçin.')
                        .setRequired(false) 
                        .addChoices(
                            // ⚠️ NOT: Buradaki rütbe ID'lerini kendi grubuna göre güncellemeyi unutma!
                            { name: 'Genelkurmay Başkanı', value: '98765432' }, 
                            { name: 'Albay', value: '87654321' },
                            { name: 'Teğmen', value: '76543210' },
                            { name: 'Subay', value: '65432109' }
                        )
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'değiştir') {
            const hedefKisi = interaction.options.getUser('kişi');
            const sebep = interaction.options.getString('sebep');
            const yeniRutbeId = interaction.options.getString('orta_rütbeler');
            const yetkili = interaction.user; 

            // 🟥 1. DURUM: RÜTBE SEÇİLMEDİĞİNDE DÖNEN HATA EMBED'İ
            if (!yeniRutbeId) {
                const hataEmbed = new EmbedBuilder()
                    .setTitle('❌ Rütbe Seçilmedi')
                    .setDescription('Lütfen bir rütbe kategorisinden rütbe seçin!')
                    .setColor('#7a0010'); 

                return interaction.reply({ embeds: [hataEmbed] });
            }

            await interaction.deferReply();

            try {
                // 🔍 1. ADIM: 3 KADEMELİ ROBLOX HESAP ARAMA MOTORU
                let robloxId = null;
                let robloxUsername = null;

                // 🔄 [KADEME 1]: Bloxlink API sorgusu
                const bloxlinkResponse = await axios.get(`https://api.blox.link/v4/public/users/${hedefKisi.id}`, {
                    headers: { 'Authorization': '989e7e7a-92e1-4560-bf64-52a1df0f0383' } 
                }).catch(() => null);

                if (bloxlinkResponse && bloxlinkResponse.data && bloxlinkResponse.data.robloxId) {
                    robloxId = bloxlinkResponse.data.robloxId;
                } 
                // 🔄 [KADEME 2]: Bloxlink bulamazsa RoWifi API sorgusu kanka
                else {
                    const rowifiResponse = await axios.get(`https://api.rowifi.xyz/v2/users/${hedefKisi.id}`).catch(() => null);
                    if (rowifiResponse && rowifiResponse.data && rowifiResponse.data.roblox_id) {
                        robloxId = rowifiResponse.data.roblox_id;
                    }
                }

                // 🔄 [KADEME 3]: İki botta da yoksa Discord kullanıcı adını Roblox'ta aratıyoruz kanka
                if (!robloxId) {
                    const robloxSearchResponse = await axios.post('https://users.roblox.com/v1/usernames/users', {
                        usernames: [hedefKisi.username],
                        excludeBannedUsers: false
                    }).catch(() => null);

                    if (robloxSearchResponse && robloxSearchResponse.data && robloxSearchResponse.data.data && robloxSearchResponse.data.data[0]) {
                        robloxId = robloxSearchResponse.data.data[0].id;
                        robloxUsername = robloxSearchResponse.data.data[0].name; // İsmi direkt buradan aldık
                    }
                }

                // Eğer Kademe 1 veya Kademe 2'den ID geldiyse ama isim hala çekilmediyse resmi API'den çekelim
                if (robloxId && !robloxUsername) {
                    const robloxUserCheck = await axios.get(`https://users.roblox.com/v1/users/${robloxId}`).catch(() => null);
                    if (robloxUserCheck) robloxUsername = robloxUserCheck.data.name;
                }

                // 3 kademede de hiçbir şey bulunamazsa hata veriyoruz
                if (!robloxId || !robloxUsername) {
                    const kayitsizEmbed = new EmbedBuilder()
                        .setTitle('❌ Roblox Hesabı Bulunamadı')
                        .setDescription(`Etiketlenen **${hedefKisi.username}** kişisi veritabanlarında bulunamadı ve bu isimde bir Roblox hesabı saptanamadı kanka!`)
                        .setColor('#7a0010');
                    return interaction.editReply({ embeds: [kayitsizEmbed] });
                }

                // 📜 2. ADIM: Kullanıcının Gruptaki Mevcut Eski Rütbe Adını Öğrenme
                const groupResponse = await axios.get(`https://groups.roblox.com/v2/users/${robloxId}/groups/roles`);
                const grupVerisi = groupResponse.data.data.find(g => g.group.id == ROBLOX_GRUP_ID);
                const eskiRutbeAdi = grupVerisi ? grupVerisi.role.name : 'Üye';

                const rütbeIsimHaritasi = { '98765432': 'Genelkurmay Başkanı', '87654321': 'Albay', '76543210': 'Teğmen', '65432109': 'Subay' };
                const yeniRutbeAdi = rütbeIsimHaritasi[yeniRutbeId] || 'Yeni Rütbe';

                // ⚡ 3. ADIM: ROBLOX OPEN CLOUD API İLE RÜTBE DEĞİŞTİRME TETİKLEMESİ
                await axios.patch(
                    `https://apis.roblox.com/cloud/v2/groups/${ROBLOX_GRUP_ID}/memberships/${robloxId}`,
                    {
                        role: `groups/${ROBLOX_GRUP_ID}/roles/${yeniRutbeId}`
                    },
                    {
                        headers: {
                            'x-api-key': ROBLOX_API_KEY,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                // 🟩 2. DURUM: BAŞARILI ŞEKİLDE RÜTBE DEĞİŞTİRME EMBED'İ
                const basariEmbed = new EmbedBuilder()
                    .setDescription(`**${robloxUsername}** - [ \`${robloxId}\` ] adlı kişiye, Yetkili ${yetkili} tarafından **${sebep}** sebebiyle **${eskiRutbeAdi}** rütbesinden **${yeniRutbeAdi}** rütbesine **terfi** edildi.`)
                    .setColor('#107a29')
                    .setFooter({ 
                        text: `İşlemi Yapan: ${yetkili.username}`, 
                        iconURL: yetkili.displayAvatarURL({ dynamic: true }) 
                    })
                    .setTimestamp();

                return interaction.editReply({ embeds: [basariEmbed] });

            } catch (error) {
                console.error("Bulut Rütbe Hatası:", error.response ? error.response.data : error.message);
                
                const apiHataEmbed = new EmbedBuilder()
                    .setTitle('❌ Rütbe Değiştirilemedi')
                    .setDescription('Roblox tarafında bir sorun oluştu veya botun gruptaki yetkisi bu işlemi yapmaya yetmiyor kanka!')
                    .setColor('#7a0010');
                    
                return interaction.editReply({ embeds: [apiHataEmbed] });
            }
        }
    },
};
