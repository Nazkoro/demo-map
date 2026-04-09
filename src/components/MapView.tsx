import { useRef } from 'react';

interface Props {
  containerRef: React.RefObject<HTMLDivElement>;
}

export default function MapView({ containerRef }: Props) {
  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
    />
  );
}
