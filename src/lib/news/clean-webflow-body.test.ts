import { describe, expect, it } from "vitest";
import { cleanWebflowBody } from "./clean-webflow-body";

const SUMMARY =
  "Vending machines average a modest monthly profit per unit, with more in busy spots.";
const scraped = `[

![](https://cdn.example/logo.png)

](/) [Home](/)[About Us](/about-us)[Contact Us](https://www.vendingpreneurs.com/booking-website) [Home](/)[News](/news)[Contact Us](#) January 16, 2026

![](https://cdn.example/photo.jpg)

${SUMMARY}

## Introduction

Real article text with [a link](/news/best-vending-locations).

[

![VendingPreneurs Brand Mark](https://cdn.example/logo.png)

](#) [Home](/)[ Privacy Policy ](https://www.vendingpreneurs.com/privacy-policy)`;

describe("cleanWebflowBody", () => {
  it("strips the old chrome and recovers the cover and summary", () => {
    expect(cleanWebflowBody(scraped)).toEqual({
      coverUrl: "https://cdn.example/photo.jpg",
      excerpt: SUMMARY,
      body: "## Introduction\n\nReal article text with [a link](/news/best-vending-locations).\n",
    });
  });

  it("keeps parentheses in a cover URL and drops zero-width padding", () => {
    const cleaned = cleanWebflowBody(
      scraped
        .replace("photo.jpg", "photo%20(2).jpg")
        .replace(SUMMARY, `\u200d ${SUMMARY}`),
    );
    expect(cleaned?.coverUrl).toBe("https://cdn.example/photo%20(2).jpg");
    expect(cleaned?.excerpt).toBe(SUMMARY);
  });

  it("leaves an article without the scraped shape alone", () => {
    expect(cleanWebflowBody("## A normal article\n\nText.")).toBeNull();
  });

  it("refuses a header with no footer rather than guessing where text ends", () => {
    expect(cleanWebflowBody(scraped.split("\n[\n\n![Vending")[0])).toBeNull();
  });
});
