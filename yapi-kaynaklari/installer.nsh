; Kaldırırken tarayıcı olarak yaptığımız kullanıcı kayıtlarını (Varsayılan uygulamalar listesi) temizle.
; Kayıtlar uygulama tarafından çalışma anında yazılıyor (src/varsayilan-windows.js).
!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\CVSBrowserURL"
  DeleteRegKey HKCU "Software\Classes\CVSBrowserHTML"
  DeleteRegKey HKCU "Software\Clients\StartMenuInternet\CVSBrowser"
  DeleteRegValue HKCU "Software\RegisteredApplications" "CVS Browser"
!macroend
