'use strict';

/**
 * Yüksek Doğruluklu Hız Testi Motoru (Ookla Speedtest.net & Cloudflare Fallback)
 *
 * Gerçek Speedtest.net metodolojisi:
 * 1. En Yakın Yerel ISP Sunucusu Keşfi (Türk Telekom, Turkcell, Vodafone vb. Ookla ağları)
 * 2. Düşük Gecikmeli Ping ve Jitter Ölçümü (Warm Keep-Alive TCP/HTTP)
 * 3. 6 Eşzamanlı Akış ile Yüksek Hızlı Hat Doygunluğu (Download: random4000x4000.jpg)
 * 4. 4 Eşzamanlı Akış ile Gerçekçi Yükleme Testi (Upload: upload.php)
 */
class SpeedTest {
  constructor() {
    this.aktif = false;
    this.iptalEdildi = false;
  }

  iptal() {
    this.iptalEdildi = true;
    this.aktif = false;
  }

  async _enYakinSunucuyuBul() {
    try {
      const res = await fetch('https://www.speedtest.net/api/js/servers?engine=js', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(3500)
      });
      if (!res.ok) return null;
      const liste = await res.json();
      if (!Array.isArray(liste) || !liste.length) return null;

      const adaylar = liste.slice(0, 5);
      let enIyi = null;
      let minPing = Infinity;

      for (const s of adaylar) {
        if (this.iptalEdildi) return null;
        const proto = s.https_functional ? 'https://' : 'http://';
        const url = proto + s.host + '/speedtest/latency.txt';
        const t0 = Date.now();
        try {
          const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(1500) });
          if (r.ok) {
            const p = Date.now() - t0;
            if (p < minPing) {
              minPing = p;
              enIyi = s;
            }
          }
        } catch (_) {}
      }

      return enIyi;
    } catch (_) {
      return null;
    }
  }

  async calistir(onIlerleme = () => {}) {
    if (this.aktif) return null;
    this.aktif = true;
    this.iptalEdildi = false;

    let ping = 0;
    let jitter = 0;
    let indirmeMbps = 0;
    let yuklemeMbps = 0;
    let sunucuAdi = 'Speedtest.net API';

    try {
      /* ------------------------------------------------------------ */
      /* 1. Sunucu Keşfi                                              */
      /* ------------------------------------------------------------ */
      onIlerleme({ asama: 'gecikme', sunucu: 'Sunucu aranıyor…', ping: 0, jitter: 0, indirmeMbps: 0, yuklemeMbps: 0, ilerleme: 5 });

      const secilenSunucu = await this._enYakinSunucuyuBul();
      let baseUrl = '';
      let latencyUrl = '';
      let downloadUrl = '';
      let uploadUrl = '';

      if (secilenSunucu && secilenSunucu.host) {
        sunucuAdi = `${secilenSunucu.sponsor || 'Ookla'} (${secilenSunucu.name || ''})`;
        const proto = secilenSunucu.https_functional ? 'https://' : 'http://';
        baseUrl = proto + secilenSunucu.host;
        latencyUrl = baseUrl + '/speedtest/latency.txt';
        downloadUrl = baseUrl + '/speedtest/random4000x4000.jpg';
        uploadUrl = baseUrl + '/speedtest/upload.php';
      } else {
        sunucuAdi = 'Cloudflare Edge (Fallback)';
        baseUrl = 'https://speed.cloudflare.com';
        latencyUrl = baseUrl + '/__down?bytes=0';
        downloadUrl = baseUrl + '/__down?bytes=10000000';
        uploadUrl = baseUrl + '/__up';
      }

      onIlerleme({ asama: 'gecikme', sunucu: sunucuAdi, ping: 0, jitter: 0, indirmeMbps: 0, yuklemeMbps: 0, ilerleme: 10 });
      if (this.iptalEdildi) return null;

      /* ------------------------------------------------------------ */
      /* 2. Gecikme (Ping) ve Dalgalanma (Jitter) Ölçümü               */
      /* ------------------------------------------------------------ */
      const gecikmeler = [];
      const pingTekrari = 8;

      for (let i = 0; i < pingTekrari; i++) {
        if (this.iptalEdildi) break;
        const basla = Date.now();
        try {
          await fetch(latencyUrl, { cache: 'no-store', signal: AbortSignal.timeout(2000) });
          const fark = Date.now() - basla;
          if (fark > 0) gecikmeler.push(fark);
        } catch (_) {}

        const yuzde = 10 + Math.round(((i + 1) / pingTekrari) * 12);
        const anlikSon = gecikmeler.length ? gecikmeler[gecikmeler.length - 1] : 0;
        onIlerleme({ asama: 'gecikme', sunucu: sunucuAdi, ping: anlikSon, jitter: 0, indirmeMbps: 0, yuklemeMbps: 0, ilerleme: yuzde });
        await new Promise(r => setTimeout(r, 40));
      }

      if (gecikmeler.length >= 2) {
        // İlk el sıkışma / DNS sapmalarını at, stabil örnekleri değerlendir
        const temiz = gecikmeler.length > 3 ? gecikmeler.slice(2) : gecikmeler;
        temiz.sort((a, b) => a - b);
        ping = Math.round(temiz.reduce((a, b) => a + b, 0) / temiz.length);

        const farklar = [];
        for (let i = 1; i < temiz.length; i++) {
          farklar.push(Math.abs(temiz[i] - temiz[i - 1]));
        }
        jitter = farklar.length ? Math.round(farklar.reduce((a, b) => a + b, 0) / farklar.length) : 1;
      } else if (gecikmeler.length === 1) {
        ping = gecikmeler[0];
        jitter = 1;
      }

      onIlerleme({ asama: 'gecikme', sunucu: sunucuAdi, ping, jitter, indirmeMbps: 0, yuklemeMbps: 0, ilerleme: 24 });
      if (this.iptalEdildi) return null;

      /* ------------------------------------------------------------ */
      /* 3. İndirme Hızı (Download) - 6 Paralel Akış, 6 Saniye        */
      /* ------------------------------------------------------------ */
      onIlerleme({ asama: 'indirme', sunucu: sunucuAdi, ping, jitter, indirmeMbps: 0, yuklemeMbps: 0, ilerleme: 25 });
      const indirmeSuresiMs = 6000;
      const indirmeBaslangic = Date.now();
      let toplamAlinanBayt = 0;
      let indirmeDevam = true;
      let sonIlerlemeZamani = 0;

      const indirmeAkisi = async () => {
        while (indirmeDevam && !this.iptalEdildi) {
          try {
            const res = await fetch(downloadUrl, { cache: 'no-store' });
            if (!res.ok) {
              await new Promise(r => setTimeout(r, 100));
              continue;
            }
            const reader = res.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done || !indirmeDevam || this.iptalEdildi) {
                if (!done) reader.cancel().catch(() => {});
                break;
              }

              toplamAlinanBayt += value.length;
              const simdi = Date.now();
              const gecenMs = simdi - indirmeBaslangic;

              if (simdi - sonIlerlemeZamani >= 100 && gecenMs > 200) {
                sonIlerlemeZamani = simdi;
                const gecenSn = gecenMs / 1000;
                indirmeMbps = parseFloat(((toplamAlinanBayt * 8) / (gecenSn * 1000000)).toFixed(1));
                const oran = Math.min(1, gecenMs / indirmeSuresiMs);
                const yuzde = 25 + Math.round(oran * 37);
                onIlerleme({ asama: 'indirme', sunucu: sunucuAdi, ping, jitter, indirmeMbps, yuklemeMbps: 0, ilerleme: yuzde });
              }

              if (gecenMs >= indirmeSuresiMs) {
                indirmeDevam = false;
                reader.cancel().catch(() => {});
                break;
              }
            }
          } catch (_) {
            break;
          }
        }
      };

      // Yüksek hızlı 1 Gbps fiber hatları doygunluğa ulaştırmak için 6 akış
      await Promise.all([
        indirmeAkisi(), indirmeAkisi(), indirmeAkisi(),
        indirmeAkisi(), indirmeAkisi(), indirmeAkisi()
      ]);

      const toplamIndirmeGecenSn = Math.max(0.5, (Date.now() - indirmeBaslangic) / 1000);
      if (toplamAlinanBayt > 0) {
        indirmeMbps = parseFloat(((toplamAlinanBayt * 8) / (toplamIndirmeGecenSn * 1000000)).toFixed(1));
      }

      onIlerleme({ asama: 'indirme', sunucu: sunucuAdi, ping, jitter, indirmeMbps, yuklemeMbps: 0, ilerleme: 63 });
      if (this.iptalEdildi) return null;

      /* ------------------------------------------------------------ */
      /* 4. Yükleme Hızı (Upload) - 4 Paralel Akış, 4.5 Saniye         */
      /* ------------------------------------------------------------ */
      onIlerleme({ asama: 'yukleme', sunucu: sunucuAdi, ping, jitter, indirmeMbps, yuklemeMbps: 0, ilerleme: 65 });
      const yuklemeSuresiMs = 4500;
      const yuklemeBaslangic = Date.now();
      let toplamGonderilenBayt = 0;
      let yuklemeDevam = true;
      let sonYuklemeIlerleme = 0;
      const yuklemeParcasi = Buffer.alloc(1024 * 512, 'z'); // 512 KB

      const yuklemeAkisi = async () => {
        while (yuklemeDevam && !this.iptalEdildi) {
          try {
            const res = await fetch(uploadUrl, { method: 'POST', body: yuklemeParcasi });
            if (res.ok) {
              toplamGonderilenBayt += yuklemeParcasi.length;
            }
            const simdi = Date.now();
            const gecenMs = simdi - yuklemeBaslangic;

            if (simdi - sonYuklemeIlerleme >= 100 && gecenMs > 200) {
              sonYuklemeIlerleme = simdi;
              const gecenSn = gecenMs / 1000;
              yuklemeMbps = parseFloat(((toplamGonderilenBayt * 8) / (gecenSn * 1000000)).toFixed(1));
              const oran = Math.min(1, gecenMs / yuklemeSuresiMs);
              const yuzde = 65 + Math.round(oran * 33);
              onIlerleme({ asama: 'yukleme', sunucu: sunucuAdi, ping, jitter, indirmeMbps, yuklemeMbps, ilerleme: yuzde });
            }

            if (gecenMs >= yuklemeSuresiMs) {
              yuklemeDevam = false;
              break;
            }
          } catch (_) {
            break;
          }
        }
      };

      await Promise.all([
        yuklemeAkisi(), yuklemeAkisi(), yuklemeAkisi(), yuklemeAkisi()
      ]);

      const toplamYuklemeGecenSn = Math.max(0.5, (Date.now() - yuklemeBaslangic) / 1000);
      if (toplamGonderilenBayt > 0) {
        yuklemeMbps = parseFloat(((toplamGonderilenBayt * 8) / (toplamYuklemeGecenSn * 1000000)).toFixed(1));
      }

      const sonuc = { asama: 'tamam', sunucu: sunucuAdi, ping, jitter, indirmeMbps, yuklemeMbps, ilerleme: 100 };
      onIlerleme(sonuc);
      this.aktif = false;
      return sonuc;
    } catch (_) {
      this.aktif = false;
      const hataSonuc = { asama: 'hata', sunucu: sunucuAdi, ping, jitter, indirmeMbps, yuklemeMbps, ilerleme: 0 };
      onIlerleme(hataSonuc);
      return hataSonuc;
    }
  }
}

module.exports = { SpeedTest };
