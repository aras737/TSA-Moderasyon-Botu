# TMF-Moderasyon-Botu

## Render üzerinde kalıcı veri

Botun ayarları, Anti-Raid yedekleri, ticket kayıtları ve kullanıcı verileri `data/storage.json` dosyasında tutulur. Render'ın Free web servislerinde dosya sistemi kalıcı değildir; yeniden dağıtım, yeniden başlatma veya servisin uykuya geçmesi sonrasında bu dosya kaybolabilir.

Kalıcı depolama kullanmak için ücretli Render Web Service'e bir Persistent Disk ekle:
- Mount Path: `/var/data`
- Environment Variable: `DATA_DIR=/var/data`

Kod, `DATA_DIR` tanımlandığında JSON verisini bu dizinde saklar. Disk eklemeden yalnızca `DATA_DIR` değişkenini tanımlamak veriyi kalıcı yapmaz. Alternatif olarak harici, kalıcı bir veritabanı bağlanmalıdır.


## Güvenlik ve ortam değişkenleri

- `BOT_OWNER_ID`: Bot sahibinin sayısal Discord kullanıcı ID'si. Açılış bildirimleri ve `/tamyasakla` onay DM'leri bu hesaba gönderilir. Boş veya geçersizse ilgili özellik güvenli biçimde atlanır.
- `/tamyasakla`: Sunucu yöneticileri talep oluşturabilir; küresel ban yalnızca `BOT_OWNER_ID` hesabı DM üzerinden onay verirse uygulanır. Süresi dolan talepler açılışta ve yeni talep oluşturulurken temizlenir. Bekleyen talepler `Storage` içinde tutulur.
- Anti-Raid'i açmadan önce bot rolünü, sunucudaki saldırı amaçlı kullanılabilecek yüksek yetkili rollerin üzerine taşı. `/koruma durum` eksik izinleri, rol sıralaması sorunlarını ve bloke olmuş kurtarma yedeğini gösterir.
- Anti-Raid, 1 saniye içinde aynı kullanıcıdan 5 korunan denetim işlemi algılandığında müdahale eder. Sunucu sahibine karşı botlar işlem yapamaz; bot rolünün üzerindeki roller de Discord hiyerarşisi nedeniyle yönetilemez.
- `/sureli-duyuru` komutu kaldırılmıştır. Yeniden dağıtım ve bot yeniden başlatıldığında zamanlayıcı gerektiren bir duyuru hizmeti çalışmaz.

## Application Emojis

Bot, `utils/emojis.js` üzerinden Discord Application Emojis'lerini yükler ve eşleşme bulunmadığında Unicode yedeklerini kullanır. Developer Portal → Applications → TMF → Emojis bölümüne şu adları yükle (dosya adlarıyla aynı): `tik`, `baarsz`, `uyari`, `koruma1`, `sil`, `yasaklandi`, `bilet`, `Ses`, `online`, `Ofline`, `megafon`, `tac`, `change`, `Discord_Link`, `global`, `Ping_Pong`, `last_yildirim`, `antena`, `uzaybot_kullanicilar`, `Paper`, `takviye`, `appEmoji_kategori`, `duration`, `riva_kilit`, `uzaybot_kanal`, `Yetkili`, `Logo_Boosts`, `elner_tarih`, `n_id`, `uzaybot_mesaj`, `RolsimgesiMasterNetworkz172`, `mor_yildiz`, `clip_board`, `rol`, `yeni`, `join_join`, `Leave_Leave`, `music`.
