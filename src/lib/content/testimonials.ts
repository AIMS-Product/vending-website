export type Testimonial = {
  /** Stable id used as React key and as the Cloudflare Stream video id once wired. */
  id: string;
  name: string;
  role: string;
  /** Initials for the avatar fallback when no headshot is supplied. */
  initials: string;
  /** Cloudflare Stream playback ID — null until video is uploaded (Slice 1b). */
  videoId: string | null;
  /** Optional headshot URL (Slice 1b). */
  avatarUrl?: string;
};

export const testimonials: ReadonlyArray<Testimonial> = [
  {
    id: "thomas-rohlader",
    name: "Thomas Rohlader",
    role: "Owner, TR Vending",
    initials: "TR",
    videoId: null,
  },
  {
    id: "joe-natoli",
    name: "Joe Natoli",
    role: "Owner — Stryker300 Vending",
    initials: "JN",
    videoId: null,
  },
  {
    id: "jason-priest",
    name: "Jason Priest",
    role: "Owner of Father & Son Vending & Markets",
    initials: "JP",
    videoId: null,
  },
  {
    id: "charles-wheeler",
    name: "Charles Wheeler",
    role: "DenCo Vending LLC",
    initials: "CW",
    videoId: null,
  },
  {
    id: "kelsey-corcoran",
    name: "Kelsey Corcoran",
    role: "Owner — Super Foods Distribution",
    initials: "KC",
    videoId: null,
  },
  {
    id: "abby-c",
    name: "Abby C",
    role: "Van Pelt Vending",
    initials: "AC",
    videoId: null,
  },
];
