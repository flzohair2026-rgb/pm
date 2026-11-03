'use client';

import { useEffect, useState } from 'react';

// Only this small component updates while the alerts are open. The booking
// page and its financial tables do not need to rerender for a rotating hint.
export default function BookingHelpHint({ hints }: { hints: string[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (hints.length <= 1) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % hints.length), 2400);
    return () => window.clearInterval(timer);
  }, [hints.length]);
  return <>{hints[index % hints.length] || 'دليل سريع'}</>;
}
