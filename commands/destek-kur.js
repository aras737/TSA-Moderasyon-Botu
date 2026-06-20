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

            ayarKaydet(interaction.guild.id, 'destekRolleri', rolIDleri);
            ayarKaydet(interaction.guild.id, 'logKanaliDestek', logKanali.id);

            const anaEmbed = new EmbedBuilder()
                .setTitle('<:tac:1505158450538352670> TSA MODERASYON | DESTEK SİSTEMİ')
                .setDescription('Yardıma mı ihtiyacınız var? Aşağıdaki butona tıklayarak bir destek talebi oluşturabilirsiniz.\n\nTalebiniz en kısa sürede TSA yetkililerimiz tarafından yanıtlanacaktır.')
                .addFields(
                    { name: '<:koruma1:1505143174190989352> MODERATÖRLÜK ÇÖZÜMLERİ', value: '`Discord içi sorunlar, moderasyon desteği ve disiplin konuları`', inline: false },
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
                    .setLabel('DESTEK OLAYI BAŞLAT')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('<:bilet:1505453733969006602>')
            );

            await interaction.reply({ 
                content: `<a:tik:1505164671081123840> **TSA Destek Sistemi başarıyla kuruldu!**\n\n<:uzaybot_kanal:1505159120074833931> Log Kanalı: ${logKanali}\n👥 Yetkili Roller: ${rolIDleri.length} adet`, 
                ephemeral: true 
            });

            await biletKanali.send({ embeds: [anaEmbed], components: [row] });
        } catch (error) {
            console.error('Destek kurulum hatası:', error);
            return interaction.reply({ content: '<a:baarsz:1505146967817326675> Sistem kurulumunda hata oluştu!', ephemeral: true });
        }
    },

    async interactionHandler(interaction) {
        try {
            // --- 1. KATEGORİ SEÇİMİ ---
            if (interaction.isButton() && interaction.customId.startsWith('tsa_setup_')) {
                // BUG DÜZELTMESİ: customId'yi '_' ile split etmek rol ID'lerini bozuyordu.
                // Şimdi prefix'i kaldırıp geri kalanı alıyoruz.
                const withoutPrefix = interaction.customId.replace('tsa_setup_', '');
                const lastUnderscoreIndex = withoutPrefix.lastIndexOf('_');
                const roller = withoutPrefix.substring(0, lastUnderscoreIndex);
                const logID = withoutPrefix.substring(lastUnderscoreIndex + 1);

                const menuRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`tsa_create_${roller}_${logID}`)
                        .setPlaceholder('Bilet Kategorisi Seçiniz...')
                        .addOptions([
                            { 
                                label: 'Moderatörlük Destek', 
                                value: 'Moderatörlük', 
                                description: 'Discord içi sorunlar ve moderasyon',
                                emoji: '<:koruma1:1505143174190989352>'
                            },
                            { 
                                label: 'Genel Destek', 
                                value: 'Genel', 
                                description: 'Oyun içi sorunlar ve genel konular',
                                emoji: '<:uzaybot_kullanicilar:1505146190973505567>'
                            },
                            { 
                                label: 'VIP/Gamepass', 
                                value: 'Gamepass', 
                                description: 'Rütbe ve özel yetkilendirme sorunları',
                                emoji: '<:takviye:1505157853994815530>'
                            },
                            { 
                                label: 'Üst Yönetim', 
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

                // BUG DÜZELTMESİ: Aynı split sorunu burada da vardı.
                const withoutPrefix = interaction.customId.replace('tsa_create_', '');
                const lastUnderscoreIndex = withoutPrefix.lastIndexOf('_');
                const roller = withoutPrefix.substring(0, lastUnderscoreIndex).split('-');
                const logID = withoutPrefix.substring(lastUnderscoreIndex + 1);
                const kategori = interaction.values[0];

                const kategoriBilgisi = {
                    'Moderatörlük': { emoji: '<:koruma1:1505143174190989352>', renk: '#ff6b6b', prefix: 'mod' },
                    'Genel': { emoji: '<:uzaybot_kullanicilar:1505146190973505567>', renk: '#4ecdc4', prefix: 'gen' },
                    'Gamepass': { emoji: '<:takviye:1505157853994815530>', renk: '#ffd93d', prefix: 'vip' },
                    'Yönetim': { emoji: '<a:uyari:1505166167189487757>', renk: '#ee5a6f', prefix: 'yön' }
                };

                const info = kategoriBilgisi[kategori];
                const kanalAdi = `${info.prefix}-${interaction.user.username.substring(0, 10)}`.toLowerCase();

                const izinler = [
                    { 
                        id: interaction.guild.id, 
                        deny: [PermissionsBitField.Flags.ViewChannel] 
                    },
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

                const kanal = await interaction.guild.channels.create({
                    name: kanalAdi,
                    type: ChannelType.GuildText,
                    permissionOverwrites: izinler,
                    topic: `Açan: ${interaction.user.id} | Kategori: ${kategori} | Zaman: ${new Date().toLocaleString('tr-TR')} | Log: ${logID}`
                });

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
                        .setLabel('BİLETİ ÜSTLEN')
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

                await kanal.send({ 
                    content: `${roller.map(r => `<@&${r}>`).join(' ')} | ${interaction.user}`,
                    embeds: [hosgeldin], 
                    components: [biletButonlar] 
                });

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
                    components: []
                });
            }

            // --- 3. BİLETİ ÜSTLENME ---
            if (interaction.isButton() && interaction.customId === 'tsa_claim') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                    return interaction.reply({ 
                        content: '<a:baarsz:1505146967817326675> Bu işlem için yeterli yetkiniz yok!', 
                        ephemeral: true 
                    });
                }

                const originalEmbed = interaction.message.embeds[0];
                // BUG DÜZELTMESİ: spliceFields(4, 0) embed'de tam 4 field olmayabilir.
                // Mevcut field sayısına göre ekliyoruz.
                const claimEmbed = EmbedBuilder.from(originalEmbed)
                    .addFields({ name: '<a:tik:1505164671081123840> ÜSTLENEN YETKİLİ', value: `${interaction.user.tag}\n<t:${Math.floor(Date.now() / 1000)}:R>`, inline: false })
                    .setColor('#ffd93d');

                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('tsa_claimed')
                        .setLabel('BİLET ÜSTLENİLDİ')
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

                // BUG DÜZELTMESİ: topic null olabilir, null check eklendi.
                const topicData = interaction.channel.topic;
                if (!topicData) return;
                const logID = topicData.split('Log: ')[1]?.trim();
                if (!logID) return;
                const logKanal = interaction.guild.channels.cache.get(logID);
                
                if (logKanal) {
                    const claimLog = new EmbedBuilder()
                        .setTitle('<a:tik:1505164671081123840> BİLET ÜSTLENİLDİ')
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
                // BUG DÜZELTMESİ: Bilet sahibi kontrolü topic'ten alınan ID ile yapılıyor.
                const topicData = interaction.channel.topic;
                if (!topicData) {
                    return interaction.reply({ content: '<a:baarsz:1505146967817326675> Kanal bilgisi okunamadı!', ephemeral: true });
                }

                const acanID = topicData.split('Açan: ')[1]?.split(' |')[0]?.trim();
                const isOwner = interaction.user.id === acanID;
                const isStaff = interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages);

                if (!isStaff && !isOwner) {
                    return interaction.reply({ 
                        content: '<a:baarsz:1505146967817326675> Yalnızca bilet sahibi veya yetkili bu işlemi yapabilir!', 
                        ephemeral: true 
                    });
                }

                const logID = topicData.split('Log: ')[1]?.trim();
                const kategori = topicData.split('Kategori: ')[1]?.split(' |')[0]?.trim();

                const kapanisEmbed = new EmbedBuilder()
                    .setTitle('<:riva_kilit:1505203119427162192> BİLET KAPATILIYOR...')
                    .setDescription(`Bu bilet **${interaction.user.tag}** tarafından kapatılıyor.\n\n⏱️ Kanal 5 saniye içinde siliniyor...`)
                    .setColor('#ff6b6b')
                    .setTimestamp();

                await interaction.reply({ embeds: [kapanisEmbed] });

                if (logID) {
                    const logKanal = interaction.guild.channels.cache.get(logID);
                    if (logKanal) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('<:riva_kilit:1505203119427162192> BİLET KAPATILDI')
                            .addFields(
                                { name: '<:appEmoji_kategori:1505159567879966811> Kategori', value: kategori || 'Bilinmiyor', inline: true },
                                { name: '<:uzaybot_kullanicilar:1505146190973505567> Bileti Açan', value: acanID ? `<@${acanID}>` : 'Bilinmiyor', inline: true },
                                { name: '<:sil:1505147967907037275> Kapatan', value: `${interaction.user.tag}`, inline: true },
                                { name: '<:uzaybot_kanal:1505159120074833931> Kanal', value: `\`${interaction.channel.name}\``, inline: false },
                                { name: '<:duration:1505171054497370275> Kapatılış Saati', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: false }
                            )
                            .setColor('#ff6b6b')
                            .setFooter({ text: `Bilet #${interaction.channel.id.substring(0, 8).toUpperCase()}` })
                            .setTimestamp();
                        
                        await logKanal.send({ embeds: [logEmbed] });
                    }
                }

                setTimeout(async () => {
                    await interaction.channel.delete().catch(() => {
                        console.log('Bilet kanalı silinemedi');
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
                // BUG DÜZELTMESİ: spliceFields ile field silmek yerine
                // son field'ı (üstlenen yetkili) güvenli şekilde kaldırıyoruz.
                const fields = originalEmbed.fields.filter(f => !f.name.includes('ÜSTLENEN YETKİLİ'));
                const reopenEmbed = EmbedBuilder.from(originalEmbed)
                    .setFields(fields)
                    .setColor('#4ecdc4')
                    .setTitle(originalEmbed.title
                        .replace('BİLET AÇILDI', 'BİLET YENİDEN AÇILDI')
                        .replace('BİLET YENİDEN AÇILDI YENİDEN AÇILDI', 'BİLET YENİDEN AÇILDI')
                    );

                const enabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('tsa_claim')
                        .setLabel('BİLETİ ÜSTLEN')
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

            // --- 6. BAŞKASINA AKTAR (tsa_assign) ---
            // BUG DÜZELTMESİ: Bu buton tanımlıydı ama handler yoktu, hata veriyordu.
            if (interaction.isButton() && interaction.customId === 'tsa_assign') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                    return interaction.reply({ 
                        content: '<a:baarsz:1505146967817326675> Bu işlem için yeterli yetkiniz yok!', 
                        ephemeral: true 
                    });
                }

                await interaction.reply({
                    content: '<:change:1505202806666170501> Bileti aktarmak istediğiniz yetkiliyi etiketleyin (30 saniye süreniz var):',
                    ephemeral: true
                });

                const filter = m => m.author.id === interaction.user.id && m.mentions.members.size > 0;
                const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

                collector.on('collect', async m => {
                    const hedef = m.mentions.members.first();
                    await interaction.channel.permissionOverwrites.edit(hedef.id, {
                        ViewChannel: true,
                        SendMessages: true,
                        AttachFiles: true,
                        ReadMessageHistory: true,
                        EmbedLinks: true,
                        ManageMessages: true
                    });
                    await m.delete().catch(() => {});
                    await interaction.channel.send({
                        content: `<:change:1505202806666170501> Bilet **${interaction.user.tag}** tarafından ${hedef} kullanıcısına aktarıldı!`
                    });
                });

                collector.on('end', (collected, reason) => {
                    if (reason === 'time' && collected.size === 0) {
                        interaction.followUp({ content: '<a:baarsz:1505146967817326675> Süre doldu, aktarma iptal edildi.', ephemeral: true }).catch(() => {});
                    }
                });
            }

        } catch (error) {
            console.error('Destek sistemi hatası:', error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '<a:baarsz:1505146967817326675> Bir hata oluştu! Lütfen daha sonra tekrar deneyiniz.', 
                        ephemeral: true 
                    });
                } else {
                    await interaction.followUp({ 
                        content: '<a:baarsz:1505146967817326675> Bir hata oluştu! Lütfen daha sonra tekrar deneyiniz.', 
                        ephemeral: true 
                    });
                }
            } catch (e) {
                console.error('Hata yanıtı gönderilemedi:', e);
            }
        }
    }
};
