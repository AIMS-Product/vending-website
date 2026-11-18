import type { Metadata } from "next";
import Image from "next/image";
import {
  mikeBio as copy,
  mikeBioInternalHref,
  mikeBioLinks,
} from "@/lib/content/mike-bio";
import { preloadGeistBio } from "../fonts";
import "@/fonts/geist-bio.css";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Mike Hoffmann — Start here",
  description: copy.bio,
  alternates: { canonical: "/mike" },
  openGraph: {
    title: "Mike Hoffmann — Start here",
    description: copy.bio,
    url: "/mike",
    images: [
      {
        url: "/images/newsletter/mike-hoffmann.webp",
        width: 720,
        height: 720,
        alt: copy.name,
      },
    ],
  },
};

function Arrow() {
  return (
    <span className={styles.arrow} aria-hidden="true">
      ↗
    </span>
  );
}

export default function MikeBioPage() {
  preloadGeistBio();
  return (
    <div className={styles.hub}>
      <header className={styles.profile}>
        <figure className={styles.portrait}>
          <Image
            src="/images/newsletter/mike-hoffmann.webp"
            alt="Mike Hoffmann sitting at a café table"
            width={720}
            height={720}
            sizes="(min-width: 760px) 410px, 100vw"
            priority
          />
        </figure>
        <p className={styles.role}>{copy.role}</p>
        <h1>{copy.name}</h1>
        <p className={styles.bio}>{copy.bio}</p>
      </header>
      <div className={styles.content}>
        <nav aria-label="Book your free market analysis">
          <a
            className={`${styles.path} ${styles.booking}`}
            href={mikeBioInternalHref(mikeBioLinks.booking)}
            data-vp-source-page-slug="mike-ig-bio"
            data-vp-source-block-id="booking"
            data-vp-source-cta-tracking-name="bio-booking"
          >
            <Image
              className={styles.logo}
              src="/images/mike-bio/vp-logo.svg"
              alt="Vendingpreneurs"
              width={118}
              height={24}
              unoptimized
            />
            <h2>{copy.bookingTitle}</h2>
            <p>{copy.bookingDescription}</p>
            <div className={styles.action}>
              <span>{copy.bookingAction}</span>
              <Arrow />
            </div>
          </a>
        </nav>
      </div>
    </div>
  );
}
