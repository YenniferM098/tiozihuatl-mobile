/** Se reserva la altura exacta antes de renderizar: el scroll no cambia al cargar canvas. */
export interface PdfPageSlot { number: number; top: number; height: number; }
export const PDF_PAGE_GAP = 12;
export function layoutPdfPages(ratios: readonly number[], width: number): PdfPageSlot[] {
  let top = 0;
  return ratios.map((ratio, index) => {
    const height = width * ratio;
    const slot = { number: index + 1, top, height };
    top += height + PDF_PAGE_GAP;
    return slot;
  });
}
export function pageAtOffset(slots: readonly PdfPageSlot[], offset: number): number {
  let low = 0, high = slots.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (slots[mid].top <= offset) low = mid; else high = mid - 1;
  }
  return Math.max(0, low);
}
export function visiblePdfWindow(slots: readonly PdfPageSlot[], top: number, height: number): { current: number; pages: number[] } {
  if (!slots.length) return { current: 1, pages: [] };
  const first = pageAtOffset(slots, top);
  const last = pageAtOffset(slots, top + height);
  const current = slots[pageAtOffset(slots, top + height * 0.25)].number;
  const pages = slots.slice(Math.max(0, first - 1), Math.min(slots.length, last + 2)).map(slot => slot.number);
  return { current, pages };
}
