const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

// Basit bir geçici veritabanı (Sunucu kapatılıp açılırsa sıfırlanır)
// Kalıcı olmasını isterseniz quick.db veya mongoose gibi bir DB entegre edebilirsiniz.
const kufurSistemiDB = new Map();

// Engellenecek küfürlerin listesi (Buraya istediğiniz kelimeleri ekleyebilirsiniz)
const yasakliKelimeler = ["küfür1", "küfür2", "piç", "orospu", "sik", "amk", "pç"];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('küfür-engel')
        .setDescription('Küfür engelleyici sistemini yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) // Sadece sunucuyu yönet yetkisi olanlar
        .addSubcommand(subcommand =>
            subcommand
                .setName('ayarla')
                .setDescription('Küfür engel sistemini aktif eder ve log kanalını belirler.')
                .addChannelOption(option => 
                    option.setName('kanal')
                        .setDescription('Küfür loglarının atılacağı kanal')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('kapat')
                .setDescription('Küfür engel sistemini devre dışı bırakır.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'ayarla') {
            const logKanal = interaction.options.getChannel('kanal');

            // Ayarları veritabanına kaydet
            kufurSistemiDB.set(guildId, {
                durum: true,
                logKanalId: logKanal.id
            });

            const embed = new EmbedBuilder()
                .setTitle('✅ Sistem Aktif Edildi')
                .setDescription(`Küfür engel sistemi başarıyla açıldı.\n**Log Kanalı:** ${logKanal}`)
                .setColor('Green')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'kapat') {
            kufurSistemiDB.delete(guildId);

            const embed = new EmbedBuilder()
                .setTitle('❌ Sistem Kapatıldı')
                .setDescription('Küfür engel sistemi bu sunucuda devre dışı bırakıldı.')
                .setColor('Red')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    },

    // --- HER ŞEY İÇİNDE OLSUN DEDİĞİNİZ İÇİN OLAY DİNLEYİCİSİ (MESSAGE CREATE) BURADA ---
    // Bu fonksiyonu index.js dosyanızdaki client.on('messageCreate') kısmına bağlamanız gerekir.
    // Eğer index.js içinde otomatik bir event handler'ınız varsa, bu fonksiyonu oradan çağırabilirsiniz.
    async handleMessage(message) {
        if (!message.guild || message.author.bot) return;

        const sunucuAyari = kufurSistemiDB.get(message.guild.id);
        if (!sunucuAyari || !sunucuAyari.durum) return; // Sistem kapalıysa işlem yapma

        // Mesajı küçük harfe çevirip kelimeleri kontrol etme
        const mesajIcerik = message.content.toLowerCase();
        const kufurVarMi = yasakliKelimeler.some(kufur => mesajIcerik.includes(kufur));

        if (kufurVarMi) {
            // Yetkilileri es geçmek isterseniz (Yönetici yetkisi olanlar küfür edebilsin diye):
            if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

            // 1. Mesajı Sil
            try {
                await message.delete();
            } catch (err) {
                console.log("Mesaj silme yetkim yok veya mesaj zaten silinmiş.");
            }

            // 2. Kullanıcıyı Uyar (Kanala geçici mesaj)
            const uyariMesaji = await message.channel.send(`⚠️ ${message.author}, lütfen kelimelerine dikkat et! Bu sunucuda küfür etmek yasaktır.`);
            setTimeout(() => uyariMesaji.delete().catch(() => {}), 5000); // 5 saniye sonra uyarıyı sil

            // 3. Log Kanalına Bildir
            const logKanal = message.guild.channels.cache.get(sunucuAyari.logKanalId);
            if (logKanal) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🤬 Küfür Yakalandı!')
                    .setColor('Orange')
                    .addFields(
                        { name: 'Kullanıcı', value: `${message.author} (${message.author.id})`, inline: true },
                        { name: 'Kanal', value: `${message.channel}`, inline: true },
                        { name: 'Silinen Mesaj', value: `\`\`\`${message.content}\`\`\`` }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'TSA Moderasyon Küfür Engel Sistemi' });

                logKanal.send({ embeds: [logEmbed] }).catch(err => console.log("Log kanalına mesaj atılamadı: " + err));
            }
        }
    }
};
