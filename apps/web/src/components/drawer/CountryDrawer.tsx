export function CountryDrawer({ country }: { country?: string }) {
  return <aside aria-label="Country details">{country ?? 'Select a country'}</aside>;
}
