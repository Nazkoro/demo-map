import { useEffect } from 'react';

interface Props {
  message: string;
  type: 'info' | 'success' | 'error';
  onDone: () => void;
}

export default function StatusToast({ message, type, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <div className={`status ${type}`} style={{ display: 'block' }}>
      {message}
    </div>
  );
}
