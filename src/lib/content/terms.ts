import type { LegalDoc } from "./legal";

export const terms: LegalDoc = {
  title: "Terms of Service",
  lastUpdated: "January 26, 2026",
  sections: [
    {
      number: "1",
      heading: "Acceptance of Terms",
      blocks: [
        {
          kind: "p",
          text: 'By accessing vendingpreneurs.com, purchasing a course or membership, participating in the VENDInsights program, submitting data through the VENDInsights platform, or opting in to receive SMS text messages, you ("Member," "Participant," "you," or "your") agree to these Terms of Service ("Terms") and our Privacy Policy, incorporated herein by reference. If you represent an organization, you confirm that you have authority to bind that entity.',
        },
        {
          kind: "p",
          text: "The VENDInsights program is operated by Modern Amenities in connection with Vendingpreneurs. By participating in VENDInsights, you agree to be bound by these Terms.",
        },
        {
          kind: "p-strong",
          text: "IF YOU DO NOT AGREE TO THESE TERMS, DO NOT USE THE SERVICES, DO NOT CHECK ANY ACCEPTANCE BOX, AND DO NOT SUBMIT ANY DATA.",
        },
      ],
    },
    {
      number: "2",
      heading: "Scope of Services",
      blocks: [
        { kind: "p", text: "The Services include:" },
        {
          kind: "ul",
          items: [
            {
              text: "Educational content, community access, courses, resources, membership programs, digital products, and live events provided by Vendingpreneurs",
            },
            {
              text: "VENDInsights: a predictive forecasting and benchmarking tool designed to aggregate anonymized vending operation data to provide revenue projections, benchmarking insights, access to negotiated group supplier rates, and industry-wide performance metrics",
            },
            {
              text: "SMS text messaging communications including community updates, event reminders, promotional offers, account notifications, and member support",
            },
          ],
        },
      ],
    },
    {
      number: "3",
      heading: "Eligibility and Account Security",
      blocks: [
        {
          kind: "p",
          text: "You must be at least 18 years old and provide accurate information when creating an account, making a purchase, submitting data, or subscribing to SMS communications. You are responsible for maintaining the confidentiality of your login credentials and all activity under your account.",
        },
      ],
    },
    {
      number: "4",
      heading: "SMS Text Messaging Program Terms",
      blocks: [
        { kind: "h3", text: "a. Program Description" },
        {
          kind: "p",
          text: "SMS communications may include community updates, event reminders, promotional offers, account notifications, and support messages.",
        },
        { kind: "h3", text: "b. Opt-In Consent" },
        {
          kind: "p",
          text: "By providing your mobile phone number, checking an opt-in box, texting a keyword, or verbally consenting, you agree to receive recurring automated messages. Consent is not required to purchase products or services.",
        },
        { kind: "h3", text: "c. Message Frequency" },
        {
          kind: "p",
          text: "Message frequency varies and may include multiple messages per week.",
        },
        { kind: "h3", text: "d. Opt-Out" },
        {
          kind: "p",
          text: "You may cancel SMS service at any time by texting STOP. A confirmation message will follow.",
        },
        { kind: "h3", text: "e. Help" },
        {
          kind: "p",
          text: "Reply HELP or contact support@vendingpreneurs.com for assistance.",
        },
        { kind: "h3", text: "f. Carrier Liability" },
        {
          kind: "p",
          text: "Carriers are not liable for delayed or undelivered messages.",
        },
        { kind: "h3", text: "g. Message and Data Rates" },
        { kind: "p", text: "Message and data rates may apply." },
        { kind: "h3", text: "h. Privacy" },
        {
          kind: "p",
          text: "For privacy-related inquiries, please refer to our Privacy Policy.",
        },
      ],
    },
    {
      number: "5",
      heading: "Membership Fees and Payments",
      blocks: [
        {
          kind: "p",
          text: "All fees for courses, memberships, and digital products are stated at the time of purchase. Subscription memberships will automatically renew at the end of each billing period unless canceled prior to renewal. Fees are non-refundable except as required by law or expressly stated in the product description. Late payments on payment plans may result in suspension of access until the account is current.",
        },
      ],
    },
    {
      number: "6",
      heading: "Refund Policy",
      blocks: [
        {
          kind: "p",
          text: "Due to the digital nature of our products and immediate access to course materials and community resources, all sales are final. Refund requests will be considered on a case-by-case basis at our sole discretion. Contact support@vendingpreneurs.com within 7 days of purchase if you believe you qualify for an exception.",
        },
      ],
    },
    {
      number: "7",
      heading: "Data Submission (VENDInsights Program)",
      blocks: [
        { kind: "h3", text: "a. Data You Provide" },
        {
          kind: "p",
          text: "As a VENDInsights Participant, you agree to provide accurate and complete information, which may include:",
        },
        {
          kind: "ul",
          items: [
            {
              text: "Business contact information (name, email, phone, company name)",
            },
            {
              text: "Location data (addresses, facility types, demographic information)",
            },
            {
              text: "Machine information (types, quantities, manufacturers, models)",
            },
            {
              text: "Revenue and sales data (gross receipts, transaction volumes, sales by product)",
            },
            {
              text: "Product performance data (sales velocity, inventory turnover)",
            },
            { text: "Supplier and vendor relationships" },
            {
              text: "Other operational metrics relevant to vending machine performance",
            },
          ],
        },
        { kind: "h3", text: "b. Your Representations" },
        {
          kind: "p",
          text: "You represent and warrant that: (a) you have the legal authority to provide all submitted data; (b) all data submitted is accurate and complete to the best of your knowledge; and (c) your submission does not violate any third-party rights or applicable laws.",
        },
      ],
    },
    {
      number: "8",
      heading: "Data Use, Anonymization, and Privacy Protection",
      blocks: [
        { kind: "h3", text: "a. Anonymization and Aggregation" },
        {
          kind: "p",
          text: "All data you submit will be anonymized and aggregated with data from other Participants. Your specific individual data, including revenue figures, location-specific performance, and other identifying information, will NEVER be shared with other Participants, third parties, or the public in a manner that could identify you or your specific operations.",
        },
        { kind: "h3", text: "b. How We Use Your Data" },
        {
          kind: "p",
          text: "Your anonymized and aggregated data will be used to:",
        },
        {
          kind: "ul",
          items: [
            { text: "Generate industry benchmarks and performance metrics" },
            { text: "Create predictive models for revenue forecasting" },
            { text: "Identify industry trends and best practices" },
            { text: "Negotiate group purchasing agreements with suppliers" },
            {
              text: "Provide you with comparative performance insights (your data vs. anonymized benchmarks)",
            },
            { text: "Improve the VENDInsights Platform and services" },
          ],
        },
        { kind: "h3", text: "c. What You Receive" },
        {
          kind: "p",
          text: "As a VENDInsights Participant, you will receive access to:",
        },
        {
          kind: "ul",
          items: [
            {
              text: "Aggregated industry benchmarks showing how locations, machines, and products perform on average",
            },
            {
              text: "Comparative analysis showing how YOUR specific metrics compare to anonymized industry benchmarks (without revealing other Participants' individual data)",
            },
            {
              text: "Access to group supplier rates and negotiated pricing",
            },
            { text: "Predictive forecasting tools" },
          ],
        },
      ],
    },
    {
      number: "9",
      heading: "Data Security and Protection",
      blocks: [
        {
          kind: "p",
          text: "We implement industry-standard security measures to protect your data, including:",
        },
        {
          kind: "ul",
          items: [
            { text: "Encryption of data in transit and at rest" },
            {
              text: "Access controls limiting data access to authorized personnel only",
            },
            { text: "Regular security audits and vulnerability assessments" },
            { text: "Secure data storage infrastructure" },
          ],
        },
        {
          kind: "p",
          text: "However, no method of transmission or storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.",
        },
      ],
    },
    {
      number: "10",
      heading: "Data Retention and Deletion",
      blocks: [
        {
          kind: "p",
          text: "We will retain your data for as long as necessary to provide services and fulfill the purposes outlined in these Terms. You may request deletion of your data at any time by contacting us at privacy@modernamenities.com (for VENDInsights) or privacy@vendingpreneurs.com (for membership services). Upon receiving a deletion request:",
        },
        {
          kind: "ul",
          items: [
            {
              text: "We will remove your identifiable data from active systems within 30 days",
            },
            {
              text: "Anonymized, aggregated data that cannot be traced back to you may remain in our systems and continue to be used for benchmarking purposes",
            },
            {
              text: "We will provide confirmation of deletion upon completion",
            },
          ],
        },
      ],
    },
    {
      number: "11",
      heading: "Your Data Rights",
      blocks: [
        {
          kind: "p",
          text: "You have the following rights regarding your data:",
        },
        {
          kind: "ul",
          items: [
            {
              lead: "Access:",
              text: "Request a copy of the data we hold about you",
            },
            {
              lead: "Correction:",
              text: "Request correction of inaccurate data",
            },
            {
              lead: "Deletion:",
              text: "Request deletion of your data (subject to legal retention requirements)",
            },
            {
              lead: "Portability:",
              text: "Request your data in a structured, commonly used format",
            },
            {
              lead: "Opt-Out:",
              text: "Withdraw from the VENDInsights program or SMS communications at any time",
            },
            { lead: "Object:", text: "Object to certain uses of your data" },
          ],
        },
        {
          kind: "p",
          text: "To exercise any of these rights, contact us at privacy@modernamenities.com (VENDInsights) or privacy@vendingpreneurs.com (membership services). We will respond to your request within 30 days.",
        },
      ],
    },
    {
      number: "12",
      heading: "Member Responsibilities",
      blocks: [
        {
          kind: "p",
          text: "You agree to use the Services for lawful purposes only. You will not share, resell, or redistribute course materials, login credentials, or community content without express written permission. You will engage respectfully with other community members and refrain from harassment, spam, or disruptive behavior.",
        },
      ],
    },
    {
      number: "13",
      heading: "Intellectual Property",
      blocks: [
        {
          kind: "p",
          text: "All website content, course materials, templates, videos, trademarks, benchmarks, forecasting models, analytics, and documentation are owned by Vendingpreneurs, Modern Amenities, or their licensors. Except as expressly permitted, you may not copy, modify, distribute, record, or share any portion of the Services. Unauthorized distribution of content may result in immediate termination without refund.",
        },
        {
          kind: "p",
          text: "You retain all ownership rights in the data you submit to VENDInsights. By submitting data, you grant Modern Amenities a worldwide, non-exclusive, royalty-free license to use, process, analyze, aggregate, and anonymize your data for the purposes described in these Terms. This license continues even after you withdraw from the Platform, but only for data that has been anonymized and aggregated in a manner that cannot identify you.",
        },
        {
          kind: "p",
          text: "All benchmarks, forecasting models, analytics, and other derivative works created from aggregated data are the exclusive property of Modern Amenities.",
        },
      ],
    },
    {
      number: "14",
      heading: "User-Generated Content",
      blocks: [
        {
          kind: "p",
          text: "By posting content in our community forums or other interactive areas, you grant Vendingpreneurs a non-exclusive, royalty-free, perpetual license to use, display, and distribute such content in connection with the Services. You retain ownership of your original content but are responsible for ensuring it does not infringe on third-party rights.",
        },
      ],
    },
    {
      number: "15",
      heading: "Disclaimers",
      blocks: [
        {
          kind: "p",
          text: 'The Services are provided "AS IS" and "AS AVAILABLE." Educational content is for informational purposes only and does not constitute business, legal, or financial advice. VENDInsights provides benchmarking and forecasting tools based on aggregated data; we make no guarantees regarding the accuracy of projections, the success of any business decisions based on Platform insights, or the availability of group purchasing benefits.',
        },
        {
          kind: "p",
          text: "Results vary and depend on individual effort, market conditions, and other factors. We make no guarantees regarding income, business success, or specific outcomes. All projections and benchmarks are provided without warranty of any kind. To the fullest extent permitted by law, we disclaim all implied warranties, including merchantability, fitness for a particular purpose, and non-infringement.",
        },
        {
          kind: "p",
          text: "You acknowledge that all business decisions remain your sole responsibility. The Platform provides informational tools only and does not constitute business, financial, or legal advice.",
        },
      ],
    },
    {
      number: "16",
      heading: "Limitation of Liability",
      blocks: [
        {
          kind: "p",
          text: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, VENDINGPRENEURS, MODERN AMENITIES, AND THEIR AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING FROM OR RELATED TO: (A) YOUR USE OR INABILITY TO USE THE SERVICES (INCLUDING SMS COMMUNICATIONS); (B) ANY UNAUTHORIZED ACCESS TO OR USE OF YOUR DATA; (C) ANY BUSINESS DECISIONS MADE BASED ON PLATFORM INSIGHTS; OR (D) ANY OTHER MATTER RELATING TO THE SERVICES.",
        },
        {
          kind: "p",
          text: "Our aggregate liability under these Terms will not exceed the total fees you paid to us in the 12 months preceding the claim.",
        },
      ],
    },
    {
      number: "17",
      heading: "Indemnification",
      blocks: [
        {
          kind: "p",
          text: "You agree to defend, indemnify, and hold harmless Vendingpreneurs, Modern Amenities, and their affiliates from any claims, damages, or expenses (including reasonable attorneys' fees) arising out of your misuse of the Services, violation of these Terms, or infringement of any third-party rights.",
        },
      ],
    },
    {
      number: "18",
      heading: "Termination",
      blocks: [
        {
          kind: "p",
          text: "We reserve the right to suspend or terminate your access to the Services for material breach of these Terms, including but not limited to unauthorized sharing of content, abusive behavior toward staff or members, or failure to pay fees. Upon termination, you will lose access to all course materials, community resources, and VENDInsights benchmarking insights and group purchasing benefits. You may terminate SMS services at any time by texting STOP.",
        },
        {
          kind: "p",
          text: "You may terminate your VENDInsights participation at any time by contacting us at privacy@modernamenities.com. Anonymized data may remain in aggregated datasets after termination.",
        },
      ],
    },
    {
      number: "19",
      heading: "Governing Law and Dispute Resolution",
      blocks: [
        {
          kind: "p",
          text: "These Terms are governed by the laws of the State of Oregon (for Vendingpreneurs membership services) and the State of Florida (for VENDInsights services), without regard to conflict-of-law principles.",
        },
        {
          kind: "p",
          text: "Any dispute not resolved informally will be settled by binding arbitration conducted under the Commercial Arbitration Rules of the American Arbitration Association. For Vendingpreneurs membership disputes, arbitration shall occur in Lane County, Oregon. For VENDInsights disputes, arbitration shall occur in Florida. Either party may seek injunctive relief in court to protect intellectual property rights or confidential information. Judgment on any award may be entered in any court of competent jurisdiction.",
        },
      ],
    },
    {
      number: "20",
      heading: "Changes to Terms",
      blocks: [
        {
          kind: "p",
          text: 'We may revise these Terms from time to time. We will post the updated version on our website, update the "Last Updated" date, and may provide notice of material changes by email. Continued use of the Services after changes take effect constitutes acceptance. If you do not agree to modifications, you may terminate your participation.',
        },
      ],
    },
    {
      number: "21",
      heading: "Contact",
      blocks: [
        {
          kind: "p",
          text: "For questions about these Terms or the Services:",
        },
        {
          kind: "p-strong",
          text: "Vendingpreneurs (Membership Services) — Email: support@vendingpreneurs.com — Mail: 91302 Coburg Industrial Way, Coburg, OR 97408",
        },
        {
          kind: "p-strong",
          text: "Modern Amenities (VENDInsights) — Email: privacy@modernamenities.com",
        },
      ],
    },
  ],
};
