"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AnimatedStatValueProps = {
  value: string;
};

type ParsedStat = {
  prefix: string;
  number: number;
  suffix: string;
  decimals: number;
};

const numberPattern = /(\d[\d,]*(?:\.\d+)?)/;

function parseStat(value: string): ParsedStat {
  const match = value.match(numberPattern);

  if (!match || match.index === undefined) {
    return { prefix: "", number: 0, suffix: value, decimals: 0 };
  }

  const rawNumber = match[0];
  const decimals = rawNumber.includes(".") ? rawNumber.split(".")[1].length : 0;

  return {
    prefix: value.slice(0, match.index),
    number: Number(rawNumber.replaceAll(",", "")),
    suffix: value.slice(match.index + rawNumber.length),
    decimals,
  };
}

function formatStat({ prefix, suffix, decimals }: ParsedStat, value: number) {
  const rounded = Number(value.toFixed(decimals));
  const formatted = rounded.toLocaleString("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });

  return `${prefix}${formatted}${suffix}`;
}

export function AnimatedStatValue({ value }: AnimatedStatValueProps) {
  const parsed = useMemo(() => parseStat(value), [value]);
  const [displayValue, setDisplayValue] = useState(() => formatStat(parsed, 0));
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let frame = 0;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      frame = requestAnimationFrame(() => setDisplayValue(value));
      return () => cancelAnimationFrame(frame);
    }

    let started = false;
    const duration = 1200;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || started) return;
        started = true;

        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);

          setDisplayValue(formatStat(parsed, parsed.number * eased));

          if (progress < 1) {
            frame = requestAnimationFrame(tick);
          }
        };

        frame = requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [parsed, value]);

  return <span ref={ref}>{displayValue}</span>;
}
