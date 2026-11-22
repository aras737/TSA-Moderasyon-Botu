# TMF-Moderasyon-Botu

## Render üzerinde kalıcı veri

Botun ayarları, Anti-Raid yedekleri, ticket kayıtları ve kullanıcı verileri `data/storage.json` dosyasında tutulur. Render'ın Free web servislerinde dosya sistemi kalıcı değildir; yeniden dağıtım, yeniden başlatma veya servisin uykuya geçmesi sonrasında bu dosya kaybolabilir.

Kalıcı depolama kullanmak için ücretli Render Web Service'e bir Persistent Disk ekle:
- Mount Path: `/var/data`
- Environment Variable: `DATA_DIR=/var/data`

Kod, `DATA_DIR` tanımlandığında JSON verisini bu dizinde saklar. Disk eklemeden yalnızca `DATA_DIR` değişkenini tanımlamak veriyi kalıcı yapmaz. Alternatif olarak harici, kalıcı bir veritabanı bağlanmalıdır.


## Güvenlik ve ortam değişkenleri

- `BOT_OWNER_ID`: `/tamyasakla` komutunu kullanabilecek tek Discord hesabının sayısal kullanıcı ID'si. Boş bırakılırsa küresel yasaklama güvenlik nedeniyle çalışmaz.
- Anti-Raid'i açmadan önce bot rolünü, sunucudaki saldırı amaçlı kullanılabilecek yüksek yetkili rollerin üzerine taşı. `/koruma durum` eksik izinleri, rol sıralaması sorunlarını ve bloke olmuş kurtarma yedeğini gösterir.
- Anti-Raid, 1 saniye içinde aynı kullanıcıdan 5 korunan denetim işlemi algılandığında müdahale eder. Sunucu sahibine karşı botlar işlem yapamaz; bot rolünün üzerindeki roller de Discord hiyerarşisi nedeniyle yönetilemez.
- `/sureli-duyuru` komutu kaldırılmıştır. Yeniden dağıtım ve bot yeniden başlatıldığında zamanlayıcı gerektiren bir duyuru hizmeti çalışmaz.
