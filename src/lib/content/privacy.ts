import type { LegalDoc } from "./legal";

export const privacy: LegalDoc = {
  title: "Privacy Policy",
  lastUpdated: "January 26, 2026",
  sections: [
    {
      number: "1",
      heading: "Introduction",
      blocks: [
        {
          kind: "p",
          text: 'Vendingpreneurs and Modern Amenities ("we," "our," or "us") are committed to protecting your privacy. This Privacy Policy describes how we collect, use, disclose, and safeguard information when you:',
        },
        {
          kind: "ul",
          items: [
            { text: "Visit vendingpreneurs.com or any sub-domain" },
            {
              text: "Communicate with our team by email, phone, SMS text message, or web form",
            },
            {
              text: "Join our community, purchase courses, or access member resources",
            },
            {
              text: "Participate in the VENDInsights program and submit data",
            },
            { text: "Opt in to receive SMS text messages from us" },
          ],
        },
        { kind: "p", text: '(collectively, the "Services")' },
        {
          kind: "p",
          text: "By using the Services, you consent to the practices described below.",
        },
      ],
    },
    {
      number: "2",
      heading: "Information We Collect",
      blocks: [
        { kind: "h3", text: "a. Information You Provide Directly" },
        {
          kind: "p-strong",
          text: "Personal and Contact Information:",
        },
        {
          kind: "p",
          text: "Name, email address, phone number (including mobile phone number), business name, and mailing address provided when you create an account, join our community, purchase a course, or opt in to receive SMS communications.",
        },
        { kind: "p-strong", text: "VENDInsights Business Information:" },
        {
          kind: "p",
          text: "When you participate in VENDInsights, you provide:",
        },
        {
          kind: "ul",
          items: [
            {
              text: "Business structure, years in operation, number of employees",
            },
            {
              text: "Location data: addresses of vending machine locations, facility types, demographic information about service areas",
            },
            {
              text: "Machine data: types of vending machines, quantities, manufacturers, models, age of equipment",
            },
            {
              text: "Financial data: revenue figures, gross receipts, transaction volumes, sales by product, profit margins",
            },
            {
              text: "Product performance data: sales velocity, inventory turnover, best-selling and worst-selling products",
            },
            {
              text: "Vendor information: current supplier relationships, purchasing volume, vendor preferences",
            },
          ],
        },
        { kind: "h3", text: "b. SMS and Mobile Information" },
        {
          kind: "p",
          text: "When you opt in to receive SMS text messages from us, we collect your mobile phone number and your consent to receive such messages. We also maintain records of your opt-in date, method of consent, and message history.",
        },
        { kind: "h3", text: "c. Information Collected Automatically" },
        {
          kind: "p",
          text: "When you access our platforms, we may automatically collect:",
        },
        {
          kind: "ul",
          items: [
            {
              lead: "Technical Information:",
              text: "IP address, browser type, device type, operating system",
            },
            {
              lead: "Usage Information:",
              text: "Pages visited, time spent on pages, navigation paths, form completion rates, referring pages, and time-stamps",
            },
          ],
        },
        { kind: "h3", text: "d. Cookies and Similar Technologies" },
        {
          kind: "p",
          text: "We use cookies and similar technologies to remember preferences, analyze traffic, improve functionality, and measure marketing performance.",
        },
        { kind: "h3", text: "e. Payment and Transaction Data" },
        {
          kind: "p",
          text: "Payment details processed through third-party providers, purchase history, and membership status.",
        },
        { kind: "h3", text: "f. Information from Third Parties" },
        { kind: "p", text: "We may receive information from:" },
        {
          kind: "ul",
          items: [
            {
              lead: "Service Providers:",
              text: "Data from form providers, analytics platforms, and cloud storage services",
            },
            {
              lead: "Public Sources:",
              text: "Publicly available business information to verify submitted data",
            },
            {
              lead: "Business Partners:",
              text: "Information from suppliers participating in group purchasing programs",
            },
          ],
        },
      ],
    },
    {
      number: "3",
      heading: "How We Use Your Information",
      blocks: [
        { kind: "h3", text: "a. Primary Services" },
        {
          kind: "ul",
          items: [
            { text: "Provide, operate, and improve the Services" },
            {
              text: "Process payments, membership access, and support tickets",
            },
            { text: "Create and maintain your account" },
          ],
        },
        { kind: "h3", text: "b. VENDInsights Functions" },
        {
          kind: "ul",
          items: [
            { text: "Process and analyze submitted data" },
            { text: "Generate anonymized, aggregated industry benchmarks" },
            { text: "Develop predictive forecasting models" },
            { text: "Provide comparative performance insights" },
            { text: "Facilitate group purchasing negotiations with suppliers" },
          ],
        },
        { kind: "h3", text: "c. Communications" },
        {
          kind: "ul",
          items: [
            {
              text: "Send SMS text messages including community updates, event reminders, promotional offers, and account notifications (you may opt out at any time)",
            },
            {
              text: "Send educational content, industry insights, or promotional offers via email (you may opt out at any time)",
            },
            { text: "Respond to your inquiries and requests" },
            { text: "Deliver technical support and customer service" },
            {
              text: "Send administrative notices about your account or participation",
            },
          ],
        },
        { kind: "h3", text: "d. Platform Improvement" },
        {
          kind: "ul",
          items: [
            {
              text: "Personalize your community experience and recommend relevant resources",
            },
            { text: "Analyze usage patterns to improve user experience" },
            { text: "Develop new features and services" },
            {
              text: "Conduct research and analytics on vending industry trends",
            },
          ],
        },
        { kind: "h3", text: "e. Legal and Security" },
        {
          kind: "ul",
          items: [
            {
              text: "Detect, investigate, and prevent fraud or security incidents",
            },
            {
              text: "Comply with legal obligations and enforce our agreements",
            },
            { text: "Resolve disputes and enforce agreements" },
          ],
        },
      ],
    },
    {
      number: "4",
      heading: "SMS Text Messaging Privacy",
      blocks: [
        { kind: "h3", text: "a. Consent" },
        {
          kind: "p",
          text: "By providing your mobile phone number and opting in to our SMS program, you expressly consent to receive recurring automated text messages at the phone number provided. Consent is not a condition of purchase.",
        },
        { kind: "h3", text: "b. Message Types and Frequency" },
        {
          kind: "p",
          text: "You may receive messages related to community updates, event reminders, promotional offers, account notifications, and member support. Message frequency varies based on your interactions and account activity.",
        },
        { kind: "h3", text: "c. Message and Data Rates" },
        {
          kind: "p",
          text: "Message and data rates may apply depending on your mobile carrier and plan. You are responsible for any charges from your wireless carrier.",
        },
        { kind: "h3", text: "d. Opt-Out" },
        {
          kind: "p",
          text: "You may opt out of receiving SMS messages at any time by replying STOP to any message. After opting out, you will receive a one-time confirmation message. You will no longer receive SMS messages from us unless you re-subscribe.",
        },
        { kind: "h3", text: "e. Help" },
        {
          kind: "p",
          text: "For help with our SMS program, reply HELP to any message or contact us at support@vendingpreneurs.com.",
        },
        { kind: "h3", text: "f. Carrier Disclaimer" },
        {
          kind: "p",
          text: "Carriers are not liable for delayed or undelivered messages. Delivery of messages is subject to effective transmission from your mobile carrier and is not guaranteed.",
        },
        { kind: "h3", text: "g. Mobile Information Sharing" },
        {
          kind: "p",
          text: "No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Text messaging originator opt-in data and consent will not be shared with any third parties, except as required to provide our SMS messaging services through aggregators and providers of text message services.",
        },
      ],
    },
    {
      number: "5",
      heading: "Data Sharing and Third-Party Disclosure",
      blocks: [
        { kind: "h3", text: "a. Anonymized and Aggregated Data" },
        {
          kind: "p",
          text: "We share anonymized and aggregated data that cannot identify you or your specific business with:",
        },
        {
          kind: "ul",
          items: [
            {
              lead: "Platform Participants:",
              text: "Industry benchmarks, performance metrics, and trend analysis",
            },
            {
              lead: "Supplier Partners:",
              text: "Aggregated purchasing data to negotiate group rates",
            },
            {
              lead: "Research Purposes:",
              text: "Industry analysis and market research (with identifying information removed)",
            },
          ],
        },
        {
          kind: "p-strong",
          text: "YOUR INDIVIDUAL DATA IS NEVER SHARED IN A FORM THAT IDENTIFIES YOU OR YOUR SPECIFIC BUSINESS.",
        },
        { kind: "h3", text: "b. Service Providers" },
        {
          kind: "p",
          text: "We may share information only with service providers (such as payment processors, cloud hosts, analytics vendors, email and communication platforms, IT security providers) who process data on our behalf under confidentiality agreements.",
        },
        { kind: "h3", text: "c. Legal Requirements" },
        {
          kind: "p",
          text: "We may disclose information to authorities when required by law, subpoena, court order, or to protect rights, property, or safety.",
        },
        { kind: "h3", text: "d. Business Transfers" },
        {
          kind: "p",
          text: "If we are involved in a merger, acquisition, sale of assets, or bankruptcy, your information may be transferred as part of that transaction. We will notify you of any such change and the choices you may have.",
        },
        { kind: "h3", text: "e. With Your Consent" },
        {
          kind: "p",
          text: "We may share your information for other purposes with your explicit consent.",
        },
        {
          kind: "p",
          text: "We do not sell or rent your personal information.",
        },
      ],
    },
    {
      number: "6",
      heading: "Legal Bases for Processing",
      blocks: [
        {
          kind: "p",
          text: "Where required by applicable law, we rely on one or more of the following grounds:",
        },
        {
          kind: "ul",
          items: [
            {
              lead: "Consent:",
              text: "You have given explicit consent for us to process your data",
            },
            {
              lead: "Contractual Necessity:",
              text: "Processing is necessary to perform our agreement with you",
            },
            {
              lead: "Legitimate Interests:",
              text: "We have legitimate business interests that are not overridden by your rights",
            },
            {
              lead: "Legal Obligation:",
              text: "Processing is necessary to comply with applicable laws and regulations",
            },
          ],
        },
      ],
    },
    {
      number: "7",
      heading: "Data Security",
      blocks: [
        {
          kind: "p",
          text: "We implement comprehensive security measures to protect your information:",
        },
        { kind: "p-strong", text: "Technical Safeguards:" },
        {
          kind: "ul",
          items: [
            {
              text: "Industry-standard encryption for data in transit (TLS/SSL) and at rest",
            },
            { text: "Secure data centers with physical access controls" },
            { text: "Regular security audits and vulnerability assessments" },
            { text: "Intrusion detection and prevention systems" },
          ],
        },
        { kind: "p-strong", text: "Administrative Safeguards:" },
        {
          kind: "ul",
          items: [
            {
              text: "Access controls limiting data access to authorized personnel only",
            },
            { text: "Employee training on data protection and privacy" },
            {
              text: "Data breach response plan and incident management procedures",
            },
          ],
        },
        { kind: "p-strong", text: "Organizational Safeguards:" },
        {
          kind: "ul",
          items: [
            { text: "Data Processing Agreements with all third-party vendors" },
            { text: "Regular compliance reviews and audits" },
            { text: "Documentation of all data processing activities" },
          ],
        },
        {
          kind: "p",
          text: "No online service, however, can guarantee absolute security. While we strive to protect your information using industry best practices, we cannot guarantee absolute security.",
        },
      ],
    },
    {
      number: "8",
      heading: "Data Retention",
      blocks: [
        { kind: "h3", text: "a. Active Participation" },
        {
          kind: "p",
          text: "We retain information for as long as necessary to fulfill the purposes outlined in this Policy, provide ongoing services, comply with legal requirements, resolve disputes, and enforce our agreements.",
        },
        { kind: "h3", text: "b. After Termination or Deletion Request" },
        {
          kind: "ul",
          items: [
            {
              lead: "Identifiable Data:",
              text: "Deleted from active systems within 30 days",
            },
            {
              lead: "Anonymized Data:",
              text: "May be retained indefinitely as part of aggregated datasets that cannot be traced back to you",
            },
            {
              lead: "Legal Requirements:",
              text: "Some data may be retained longer to comply with legal, accounting, or regulatory requirements",
            },
            {
              lead: "Backup Systems:",
              text: "Data in backup systems will be deleted according to our backup rotation schedule (typically within 90 days)",
            },
          ],
        },
        { kind: "h3", text: "c. Inactive Accounts" },
        {
          kind: "p",
          text: "If you do not access your account or submit data for 24 consecutive months, we may consider your account inactive and archive or delete your data after providing notice.",
        },
        {
          kind: "p",
          text: "SMS opt-in consent records are retained for the duration of your subscription and as required by law.",
        },
      ],
    },
    {
      number: "9",
      heading: "Your Privacy Rights",
      blocks: [
        { kind: "h3", text: "a. Universal Rights (All Users)" },
        {
          kind: "p",
          text: "Depending on your jurisdiction, you may have the right to:",
        },
        {
          kind: "ul",
          items: [
            {
              lead: "Access:",
              text: "Request a copy of the personal data we hold about you",
            },
            {
              lead: "Correction:",
              text: "Request correction of inaccurate or incomplete data",
            },
            {
              lead: "Deletion:",
              text: "Request deletion of your personal data (subject to legal exceptions)",
            },
            {
              lead: "Portability:",
              text: "Request your data in a structured, commonly used, machine-readable format",
            },
            {
              lead: "Opt-Out:",
              text: "Withdraw from programs and stop data collection at any time",
            },
            {
              lead: "Object:",
              text: "Object to certain processing of your data",
            },
          ],
        },
      ],
    },
    {
      number: "10",
      heading: "State-Specific Privacy Rights",
      blocks: [
        { kind: "h3", text: "a. California Privacy Rights (CCPA/CPRA)" },
        { kind: "p", text: "California residents have additional rights:" },
        {
          kind: "ul",
          items: [
            {
              lead: "Right to Know:",
              text: "Request detailed information about what personal information is collected and how it is used",
            },
            {
              lead: "Right to Delete:",
              text: "Request deletion of personal information",
            },
            {
              lead: "Right to Opt-Out of Sale/Sharing:",
              text: "We do not sell your data or share it for cross-context behavioral advertising",
            },
            {
              lead: "Right to Correct:",
              text: "Request correction of inaccurate information",
            },
            {
              lead: "Right to Limit Sensitive Personal Information:",
              text: "Request limitation on use of sensitive personal information",
            },
            {
              lead: "Right to Non-Discrimination:",
              text: "You will not receive discriminatory treatment for exercising your privacy rights",
            },
          ],
        },
        {
          kind: "p-strong",
          text: "Categories of Personal Information Collected (CCPA):",
        },
        {
          kind: "p",
          text: "Identifiers (name, email, phone, business name), commercial information (transaction data, purchasing history), financial information (revenue data, sales figures), geolocation data (business location addresses), professional information (business operations data).",
        },
        { kind: "h3", text: "b. Virginia Privacy Rights (VCDPA)" },
        {
          kind: "p",
          text: "Virginia residents have the right to: access personal data, correct inaccuracies, delete personal data, obtain a copy of personal data, and opt out of targeted advertising, sale of personal data, or profiling (Note: we do not engage in these activities).",
        },
        { kind: "h3", text: "c. Colorado Privacy Rights (CPA)" },
        {
          kind: "p",
          text: "Colorado residents have similar rights including: access, correction, deletion, data portability, and the right to opt out of targeted advertising, sale, or profiling.",
        },
        { kind: "h3", text: "d. Connecticut Privacy Rights (CTDPA)" },
        {
          kind: "p",
          text: "Connecticut residents have rights including: access to personal data, correction of inaccuracies, deletion of personal data, data portability, and opt out of targeted advertising and sale.",
        },
        { kind: "h3", text: "e. Utah Privacy Rights (UCPA)" },
        {
          kind: "p",
          text: "Utah residents have the right to: access and obtain a copy of personal data, delete personal data, and opt out of targeted advertising and sale of personal data.",
        },
        { kind: "h3", text: "f. Other State Rights" },
        {
          kind: "p",
          text: "If you reside in a state with comprehensive privacy legislation not listed above, please contact us to understand your specific rights under your state's law.",
        },
      ],
    },
    {
      number: "11",
      heading: "How to Exercise Your Rights",
      blocks: [
        { kind: "p-strong", text: "Contact Methods:" },
        {
          kind: "ul",
          items: [
            {
              text: "Email: privacy@vendingpreneurs.com (membership services) or privacy@modernamenities.com (VENDInsights)",
            },
            { text: "Mail: 91302 Coburg Industrial Way, Coburg, OR 97408" },
            { text: "SMS Opt-Out: Reply STOP to any SMS message" },
          ],
        },
        { kind: "p-strong", text: "What to Include in Your Request:" },
        {
          kind: "ul",
          items: [
            { text: "Your full name and contact information" },
            { text: "Description of the right you wish to exercise" },
            { text: "Your state of residence (for state-specific rights)" },
            { text: "Sufficient information to verify your identity" },
          ],
        },
        { kind: "p-strong", text: "Verification Process:" },
        {
          kind: "p",
          text: "To protect your privacy, we must verify your identity before fulfilling requests. We may ask you to provide information matching what we have on file, respond to verification emails, or provide additional documentation.",
        },
        { kind: "p-strong", text: "Response Timeline:" },
        {
          kind: "ul",
          items: [
            { text: "30 days for most requests" },
            {
              text: "45 days for complex requests (we will notify you of any extension)",
            },
            {
              text: "California residents: 45 days, with possible 45-day extension",
            },
          ],
        },
        { kind: "p-strong", text: "Authorized Agents:" },
        {
          kind: "p",
          text: "You may designate an authorized agent to make requests on your behalf. The agent must provide proof of authorization, and we may require you to verify your identity directly with us.",
        },
      ],
    },
    {
      number: "12",
      heading: "Cookies and Tracking Technologies",
      blocks: [
        { kind: "h3", text: "a. Types of Cookies We Use" },
        {
          kind: "ul",
          items: [
            {
              lead: "Essential Cookies:",
              text: "Required for platform functionality (login, form submission, security)",
            },
            {
              lead: "Analytics Cookies:",
              text: "Help us understand how users interact with the platform",
            },
            {
              lead: "Performance Cookies:",
              text: "Allow us to monitor and improve platform performance",
            },
            {
              lead: "Functional Cookies:",
              text: "Remember your preferences and settings",
            },
          ],
        },
        { kind: "h3", text: "b. Third-Party Cookies" },
        {
          kind: "p",
          text: "We may use third-party analytics services (e.g., Google Analytics) that place cookies on your device. These third parties have their own privacy policies.",
        },
        { kind: "h3", text: "c. Your Cookie Choices" },
        {
          kind: "p",
          text: "You can control cookies through browser settings, industry opt-out tools like the Network Advertising Initiative, or platform cookie preference settings (if available). Note that disabling essential cookies may prevent you from using certain features.",
        },
      ],
    },
    {
      number: "13",
      heading: "Do Not Track Signals",
      blocks: [
        {
          kind: "p",
          text: 'Some browsers include "Do Not Track" (DNT) signals. Our platforms do not currently respond to DNT signals. We will update this policy if we implement DNT response mechanisms in the future.',
        },
      ],
    },
    {
      number: "14",
      heading: "Children's Privacy",
      blocks: [
        {
          kind: "p",
          text: "The Services are not directed to individuals under 18 years of age. We do not knowingly collect personal information from children under 18. If you are under 18, do not use the Services or provide any information. If you believe we have collected information from a child, please contact us for deletion at privacy@vendingpreneurs.com.",
        },
      ],
    },
    {
      number: "15",
      heading: "International Data Transfers",
      blocks: [
        {
          kind: "p",
          text: "Our Services operate within the United States. If you access the Services from outside the U.S., your information will be transferred to, stored, and processed in the United States. By using the Services, you consent to this transfer.",
        },
      ],
    },
    {
      number: "16",
      heading: "Changes to This Policy",
      blocks: [
        {
          kind: "p",
          text: 'We may update this Policy periodically. We will notify you of material changes by posting a prominent notice on our platforms, sending an email to your registered email address, and updating the "Last Updated" date. Continued use of the Services after changes become effective signifies acceptance. If you do not agree to changes, you may terminate your participation.',
        },
      ],
    },
    {
      number: "17",
      heading: "Contact Us",
      blocks: [
        {
          kind: "p",
          text: "Questions about this Policy or our privacy practices?",
        },
        {
          kind: "p-strong",
          text: "Vendingpreneurs (Membership Services) — Email: privacy@vendingpreneurs.com — Mail: 91302 Coburg Industrial Way, Coburg, OR 97408",
        },
        {
          kind: "p-strong",
          text: "Modern Amenities (VENDInsights) — Attention: Privacy Officer — Email: privacy@modernamenities.com",
        },
        {
          kind: "p-strong",
          text: "Response Time: We will respond to privacy inquiries within 10 business days.",
        },
      ],
    },
    {
      number: "18",
      heading: "State-Specific Contact Information for Complaints",
      blocks: [
        {
          kind: "p-strong",
          text: "California Residents:",
        },
        {
          kind: "p",
          text: "If you have concerns about our privacy practices, you may contact the California Attorney General: California Department of Justice, Office of the Attorney General — 1300 I Street, Sacramento, CA 95814 — Phone: (916) 445-9555 — Website: oag.ca.gov",
        },
        { kind: "p-strong", text: "Other States:" },
        {
          kind: "p",
          text: "Contact your state's Attorney General or consumer protection office for privacy-related complaints.",
        },
      ],
    },
  ],
};
