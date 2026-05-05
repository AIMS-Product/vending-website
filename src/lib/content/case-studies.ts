export type CaseStudyVideo = {
  id: string;
  name: string;
  role: string;
  /** Direct video URL — Bunny CDN until Slice 1c migrates to Cloudflare Stream. */
  videoUrl: string;
  posterUrl: string;
};

export type CaseStudyQuote = {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
  /** Multi-paragraph testimonial body. */
  body: ReadonlyArray<string>;
};

export const caseStudiesHero = {
  eyebrow: "Real People, Real Routes",
  title: "Case Studies",
  body: "Members from across the country share how Vendingpreneurs took them from zero vending experience to a working route — in their own words.",
} as const;

export const caseStudyVideos: ReadonlyArray<CaseStudyVideo> = [
  {
    id: "thomas-rohlader",
    name: "Thomas Rohlader",
    role: "Owner, TR Vending",
    videoUrl:
      "https://siladigital.b-cdn.net/Websites%20Videos/Vendingprenuers/Thomas%20Rohladerl.mp4",
    posterUrl: "/images/testimonials/poster-thomas.png",
  },
  {
    id: "joe-natoli",
    name: "Joe Natoli",
    role: "Owner — Stryker300 Vending",
    videoUrl:
      "https://siladigital.b-cdn.net/Websites%20Videos/Vendingprenuers/Joe%20Natoli-all.mp4",
    posterUrl: "/images/testimonials/poster-joe.png",
  },
  {
    id: "jason-priest",
    name: "Jason Priest",
    role: "Owner of Father & Son Vending & Markets",
    videoUrl:
      "https://siladigital.b-cdn.net/Websites%20Videos/Vendingprenuers/Jason%20Priest.mp4",
    posterUrl: "/images/testimonials/poster-jason.png",
  },
  {
    id: "anthony",
    name: "Anthony, CEO",
    role: "H&H Vending",
    videoUrl:
      "https://siladigital.b-cdn.net/Websites%20Videos/Vendingprenuers/Anthony.mp4",
    posterUrl: "/images/testimonials/poster-anthony.png",
  },
];

export const caseStudyQuotes: ReadonlyArray<CaseStudyQuote> = [
  {
    id: "charles-wheeler",
    name: "Charles Wheeler",
    role: "DenCo Vending LLC",
    avatarUrl: "/images/testimonials/charles-wheeler.png",
    body: [
      "I am a High School Football Coach and Teacher in Texas. I had no previous vending experience prior to joining the Vendingpreneurs. As a matter of fact, I had no formal training in business or sales at all. Joining Vendingpreneurs gave me access to nationwide network of Vendors who are learning right there along with me. The ability to bounce ideas off of each other, celebrate wins, and share mistakes made has helped me scale my business rather quickly. I placed my first market 4 months after joining, and am now 7 months in with 5 markets now live and 2 more being delivered soon!",
    ],
  },
  {
    id: "kelsey-corcoran",
    name: "Kelsey Corcoran",
    role: "Owner — Super Foods Distribution",
    avatarUrl: "/images/testimonials/kelsey-corcoran.png",
    body: [
      "I've only been a part of the community for less than three months and have already gained much more than I expected! Not only does Mike and his team do an incredible job of laying out everything you need to have a successful vending/market business, the Skool community aspect has been really helpful in answering questions and leaning on each other for support as we have our own trial and errors. Side note: For almost 7 years I've had an article about a successful entrepreneur (making $10,000 a month in vending machines) bookmarked on my phone, always wishing I knew how to do it. So glad to have found Mike & this community to finally learn it & would recommend this to all of my friends!",
    ],
  },
  {
    id: "abby-c",
    name: "Abby C",
    role: "Van Pelt Vending",
    avatarUrl: "/images/testimonials/abby-c.png",
    body: [
      'What an experience! We joined Vendingpreneurs on a whim with zero vending knowledge hoping the risk was minimal but the upside would be steep. And, we were right! We now have our four children (ages 8-14) involved, setting an example for hard yet fruitful work, and creating a future that will directly impact them. They get to test snacks, count money, pick products for restocking, clean machines, talk to customers, shop for products, and even be assigned to a certain location as the "lead vending manager". We have been able to go from zero vending machines to 30+ in about a year with the guidance and support from the Vendingpreneurs community. Of course, there have been challenges and lessons learned, but those are great learning tools for our children. On top of that, it\'s been fun and a great conversation starter when neighbors spot a vending machine in our garage. ;) We have learned to adapt to situations, be flexible, and ultimately dive into the entrepreneurial lifestyle. Best decision, highly recommend!',
    ],
  },
  {
    id: "dewitts",
    name: "Dennis and Michelle Dewitt",
    role: "JC Vending",
    avatarUrl: "/images/testimonials/dewitts.png",
    body: [
      "Before I joined the Vendingpreneurs group, I had no experience with vending machines or modern amenities. In the past, I've been intrigued about running my own vending machine business, and after following Mike on social media for several months, I thought that I should give it a try. The Vendingpreneurs community has been very helpful because they provide insight on a lot of things that occur when you place a machine or land a micromarket. The community has been a wealth of knowledge for all things that I've encountered and things that I have not yet encountered. Mike's video's are great as well and I try to watch them as much as I can. The best thing about Vendingpreneurs is that it's a group of people that are fully aware that they are not experts, but they are willing to dive in and make mistakes and learn. Then they are willing to share about their experiences and help others not make the same mistakes.",
    ],
  },
  {
    id: "bret-bourgeois",
    name: "Bret Bourgeois",
    role: "Owner — SC Vending",
    avatarUrl: "/images/testimonials/bret-bourgeois.png",
    body: [
      "I had no previous vending experience. Vendingpreneurs has taken me from zero knowledge about the business to being able to navigate the securing of locations, selecting machines, and deciding on inventory. They have offered excellent assistance throughout the process from start-up to a fully functional vending business. The best thing about Vendingpreneurs is the community and resources available, the relationships built with others who have come alongside me as I continue to build my venture.",
    ],
  },
  {
    id: "kyle-sharp",
    name: "Kyle Sharp",
    role: "Oceanside Vending, LLC",
    avatarUrl: "/images/testimonials/kyle-sharp.png",
    body: [
      "Mike's program helped us go from zero knowledge about the vending industry to having 10 locations in 6 months. It's proven and works!",
    ],
  },
  {
    id: "adam-s",
    name: "Adam S",
    role: "Owner, Emporio Vending LLC",
    avatarUrl: "/images/testimonials/adam-s.png",
    body: [
      "Vendingpreneur has been an absolute game changer for us! We knew nothing about the vending industry and Vendingpreneur welcomed us in and helped us learn and strategize a plan that would work for us. The community as a whole has been amazing with so many hard charging, intelligent entrepreneurs that share their lessons learned every day to help out others. I have texted and called others in the group that are on the other side of the country with questions and they have been more than willing to help me out. We wouldn't be where we are today, with multiple locations up and running, without Mike and the Vendingpreneur community. Mike is extremely knowledgeable and more than willing to help anyone with anything, big or small. He is selfless and very gracious with his time to help you out. He has your best interests at heart and wants nothing more than to help you succeed, while asking nothing in return! If you are interested in the vending machine business there is no better place to start then with Vendingpreneur!",
    ],
  },
  {
    id: "lonny-carter",
    name: "Lonny Carter",
    role: "Owner, Awesome Vend LLC",
    avatarUrl: "/images/testimonials/lonny-carter.jpg",
    body: [
      "Before Vendingpreneurs, I had no knowledge of the vending business. Mike was there every step of the way, incredibly responsive, and a true partner. I just signed my fourth location in less than six months, and I am just getting started!",
    ],
  },
  {
    id: "nolan-mayfield",
    name: "Nolan Mayfield",
    role: "Cofounder at Dash ATM Services",
    avatarUrl: "/images/testimonials/nolan-mayfield.png",
    body: [
      "I had no prior experience with vending (lots of atm experience) and Mike saved my business partner and I from buying the wrong model machine. Vendingpreneurs has since saved us countless mistakes and been an invaluable resource for learning the biz. I cannot recommend it enough and my favorite thing is how engaged everyone is. It's all timely, thoughtful engagement!",
    ],
  },
  {
    id: "ben-sanders",
    name: "Ben Sanders",
    role: "Owner & Operator",
    avatarUrl: "/images/testimonials/ben-sanders.png",
    body: [
      "In just a blink of time, Mike Hoffman and Vendingpreneurs transformed my journey from a mere dream to a tangible reality! With no prior vending experience, their guidance propelled me forward, and within a mere month, I secured my very first vending machine contract, marking the beginning of an incredible entrepreneurial adventure. I am overflowing with gratitude for the invaluable wisdom, support, and vibrant community that Vendingpreneurs offers. It's like finding a guiding light amidst the vast sea of possibilities. To anyone harboring the desire to embark on their entrepreneurial voyage, I wholeheartedly recommend joining this remarkable group. Their expertise is unmatched, their camaraderie uplifting. As I continue to evolve and flourish in this newfound venture, I am profoundly grateful for the unwavering support of Vendingpreneurs. They've become my compass, guiding me through every twist and turn of the business landscape. Namaste, indeed, to the journey ahead!",
    ],
  },
];
