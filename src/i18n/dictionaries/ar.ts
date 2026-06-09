/**
 * Arabic dictionary (right-to-left). Typed `: Dictionary`, so the compiler
 * enforces exact key parity with the English source ({@link ./en}).
 * Brand/technical terms (OpenTelemetry, Next.js, WebAssembly, jsPDF, marked,
 * turndown, pdfjs-dist, PNG/HTML/PDF/GIF…) are kept in their original form.
 */
import type { Dictionary } from "./en";

/** ملاحظة الفيديو → gif، مشتركة بين جميع صيغ مصدر الفيديو. */
const GIF_NOTE: string = "‏GIF متحرك؛ اضبط fps والعرض لموازنة الحجم والسلاسة.";

export const ar: Dictionary = {
  app: {
    title: "openConv — محوّل ملفات خاص يعمل داخل المتصفح",
    description:
      "محوّل ملفات مفتوح المصدر يعمل بالكامل داخل متصفحك. الصور والبيانات والمستندات والصوت والفيديو — ملفاتك لا تغادر جهازك أبدًا.",
  },
  header: {
    github: "GitHub",
  },
  hero: {
    title: "حوّل ملفاتك دون مغادرة متصفحك.",
    description:
      "‏openConv محوّل ملفات مفتوح المصدر يعمل بالكامل من جهة العميل. أفلِت ملفًا، واختر الصيغة الهدف، ثم نزِّل — بياناتك لا تمسّ أي خادم.",
    privacy: "خاص بحكم البنية — لا رفع، ولا تتبّع لملفاتك.",
  },
  features: {
    clientSide: {
      title: "‏100% داخل المتصفح",
      body: "تُفكّ الملفات وتُحوّل ويُعاد ترميزها داخل متصفحك. لا يُرفع أي شيء — إطلاقًا.",
    },
    families: {
      title: "خمس عائلات وسائط",
      body: "الصور والبيانات المنظّمة والمستندات والصوت والفيديو، كلها من مكان واحد.",
    },
    observable: {
      title: "قابل للمراقبة بحكم التصميم",
      body: "كل عملية تحويل تُتتبَّع وتُسجَّل عبر OpenTelemetry، مع معرّف تتبّع (trace id).",
    },
  },
  footer: {
    text: "openConv · مرخّص بموجب MIT · مبني باستخدام Next.js وWebAssembly. تعمل التحويلات محليًا على جهازك.",
  },
  dropzone: {
    idle: "اسحب الملفات وأفلِتها، أو انقر للتصفّح",
    active: "أفلِت ملفاتك",
    hint: "الصور والبيانات والمستندات والصوت والفيديو — تُحوَّل مباشرةً داخل متصفحك.",
    aria: "إضافة ملفات للتحويل",
  },
  workspace: {
    fileOne: "{count} ملف",
    fileMany: "{count} ملفات",
    clearFinished: "مسح المكتملة",
    convertAll: "تحويل الكل",
  },
  formatSelect: {
    none: "لا تتوفّر تحويلات",
  },
  kinds: {
    image: "صور",
    data: "بيانات",
    document: "مستندات",
    audio: "صوت",
    video: "فيديو",
  },
  job: {
    unknownFormat: "صيغة غير معروفة",
    unsupported: "لا يتوفّر تحويل داخل المتصفح لهذا النوع من الملفات.",
    remove: "إزالة",
    download: "تنزيل",
    cancel: "إلغاء",
    convert: "تحويل",
    converting: "جارٍ التحويل…",
    doneIn: "اكتمل في {ms} مللي ثانية",
    trace: "تتبّع",
    canceled: "أُلغي.",
  },
  options: {
    quality: "الجودة",
    background: "الخلفية (تسطيح الشفافية)",
    indent: "المسافة البادئة",
    header: "تضمين صف العناوين",
    pageSize: "حجم الصفحة",
    margin: "الهامش",
    audioBitrate: "معدل بِت الصوت",
    fps: "إطارات في الثانية",
    width: "العرض",
  },
  units: {
    spaces: "مسافات",
  },
  choices: {
    "#ffffff": "أبيض",
    "#000000": "أسود",
    "#808080": "رمادي",
  },
  notes: {
    markdown_html: "يحوّل Markdown إلى مستند HTML مستقل عبر marked.",
    html_markdown: "يحوّل HTML إلى Markdown عبر turndown.",
    markdown_txt: "يجرّد تنسيق Markdown إلى نص عادي قابل للقراءة.",
    html_txt: "يستخرج نصًا عاديًا قابلًا للقراءة من HTML.",
    txt_html: "يلفّ فقرات النص العادي في HTML مهرَّب.",
    txt_markdown: "يعامل النص العادي كـ Markdown، مع تهريب العلامات الشاردة.",
    html_pdf: "يحوّل HTML إلى PDF داخل المتصفح عبر jsPDF.",
    markdown_pdf: "يحوّل Markdown (عبر HTML) إلى PDF داخل المتصفح عبر jsPDF.",
    pdf_txt: "يستخرج طبقة النص من ملف PDF عبر pdfjs-dist.",
    mp4_gif: GIF_NOTE,
    webm_gif: GIF_NOTE,
    mov_gif: GIF_NOTE,
    mkv_gif: GIF_NOTE,
    avi_gif: GIF_NOTE,
  },
  errors: {
    UNSUPPORTED_CONVERSION: "هذا التحويل غير مدعوم.",
    CONVERSION_FAILED: "فشل التحويل. جرّب ملفًا أو صيغة مختلفة.",
    CONVERSION_CANCELED: "أُلغي التحويل.",
    INVALID_INPUT: "تعذّرت قراءة الملف أو أنه تالف.",
    FORMAT_DETECTION_FAILED: "تعذّر تحديد صيغة هذا الملف.",
  },
  locale: {
    label: "اللغة",
  },
};
