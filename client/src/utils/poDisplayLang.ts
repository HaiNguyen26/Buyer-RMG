/** Ngôn ngữ hiển thị / PDF — Buyer PO (chi tiết + xuất file). */
export type PoDisplayLang = 'vi' | 'en';

export const PO_DISPLAY_LANG_STORAGE_KEY = 'buyer-po-display-lang';

export function getStoredPoDisplayLang(): PoDisplayLang {
  try {
    const v = localStorage.getItem(PO_DISPLAY_LANG_STORAGE_KEY);
    if (v === 'en' || v === 'vi') return v;
  } catch {
    /* ignore */
  }
  return 'vi';
}

export function setStoredPoDisplayLang(lang: PoDisplayLang): void {
  try {
    localStorage.setItem(PO_DISPLAY_LANG_STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}
