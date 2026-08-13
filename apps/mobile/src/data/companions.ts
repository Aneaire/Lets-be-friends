import type { ActivityCategory, FriendStrength } from '@lets-be-friends/shared'

export type SessionMode = 'in_person' | 'online'

export type AvailabilitySlot = {
  id: string
  day: string
  date: string
  time: string
  mode: SessionMode
}

export type Companion = {
  id: string
  name: string
  pronouns: string
  age: number
  location: string
  distance: string
  tagline: string
  bio: string
  imageUrl: string
  verified: boolean
  completedExperiences: number
  responseTime: string
  rating: number
  reviewCount: number
  categories: ActivityCategory[]
  strengths: FriendStrength[]
  languages: string[]
  sessionModes: SessionMode[]
  rateLabel: string
  availability: AvailabilitySlot[]
}

export const companions: Companion[] = [
  {
    id: 'mika-santos',
    name: 'Mika Santos',
    pronouns: 'they/them',
    age: 27,
    location: 'Makati, Metro Manila',
    distance: '2.4 km away',
    tagline: 'Quiet coffee, honest conversation, and city walks at your pace.',
    bio: 'I am a community producer who knows the calm corners of Makati. I companion low-pressure experiences for members who want thoughtful company, a fresh perspective, or a gentle introduction to the city.',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=85',
    verified: true,
    completedExperiences: 86,
    responseTime: 'Usually replies within 20 minutes',
    rating: 4.9,
    reviewCount: 42,
    categories: ['Coffee and meals', 'Explore the city', 'Arts and crafts'],
    strengths: ['Good listener', 'Coffee companion', 'Local tour buddy'],
    languages: ['English', 'Filipino'],
    sessionModes: ['in_person', 'online'],
    rateLabel: 'From ₱650 / experience',
    availability: [
      { id: 'mika-tue', day: 'Tue', date: 'Aug 11', time: '3:00 PM', mode: 'in_person' },
      { id: 'mika-wed', day: 'Wed', date: 'Aug 12', time: '7:00 PM', mode: 'online' },
      { id: 'mika-sat', day: 'Sat', date: 'Aug 15', time: '10:30 AM', mode: 'in_person' },
    ],
  },
  {
    id: 'paolo-reyes',
    name: 'Paolo Reyes',
    pronouns: 'he/him',
    age: 31,
    location: 'Quezon City, Metro Manila',
    distance: '5.8 km away',
    tagline: 'Food trips and neighborhood stories without a rushed itinerary.',
    bio: 'I write about local food and help newcomers feel at home. My experiences are relaxed, practical, and centered on places that treat people well.',
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=85',
    verified: true,
    completedExperiences: 124,
    responseTime: 'Usually replies within 1 hour',
    rating: 4.8,
    reviewCount: 71,
    categories: ['Coffee and meals', 'Explore the city', 'Photo walks'],
    strengths: ['Food trip companion', 'Local tour buddy', 'Photography walk partner'],
    languages: ['English', 'Filipino', 'Kapampangan'],
    sessionModes: ['in_person'],
    rateLabel: 'From ₱800 / experience',
    availability: [
      { id: 'paolo-fri', day: 'Fri', date: 'Aug 14', time: '5:30 PM', mode: 'in_person' },
      { id: 'paolo-sun', day: 'Sun', date: 'Aug 16', time: '11:00 AM', mode: 'in_person' },
    ],
  },
  {
    id: 'sam-dela-cruz',
    name: 'Sam Dela Cruz',
    pronouns: 'she/her',
    age: 25,
    location: 'Pasig, Metro Manila',
    distance: '7.1 km away',
    tagline: 'A steady study partner for deep work, check-ins, and small wins.',
    bio: 'I am a graduate student and peer facilitator. I companion focused coworking and online sessions with clear boundaries, kind accountability, and room to reset.',
    imageUrl: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=85',
    verified: true,
    completedExperiences: 54,
    responseTime: 'Usually replies within 30 minutes',
    rating: 5,
    reviewCount: 29,
    categories: ['Study and coworking', 'Language exchange', 'Good company'],
    strengths: ['Study partner', 'Good listener', 'Language practice'],
    languages: ['English', 'Filipino', 'Japanese'],
    sessionModes: ['online', 'in_person'],
    rateLabel: 'From ₱500 / experience',
    availability: [
      { id: 'sam-mon', day: 'Mon', date: 'Aug 10', time: '8:00 PM', mode: 'online' },
      { id: 'sam-thu', day: 'Thu', date: 'Aug 13', time: '6:30 PM', mode: 'online' },
      { id: 'sam-sat', day: 'Sat', date: 'Aug 15', time: '2:00 PM', mode: 'in_person' },
    ],
  },
  {
    id: 'ines-garcia',
    name: 'Ines Garcia',
    pronouns: 'she/they',
    age: 29,
    location: 'BGC, Taguig',
    distance: '8.6 km away',
    tagline: 'Creative resets through sketching, conversation, and gentle prompts.',
    bio: 'I facilitate beginner-friendly creative sessions. No portfolio is needed. We can draw together online or meet in a public studio space for a grounded afternoon.',
    imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=85',
    verified: true,
    completedExperiences: 67,
    responseTime: 'Usually replies within 2 hours',
    rating: 4.9,
    reviewCount: 38,
    categories: ['Arts and crafts', 'Good company', 'Hobbies and skills'],
    strengths: ['Hobby mentor', 'Good listener', 'Online chat friend'],
    languages: ['English', 'Filipino', 'Spanish'],
    sessionModes: ['online', 'in_person'],
    rateLabel: 'From ₱700 / experience',
    availability: [
      { id: 'ines-wed', day: 'Wed', date: 'Aug 12', time: '4:00 PM', mode: 'online' },
      { id: 'ines-sun', day: 'Sun', date: 'Aug 16', time: '3:30 PM', mode: 'in_person' },
    ],
  },
]

export function getCompanion(id: string) {
  return companions.find((companion) => companion.id === id)
}
