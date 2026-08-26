import type { LegalDoc } from "./legal";

/**
 * Anti-spam policy. Adapted from the Modern Amenities policy at
 * modern-amenities.com/spam-policy, with the sections that matter for this
 * business rather than an operator business: members run their own outreach
 * to win locations, and this page has to be clear that they do it for
 * themselves and not on our behalf.
 *
 * Section 3 mirrors the SMS opt-out wording in `privacy.ts` deliberately.
 * If one changes, change the other — a contradiction between the two is the
 * kind of thing a complaint gets built on.
 *
 * The postal address in section 6 is the one `privacy.ts` already publishes
 * for Vendingpreneurs Membership Services. Keep the two identical: CAN-SPAM
 * wants a real address, and two legal pages naming different ones is worse
 * than either on its own.
 */
export const spamPolicy: LegalDoc = {
  title: "Anti-Spam Policy",
  lastUpdated: "August 26, 2026",
  sections: [
    {
      number: "1",
      heading: "Our Position on Unsolicited Email",
      blocks: [
        {
          kind: "p",
          text: "Vendingpreneurs does not authorize, condone, or engage in the advertising or promotion of vendingpreneurs.com, or of any Vendingpreneurs course, membership, program, or service, through unsolicited bulk email. The use of unsolicited bulk or commercial email to advertise this website is strictly prohibited.",
        },
        {
          kind: "p",
          text: "We send commercial email only to people who asked to hear from us — by requesting a resource, subscribing to our newsletter, booking a call, submitting a form on this site, or joining our community.",
        },
      ],
    },
    {
      number: "2",
      heading: "How We Send Commercial Email",
      blocks: [
        {
          kind: "p",
          text: "Vendingpreneurs is committed to following the U.S. CAN-SPAM Act of 2003 and applicable anti-spam regulations in its commercial email. In line with that commitment, we aim to ensure that our commercial messages:",
        },
        {
          kind: "ul",
          items: [
            {
              lead: "Identify us accurately:",
              text: 'use accurate, non-deceptive "From," "To," "Reply-To," and routing information that correctly identifies Vendingpreneurs as the sender.',
            },
            {
              lead: "Tell the truth in the subject line:",
              text: "use a subject line that accurately reflects the content of the message and does not mislead the recipient.",
            },
            {
              lead: "Make leaving easy:",
              text: "provide a clear and conspicuous way for recipients to opt out of receiving future commercial email.",
            },
            {
              lead: "Honor opt-outs promptly:",
              text: "act on opt-out requests in a timely manner after a request is received.",
            },
            {
              lead: "Include a real address:",
              text: "include a valid physical postal address for Vendingpreneurs, as the CAN-SPAM Act requires.",
            },
          ],
        },
        {
          kind: "p",
          text: "We do not sell, rent, or transfer the email addresses of recipients who have opted out.",
        },
      ],
    },
    {
      number: "3",
      heading: "How to Opt Out",
      blocks: [
        {
          kind: "p",
          text: "Every commercial email we send carries an unsubscribe link. Using it removes you from that mailing list. You may also email us directly and ask to be removed.",
        },
        {
          kind: "p",
          text: "You may opt out of receiving SMS messages at any time by replying STOP to any message. After opting out, you will receive a one-time confirmation message. You will no longer receive SMS messages from us unless you re-subscribe.",
        },
        {
          kind: "p",
          text: "Opting out of marketing messages does not stop transactional messages about a purchase, a booked call, or your membership, which we may still need to send you.",
        },
      ],
    },
    {
      number: "4",
      heading: "Members, Ambassadors, and Affiliates",
      blocks: [
        {
          kind: "p",
          text: "Vendingpreneurs teaches people to build their own vending businesses, and that work involves contacting property managers, business owners, and prospective locations. Those communications are sent by the member, for the member's own business.",
        },
        {
          kind: "p-strong",
          text: "A member of the Vendingpreneurs community is not acting as an agent of Vendingpreneurs when they contact a prospective location, and Vendingpreneurs is not the sender of those messages.",
        },
        {
          kind: "p",
          text: "Every member, ambassador, and affiliate is responsible for their own compliance with the CAN-SPAM Act, the Telephone Consumer Protection Act, and any other law that applies to how they contact people. Nothing taught in our programs authorizes anyone to send unsolicited bulk email, and we do not permit anyone to send unsolicited bulk email that references, promotes, or links to vendingpreneurs.com.",
        },
        {
          kind: "p",
          text: "Where we find that someone has used our name, our brand, or a link to this website in unsolicited bulk email, we will ask them to stop and may end their access to our programs.",
        },
      ],
    },
    {
      number: "5",
      heading: "Vendors and Partners",
      blocks: [
        {
          kind: "p",
          text: "We expect any vendor, contractor, or partner sending email on our behalf to follow the same standards set out in this policy. Where a partner sends messages that reference Vendingpreneurs, that partner is responsible for holding a lawful basis to contact each recipient and for honoring opt-outs.",
        },
      ],
    },
    {
      number: "6",
      heading: "Reporting Abuse",
      blocks: [
        {
          kind: "p",
          text: "If you believe you have received an unsolicited message that violates this policy, or a message that improperly references this website, please contact us so the matter can be reviewed.",
        },
        {
          kind: "p-strong",
          text: "Vendingpreneurs — Email: support@vendingpreneurs.com — Mail: 91302 Coburg Industrial Way, Coburg, OR 97408",
        },
        {
          kind: "p",
          text: "Where you can, include the full message with its headers. Headers tell us who actually sent a message, which is the difference between a report we can act on and one we cannot.",
        },
        {
          kind: "p",
          text: "For how we collect, use, and store personal information, including email addresses and phone numbers, see our Privacy Policy.",
        },
      ],
    },
  ],
};
