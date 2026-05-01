export type Testimonial = {
  /** Stable id used as React key. */
  id: string;
  name: string;
  role: string;
  initials: string;
  /** Direct video URL (currently Bunny CDN). Slice 1c will migrate to Cloudflare Stream. */
  videoUrl: string | null;
  /** Poster frame for the video (used as the still on the card). */
  posterUrl: string | null;
  /** Headshot or initial-style avatar — used when there is no video. */
  avatarUrl: string | null;
};

export const testimonials: ReadonlyArray<Testimonial> = [
  {
    id: "thomas-rohlader",
    name: "Thomas Rohlader",
    role: "Owner, TR Vending",
    initials: "TR",
    videoUrl:
      "https://siladigital.b-cdn.net/Websites%20Videos/Vendingprenuers/Thomas%20Rohladerl.mp4",
    posterUrl: "/images/testimonials/poster-thomas.png",
    avatarUrl: null,
  },
  {
    id: "joe-natoli",
    name: "Joe Natoli",
    role: "Owner — Stryker300 Vending",
    initials: "JN",
    videoUrl:
      "https://siladigital.b-cdn.net/Websites%20Videos/Vendingprenuers/Joe%20Natoli-all.mp4",
    posterUrl: "/images/testimonials/poster-joe.png",
    avatarUrl: null,
  },
  {
    id: "jason-priest",
    name: "Jason Priest",
    role: "Owner of Father & Son Vending & Markets",
    initials: "JP",
    videoUrl:
      "https://siladigital.b-cdn.net/Websites%20Videos/Vendingprenuers/Jason%20Priest.mp4",
    posterUrl: "/images/testimonials/poster-jason.png",
    avatarUrl: null,
  },
  {
    id: "charles-wheeler",
    name: "Charles Wheeler",
    role: "DenCo Vending LLC",
    initials: "CW",
    videoUrl: null,
    posterUrl: null,
    avatarUrl: "/images/testimonials/charles-wheeler.png",
  },
  {
    id: "kelsey-corcoran",
    name: "Kelsey Corcoran",
    role: "Owner — Super Foods Distribution",
    initials: "KC",
    videoUrl: null,
    posterUrl: null,
    avatarUrl: "/images/testimonials/kelsey-corcoran.png",
  },
  {
    id: "abby-c",
    name: "Abby C",
    role: "Van Pelt Vending",
    initials: "AC",
    videoUrl: null,
    posterUrl: null,
    avatarUrl: "/images/testimonials/abby-c.png",
  },
];
