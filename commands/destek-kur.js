const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionsBitField, 
    ChannelType,
    StringSelectMenuBuilder
} = require('discord.js');
const { ayarKaydet, ayarGetir } = require('../utils/db');

module.exports = {
    // Merkezi yetki kontrolü (Sadece Adminler kurabilir)
    requiredPerms: [PermissionsBitField.Flags.Administrator],

    data: new SlashCommandBuilder()
        .setName('destek-kur')
        .setDescription('TSA Moderasyon Destek Sistemini kurar.')
        .addStringOption(option => 
            option.setName('yetkili-roller')
                .setDescription('Yetkili rolleri etiketle (Örn: @Rol1 @Rol2)')
                .setRequired(true)
        )
        .addChannelOption(option => 
            option.setName('log-kanali')
                .setDescription('Bilet kayıtlarının gideceği kanal')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('bilimesaj-kanali')
                .setDescription('Bilet oluştur mesajının gideceği kanal')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),
    
    async execute(interaction) {
        try {
            const rollerInput = interaction.options.getString('yetkili-roller');
            const logKanali = interaction.options.getChannel('log-kanali');
            const biletKanali = interaction.options.getChannel('bilimesaj-kanali') || interaction.channel;
            const rolIDleri = rollerInput.match(/\d+/g); 

            if (!rolIDleri || rolIDleri.length === 0) {
                return interaction.reply({ content: "<a:baarsz:1505146967817326675> Geçerli roller girmelisin! Örn: @Rol1 @Rol2", ephemeral: true });
            }

            // Rolleri Storage'a kaydet
            ayarKaydet(interaction.guild.id, 'destekRolleri', rolIDleri);
            ayarKaydet(interaction.guild.id, 'logKanaliDestek', logKanali.id);

            const anaEmbed = new EmbedBuilder()
                .setTitle('<:tac:1505158450538352670> TSA MODERASYON | DESTEK SİSTEMİ')
                .setDescription('Yardıma mı ihtiyacınız var? Aşağıdaki butona tıklayarak bir destek talebi oluşturabilirsiniz.\n\nTalebiniz en kısa sürede TSA yetkililerimiz tarafından yanıtlanacaktır.')
                .addFields(
                    { name: '<:koruma1:1505143174190989352> MODERATÖRLÜk ÇÖZÜMLERİ', value: '`Discord içi sorunlar, moderasyon desteği ve disiplin konuları`', inline: false },
                    { name: '<:uzaybot_kullanicilar:1505146190973505567> GENEL DESTEK', value: '`Oyun içi sorunlar, hesap sorunları ve genel danışmanlık`', inline: false },
                    { name: '<:takviye:1505157853994815530> VIP/GAMEPASS', value: '`Rütbe satın alma, Gamepass sorunları ve özel yetkilendirmeler`', inline: false },
                    { name: '<a:uyari:1505166167189487757> ÜST YÖNETİM', value: '`Ciddi şikayetler, gizli konular ve yönetim sorunları`', inline: false }
                )
                .setColor('#2f3136')
                .setImage('https://r.resimlink.com/EnN8AFTihKvk.png')
                .setFooter({ text: '© 2026 TSA Moderasyon Sistemi | Biletiniz kayıtlı tutulacaktır', iconURL: interaction.guild.iconURL() })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`tsa_setup_${rolIDleri.join('-')}_${logKanali.id}`)
                    .setLabel('<:Paper:1505146388596391977> DESTEK OLAYI BAŞLAT')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('<:bilet:1505453733969006602>')
            );

            await interaction.reply({ 
                content: `<a:tik:1505164671081123840> **TSA Destek Sistemi başarıyla kuruldu!**\n\n<:uzaybot_kanal:1505159120074833931> Log Kanalı: ${logKanali}\n👥 Yetkili Roller: ${rolIDleri.length} adet`, 
                ephemeral: true 
            });

            await biletKanali.send({ embeds: [anaEmbed], components: [row] });
        } catch (error) {
            console.error('<a:baarsz:1505146967817326675> Destek kurulum hatası:', error);
            return interaction.reply({ content: '<a:baarsz:1505146967817326675> Sistem kurulumunda hata oluştu!', ephemeral: true });
        }
    },

    async interactionHandler(interaction) {
        try {
            // --- 1. KATEGORİ SEÇİMİ ---
            if (interaction.isButton() && interaction.customId.startsWith('tsa_setup_')) {
                const data = interaction.customId.split('_');
                const roller = data[2];
                const logID = data[3];

                const menuRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`tsa_create_${roller}_${logID}`)
                        .setPlaceholder('<:appEmoji_kategori:1505159567879966811> Bilet Kategorisi Seçiniz...')
                        .addOptions([
                            { 
                                label: '<:koruma1:1505143174190989352> Moderatörlük Destek', 
                                value: 'Moderatörlük', 
                                description: 'Discord içi sorunlar ve moderasyon',
                                emoji: '<:koruma1:1505143174190989352>'
                            },
                            { 
                                label: '<:uzaybot_kullanicilar:1505146190973505567> Genel Destek', 
                                value: 'Genel', 
                                description: 'Oyun içi sorunlar ve genel konular',
                                emoji: '<:uzaybot_kullanicilar:1505146190973505567>'
                            },
                            { 
                                label: '<:takviye:1505157853994815530> VIP/Gamepass', 
                                value: 'Gamepass', 
                                description: 'Rütbe ve özel yetkilendirme sorunları',
                                emoji: '<:takviye:1505157853994815530>'
                            },
                            { 
                                label: '<a:uyari:1505166167189487757> Üst Yönetim', 
                                value: 'Yönetim', 
                                description: 'Ciddi konular ve gizli şikayetler',
                                emoji: '<a:uyari:1505166167189487757>'
                            },
                        ])
                );

                const confirmEmbed = new EmbedBuilder()
                    .setTitle('<:bilet:1505453733969006602> DESTEK OLAYI OLUŞTURMA')
                    .setDescription('Lütfen sorununuzla ilgili **doğru kategoriyi** seçin. Yanlış kategori seçimi destek sürenizi uzatabilir.')
                    .setColor('#5865f2')
                    .setFooter({ text: 'TSA Destek Sistemi' });

                await interaction.reply({ 
                    embeds: [confirmEmbed],
                    components: [menuRow], 
                    ephemeral: true 
                });
            }

            // --- 2. BİLET KANALI OLUŞTURMA ---
            if (interaction.isStringSelectMenu() && interaction.customId.startsWith('tsa_create_')) {
                await interaction.deferReply({ ephemeral: true });

                const data = interaction.customId.split('_');
                const roller = data[2].split('-');
                const logID = data[3];
                const kategori = interaction.values[0];

                // Kategori emojileri ve renkleri
                const kategoriBilgisi = {
                    'Moderatörlük': { emoji: '<:koruma1:1505143174190989352>', renk: '#ff6b6b', prefix: 'mod' },
                    'Genel': { emoji: '<:uzaybot_kullanicilar:1505146190973505567>', renk: '#4ecdc4', prefix: 'gen' },
                    'Gamepass': { emoji: '<:takviye:1505157853994815530>', renk: '#ffd93d', prefix: 'vip' },
                    'Yönetim': { emoji: '<a:uyari:1505166167189487757>', renk: '#ee5a6f', prefix: 'yön' }
                };

                const info = kategoriBilgisi[kategori];
                const kanalAdi = `${info.prefix}-${interaction.user.username.substring(0, 10)}`.toLowerCase();

                // İzinler - Önce herkese kapat
                const izinler = [
                    { 
                        id: interaction.guild.id, 
                        deny: [PermissionsBitField.Flags.ViewChannel] 
                    },
                    // Kullanıcı görsün
                    { 
                        id: interaction.user.id, 
                        allow: [
                            PermissionsBitField.Flags.ViewChannel, 
                            PermissionsBitField.Flags.SendMessages, 
                            PermissionsBitField.Flags.AttachFiles, 
                            PermissionsBitField.Flags.ReadMessageHistory,
                            PermissionsBitField.Flags.EmbedLinks
                        ] 
                    }
                ];

                // Yetkili rolleri ekle
                roller.forEach(r => {
                    izinler.push({ 
                        id: r, 
                        allow: [
                            PermissionsBitField.Flags.ViewChannel, 
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.AttachFiles,
                            PermissionsBitField.Flags.ReadMessageHistory,
                            PermissionsBitField.Flags.EmbedLinks,
                            PermissionsBitField.Flags.ManageMessages
                        ] 
                    });
                });

                // Kanal oluştur
                const kanal = await interaction.guild.channels.create({
                    name: kanalAdi,
                    type: ChannelType.GuildText,
                    permissionOverwrites: izinler,
                    topic: `Açan: ${interaction.user.id} | Kategori: ${kategori} | Zaman: ${new Date().toLocaleString('tr-TR')} | Log: ${logID}`
                });

                // Hoşgeldin mesajı
                const hosgeldin = new EmbedBuilder()
                    .setTitle(`${info.emoji} TSA DESTEK SİSTEMİ - BİLET AÇILDI`)
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 512 }))
                    .setDescription(`Merhaba ${interaction.user.username}! <:tac:1505158450538352670>\n\nDestek talebiniz başarıyla oluşturuldu. Lütfen sorununuzu **detaylı bir şekilde** açıklayın. Yetkililerimiz size en kısa sürede yardımcı olacaktır.`)
                    .addFields(
                        { name: '<:uzaybot_kullanicilar:1505146190973505567> Talebini Açan', value: `${interaction.user.tag}`, inline: true },
                        { name: '<:appEmoji_kategori:1505159567879966811> Bilet Kategorisi', value: `${info.emoji} ${kategori}`, inline: true },
                        { name: '<:duration:1505171054497370275> Oluşturulma Saati', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
                        { name: '<:bilet:1505453733969006602> Bilet Numarası', value: `\`#${kanal.id.substring(0, 8).toUpperCase()}\``, inline: true }
                    )
                    .setColor(info.renk)
                    .setFooter({ text: 'TSA Destek Sistemi | Lütfen sakin ve nazik bir şekilde iletişim kurunuz' })
                    .setTimestamp();

                const biletButonlar = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('tsa_claim')
                        .setLabel('BILETI ÜSTLEN')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('<a:tik:1505164671081123840>'),
                    new ButtonBuilder()
                        .setCustomId('tsa_assign')
                        .setLabel('BAŞKASINA AKTAR')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('<:change:1505202806666170501>'),
                    new ButtonBuilder()
                        .setCustomId('tsa_fast_close')
                        .setLabel('KAPATMA OLAYI')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('<:riva_kilit:1505203119427162192>')
                );

                const yetkiliMesaj = await kanal.send({ 
                    content: `${roller.map(r => `<@&${r}>`).join(' ')} | ${interaction.user}`,
                    embeds: [hosgeldin], 
                    components: [biletButonlar] 
                });

                // Log Gönder
                const logKanal = interaction.guild.channels.cache.get(logID);
                if (logKanal) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('<:bilet:1505453733969006602> YENİ BİLET AÇILDI')
                        .addFields(
                            { name: '<:uzaybot_kullanicilar:1505146190973505567> Talebini Açan', value: `${interaction.user.tag}\n\`ID: ${interaction.user.id}\``, inline: true },
                            { name: '<:appEmoji_kategori:1505159567879966811> Kategori', value: `${info.emoji} ${kategori}`, inline: true },
                            { name: '<:uzaybot_kanal:1505159120074833931> Kanal', value: `${kanal}`, inline: true },
                            { name: '<:duration:1505171054497370275> Zaman', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: false }
                        )
                        .setColor(info.renk)
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                        .setFooter({ text: `Bilet #${kanal.id.substring(0, 8).toUpperCase()}` })
                        .setTimestamp();
                    
                    await logKanal.send({ embeds: [logEmbed] });
                }

                await interaction.editReply({ 
                    content: `<a:tik:1505164671081123840> **Bilet başarıyla oluşturuldu!**\n\n<:uzaybot_kanal:1505159120074833931> Bilet Kanalı: ${kanal}\n📂 Kategori: ${info.emoji} ${kategori}`, 
                    components: [],
                    ephemeral: true 
                });
            }

            // --- 3. BİLETİ ÜSTLENME ---
            if (interaction.isButton() && interaction.customId === 'tsa_claim') {
                // Yetki kontrolü
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                    return interaction.reply({ 
                        content: '<a:baarsz:1505146967817326675> Bu işlem için yeterli yetkiniz yok!', 
                        ephemeral: true 
                    });
                }

                const originalEmbed = interaction.message.embeds[0];
                const claimEmbed = EmbedBuilder.from(originalEmbed)
                    .spliceFields(4, 0, { name: '<a:tik:1505164671081123840> ÜSTLENEN YETKİLİ', value: `${interaction.user.tag}\n<t:${Math.floor(Date.now() / 1000)}:R>`, inline: false })
                    .setColor('#ffd93d');

                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('tsa_claimed')
                        .setLabel('BİLET ÜSTLENILDI')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true)
                        .setEmoji('<a:tik:1505164671081123840>'),
                    new ButtonBuilder()
                        .setCustomId('tsa_reopen')
                        .setLabel('YENİDEN AÇ')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('<:change:1505202806666170501>'),
                    new ButtonBuilder()
                        .setCustomId('tsa_fast_close')
                        .setLabel('KAPATMA OLAYI')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('<:riva_kilit:1505203119427162192>')
                );

                await interaction.update({ embeds: [claimEmbed], components: [disabledRow] });
                
                await interaction.followUp({ 
                    content: `<:Yetkili:1505192912680390827> **${interaction.user.tag}** bu biletle ilgilenmeye başladı!\n\n<:duration:1505171054497370275> Lütfen 24 saat içerisinde çözüm sağlayınız.`,
                    ephemeral: false 
                });

                // Log
                const topicData = interaction.channel.topic;
                const logID = topicData.split('Log: ')[1];
                const logKanal = interaction.guild.channels.cache.get(logID);
                
                if (logKanal) {
                    const claimLog = new EmbedBuilder()
                        .setTitle('<a:tik:1505164671081123840> BİLET ÜSTLENILDI')
                        .addFields(
                            { name: '<:uzaybot_kullanicilar:1505146190973505567> Üstlenen Yetkili', value: `${interaction.user.tag}`, inline: true },
                            { name: '<:duration:1505171054497370275> Üstlenme Saati', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
                        )
                        .setColor('#ffd93d')
                        .setTimestamp();
                    await logKanal.send({ embeds: [claimLog] });
                }
            }

            // --- 4. HIZLI KAPATMA VE LOGLAMA ---
            if (interaction.isButton() && interaction.customId === 'tsa_fast_close') {
                // Yetki kontrolü
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages) && 
                    !interaction.message.mentions.has(interaction.user.id)) {
                    return interaction.reply({ 
                        content: '<a:baarsz:1505146967817326675> Yalnızca bilet sahibi veya yetkili bu işlemi yapabilir!', 
                        ephemeral: true 
                    });
                }

                const topicData = interaction.channel.topic;
                const logID = topicData.split('Log: ')[1];
                const acanID = topicData.split('Açan: ')[1].split(' |')[0];
                const kategori = topicData.split('Kategori: ')[1].split(' |')[0];

                // Kapatma embed'i
                const kapanisEmbed = new EmbedBuilder()
                    .setTitle('<:riva_kilit:1505203119427162192> BİLET KAPATILIYOR...')
                    .setDescription(`Bu bilet **${interaction.user.tag}** tarafından kapatılıyor.\n\n⏱️ Kanal 5 saniye içinde siliniyor...`)
                    .setColor('#ff6b6b')
                    .setTimestamp();

                await interaction.reply({ embeds: [kapanisEmbed] });

                // Log Gönder
                const logKanal = interaction.guild.channels.cache.get(logID);
                if (logKanal) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('<:riva_kilit:1505203119427162192> BİLET KAPATILDI')
                        .addFields(
                            { name: '<:appEmoji_kategori:1505159567879966811> Kategori', value: kategori, inline: true },
                            { name: '<:uzaybot_kullanicilar:1505146190973505567> Bileti Açan', value: `<@${acanID}>`, inline: true },
                            { name: '<:sil:1505147967907037275> Kapatan', value: `${interaction.user.tag}`, inline: true },
                            { name: '<:uzaybot_kanal:1505159120074833931> Kanal', value: `\`${interaction.channel.name}\``, inline: false },
                            { name: '<:duration:1505171054497370275> Kapatılış Saati', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: false }
                        )
                        .setColor('#ff6b6b')
                        .setFooter({ text: `Bilet #${interaction.channel.id.substring(0, 8).toUpperCase()}` })
                        .setTimestamp();
                    
                    await logKanal.send({ embeds: [logEmbed] });
                }

                // Kanal sil
                setTimeout(async () => {
                    await interaction.channel.delete().catch(() => {
                        console.log('<a:baarsz:1505146967817326675> Bilet kanalı silinemedi');
                    });
                }, 5000);
            }

            // --- 5. YENİDEN AÇ ---
            if (interaction.isButton() && interaction.customId === 'tsa_reopen') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                    return interaction.reply({ 
                        content: '<a:baarsz:1505146967817326675> Bu işlem için yeterli yetkiniz yok!', 
                        ephemeral: true 
                    });
                }

                const originalEmbed = interaction.message.embeds[0];
                const reopenEmbed = EmbedBuilder.from(originalEmbed)
                    .spliceFields(4, 1)
                    .setColor('#4ecdc4')
                    .setTitle(originalEmbed.title.replace('BİLET AÇILDI', 'BİLET YENİDEN AÇILDI'));

                const enabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('tsa_claim')
                        .setLabel('BILETI ÜSTLEN')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('<a:tik:1505164671081123840>'),
                    new ButtonBuilder()
                        .setCustomId('tsa_assign')
                        .setLabel('BAŞKASINA AKTAR')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('<:change:1505202806666170501>'),
                    new ButtonBuilder()
                        .setCustomId('tsa_fast_close')
                        .setLabel('KAPATMA OLAYI')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('<:riva_kilit:1505203119427162192>')
                );

                await interaction.update({ embeds: [reopenEmbed], components: [enabledRow] });
                await interaction.followUp({ 
                    content: `<:change:1505202806666170501> Bilet **${interaction.user.tag}** tarafından yeniden açıldı!`,
                    ephemeral: false 
                });
            }

        } catch (error) {
            console.error('<a:baarsz:1505146967817326675> Destek sistemi hatası:', error);
            try {
                await interaction.reply({ 
                    content: '<a:baarsz:1505146967817326675> Bir hata oluştu! Lütfen daha sonra tekrar deneyiniz.', 
                    ephemeral: true 
                });
            } catch (e) {
                console.error('Hata yanıtı gönderilemedi:', e);
            }
        }
    }
};
