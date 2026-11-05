'use strict';

/*
 * Katman görünümünün köprüsü. Sekme içerikleri preload ALMAZ; bu preload
 * yalnızca bizim yazdığımız yerel katman sayfasına yüklenir ve yüzeyi
 * kasıtlı olarak dar tutulur: yalnızca kutunun yapabilmesi gereken işler.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('katman', {
  // Ana süreç ne çizileceğini buradan bildirir.
  dinle: (geriCagirim) => {
    ipcRenderer.on('katman:icerik', (_e, veri) => geriCagirim(veri));
  },
  hazir: () => ipcRenderer.send('katman:hazir'),
  kapat: () => ipcRenderer.send('katman:kapat'),

  // İndirilenler kutusu
  indirmeAc: (id) => ipcRenderer.send('katman:indirme-ac', id),
  indirmeEylem: (id, eylem) => ipcRenderer.send('katman:indirme-eylem', String(id), String(eylem)),
  indirmeKlasor: (id) => ipcRenderer.send('katman:indirme-klasor', id),
  tumunuGoster: () => ipcRenderer.send('katman:tumunu-goster'),

  // Yer imleri menüsü (çubuktaki "Tüm yer imleri" ve taşma düğmeleri)
  yerimiGit: (url, yeniSekme) => ipcRenderer.send('katman:yerimi-git', String(url), !!yeniSekme),
  yerimiKaydet: (veri) => ipcRenderer.send('katman:yerimi-kaydet', veri),
  yerimiKaldir: (url) => ipcRenderer.send('katman:yerimi-kaldir', String(url)),
  yerimiTumunuAc: () => ipcRenderer.send('katman:yerimi-tumu'),

  // İzin kutusu. Karar tek seferlik; ana süreç kutuyu kapatır.
  izinKarar: (izinVer, hatirla) => ipcRenderer.send('katman:izin', { izinVer, hatirla }),

  // Onay penceresi (eklenti kurulumu/kaldırma gibi). Karar tek seferlik.
  onayKarar: (tamam) => ipcRenderer.send('katman:onay', !!tamam),

  // Yenilikler penceresi: seçilen dile çevrilmiş sürüm notunu ister (yalnızca dil kodu gider).
  yenilikCevir: (kod) => ipcRenderer.invoke('katman:yenilik-cevir', String(kod)),

  // VPN açılır kutusu. Aç/kapa OTOMATİK KAYIT içerir (token sunucudan alınır);
  // invoke ile sonucu bekleyip UI güncellenir. Kullanıcı token girmez.
  vpnAcKapa: (deger) => ipcRenderer.invoke('katman:vpn-ackapa', deger),
  vpnLokasyon: (id) => ipcRenderer.send('katman:vpn-lokasyon', id),
  vpnCikisIp: () => ipcRenderer.invoke('katman:vpn-ip')
});
