const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('grup_listele')
        .setDescription('Belirtilen Roblox kullanıcısının katıldığı grupları listeler kanka.')
        .addStringOption(option =>
            option.setName('kullanici_adi')
                .setDescription('Sorgulamak istediğin Roblox kullanıcı adı')
                .setRequired(true)
        ),

    async execute(interaction) {
        // İşlem API'den veri çekerken biraz sürebilir, Discord hata vermesin diye bekletiyoruz.
        await interaction.deferReply(); 
        
        const username = interaction.options.getString('kullanici_adi');

        try {
            // 1. AŞAMA: Roblox Kullanıcı Adından Kullanıcı ID'sini Çekme
            const userRes = await fetch('https://users.roblox.com/v1/usernames/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
            });
            const userData = await userRes.json();

            // Eğer kullanıcı bulunamazsa uyar
            if (!userData.data || userData.data.length === 0) {
                return interaction.editReply('❌ Kanka bu isimde bir Roblox kullanıcısı bulamadım, adı doğru yazdığına emin misin?');
            }

            const robloxId = userData.data[0].id;
            const realUsername = userData.data[0].name; // Roblox'taki orijinal büyük/küçük harf durumu

            // 2. AŞAMA: Kullanıcının Gruplarını Çekme
            const groupRes = await fetch(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`);
            const groupData = await groupRes.json();

            if (!groupData.data) {
                return interaction.editReply('❌ Kanka bu kullanıcının gruplarını çekerken Roblox API kaynaklı bir hata oluştu!');
            }

            const groups = groupData.data;
            const totalGroups = groups.length;

            if (totalGroups === 0) {
                return interaction.editReply(`Kanka **${realUsername}** hiçbir gruba üye değil.`);
            }

            // Sayfalama (Discord mesaj karakter sınırını aşmamak için ilk 10 grubu gösteriyoruz)
            const itemsPerPage = 10;
            const totalPages = Math.ceil(totalGroups / itemsPerPage);
            const currentGroups = groups.slice(0, itemsPerPage);

            // 3. AŞAMA: Embed (Mesaj) Tasarımını Görseldekiyle Birebir Hazırlama
            let description = `Gruplarım: ${realUsername}\n`;
            description += `**Roblox ID:** \`${robloxId}\`\n`;
            description += `**Toplam Grup:** ${totalGroups}\n`;
            description += `**Sayfa:** 1 / ${totalPages}\n\n`;

            for (const item of currentGroups) {
                const gName = item.group.name;
                const gId = item.group.id;
                // Sayıları 1.000 formatına çevirme (Örn: 98086 -> 98.086)
                const memberCount = item.group.memberCount.toLocaleString('tr-TR'); 
                
                const rName = item.role.name;
                const rRank = item.role.rank; // Resimdeki "ID: 225" kısmı Roblox'taki rütbe sırasıdır (Rank ID)

                description += `• **${gName}**\n`;
                description += `**Rütbe:** ${rName} [**ID:** \`${rRank}\` ]\n`;
                description += `**Üye Sayısı:** ${memberCount}\n`;
                description += `**Grup ID:** \`${gId}\`\n\n`;
            }

            const embed = new EmbedBuilder()
                .setColor('#2b2d31') // Discord'un orijinal koyu temasına uygun arka plan
                .setDescription(description);

            // Sonucu gönder!
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("Grup Listeleme Hatası:", error);
            await interaction.editReply('❌ Kanka API bağlantısında sistemsel bir hata oluştu, konsolu kontrol et!');
        }
    }
};
