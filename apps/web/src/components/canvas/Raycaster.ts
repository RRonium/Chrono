export type ScreenPoint = { x: number; y: number };

export function getCanvasPoint(event: PointerEvent, element: HTMLElement): ScreenPoint {
  const bounds = element.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}
