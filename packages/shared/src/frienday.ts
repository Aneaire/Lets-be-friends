// Canonical Frienday guide content shared by the web guide and the native
// guide screen. Icons and layout stay in each client.
export const friendaySteps = [
  {
    title: 'Set up your profile',
    body: 'Use your real identity. Companions list only services they can safely and legally perform.',
  },
  {
    title: 'Find the right match',
    body: 'Members browse Companion profiles. Companions respond only when the request fits their skills and comfort.',
  },
  {
    title: 'Chat and agree in writing',
    body: 'Agree on activity, date, meeting place, duration, price, materials, boundaries, and what counts as complete.',
  },
  {
    title: 'Confirm and fund the booking',
    body: 'The member confirms and the total is reserved. Payment stays reserved until completion. Keep payment in the app.',
  },
  {
    title: 'Meet as agreed',
    body: 'Meet in a well lit public place when possible. Confirm the person matches the profile before continuing.',
  },
  {
    title: 'Decide on optional check-in photos',
    body: 'For member wallet bookings, the Companion decides a start photo and the member decides an end photo. Each may upload one private image or explicitly skip after reading the warning. There is no midpoint photo.',
  },
  {
    title: 'Confirm completion together',
    body: 'At the end, both the Companion and the member confirm completion before separating. Pending requests can still be edited, but accepted sessions have no in-app amendment flow.',
  },
  {
    title: 'Payment stays pending first',
    body: 'After both people confirm completion, funds stay pending before settlement can continue. A booking report pauses unsettled funds for review.',
  },
  {
    title: 'Leave an honest review',
    body: 'Both people may rate each other. Keep reviews truthful, relevant, and free of private details.',
  },
] as const

export const friendayCheckins = [
  {
    title: 'Start photo (Companion)',
    when: 'At the start',
    purpose: 'The Companion may upload one private start image, or explicitly skip after reading the warning.',
  },
  {
    title: 'End photo (member)',
    when: 'At the end',
    purpose: 'The member may upload one private end image, or explicitly skip after reading the warning. There is no midpoint photo.',
  },
] as const

export const friendaySafetyGroups = [
  {
    title: 'Before the Frienday',
    short: 'Before',
    items: [
      'Keep chat, booking details, and payment inside the app.',
      'Read ratings, reviews, descriptions, and qualifications.',
      'Tell a trusted person where you go and when you expect to return.',
      'Arrange your own transport and keep a way to leave.',
    ],
  },
  {
    title: 'During the Frienday',
    short: 'During',
    items: [
      'Follow the agreed task, schedule, price, and boundaries.',
      'Consent can be withdrawn at any time.',
      'Stop if the situation becomes unsafe.',
    ],
  },
  {
    title: 'In an emergency',
    short: 'Emergency',
    items: [
      'Leave first, then contact local emergency services.',
      'Report to Let’s Be Friends only after reaching safety.',
    ],
  },
] as const

export const friendayNotAllowed = [
  'Illegal activity or help with a crime.',
  'Sexual services, exploitation, or trafficking.',
  'Violence, threats, intimidation, harassment, or hate based conduct.',
  'Weapons tasks or activity meant to harm.',
  'Drug sales, illegal substances, or unsafe intoxication.',
  'Fraud, impersonation, cheating, false documents, or deceptive testimony.',
  'Surveillance, stalking, or locating someone without consent.',
  'Unlicensed regulated work when a license is required.',
  'Unsafe work without training, protective equipment, or legal permission.',
  'Any romantic, adult, hazardous, or inappropriate service involving a minor.',
] as const

export const friendayPromise = [
  'Be honest about identity, needs, skills, and qualifications.',
  'Keep important agreements in the app.',
  'Respect consent, privacy, time, property, and boundaries.',
  'Complete your own optional check-in photo, or explicitly skip after reading the warning.',
  'Keep payment on the platform.',
  'Follow local laws and platform rules.',
  'Leave and report the booking if it becomes unsafe.',
] as const
