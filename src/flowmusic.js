'use strict';

/**
 * FlowMusic Helper: FlowMusic stüdyosu için yerleşik akıllı prompt,
 * vokal, şablon ve stil paneli enjeksiyonu.
 * Sayfa açıldığında sağ altta şık bir daire/baloncuk simgesi olarak durur;
 * tıklandığında paneli açar/kapatır. 12 dil ile tam uyumludur.
 */

const DIL_METINLERI = {
  tr: {
    helper: 'Yardımcı',
    kapat: 'Kapat',
    reference: '+ Referans',
    remix: '+ Remix',
    vocal: '+ Vokal',
    sozler: 'Şarkı Sözleri',
    enstrumantal: 'Enstrümantal',
    sozlerIpucu: 'Şarkı sözlerini buraya yazın veya enstrümantal için boş bırakın',
    optimize: '🪄 Optimize Et',
    sozUret: '📝 Söz Üret',
    stil: 'Stil ve Tarz',
    stilIpucu: 'Üretilecek müziği yönlendirmek için stil, ruh hali, enstrüman vb. girin',
    gelistir: '🪄 Geliştir',
    sablonlar: '📁 Şablonlar',
    promptlarim: '🏷️ Promptlarım',
    mevcutKaydet: '➕ Mevcut Stili Kaydet',
    kayitliYok: 'Henüz kayıtlı prompt yok.',
    vokalCinsiyet: 'Vokal Cinsiyeti',
    kadin: 'Kadın',
    erkek: 'Erkek',
    sarkiAdiIpucu: 'Şarkı adını girin',
    aktarBtn: 'FlowMusic Promptuna Aktar',
    aktarildi: '✓ FlowMusic Promptuna Aktarıldı!',
    kopyalandi: '✓ Panoya Kopyalandı!',
    baloncukBaslik: 'FlowMusic Stüdyo Paneli'
  },
  az: {
    helper: 'Köməkçi',
    kapat: 'Bağla',
    reference: '+ Referans',
    remix: '+ Remix',
    vocal: '+ Vokal',
    sozler: 'Mahnı Sözləri',
    enstrumantal: 'İnstrumental',
    sozlerIpucu: 'Mahnı sözlərini bura yazın və ya instrumental üçün boş qoyun',
    optimize: '🪄 Optimallaşdır',
    sozUret: '📝 Söz Yarat',
    stil: 'Stil və Janr',
    stilIpucu: 'Musiqini idarə etmək üçün stil, əhval, alət və s. daxil edin',
    gelistir: '🪄 Təkmilləşdir',
    sablonlar: '📁 Şablonlar',
    promptlarim: '🏷️ Promptlarım',
    mevcutKaydet: '➕ Hazırkı Stili Saxla',
    kayitliYok: 'Hələlik qeyd edilmiş prompt yoxdur.',
    vokalCinsiyet: 'Vokal Cinsi',
    kadin: 'Qadın',
    erkek: 'Kişi',
    sarkiAdiIpucu: 'Mahnı adını daxil edin',
    aktarBtn: 'FlowMusic Promptuna Köçür',
    aktarildi: '✓ FlowMusic Promptuna Köçürüldü!',
    kopyalandi: '✓ Panoya Kopyalandı!',
    baloncukBaslik: 'FlowMusic Studiya Paneli'
  },
  en: {
    helper: 'Helper',
    kapat: 'Close',
    reference: '+ Reference',
    remix: '+ Remix',
    vocal: '+ Vocal',
    sozler: 'Lyrics',
    enstrumantal: 'Instrumental',
    sozlerIpucu: 'Enter lyrics here or leave blank for instrumental',
    optimize: '🪄 Optimize',
    sozUret: '📝 Generate Lyrics',
    stil: 'Style',
    stilIpucu: 'Enter style, mood, instrument, etc. to control the generated music',
    gelistir: '🪄 Enhance',
    sablonlar: '📁 Templates',
    promptlarim: '🏷️ My prompts',
    mevcutKaydet: '➕ Save Current Style',
    kayitliYok: 'No saved prompts yet.',
    vokalCinsiyet: 'Vocal Gender',
    kadin: 'Female',
    erkek: 'Male',
    sarkiAdiIpucu: 'Enter song title',
    aktarBtn: 'Transfer to FlowMusic Prompt',
    aktarildi: '✓ Transferred to FlowMusic Prompt!',
    kopyalandi: '✓ Copied to Clipboard!',
    baloncukBaslik: 'FlowMusic Studio Panel'
  },
  de: {
    helper: 'Helfer',
    kapat: 'Schließen',
    reference: '+ Referenz',
    remix: '+ Remix',
    vocal: '+ Vokal',
    sozler: 'Songtext',
    enstrumantal: 'Instrumental',
    sozlerIpucu: 'Songtext hier eingeben oder für Instrumental leer lassen',
    optimize: '🪄 Optimieren',
    sozUret: '📝 Text generieren',
    stil: 'Stil',
    stilIpucu: 'Stil, Stimmung, Instrumente usw. eingeben',
    gelistir: '🪄 Verbessern',
    sablonlar: '📁 Vorlagen',
    promptlarim: '🏷️ Meine Prompts',
    mevcutKaydet: '➕ Aktuellen Stil speichern',
    kayitliYok: 'Noch keine gespeicherten Prompts.',
    vokalCinsiyet: 'Vokales Geschlecht',
    kadin: 'Weiblich',
    erkek: 'Männlich',
    sarkiAdiIpucu: 'Songtitel eingeben',
    aktarBtn: 'Zu FlowMusic-Prompt übertragen',
    aktarildi: '✓ In FlowMusic-Prompt übertragen!',
    kopyalandi: '✓ In die Zwischenablage kopiert!',
    baloncukBaslik: 'FlowMusic Studio-Panel'
  },
  fr: {
    helper: 'Assistant',
    kapat: 'Fermer',
    reference: '+ Référence',
    remix: '+ Remix',
    vocal: '+ Voix',
    sozler: 'Paroles',
    enstrumantal: 'Instrumental',
    sozlerIpucu: 'Entrez les paroles ici ou laissez vide pour un instrumental',
    optimize: '🪄 Optimiser',
    sozUret: '📝 Générer des paroles',
    stil: 'Style',
    stilIpucu: "Entrez le style, l'ambiance, les instruments, etc.",
    gelistir: '🪄 Améliorer',
    sablonlar: '📁 Modèles',
    promptlarim: '🏷️ Mes prompts',
    mevcutKaydet: '➕ Enregistrer le style actuel',
    kayitliYok: 'Aucun prompt enregistré pour le moment.',
    vokalCinsiyet: 'Genre de la voix',
    kadin: 'Femme',
    erkek: 'Homme',
    sarkiAdiIpucu: 'Entrez le titre de la chanson',
    aktarBtn: 'Transférer vers le prompt FlowMusic',
    aktarildi: '✓ Transféré vers le prompt FlowMusic !',
    kopyalandi: '✓ Copié dans le presse-papiers !',
    baloncukBaslik: 'Panneau FlowMusic Studio'
  },
  es: {
    helper: 'Asistente',
    kapat: 'Cerrar',
    reference: '+ Referencia',
    remix: '+ Remix',
    vocal: '+ Voz',
    sozler: 'Letra',
    enstrumantal: 'Instrumental',
    sozlerIpucu: 'Introduce la letra aquí o déjalo en blanco para instrumental',
    optimize: '🪄 Optimizar',
    sozUret: '📝 Generar letra',
    stil: 'Estilo',
    stilIpucu: 'Introduce estilo, estado de ánimo, instrumentos, etc.',
    gelistir: '🪄 Mejorar',
    sablonlar: '📁 Plantillas',
    promptlarim: '🏷️ Mis prompts',
    mevcutKaydet: '➕ Guardar estilo actual',
    kayitliYok: 'No hay prompts guardados todavía.',
    vokalCinsiyet: 'Género de voz',
    kadin: 'Femenino',
    erkek: 'Masculino',
    sarkiAdiIpucu: 'Introduce el título de la canción',
    aktarBtn: 'Transferir al prompt de FlowMusic',
    aktarildi: '✓ ¡Transferido al prompt de FlowMusic!',
    kopyalandi: '✓ ¡Copiado al portapapeles!',
    baloncukBaslik: 'Panel de FlowMusic Studio'
  },
  it: {
    helper: 'Assistente',
    kapat: 'Chiudi',
    reference: '+ Riferimento',
    remix: '+ Remix',
    vocal: '+ Voce',
    sozler: 'Testo',
    enstrumantal: 'Strumentale',
    sozlerIpucu: 'Inserisci il testo qui o lascia vuoto per lo strumentale',
    optimize: '🪄 Ottimizza',
    sozUret: '📝 Genera testo',
    stil: 'Stile',
    stilIpucu: 'Inserisci stile, atmosfera, strumenti, ecc.',
    gelistir: '🪄 Migliora',
    sablonlar: '📁 Modelli',
    promptlarim: '🏷️ I miei prompt',
    mevcutKaydet: '➕ Salva stile corrente',
    kayitliYok: 'Nessun prompt salvato ancora.',
    vokalCinsiyet: 'Genere vocale',
    kadin: 'Femminile',
    erkek: 'Maschile',
    sarkiAdiIpucu: 'Inserisci il titolo del brano',
    aktarBtn: 'Trasferisci nel prompt di FlowMusic',
    aktarildi: '✓ Trasferito nel prompt FlowMusic!',
    kopyalandi: '✓ Copiato negli appunti!',
    baloncukBaslik: 'Pannello FlowMusic Studio'
  },
  pt: {
    helper: 'Assistente',
    kapat: 'Fechar',
    reference: '+ Referência',
    remix: '+ Remix',
    vocal: '+ Voz',
    sozler: 'Letra',
    enstrumantal: 'Instrumental',
    sozlerIpucu: 'Digite a letra aqui ou deixe em branco para instrumental',
    optimize: '🪄 Otimizar',
    sozUret: '📝 Gerar letra',
    stil: 'Estilo',
    stilIpucu: 'Digite estilo, clima, instrumento, etc.',
    gelistir: '🪄 Aprimorar',
    sablonlar: '📁 Modelos',
    promptlarim: '🏷️ Meus prompts',
    mevcutKaydet: '➕ Salvar estilo atual',
    kayitliYok: 'Nenhum prompt salvo ainda.',
    vokalCinsiyet: 'Gênero vocal',
    kadin: 'Feminino',
    erkek: 'Masculino',
    sarkiAdiIpucu: 'Digite o título da música',
    aktarBtn: 'Transferir para o prompt do FlowMusic',
    aktarildi: '✓ Transferido para o prompt FlowMusic!',
    kopyalandi: '✓ Copiado para a área de transferência!',
    baloncukBaslik: 'Painel FlowMusic Studio'
  },
  ru: {
    helper: 'Помощник',
    kapat: 'Закрыть',
    reference: '+ Референс',
    remix: '+ Ремикс',
    vocal: '+ Вокал',
    sozler: 'Текст песни',
    enstrumantal: 'Инструментал',
    sozlerIpucu: 'Введите текст песни здесь или оставьте пустым для инструментала',
    optimize: '🪄 Оптимизировать',
    sozUret: '📝 Создать текст',
    stil: 'Стиль',
    stilIpucu: 'Введите стиль, настроение, инструменты и т. д.',
    gelistir: '🪄 Улучшить',
    sablonlar: '📁 Шаблоны',
    promptlarim: '🏷️ Мои промпты',
    mevcutKaydet: '➕ Сохранить текущий стиль',
    kayitliYok: 'Пока нет сохраненных промптов.',
    vokalCinsiyet: 'Пол вокала',
    kadin: 'Женский',
    erkek: 'Мужской',
    sarkiAdiIpucu: 'Введите название песни',
    aktarBtn: 'Перенести в промпт FlowMusic',
    aktarildi: '✓ Перенесено в промпт FlowMusic!',
    kopyalandi: '✓ Скопировано в буфер обмена!',
    baloncukBaslik: 'Панель FlowMusic Studio'
  },
  ar: {
    helper: 'مساعد',
    kapat: 'إغلاق',
    reference: '+ مرجع',
    remix: '+ ريمكس',
    vocal: '+ صوت',
    sozler: 'كلمات الأغنية',
    enstrumantal: 'موسيقى فقط',
    sozlerIpucu: 'أدخل كلمات الأغنية هنا أو اتركها فارغة للموسيقى',
    optimize: '🪄 تحسين',
    sozUret: '📝 توليد كلمات',
    stil: 'النمط',
    stilIpucu: 'أدخل النمط، الحالة المزاجية، الآلات، إلخ.',
    gelistir: '🪄 تحسين النمط',
    sablonlar: '📁 القوالب',
    promptlarim: '🏷️ مطالباتي',
    mevcutKaydet: '➕ حفظ النمط الحالي',
    kayitliYok: 'لا توجد مطالبات محفوظة بعد.',
    vokalCinsiyet: 'نوع الصوت',
    kadin: 'أنثى',
    erkek: 'ذكر',
    sarkiAdiIpucu: 'أدخل عنوان الأغنية',
    aktarBtn: 'نقل إلى مطالبة FlowMusic',
    aktarildi: '✓ تم النقل إلى موجه FlowMusic!',
    kopyalandi: '✓ تم النسخ إلى الحافظة!',
    baloncukBaslik: 'لوحة استوديو FlowMusic'
  },
  zh: {
    helper: '助手',
    kapat: '关闭',
    reference: '+ 参考音频',
    remix: '+ 混音重制',
    vocal: '+ 人声强化',
    sozler: '歌词',
    enstrumantal: '纯音乐',
    sozlerIpucu: '在此输入歌词，或留空以生成纯音乐',
    optimize: '🪄 优化结构',
    sozUret: '📝 生成歌词',
    stil: '音乐风格',
    stilIpucu: '输入风格、情绪、乐器等以控制生成的音乐',
    gelistir: '🪄 强化质感',
    sablonlar: '📁 预设模板',
    promptlarim: '🏷️ 我的提示词',
    mevcutKaydet: '➕ 保存当前风格',
    kayitliYok: '暂无保存的提示词。',
    vokalCinsiyet: '人声性别',
    kadin: '女性',
    erkek: '男性',
    sarkiAdiIpucu: '输入歌曲标题',
    aktarBtn: '填入 FlowMusic 提示词框',
    aktarildi: '✓ 已传输到 FlowMusic 提示词！',
    kopyalandi: '✓ 已复制到剪贴板！',
    baloncukBaslik: 'FlowMusic 创作助手'
  },
  ja: {
    helper: 'ヘルパー',
    kapat: '閉じる',
    reference: '+ 参照音源',
    remix: '+ リミックス',
    vocal: '+ ボーカル',
    sozler: '歌詞',
    enstrumantal: 'インストゥルメンタル',
    sozlerIpucu: 'ここに歌詞を入力するか、インストの場合は空白のままにします',
    optimize: '🪄 最適化',
    sozUret: '📝 歌詞を生成',
    stil: 'スタイル',
    stilIpucu: 'スタイル、ムード、楽器などを入力して音楽を制御します',
    gelistir: '🪄 品質向上',
    sablonlar: '📁 テンプレート',
    promptlarim: '🏷️ 保存したプロンプト',
    mevcutKaydet: '➕ 現在のスタイルを保存',
    kayitliYok: '保存されたプロンプトはまだありません。',
    vokalCinsiyet: 'ボーカル性別',
    kadin: '女性',
    erkek: '男性',
    sarkiAdiIpucu: '曲名を入力',
    aktarBtn: 'FlowMusic プロンプトに適用',
    aktarildi: '✓ FlowMusicプロンプトに転送完了！',
    kopyalandi: '✓ クリップボードにコピーしました！',
    baloncukBaslik: 'FlowMusic スタジオパネル'
  }
};

function flowmusicMi(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.includes('flowmusic');
  } catch {
    return false;
  }
}

function flowmusicKodu(dil = 'tr') {
  const T = DIL_METINLERI[dil] || DIL_METINLERI.en || DIL_METINLERI.tr;
  const jsonT = JSON.stringify(T);

  return `(() => {
  if (document.getElementById("fm-floating-bubble") || document.getElementById("fm-helper-panel")) return;

  const T = ${jsonT};

  const styleEl = document.createElement("style");
  styleEl.textContent = \`
    #fm-floating-bubble {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(37, 99, 235, 0.45), 0 2px 6px rgba(0, 0, 0, 0.35);
      cursor: pointer;
      z-index: 2147483647;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, background 0.2s ease;
      user-select: none;
    }
    #fm-floating-bubble:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 20px rgba(37, 99, 235, 0.6), 0 3px 8px rgba(0, 0, 0, 0.4);
    }
    #fm-floating-bubble:active {
      transform: scale(0.94);
    }
    #fm-floating-bubble svg {
      width: 26px;
      height: 26px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      pointer-events: none;
    }

    #fm-helper-panel {
      position: fixed;
      bottom: 86px;
      right: 24px;
      width: 375px;
      max-height: calc(100vh - 110px);
      background-color: #121214;
      color: #e0e0e0;
      border-radius: 14px;
      border: 1px solid #27272a;
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05);
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 2147483646;
      display: none;
      flex-direction: column;
      gap: 12px;
      overflow-y: auto;
      box-sizing: border-box;
      animation: fmPopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #fm-helper-panel.fm-open {
      display: flex;
    }
    @keyframes fmPopIn {
      from { opacity: 0; transform: translateY(12px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    #fm-helper-panel * {
      box-sizing: border-box;
    }

    .fm-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 8px;
      border-bottom: 1px solid #232327;
    }
    .fm-title-tag {
      font-size: 13.5px;
      font-weight: 700;
      color: #f4f4f5;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .fm-title-tag span {
      background: rgba(59, 130, 246, 0.16);
      color: #60a5fa;
      font-size: 10.5px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    .fm-close-btn {
      background: transparent;
      border: 0;
      color: #a1a1aa;
      cursor: pointer;
      font-size: 16px;
      padding: 2px 6px;
      border-radius: 6px;
      transition: background 0.15s, color 0.15s;
    }
    .fm-close-btn:hover {
      background: #27272a;
      color: #fafafa;
    }

    .fm-top-actions {
      display: flex;
      gap: 8px;
    }
    .fm-chip-btn {
      flex: 1;
      background: #1e1e22;
      border: 1px solid #2d2d33;
      color: #d1d5db;
      padding: 8px 10px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .fm-chip-btn:hover {
      background: #27272a;
      color: #ffffff;
      border-color: #3f3f46;
    }
    .fm-chip-btn.active {
      background: #1e3a8a;
      border-color: #3b82f6;
      color: #93c5fd;
    }

    .fm-section-card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      position: relative;
    }
    .fm-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .fm-card-title {
      font-weight: 600;
      font-size: 13px;
      color: #f4f4f5;
    }

    .fm-switch-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #a1a1aa;
    }
    .fm-switch {
      position: relative;
      display: inline-block;
      width: 32px;
      height: 18px;
    }
    .fm-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .fm-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: #3f3f46;
      transition: 0.2s;
      border-radius: 20px;
    }
    .fm-slider:before {
      position: absolute;
      content: "";
      height: 14px;
      width: 14px;
      left: 2px;
      bottom: 2px;
      background-color: white;
      transition: 0.2s;
      border-radius: 50%;
    }
    input:checked + .fm-slider {
      background-color: #3b82f6;
    }
    input:checked + .fm-slider:before {
      transform: translateX(14px);
    }

    .fm-textarea {
      width: 100%;
      height: 70px;
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 6px;
      padding: 8px 10px;
      color: #f4f4f5;
      font-family: inherit;
      font-size: 12px;
      resize: vertical;
      outline: none;
      transition: border-color 0.2s;
    }
    .fm-textarea:focus {
      border-color: #3b82f6;
    }

    .fm-input {
      width: 100%;
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 6px;
      padding: 8px 10px;
      color: #f4f4f5;
      font-family: inherit;
      font-size: 12px;
      outline: none;
      transition: border-color 0.2s;
    }
    .fm-input:focus {
      border-color: #3b82f6;
    }

    .fm-card-footer {
      display: flex;
      gap: 6px;
    }
    .fm-small-btn {
      background: #232328;
      border: 1px solid #2f2f35;
      color: #d4d4d8;
      padding: 5px 8px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .fm-small-btn:hover {
      background: #2c2c32;
      color: #ffffff;
      border-color: #3f3f46;
    }

    .fm-dropdown-menu {
      position: absolute;
      bottom: 42px;
      left: 12px;
      right: 12px;
      background: #18181b;
      border: 1px solid #3f3f46;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
      display: none;
      flex-direction: column;
      z-index: 10;
      max-height: 210px;
      overflow-y: auto;
      padding: 6px;
      gap: 4px;
    }
    .fm-dropdown-menu.show {
      display: flex;
    }
    .fm-menu-item {
      text-align: left;
      background: transparent;
      border: none;
      color: #e4e4e7;
      padding: 6px 8px;
      font-size: 11px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .fm-menu-item:hover {
      background: #27272a;
      color: #ffffff;
    }

    .fm-saved-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
    }
    .fm-saved-item:hover {
      background: #27272a;
    }
    .fm-delete-saved-btn {
      background: transparent;
      border: none;
      color: #ef4444;
      cursor: pointer;
      font-size: 11px;
    }

    .fm-gender-toggle {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 10px;
    }
    .fm-gender-options {
      display: flex;
      gap: 6px;
    }
    .fm-gender-btn {
      background: #232328;
      border: 1px solid transparent;
      color: #a1a1aa;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .fm-gender-btn.active {
      background: #3b82f6;
      color: #fff;
      border-color: #2563eb;
    }

    .fm-apply-btn {
      background: #3b82f6;
      color: #ffffff;
      border: none;
      padding: 10px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.25s, transform 0.1s, box-shadow 0.2s;
    }
    .fm-apply-btn:hover {
      background: #2563eb;
    }
    .fm-apply-btn:active {
      transform: scale(0.98);
    }
  \`;
  document.head.appendChild(styleEl);

  // 1. ŞABLONLAR & PRESETLER
  const templates = [
    {
      name: "Slow Pop Ballad (Duygusal)",
      style: "Emotional Turkish slow pop ballad with subtle arabesque influences, melancholic atmosphere, 70 BPM, minor key, emotive piano, acoustic guitar, warm bass, orchestral strings, cinematic build up."
    },
    {
      name: "Modern Trap / Drill",
      style: "Hard-hitting modern Turkish trap, 140 BPM, rolling 808 sub bass, snappy hi-hat rolls, dark ambient synth pads, aggressive flow, pitch-shifted vocal samples, modern punchy mix."
    },
    {
      name: "80s Synthwave / Retro",
      style: "1980s synthwave, nostalgic analog synthesizers, punchy gated reverb drums, driving bassline, neon night vibe, melodic hook, retro synth leads, 115 BPM."
    },
    {
      name: "Akustik / Lo-Fi",
      style: "Warm acoustic indie, fingerpicked nylon guitar, subtle upright bass, soft brushed drums, lo-fi vinyl crackle, cozy intimate late-night atmosphere, relaxed tempo."
    },
    {
      name: "Anadolu Rock / Elektro Bağlama",
      style: "Psychedelic Anatolian rock, fuzz overdrive electric guitar, microtonal synth, rhythmic electro baglama, groovy 70s drum breaks, dynamic percussion."
    }
  ];

  const lyricPresets = [
    "[Intro - Soft Piano]\\nGece sessiz, odam karanlık...\\n\\n[Verse 1]\\nPencereye vuran yağmur gibi sessizce aktın içimden,\\nAdını fısıldadım yine geçmişin soğuk nefesinden.\\n\\n[Chorus]\\nSenden kalan bir ben varım şimdi,\\nKırık dökük anılar, yarım bir hikaye gibi...\\n\\n[Bridge]\\nUnutmak kolay mı sanıyorsun?\\nHer şarkıda sen varsın.\\n\\n[Outro]\\nSessizce biten bir melodi gibi...",
    "[Intro - Heavy Bass]\\n(Yeah, başla)\\n\\n[Verse 1]\\nSokaklar soğuk ama aklım hep odakta,\\nAdım adım yürüdüm, gözüm yok hiç tuzakta.\\nHer vuruşta ritim yükselir tırnaklarımla kazdım,\\nKimse inanmazken ben geleceğimi yazdım.\\n\\n[Chorus]\\nDurmak yok, yolumuz uzun bizim,\\nHer engeli aşar bu saf enerjim!\\n\\n[Outro]\\nSon sözü beat söyler."
  ];

  // 2. YÜZEN BALONCUK (POPUP LAUNCHER)
  const bubble = document.createElement("div");
  bubble.id = "fm-floating-bubble";
  bubble.title = T.baloncukBaslik;
  bubble.innerHTML = \`
    <svg viewBox="0 0 24 24">
      <path d="M9 18V5l12-2v13"></path>
      <circle cx="6" cy="18" r="3"></circle>
      <circle cx="18" cy="16" r="3"></circle>
    </svg>
  \`;
  document.body.appendChild(bubble);

  // 3. YARDIMCI PANEL
  const panel = document.createElement("div");
  panel.id = "fm-helper-panel";
  panel.innerHTML = \`
    <div class="fm-header">
      <div class="fm-title-tag">
        FlowMusic Studio <span>${T.helper}</span>
      </div>
      <button class="fm-close-btn" id="btn-close-fm" title="${T.kapat}">✕</button>
    </div>

    <!-- Gizli Dosya Girişi -->
    <input type="file" id="fm-file-input" style="display:none;" accept="audio/*">

    <!-- Üst Aksiyonlar -->
    <div class="fm-top-actions">
      <button class="fm-chip-btn" id="btn-reference">${T.reference}</button>
      <button class="fm-chip-btn" id="btn-remix">${T.remix}</button>
      <button class="fm-chip-btn" id="btn-vocal">${T.vocal}</button>
    </div>

    <!-- Lyrics Kartı -->
    <div class="fm-section-card">
      <div class="fm-card-header">
        <span class="fm-card-title">${T.sozler}</span>
        <div class="fm-switch-wrapper">
          <span>${T.enstrumantal}</span>
          <label class="fm-switch">
            <input type="checkbox" id="fm-instrumental-toggle">
            <span class="fm-slider"></span>
          </label>
        </div>
      </div>
      <textarea id="fm-lyrics-input" class="fm-textarea" placeholder="${T.sozlerIpucu}"></textarea>
      
      <div class="fm-card-footer">
        <button class="fm-small-btn" id="btn-optimize-lyrics">${T.optimize}</button>
        <button class="fm-small-btn" id="btn-generate-lyrics">${T.sozUret}</button>
      </div>
    </div>

    <!-- Style Kartı -->
    <div class="fm-section-card">
      <span class="fm-card-title">${T.stil}</span>
      <textarea id="fm-style-input" class="fm-textarea" placeholder="${T.stilIpucu}"></textarea>
      
      <div class="fm-card-footer">
        <button class="fm-small-btn" id="btn-enhance-style">${T.gelistir}</button>
        <button class="fm-small-btn" id="btn-templates">${T.sablonlar}</button>
        <button class="fm-small-btn" id="btn-my-prompts">${T.promptlarim}</button>
      </div>

      <!-- Templates Menüsü -->
      <div id="fm-templates-menu" class="fm-dropdown-menu"></div>

      <!-- My Prompts Menüsü -->
      <div id="fm-prompts-menu" class="fm-dropdown-menu">
        <button class="fm-menu-item" id="btn-save-current-prompt" style="font-weight:600; color:#3b82f6;">${T.mevcutKaydet}</button>
        <div id="fm-saved-prompts-list"></div>
      </div>
    </div>

    <!-- Vocal Gender -->
    <div class="fm-gender-toggle">
      <span class="fm-card-title">${T.vokalCinsiyet}</span>
      <div class="fm-gender-options">
        <button class="fm-gender-btn" data-gender="Female">${T.kadin}</button>
        <button class="fm-gender-btn" data-gender="Male">${T.erkek}</button>
      </div>
    </div>

    <!-- Song Title -->
    <div class="fm-section-card">
      <div class="fm-card-header">
        <input type="text" id="fm-title-input" class="fm-input" maxlength="50" placeholder="${T.sarkiAdiIpucu}">
        <span id="fm-title-counter" style="font-size:12px; color:#71717a;">0/50</span>
      </div>
    </div>

    <button id="fm-apply-to-flow" class="fm-apply-btn">${T.aktarBtn}</button>
  \`;
  document.body.appendChild(panel);

  // 4. BALONCUKLA AÇ / KAPA MANTIĞI
  function panelGosterGizle() {
    panel.classList.toggle("fm-open");
  }

  bubble.addEventListener("click", panelGosterGizle);
  document.getElementById("btn-close-fm").addEventListener("click", () => {
    panel.classList.remove("fm-open");
  });

  // Elementler
  const lyricsInput = document.getElementById("fm-lyrics-input");
  const styleInput = document.getElementById("fm-style-input");
  const titleInput = document.getElementById("fm-title-input");
  const titleCounter = document.getElementById("fm-title-counter");
  const instToggle = document.getElementById("fm-instrumental-toggle");
  const fileInput = document.getElementById("fm-file-input");

  const templatesMenu = document.getElementById("fm-templates-menu");
  const promptsMenu = document.getElementById("fm-prompts-menu");
  const savedPromptsList = document.getElementById("fm-saved-prompts-list");

  // Sayfada son odaklanılan girdi alanını takip et
  let sonSayfaGirdisi = null;
  document.addEventListener("focusin", (e) => {
    const t = e.target;
    if (!t) return;
    if (t.closest && (t.closest("#fm-helper-panel") || t.closest("#fm-floating-bubble"))) return;
    if (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable || (t.getAttribute && (t.getAttribute("contenteditable") === "true" || t.getAttribute("role") === "textbox"))) {
      sonSayfaGirdisi = t;
    }
  }, true);

  // Reference dosya seçimi
  document.getElementById("btn-reference").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      const fileName = e.target.files[0].name;
      if (!styleInput.value.includes("[Reference:")) {
        styleInput.value = \`[Reference: \${fileName}] \` + styleInput.value;
      }
    }
  });

  // Remix düğmesi
  document.getElementById("btn-remix").addEventListener("click", function () {
    this.classList.toggle("active");
    const tag = "remix arrangement, modern reimagining, alternate production";
    if (this.classList.contains("active")) {
      if (!styleInput.value.includes(tag)) {
        styleInput.value = styleInput.value ? \`\${styleInput.value}, \${tag}\` : tag;
      }
    } else {
      styleInput.value = styleInput.value.replace(\`, \${tag}\`, "").replace(tag, "").trim();
    }
  });

  // Vocal düğmesi
  document.getElementById("btn-vocal").addEventListener("click", function () {
    this.classList.toggle("active");
    const tag = "clean lead vocals, clear vocal presence, center mixed vocals";
    if (this.classList.contains("active")) {
      if (!styleInput.value.includes(tag)) {
        styleInput.value = styleInput.value ? \`\${styleInput.value}, \${tag}\` : tag;
      }
    } else {
      styleInput.value = styleInput.value.replace(\`, \${tag}\`, "").replace(tag, "").trim();
    }
  });

  // Optimize Lyrics
  document.getElementById("btn-optimize-lyrics").addEventListener("click", () => {
    let text = lyricsInput.value.trim();
    if (!text) return;
    if (!text.includes("[Verse") && !text.includes("[Chorus")) {
      const paragraphs = text.split(/\\n\\s*\\n/);
      if (paragraphs.length >= 2) {
        text = \`[Verse 1]\\n\${paragraphs[0]}\\n\\n[Chorus]\\n\${paragraphs[1]}\`;
        if (paragraphs[2]) text += \`\\n\\n[Verse 2]\\n\${paragraphs[2]}\`;
        if (paragraphs[3]) text += \`\\n\\n[Outro]\\n\${paragraphs[3]}\`;
      } else {
        text = \`[Verse]\\n\${text}\\n\\n[Chorus]\\n...\`;
      }
      lyricsInput.value = text;
    }
  });

  // Generate Lyrics
  let lyricIdx = 0;
  document.getElementById("btn-generate-lyrics").addEventListener("click", () => {
    lyricsInput.value = lyricPresets[lyricIdx % lyricPresets.length];
    lyricIdx++;
  });

  // Enhance Style
  document.getElementById("btn-enhance-style").addEventListener("click", () => {
    const enhancements = "studio quality production, wide stereo imaging, polished mastering, warm analog tone, dynamic mix";
    if (!styleInput.value.includes("studio quality")) {
      styleInput.value = styleInput.value ? \`\${styleInput.value}, \${enhancements}\` : enhancements;
    }
  });

  // Templates menüsü
  templatesMenu.innerHTML = templates
    .map((t, i) => \`<button class="fm-menu-item" data-template-index="\${i}"><b>\${t.name}</b></button>\`)
    .join("");

  document.getElementById("btn-templates").addEventListener("click", () => {
    promptsMenu.classList.remove("show");
    templatesMenu.classList.toggle("show");
  });

  templatesMenu.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-template-index]");
    if (btn) {
      const idx = btn.dataset.templateIndex;
      styleInput.value = templates[idx].style;
      templatesMenu.classList.remove("show");
    }
  });

  // My Prompts
  function renderSavedPrompts() {
    const saved = JSON.parse(localStorage.getItem("fm_saved_prompts") || "[]");
    if (saved.length === 0) {
      savedPromptsList.innerHTML = \`<div style="font-size:11px; color:#71717a; padding:6px;">${T.kayitliYok}</div>\`;
      return;
    }
    savedPromptsList.innerHTML = saved
      .map((item, index) => \`
        <div class="fm-saved-item">
          <span style="cursor:pointer; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" data-load-idx="\${index}">
            \${item.title || item.style.substring(0, 22) + "..."}
          </span>
          <button class="fm-delete-saved-btn" data-del-idx="\${index}">✕</button>
        </div>
      \`)
      .join("");
  }

  document.getElementById("btn-my-prompts").addEventListener("click", () => {
    templatesMenu.classList.remove("show");
    renderSavedPrompts();
    promptsMenu.classList.toggle("show");
  });

  document.getElementById("btn-save-current-prompt").addEventListener("click", () => {
    const currentStyle = styleInput.value.trim();
    const currentTitle = titleInput.value.trim();
    if (!currentStyle) return;
    const saved = JSON.parse(localStorage.getItem("fm_saved_prompts") || "[]");
    saved.unshift({ title: currentTitle || "Prompt", style: currentStyle });
    localStorage.setItem("fm_saved_prompts", JSON.stringify(saved.slice(0, 10)));
    renderSavedPrompts();
  });

  promptsMenu.addEventListener("click", (e) => {
    if (e.target.dataset.loadIdx !== undefined) {
      const idx = e.target.dataset.loadIdx;
      const saved = JSON.parse(localStorage.getItem("fm_saved_prompts") || "[]");
      if (saved[idx]) {
        styleInput.value = saved[idx].style;
        promptsMenu.classList.remove("show");
      }
    } else if (e.target.dataset.delIdx !== undefined) {
      const idx = e.target.dataset.delIdx;
      let saved = JSON.parse(localStorage.getItem("fm_saved_prompts") || "[]");
      saved.splice(idx, 1);
      localStorage.setItem("fm_saved_prompts", JSON.stringify(saved));
      renderSavedPrompts();
    }
  });

  // Dışarı tıklayınca menüleri kapat
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#btn-templates") && !e.target.closest("#fm-templates-menu")) {
      templatesMenu.classList.remove("show");
    }
    if (!e.target.closest("#btn-my-prompts") && !e.target.closest("#fm-prompts-menu")) {
      promptsMenu.classList.remove("show");
    }
  });

  // Karakter sayacı
  titleInput.addEventListener("input", (e) => {
    titleCounter.textContent = \`\${e.target.value.length}/50\`;
  });

  // Cinsiyet seçimi
  let selectedGender = "";
  const genderBtns = document.querySelectorAll(".fm-gender-btn");
  genderBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      genderBtns.forEach((b) => b.classList.remove("active"));
      if (selectedGender === btn.dataset.gender) {
        selectedGender = "";
      } else {
        btn.classList.add("active");
        selectedGender = btn.dataset.gender;
      }
    });
  });

  // Instrumental toggle
  instToggle.addEventListener("change", (e) => {
    lyricsInput.disabled = e.target.checked;
    lyricsInput.style.opacity = e.target.checked ? "0.3" : "1";
  });

  // Panoya güvenli kopyalama
  function panoyaKopyala(metin) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(metin).catch(() => panoyaYedekKopyala(metin));
      } else {
        panoyaYedekKopyala(metin);
      }
    } catch (_) {
      panoyaYedekKopyala(metin);
    }
  }

  function panoyaYedekKopyala(metin) {
    try {
      const t = document.createElement("textarea");
      t.value = metin;
      t.style.position = "fixed";
      t.style.top = "-9999px";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.focus();
      t.select();
      document.execCommand("copy");
      t.remove();
    } catch (_) {}
  }

  // React, Vue ve modern web formları için yerel değer atama
  function elemanaDegerYaz(el, deger) {
    if (!el) return false;
    try {
      el.focus();
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, "value");
        if (desc && desc.set) {
          desc.set.call(el, deger);
        } else {
          el.value = deger;
        }
        el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
        try {
          el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, data: deger, inputType: "insertText" }));
        } catch (_) {}
      } else if (el.isContentEditable || (el.getAttribute && (el.getAttribute("contenteditable") === "true" || el.getAttribute("role") === "textbox"))) {
        try {
          document.execCommand("selectAll", false, null);
          document.execCommand("insertText", false, deger);
        } catch (_) {
          el.innerText = deger;
          el.textContent = deger;
        }
        el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        try {
          el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, data: deger, inputType: "insertText" }));
        } catch (_) {}
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Sayfadaki FlowMusic girdi alanlarını tara (yardımcı paneli hariç tutar)
  function sayfaGirdileriniTopla(kok) {
    const sonuclar = [];
    if (!kok) return sonuclar;
    try {
      const adaylar = kok.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"], input[type="text"], input:not([type])');
      for (let i = 0; i < adaylar.length; i++) {
        const el = adaylar[i];
        if (el.closest && (el.closest("#fm-helper-panel") || el.closest("#fm-floating-bubble"))) continue;
        sonuclar.push(el);
      }
    } catch (_) {}
    try {
      const tumu = kok.querySelectorAll("*");
      for (let i = 0; i < tumu.length; i++) {
        if (tumu[i].shadowRoot) {
          sonuclar.push(...sayfaGirdileriniTopla(tumu[i].shadowRoot));
        }
        if (tumu[i].tagName === "IFRAME") {
          try {
            if (tumu[i].contentDocument) sonuclar.push(...sayfaGirdileriniTopla(tumu[i].contentDocument));
          } catch (_) {}
        }
      }
    } catch (_) {}
    return sonuclar;
  }

  function gorunurMu(el) {
    if (!el || !el.isConnected) return false;
    try {
      const st = window.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
      const r = el.getBoundingClientRect();
      return (r.width > 0 && r.height > 0) || el === sonSayfaGirdisi;
    } catch (_) {
      return true;
    }
  }

  // FlowMusic promptuna aktar
  document.getElementById("fm-apply-to-flow").addEventListener("click", () => {
    const isInstrumental = instToggle.checked;
    const lyrics = lyricsInput.value.trim();
    const style = styleInput.value.trim();
    const title = titleInput.value.trim();

    const promptParts = [];
    if (title) promptParts.push(\`[Title: \${title}]\`);
    if (style) promptParts.push(\`[Style: \${style}]\`);
    if (selectedGender && !isInstrumental) promptParts.push(\`[Vocal: \${selectedGender}]\`);
    if (isInstrumental) {
      promptParts.push("[Instrumental]");
    } else if (lyrics) {
      promptParts.push(\`\\n[Lyrics]:\\n\${lyrics}\`);
    }

    const compiledPrompt = promptParts.join(" ").trim();
    if (!compiledPrompt) return;

    // 1. Her zaman panoya da kopyala (güvenlik ağı)
    panoyaKopyala(compiledPrompt);

    // 2. Sayfadaki giriş alanlarını bul
    const sayfaGirdileri = sayfaGirdileriniTopla(document).filter(gorunurMu);

    let sozlerAlani = null;
    let stilAlani = null;
    let baslikAlani = null;
    let genelPromptAlani = null;

    for (const el of sayfaGirdileri) {
      const txt = ((el.placeholder || "") + " " + (el.name || "") + " " + (el.id || "") + " " + (el.className || "") + " " + (el.getAttribute("aria-label") || "")).toLowerCase();
      if (!sozlerAlani && (txt.includes("lyric") || txt.includes("söz") || txt.includes("paroles") || txt.includes("letras"))) {
        sozlerAlani = el;
      } else if (!stilAlani && (txt.includes("style") || txt.includes("genre") || txt.includes("tag") || txt.includes("stil") || txt.includes("tarz") || txt.includes("mood"))) {
        stilAlani = el;
      } else if (!baslikAlani && (txt.includes("title") || txt.includes("başlık") || txt.includes("track") || txt.includes("song name") || txt.includes("título") || txt.includes("titre"))) {
        baslikAlani = el;
      } else if (!genelPromptAlani && (txt.includes("prompt") || txt.includes("describe") || txt.includes("music") || txt.includes("şarkı") || txt.includes("enter") || txt.includes("create"))) {
        genelPromptAlani = el;
      }
    }

    let aktarildi = false;

    // Durum 1: Sayfada Özel Mod (Ayrı Söz / Stil kutuları varsa)
    if (sozlerAlani || stilAlani) {
      if (stilAlani) {
        let stilDegeri = style;
        if (selectedGender && !isInstrumental) stilDegeri = stilDegeri ? \`\${stilDegeri}, [Vocal: \${selectedGender}]\` : \`[Vocal: \${selectedGender}]\`;
        if (isInstrumental) stilDegeri = stilDegeri ? \`\${stilDegeri}, [Instrumental]\` : \`[Instrumental]\`;
        if (stilDegeri) {
          elemanaDegerYaz(stilAlani, stilDegeri);
          aktarildi = true;
        }
      }
      if (sozlerAlani) {
        const sozDegeri = isInstrumental ? "[Instrumental]" : lyrics;
        if (sozDegeri) {
          elemanaDegerYaz(sozlerAlani, sozDegeri);
          aktarildi = true;
        }
      }
      if (baslikAlani && title) {
        elemanaDegerYaz(baslikAlani, title);
        aktarildi = true;
      }
    }

    // Durum 2: Genel Prompt Kutusu (veya en uygun sayfa alanı)
    if (!aktarildi) {
      const hedef = genelPromptAlani ||
        (sonSayfaGirdisi && gorunurMu(sonSayfaGirdisi) ? sonSayfaGirdisi : null) ||
        sayfaGirdileri.find(e => e.tagName === "TEXTAREA") ||
        sayfaGirdileri.find(e => e.isContentEditable || (e.getAttribute && e.getAttribute("contenteditable") === "true")) ||
        sayfaGirdileri[0];

      if (hedef) {
        aktarildi = elemanaDegerYaz(hedef, compiledPrompt);
      }
    }

    // Buton üzerinde görsel geri bildirim
    const applyBtn = document.getElementById("fm-apply-to-flow");
    applyBtn.textContent = aktarildi ? T.aktarildi : T.kopyalandi;
    applyBtn.style.backgroundColor = aktarildi ? "#10b981" : "#f59e0b";
    setTimeout(() => {
      applyBtn.textContent = T.aktarBtn;
      applyBtn.style.backgroundColor = "";
    }, 2200);
  });
})();`;
}

module.exports = {
  flowmusicMi,
  flowmusicKodu,
  DIL_METINLERI
};
