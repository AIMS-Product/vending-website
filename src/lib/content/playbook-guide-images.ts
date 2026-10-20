/** Renders of the PDF itself, written by scripts/playbook-guide/build.ts. */
const page = (n: number, alt: string) => ({
  src: `/images/playbook-guide/page-${n}.webp`,
  alt,
  width: 800,
  height: 1035,
});

export const guideImages = {
  cover: {
    ...page(1, "Cover of The First Location Playbook by Mike Hoffmann"),
  },
  previews: [
    page(5, "Play 03 page: build a list of 25 targets, with Mike's AI prompt"),
    page(7, "Play 05 page: objection answers and the follow-up schedule"),
    page(
      8,
      "Play 06 page: the five contract terms, with Mike's video and an assignment",
    ),
  ],
} as const;
