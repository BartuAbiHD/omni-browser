# Teknik Şartname: Tarayıcılardan Veri İçe Aktarma (Browser Import Engine)

## 1. Genel Bakış ve Hedef
Kullanıcıların mevcut tarayıcılarındaki yer imlerini (bookmarks) ve geçmiş (history) kayıtlarını tek tıkla CVS Browser'a aktarmasını sağlamak.
Desteklenecek tarayıcılar:
- **Google Chrome**
- **Brave Browser**
- **Microsoft Edge**
- **Supermium**
- **Vivaldi**
- **Opera One**
- **Opera GX**
- **Mozilla Firefox**
- **Floorp**
- **HTML Yer İmi Dosyası (.html)**

Tamamı 12 dil (`tr`, `az`, `en`, `de`, `fr`, `es`, `it`, `pt`, `ru`, `ar`, `zh`, `ja`) ile %100 yerelleştirilmiş olacaktır.

---

## 2. Mimari ve Bileşenler

### 2.1. Çekirdek Aktarma Modülü (`src/tarayici-aktar.js`)
- **Otomatik Profil Tespiti:**
  - Chromium tabanlı tarayıcılar: `%LOCALAPPDATA%` ve `%APPDATA%` altında `User Data/Default` ya da `User Data/Profile *` dizinlerini tespit eder.
    - Google Chrome: `%LOCALAPPDATA%\Google\Chrome\User Data`
    - Brave: `%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data`
    - Microsoft Edge: `%LOCALAPPDATA%\Microsoft\Edge\User Data`
    - Supermium: `%LOCALAPPDATA%\Supermium\User Data`
    - Vivaldi: `%LOCALAPPDATA%\Vivaldi\User Data`
    - Opera One: `%APPDATA%\Opera Software\Opera Stable`
    - Opera GX: `%APPDATA%\Opera Software\Opera GX Stable`
  - Gecko tabanlı tarayıcılar: `%APPDATA%` altında profilleri tespit eder.
    - Mozilla Firefox: `%APPDATA%\Mozilla\Firefox\Profiles`
    - Floorp: `%APPDATA%\Floorp\Profiles`
  - macOS / Linux desteği: `~/Library/Application Support/...` ve `~/.config/...` yolları.

- **Veri Çıkarma Mantığı:**
  - **Yer İmleri (Chromium):** `Bookmarks` JSON dosyasını okur; hiyerarşik klasör yapısını düzleştirerek `{ url, baslik, zaman }` formatına dönüştürür.
  - **Geçmiş (Chromium):** `History` SQLite veritabanını okur. Tarayıcı açıkken veritabanı kilitli olabileceği için geçici bir kopyasını (`os.tmpdir()`) oluşturup `node:sqlite` ile sorgular (`SELECT url, title, last_visit_time FROM urls ORDER BY last_visit_time DESC LIMIT 2000`).
  - **Yer İmleri ve Geçmiş (Gecko - Firefox & Floorp):** `places.sqlite` dosyasını geçiciye kopyalar; `moz_bookmarks` ve `moz_places` tablolarından yer imi ve geçmişi çeker.
  - **HTML Dosyası:** Netscape Bookmark formatındaki `.html` dışa aktarma dosyalarını regex ile ayrıştırır.

### 2.2. Ana Süreç ve IPC Entegrasyonu (`main.js` & `preload.js`)
- `aktarilabilirTarayicilar()`: Sistemde kurulu ve verisi bulunan tarayıcıların listesini döner.
- `tarayicidanAktar(tarayiciId, secenekler)`: Seçilen tarayıcıdan yer imleri ve/veya geçmişi çekip `store.js`'e ekler.
  - Yer imleri için mükerrer kayıt kontrolü (`store.yerImiVarMi`).
  - Geçmiş için akıllı birleştirme (`store.gecmiseEkle`).
- `htmlYerImiAktar(dosyaYolu)`: Dosya seçici ile seçilen HTML dosyasını aktarır.

### 2.3. Arayüz ve Kullanıcı Deneyimi (`ui/index.html`, `ui/app.js`, `ui/style.css`)
- **Arayüz Noktaları:**
  1. Ayarlar > Genel sekmesinde **"Başka bir tarayıcıdan veri aktar"** butonu.
  2. Yer imleri çubuğunda yer imi yokken görünen ipucu butonuna ek **"İçe Aktar"** bağlantısı.
  3. Açılan modern modal penceresi (`#aktarmaPaneli`):
     - Algılanan tarayıcıların simgeleri ve adları.
     - Aktarılacak veri seçenekleri (☑ Yer İmleri, ☑ Gezinme Geçmişi).
     - "İçe Aktar" butonu ve aktarım sonrasında "X yer imi ve Y geçmiş kaydı başarıyla aktarıldı" özeti.

---

## 3. 12 Dil Desteği
Aşağıdaki anahtarlar 12 dil dosyasına (`tr`, `az`, `en`, `de`, `fr`, `es`, `it`, `pt`, `ru`, `ar`, `zh`, `ja`) eklenecektir:
- `aktarma.baslik`
- `aktarma.aciklama`
- `aktarma.tarayiciSecin`
- `aktarma.yerImleri`
- `aktarma.gecmis`
- `aktarma.baslat`
- `aktarma.tamamlandi`
- `aktarma.bulunamadi`
- `aktarma.dosyadanAktar`

---

## 4. Test ve Doğrulama Planı
- `test/aktar.js` birim testi:
  - Mock Chromium Bookmarks JSON ayrıştırma.
  - Mock HTML bookmarks ayrıştırma.
  - Veri doğrulama ve mükerrer kayıt engelleme.
- 11 kapılı CI ve `npm test` sözleşme uyumluluğu.
