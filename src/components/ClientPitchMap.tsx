import React, { lazy, Suspense, useEffect, useState } from "react";

type PitchLike = { id: string; name: string; latitude: number; longitude: number };

// Lazy-load to avoid SSR (leaflet uses `window`)
const InnerMap = lazy(() => import("./PitchMap").then((m) => ({ default: m.PitchMap })));

export function ClientPitchMap<T extends PitchLike>(props: {
  pitches: T[];
  onSelect: (p: T) => void;
  selectedId?: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="grid h-full w-full place-items-center bg-muted text-sm text-muted-foreground">…</div>;
  }
  const Map = InnerMap as unknown as (p: typeof props) => React.ReactElement;
  return (
    <Suspense fallback={<div className="grid h-full w-full place-items-center bg-muted text-sm text-muted-foreground">…</div>}>
      <Map {...props} />
    </Suspense>
  );
}
