export function FXWidget({ pair = 'USD/EUR' }: { pair?: string }) {
  return <section aria-label="Foreign exchange quote">{pair}</section>;
}
