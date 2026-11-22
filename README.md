# TMF-Moderasyon-Botu

## Render üzerinde kalıcı veri

Botun ayarları, Anti-Raid yedekleri, ticket kayıtları ve kullanıcı verileri `data/storage.json` dosyasında tutulur. Render'ın Free web servislerinde dosya sistemi kalıcı değildir; yeniden dağıtım, yeniden başlatma veya servisin uykuya geçmesi sonrasında bu dosya kaybolabilir.

Kalıcı depolama kullanmak için ücretli Render Web Service'e bir Persistent Disk ekle:
- Mount Path: `/var/data`
- Environment Variable: `DATA_DIR=/var/data`

Kod, `DATA_DIR` tanımlandığında JSON verisini bu dizinde saklar. Disk eklemeden yalnızca `DATA_DIR` değişkenini tanımlamak veriyi kalıcı yapmaz. Alternatif olarak harici, kalıcı bir veritabanı bağlanmalıdır.

