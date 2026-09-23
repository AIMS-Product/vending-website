"use client";

import { useState } from "react";
import Image from "next/image";

// "A member talks on camera", one treatment site-wide: the poster still, a
// play badge bottom-left (never over the face), and the video only loads on
// click. Native <video controls> showed a grey scrub bar and 0:00 before
// anyone asked to watch.
export function VideoCard({
  src,
  poster,
  label,
}: {
  src: string;
  poster: string;
  /** Accessible name, e.g. "Video testimonial from Joe Natoli". */
  label: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <video
        controls
        autoPlay
        playsInline
        poster={poster}
        aria-label={label}
        className="rounded-control border-ink bg-ink aspect-video w-full border-2 object-contain"
      >
        <source src={src} type="video/mp4" />
      </video>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play: ${label}`}
      className="group rounded-control border-ink bg-ink focus-visible:ring-sky relative block aspect-video w-full overflow-hidden border-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <Image
        src={poster}
        alt=""
        fill
        sizes="(min-width: 1024px) 340px, (min-width: 640px) 50vw, 100vw"
        className="object-cover transition duration-500 group-hover:scale-[1.03]"
      />
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"
      />
      <span
        aria-hidden
        className="border-ink bg-brand-600 absolute bottom-3 left-3 flex size-11 items-center justify-center rounded-full border-2 shadow-[3px_3px_0_#111111] transition group-hover:-translate-y-0.5"
      >
        <svg viewBox="0 0 16 16" className="size-4 translate-x-px" fill="none">
          <path d="M4.5 2.5v11l9-5.5-9-5.5z" fill="#111111" />
        </svg>
      </span>
    </button>
  );
}
