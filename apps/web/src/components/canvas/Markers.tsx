export type Marker = { id: string; latitude: number; longitude: number };

export function Markers({ markers }: { markers: Marker[] }) {
  return <>{markers.map((marker) => <span key={marker.id} data-marker={marker.id} />)}</>;
}
