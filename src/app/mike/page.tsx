import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MikeBioLink } from "@/components/attribution/MikeBioLink";
import {
  mikeBio as copy,
  mikeBioInternalHref,
  mikeBioLinks,
} from "@/lib/content/mike-bio";
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
        <nav aria-label="Choose your next step">
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
        <section className={styles.learn} aria-labelledby="learn-heading">
          <h2 id="learn-heading">{copy.learnHeading}</h2>
          <MikeBioLink
            className={styles.video}
            href={mikeBioLinks.video}
            linkId="bio-video-first-machine"
            videoId={copy.videoId}
          >
            <span className={styles.videoPreview}>
              <Image
                src="/images/mike-bio/first-machine-thumbnail.jpg"
                alt=""
                width={480}
                height={360}
                sizes="(min-width: 760px) 410px, calc(100vw - 48px)"
              />
              <span className={styles.play} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="m10 7 7 5-7 5V7Z" fill="currentColor" />
                </svg>
              </span>
            </span>
            <span className={styles.videoDetails}>
              <span>
                <strong>{copy.videoTitle}</strong>
                <span className={styles.videoAction}>{copy.videoAction}</span>
              </span>
              <span aria-hidden="true">↗</span>
            </span>
          </MikeBioLink>
        </section>
        <MikeBioLink
          className={`${styles.path} ${styles.newsletter}`}
          href={mikeBioLinks.newsletter}
          linkId="bio-newsletter"
        >
          <div className={styles.pathTop}>
            <span>{copy.newsletterBrand}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </div>
          <h2>{copy.newsletterTitle}</h2>
          <p>{copy.newsletterDescription}</p>
          <div className={styles.action}>
            <span>{copy.newsletterAction}</span>
            <Arrow />
          </div>
        </MikeBioLink>
        <nav
          className={styles.secondary}
          aria-label="More from Vendingpreneurs"
        >
          <MikeBioLink
            href={mikeBioInternalHref(mikeBioLinks.stories)}
            linkId="bio-case-studies"
          >
            {copy.storiesAction}
            <span aria-hidden="true">↗</span>
          </MikeBioLink>
        </nav>
        <footer className={styles.footer}>
          <span>{copy.name}</span>
          <span aria-hidden="true">/</span>
          <Link href="/privacy">{copy.privacyLabel}</Link>
        </footer>
      </div>
    </div>
  );
}
