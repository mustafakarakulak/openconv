/**
 * Turkish dictionary. Typed `: Dictionary`, so the compiler enforces exact key
 * parity with the English source ({@link ./en}). Brand/technical terms
 * (OpenTelemetry, Next.js, WebAssembly, jsPDF, marked, turndown, pdfjs-dist,
 * PNG/HTML/PDF…) are intentionally kept in their original form.
 */
import type { Dictionary } from "./en";

/** video → gif notu; tüm video kaynak biçimleri için ortak. */
const GIF_NOTE: string =
  "Hareketli GIF; boyut ve akıcılık dengesi için fps ve genişliği ayarlayın.";

export const tr: Dictionary = {
  app: {
    title: "openConv — gizli, tarayıcıda çalışan dosya dönüştürücü",
    description:
      "Tamamen tarayıcınızda çalışan açık kaynaklı dosya dönüştürücü. Görseller, veri, belgeler, ses ve video — dosyalarınız cihazınızdan asla çıkmaz.",
  },
  header: {
    github: "GitHub",
  },
  hero: {
    title: "Dosyaları tarayıcınızdan çıkmadan dönüştürün.",
    description:
      "openConv, açık kaynaklı ve tamamen tarayıcıda çalışan bir dosya dönüştürücüdür. Bir dosya bırakın, hedef biçimi seçin ve indirin — verileriniz hiçbir sunucuya dokunmaz.",
    privacy: "Mimari olarak gizli — yükleme yok, dosyalarınız izlenmez.",
  },
  features: {
    clientSide: {
      title: "%100 tarayıcıda",
      body: "Dosyalar tarayıcınızda çözülür, dönüştürülür ve yeniden kodlanır. Hiçbir şey yüklenmez — asla.",
    },
    families: {
      title: "Beş medya ailesi",
      body: "Görseller, yapılandırılmış veri, belgeler, ses ve video — hepsi tek yerden.",
    },
    observable: {
      title: "Tasarımdan gözlemlenebilir",
      body: "Her dönüşüm OpenTelemetry ile izlenir ve günlüklenir, üstelik bir trace id ile birlikte.",
    },
  },
  footer: {
    text: "openConv · MIT lisanslı · Next.js & WebAssembly ile geliştirildi. Dönüşümler cihazınızda yerel olarak çalışır.",
  },
  dropzone: {
    idle: "Dosyaları sürükleyip bırakın veya göz atmak için tıklayın",
    active: "Dosyalarınızı bırakın",
    hint: "Görseller, veri, belgeler, ses ve video — doğrudan tarayıcınızda dönüştürülür.",
    aria: "Dönüştürülecek dosya ekle",
  },
  workspace: {
    fileOne: "{count} dosya",
    fileMany: "{count} dosya",
    clearFinished: "Bitenleri temizle",
    convertAll: "Tümünü dönüştür",
  },
  formatSelect: {
    none: "Dönüşüm yok",
  },
  kinds: {
    image: "Görseller",
    data: "Veri",
    document: "Belgeler",
    audio: "Ses",
    video: "Video",
  },
  job: {
    unknownFormat: "Bilinmeyen biçim",
    unsupported: "Bu dosya türü için tarayıcıda çalışan bir dönüşüm yok.",
    remove: "Kaldır",
    download: "İndir",
    cancel: "İptal",
    convert: "Dönüştür",
    converting: "Dönüştürülüyor…",
    doneIn: "{ms} ms'de tamamlandı",
    trace: "iz",
    canceled: "İptal edildi.",
  },
  options: {
    quality: "Kalite",
    background: "Arka plan (saydamlığı düzleştir)",
    indent: "Girinti",
    header: "Başlık satırını dahil et",
    pageSize: "Sayfa boyutu",
    margin: "Kenar boşluğu",
    audioBitrate: "Ses bit hızı",
    fps: "Saniyedeki kare",
    width: "Genişlik",
  },
  units: {
    spaces: "boşluk",
  },
  choices: {
    "#ffffff": "Beyaz",
    "#000000": "Siyah",
    "#808080": "Gri",
  },
  notes: {
    markdown_html: "Markdown'ı marked ile bağımsız bir HTML belgesine dönüştürür.",
    html_markdown: "HTML'i turndown ile Markdown'a dönüştürür.",
    markdown_txt: "Markdown biçimlendirmesini okunabilir düz metne indirger.",
    html_txt: "HTML'den okunabilir düz metin çıkarır.",
    txt_html: "Düz metin paragraflarını kaçışlı HTML içine sarar.",
    txt_markdown: "Düz metni Markdown olarak ele alır, başıboş işaretlemeyi kaçışlar.",
    html_pdf: "HTML'i tarayıcıda jsPDF ile PDF'e dönüştürür.",
    markdown_pdf: "Markdown'ı (HTML üzerinden) tarayıcıda jsPDF ile PDF'e dönüştürür.",
    pdf_txt: "Bir PDF'in metin katmanını pdfjs-dist ile çıkarır.",
    mp4_gif: GIF_NOTE,
    webm_gif: GIF_NOTE,
    mov_gif: GIF_NOTE,
    mkv_gif: GIF_NOTE,
    avi_gif: GIF_NOTE,
  },
  errors: {
    UNSUPPORTED_CONVERSION: "Bu dönüşüm desteklenmiyor.",
    CONVERSION_FAILED: "Dönüşüm başarısız oldu. Farklı bir dosya veya biçim deneyin.",
    CONVERSION_CANCELED: "Dönüşüm iptal edildi.",
    INVALID_INPUT: "Dosya okunamadı veya bozuk.",
    INPUT_TOO_LARGE: "Bu dosya tarayıcıda dönüştürülemeyecek kadar büyük.",
    FORMAT_DETECTION_FAILED: "Bu dosyanın biçimi belirlenemedi.",
  },
  locale: {
    label: "Dil",
  },
};
