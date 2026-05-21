/**
 * Ghi chú RFQ có thể chứa block nội bộ [RFQ_ITEMS]{"itemIds":[...]}[/RFQ_ITEMS].
 * Chỉ dùng cho backend; không hiển thị block này cho user.
 */

const RFQ_ITEMS_REGEX = /\[RFQ_ITEMS\][\s\S]*?\[\/RFQ_ITEMS\]/g;

/** Loại bỏ block [RFQ_ITEMS]...[/RFQ_ITEMS] khỏi chuỗi, trả về phần ghi chú hiển thị được. */
export function stripRfqItemsTag(notes: string | null | undefined): string {
  if (notes == null || notes === '') return '';
  const stripped = notes.replace(RFQ_ITEMS_REGEX, '').replace(/\n\n\n+/g, '\n\n').trim();
  return stripped;
}

/** Lấy lại block [RFQ_ITEMS]...[/RFQ_ITEMS] từ notes (để giữ khi cập nhật ghi chú). */
export function extractRfqItemsBlock(notes: string | null | undefined): string | null {
  if (notes == null || notes === '') return null;
  const match = notes.match(/\[RFQ_ITEMS\][\s\S]*?\[\/RFQ_ITEMS\]/);
  return match ? match[0] : null;
}
