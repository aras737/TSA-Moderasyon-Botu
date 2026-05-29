const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios'); 

// =========================================================================
// ⚙️ ROBLOX OPEN CLOUD CONFIG (Render .env Bağlantılı)
// =========================================================================
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY; 
const ROBLOX_GRUP_ID = "33389098"; // Grubunun ID'si sabit kanka

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rütbedeğiştir') // Discord kuralları gereği tamamen küçük harf yaptık kanka
        .setDescription('Doğrudan Roblox kullanıcı adı belirterek rütbe günceller.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption(option =>
            option.setName('isim') // İstediğin gibi "isim" seçeneği
                .setDescription('Rütbesi değiştirilecek kişinin tam Roblox kullanıcı adı.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('sebep') // İstediğin gibi "sebep" seçeneği
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
                .setRequired(false) // İlk baştaki hata embed'ini tetikleyebilmek için false bıraktık kanka
                .addChoices(
                    // ⚠️ NOT: Buradaki rütbe ID'lerini kendi grubuna göre güncellemeyi unutma!
                    { name: 'Genelkurmay Başkanı', value: '98765432' }, 
                    { name: 'Albay', value: '87654321' },
                    { name: 'Teğmen', value: '76543210' },
                    { name: 'Subay', value: '65432109' }
                )
        ),

    async execute(interaction) {
        const robloxAdiInput = interaction.options.getString('isim');
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
            // 🔍 1. ADIM: Doğrudan Roblox Kullanıcı Adından ID Sorgulama
            const robloxSearchResponse = await axios.post('https://users.roblox.com/v1/usernames/users', {
                usernames: [robloxAdiInput],
                excludeBannedUsers: false
            }).catch(() => null);

            if (!robloxSearchResponse || !robloxSearchResponse.data || !robloxSearchResponse.data.data || !robloxSearchResponse.data.data[0]) {
                const kayitsizEmbed = new EmbedBuilder()
                    .setTitle('❌ Roblox Hesabı Bulunamadı')
                    .setDescription(`**${robloxAdiInput}** adında aktif bir Roblox kullanıcı adı saptanamadı kanka!`)
                    .setColor('#7a0010');
                return interaction.editReply({ embeds: [kayitsizEmbed] });
            }

            const robloxId = robloxSearchResponse.data.data[0].id;
            const robloxUsername = robloxSearchResponse.data.data[0].name;

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
    },
};
