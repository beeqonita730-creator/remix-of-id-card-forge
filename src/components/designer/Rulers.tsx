interface RulerProps {
  widthMm: number;
  heightMm: number;
  scale: number;
  show?: boolean;
  children: React.ReactNode;
}

const THICK = 18;

function ticks(lengthMm: number) {
  const out: number[] = [];
  for (let mm = 0; mm <= Math.floor(lengthMm); mm += 1) out.push(mm);
  return out;
}

/** mm rulers that follow the canvas dimensions, so they flip with orientation. */
export function Rulers({ widthMm, heightMm, scale, show = true, children }: RulerProps) {
  const step = scale < 3 ? 10 : 5;
  if (!show) return <>{children}</>;
  return (
    <div className="inline-block">
      <div className="flex">
        <div style={{ width: THICK, height: THICK }} className="shrink-0 rounded-tl bg-muted" />
        <div
          className="relative shrink-0 overflow-hidden bg-muted"
          style={{ width: widthMm * scale, height: THICK }}
        >
          {ticks(widthMm).map((mm) => {
            const major = mm % step === 0;
            return (
              <div
                key={`h${mm}`}
                className="absolute bottom-0 bg-border"
                style={{ left: mm * scale, width: 1, height: major ? 8 : 4 }}
              >
                {major ? (
                  <span className="absolute -top-[11px] left-[2px] text-[8px] leading-none text-muted-foreground">
                    {mm}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex">
        <div
          className="relative shrink-0 overflow-hidden bg-muted"
          style={{ width: THICK, height: heightMm * scale }}
        >
          {ticks(heightMm).map((mm) => {
            const major = mm % step === 0;
            return (
              <div
                key={`v${mm}`}
                className="absolute right-0 bg-border"
                style={{ top: mm * scale, height: 1, width: major ? 8 : 4 }}
              >
                {major ? (
                  <span className="absolute left-[1px] top-[1px] text-[8px] leading-none text-muted-foreground">
                    {mm}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        {children}
      </div>
    </div>
  );
}
