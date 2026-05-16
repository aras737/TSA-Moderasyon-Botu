const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType } = require('discord.js');

// Çift event kaydını önleyen koruma kilidi
let sesSistemiKilitlendi = false;

module.exports = {
    requiredPerms: [PermissionsBitField.Flags.Administrator],

    data: new SlashCommandBuilder()
        .setName('ses-paneli-kur')
        .setDescription('TSA Gelişmiş İçten Butonlu Özel Ses Kanalı panelini kurar.')
        .addChannelOption(option =>
            option.setName('kategori')
                .setDescription('Özel odaların açılacağı ana kategoriyi seçin')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildCategory)
        ),

    async execute(interaction) {
        const kategori = interaction.options.getChannel('kategori');
        const client = interaction.client;
        
        // Emojilerin kanka
        const korumaEmoji = '<:koruma1:1505143174190989352>';
        const ayarlarEmoji = '<a:acs_ayarlar:1505165015127162994>';
        const kategoriEmoji = '<:appEmoji_kategori:1505159567879966811>';
        const onlineEmoji = '<a:online:1505145208046878730>';
        const sesEmoji = '<:Ses:1505167107338535003>';
        const tikEmoji = '<a:tik:1505164671081123840>';
        const uyariEmoji = '<a:uyari:1505166167189487757>';
        const linkEmoji = '<:Discord_Link:1505166617426923661>';
        const basarisizEmoji = '<a:baarsz:1505146967817326675>';
        const silEmoji = '<:sil:1505147967907037275>';

        // --- 🤖 HER ŞEYİ KENDİ İÇİNDE YÖNETEN GELİŞMİŞ BACKEND ---
        if (!sesSistemiKilitlendi) {
            
            client.on('interactionCreate', async (inter) => {
                if (!inter.isButton()) return;
                const member = inter.member;
                const guild = inter.guild;

                // 🔥 1. BUTON: ANA PANELDEKİ "ODA OLUŞTUR" BUTONU
                if (inter.customId.startsWith('tsa_ses_olustur_')) {
                    const targetKategoriId = inter.customId.split('tsa_ses_olustur_')[1];

                    // Aktif oda kontrolü (Dinamik arama)
                    const odaArat = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name.endsWith(`${member.user.username} Odası`));
                    if (odaArat) {
                        return inter.reply({ 
                            content: `${uyariEmoji} **Hata:** Kanka zaten aktif olarak açık bir odan bulunuyor! Kanalın: ${odaArat}`, 
                            ephemeral: true 
                        });
                    }

                    await inter.deferReply({ ephemeral: true });

                    try {
                        // Ses kanalını oluşturuyoruz
                        const yeniSesKanali = await guild.channels.create({
                            name: `🔊 ${member.user.username} Odası`,
                            type: ChannelType.GuildVoice,
                            parent: targetKategoriId,
                            permissionOverwrites: [
                                {
                                    id: guild.id, // @everyone görebilir ve girebilir
                                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect],
                                },
                                {
                                    id: member.id, // Oda Sahibi (Full Yetki)
                                    allow: [
                                        PermissionsBitField.Flags.ViewChannel, 
                                        PermissionsBitField.Flags.Connect, 
                                        PermissionsBitField.Flags.ManageChannels,
                                        PermissionsBitField.Flags.MuteMembers,
                                        PermissionsBitField.Flags.DeafenMembers,
                                        PermissionsBitField.Flags.MoveMembers
                                    ],
                                }
                            ]
                        });

                        // 🔔 ODA İÇİ KONTROL PANELİ (Oda metin alanına gönderilecek)
                        const icPanelEmbed = new EmbedBuilder()
                            .setTitle(`${korumaEmoji} TSA | Oda Yönetim Paneli`)
                            .setDescription(
                                `Hoş geldin, **${member.user.username}**! Burası senin tamamen kişisel odandır.\n\n` +
                                `• İşin bittiğinde odayı aşağıdaki butona basarak anında kapatabilirsin.\n` +
                                `• **Güvenlik Koruması:** Bu butonu senden başka hiçbir üye tetikleyemez!`
                            )
                            .setColor('#e74c3c')
                            .setFooter({ text: 'TSA Oda Kontrol Sistemi', iconURL: member.user.displayAvatarURL() })
                            .setTimestamp();

                        // Odayı Kapatma Butonu (Oda sahibinin ID'sini customId içine kilitliyoruz!)
                        const icRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`tsa_oda_sil_${member.id}`)
                                .setLabel('Odayı Sil')
                                .setEmoji(silEmoji)
                                .setStyle(ButtonStyle.Danger)
                        );

                        // Butonlu mesajı ses kanalının içine (Metin kısmına) gönderiyoruz
                        await yeniSesKanali.send({ 
                            content: `👋 ${member}, odanın yönetim paneli aktif!`, 
                            embeds: [icPanelEmbed], 
                            components: [icRow] 
                        });

                        // Ana paneldeki üyeye yanıt
                        await inter.editReply({ 
                            content: `${korumaEmoji} **Odan Başarıyla İnşa Edildi!**\n${linkEmoji} **Oda Bağlantısı:** ${yeniSesKanali}` 
                        });

                        // Üye sestedeyse otomatik odasına taşı
                        if (member.voice.channel) {
                            await member.voice.setChannel(yeniSesKanali).catch(() => {});
                        }

                    } catch (error) {
                        console.error(error);
                        await inter.editReply({ content: `${basarisizEmoji} Oda oluşturulurken teknik bir hata meydana geldi!` });
                    }
                }

                // 🗑️ 2. BUTON: ODA İÇİNDEKİ "ODAYI SİL" BUTONU
                if (inter.customId.startsWith('tsa_oda_sil_')) {
                    const odaSahibiId = inter.customId.split('tsa_oda_sil_')[1];

                    // Güvenlik Duvarı: Basan kişi odayı açan kişi mi?
                    if (inter.user.id !== odaSahibiId) {
                        return inter.reply({ 
                            content: `${uyariEmoji} **Hata:** Kanka bu odayı sen açmadın! Sadece oda sahibi (**<@${odaSahibiId}>**) bu odayı imha edebilir.`, 
                            ephemeral: true 
                        });
                    }

                    // Eğer sahibi bastıysa kanalı saniyeler içinde yok et
                    await inter.reply({ content: `${silEmoji} Kanal imha ediliyor...` });
                    
                    setTimeout(async () => {
                        try {
                            await inter.channel.delete();
                            console.log(`${silEmoji} [TSA Ses Log] Oda sahibi tarafından kanal silindi: ${inter.channel.name}`);
                        } catch (err) {
                            // Kanal zaten silindiyse hata basmasın
                        }
                    }, 1000);
                }
            });

            // 🧹 3. EVENT: ODADAN HERKES ÇIKINCA OTOMATİK SİLME (Yedek Güvenlik Motoru)
            client.on('voiceStateUpdate', async (oldState, newState) => {
                const eskiKanal = oldState.channel;
                
                if (eskiKanal && eskiKanal.name.endsWith('Odası')) {
                    const kalanInsanSayisi = eskiKanal.members.filter(m => !m.user.bot).size;
                    
                    if (kalanInsanSayisi === 0) {
                        setTimeout(async () => {
                            const teyitKanali = oldState.guild.channels.cache.get(eskiKanal.id);
                            if (teyitKanali && teyitKanali.members.filter(m => !m.user.bot).size === 0) {
                                await teyitKanali.delete().catch(() => {});
                            }
                        }, 1500);
                    }
                }
            });

            sesSistemiKilitlendi = true;
            console.log(`${ayarlarEmoji} [TSA Ses Entegrasyonu] İçten butonlu ve sahiplik korumalı ses modülü başarıyla kilitlendi!`);
        }

        // --- 📝 ANA GÖRSEL PANEL KISMI (EMBED) ---
        const panelEmbed = new EmbedBuilder()
            .setTitle(`${korumaEmoji} TSA | Özel Oda Yönetim Sistemi`)
            .setDescription(
                `Aşağıdaki butona tıklayarak tamamen size ait, ayarlarını bizzat yöneteceğiniz **Geçici Ses Kanalı** oluşturabilirsiniz!\n\n` +
                `${ayarlarEmoji} **Gelişmiş Sistem Özellikleri:**\n` +
                `• Butona bastığınızda odanız saniyeler içinde otomatik olarak inşa edilir.\n` +
                `• Odanın içindeki metin kanalına **Sadece Sizin** kontrol edebileceğiniz bir imha paneli gönderilir.\n` +
                `• Başka hiçbir üye odanızı izinsiz butonla kapatamaz.\n` +
                `• Odada kimse kalmadığında sistem otomatik temizlik moduna geçer.`
            )
            .addFields(
                { name: `${kategoriEmoji} Odaların İnşa Edileceği Bölge`, value: `${kategoriEmoji} **${kategori.name}**`, inline: true },
                { name: `${korumaEmoji} Güvenlik Altyapısı`, value: `${onlineEmoji} Aktif (TSA Koruma v3)`, inline: true }
            )
            .setColor('#2ecc71')
            .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 512 }) || null)
            .setFooter({ text: 'Turkish Armed Forces | Sahiplik Korumalı Oda Modülü', iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`tsa_ses_olustur_${kategori.id}`)
                .setLabel('Özel Oda Oluştur')
                .setEmoji(sesEmoji)
                .setStyle(ButtonStyle.Success)
        );

        await interaction.reply({ content: `${tikEmoji} **Başarılı:** Sahiplik korumalı ve oda içi butonlu sistem aktif edilip panel gönderildi!`, ephemeral: true });
        await interaction.channel.send({ embeds: [panelEmbed], components: [row] });
    }
};