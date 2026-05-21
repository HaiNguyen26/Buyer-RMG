import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const API_ORIGIN_FOR_ATTACHMENTS = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return 'http://localhost:5000';
  }
})();

export function toAbsoluteAttachmentHref(fileUrl: string): string {
  const v = fileUrl.trim();
  if (!v) return '';
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith('/api/')) return `${API_ORIGIN_FOR_ATTACHMENTS}${v}`;
  return v;
}

/** Mở URL API (Bearer) bằng blob — tránh mất token khi mở tab mới. */
export async function openAttachmentWithAuth(
  href: string,
  onError: (msg: string) => void,
  fallbackLabel?: string,
): Promise<void> {
  try {
    const rawToken = localStorage.getItem('token');
    const token = rawToken ? rawToken.trim().replace(/^"(.*)"$/, '$1') : '';
    if (!token) {
      onError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }
    const res = await axios.get(href, {
      responseType: 'blob',
      headers: { Authorization: `Bearer ${token}` },
    });
    const blobUrl = URL.createObjectURL(res.data);
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch {
    onError(`Không mở được tài liệu${fallbackLabel ? `: ${fallbackLabel}` : ''}`);
  }
}

export function extractHttpUrls(input?: string | null): string[] {
  if (!input) return [];
  const matches = input.match(/https?:\/\/[^\s|)]+/gi);
  if (!matches?.length) return [];
  return matches.map((u) => u.replace(/[.,;]+$/g, '').trim()).filter(Boolean);
}
