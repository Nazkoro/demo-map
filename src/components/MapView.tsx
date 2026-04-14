interface Props {
  containerRef: React.RefObject<HTMLDivElement>;
}

export default function MapView({ containerRef }: Props) {
  return <div ref={containerRef} className="map-canvas" />;
}
