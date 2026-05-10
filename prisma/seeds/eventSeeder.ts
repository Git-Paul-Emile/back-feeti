import { PrismaClient } from '../../src/generated/prisma/client.js';

// Événements indexés par pays (countryCode)
const eventsData = [

  // ═══════════════════════════════════════════════════════════════
  //  🇨🇬  CONGO (CG) — Brazzaville / Pointe-Noire
  // ═══════════════════════════════════════════════════════════════
  {
    countryCode: 'CG',
    title: 'Festival Électro Summer Live',
    description: 'Le plus grand festival de musique électronique en streaming live depuis Brazzaville. Plusieurs artistes internationaux se produisent en direct.',
    date: '2026-07-15', time: '20:00',
    location: 'Studio Live, Brazzaville',
    image: 'https://images.unsplash.com/photo-1731427442377-e531ddf62066?w=1080&q=80&fit=crop',
    price: 15000, currency: 'FCFA', category: 'Musique',
    maxAttendees: 3000, attendees: 1250,
    isLive: true, isFeatured: true, isFavorite: false, status: 'published',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    countryCode: 'CG',
    title: 'Jazz Session Live',
    description: 'Session jazz intimiste en streaming direct depuis le Blue Note de Pointe-Noire. Une soirée acoustique exceptionnelle.',
    date: '2026-07-18', time: '18:30',
    location: 'Blue Note, Pointe-Noire',
    image: 'https://images.unsplash.com/photo-1723450486856-fe8102d0f1c9?w=1080&q=80&fit=crop',
    price: 12000, currency: 'FCFA', category: 'Jazz',
    maxAttendees: 800, attendees: 320,
    isLive: true, isFeatured: false, isFavorite: true, status: 'published',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  },
  {
    countryCode: 'CG',
    title: 'Théâtre En Direct : Antigone',
    description: "Pièce de théâtre classique en streaming depuis le Théâtre National. Une interprétation moderne d'Antigone par la troupe nationale.",
    date: '2026-07-22', time: '19:00',
    location: 'Théâtre National, Brazzaville',
    image: 'https://images.unsplash.com/photo-1539964604210-db87088e0c2c?w=1080&q=80&fit=crop',
    price: 18000, currency: 'FCFA', category: 'Art & Culture',
    maxAttendees: 1200, attendees: 450,
    isLive: true, isFeatured: true, isFavorite: false, status: 'published',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  },
  {
    countryCode: 'CG',
    title: 'Festival de Musique Traditionnelle',
    description: 'Célébration de la musique traditionnelle congolaise à ciel ouvert. Trois jours de concerts, expositions et ateliers culturels.',
    date: '2026-08-10', time: '16:00',
    location: 'Place de la République, Brazzaville',
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1080&q=80&fit=crop',
    price: 12000, currency: 'FCFA', category: 'Musique',
    maxAttendees: 800, attendees: 450,
    isLive: false, isFeatured: true, isFavorite: true, status: 'published',
  },
  {
    countryCode: 'CG',
    title: 'Concert Classique — Orchestre National',
    description: "Soirée de musique classique avec l'Orchestre National du Congo. Beethoven, Mozart et œuvres africaines contemporaines.",
    date: '2026-08-15', time: '19:30',
    location: 'Salle de Concert, Brazzaville',
    image: 'https://images.unsplash.com/photo-1465847734447-7e6c4553ddb4?w=1080&q=80&fit=crop',
    price: 30000, currency: 'FCFA', category: 'Musique',
    maxAttendees: 200, attendees: 120,
    isLive: false, isFeatured: true, isFavorite: false, status: 'published',
  },
  {
    countryCode: 'CG',
    title: 'Comedy Night Brazzaville',
    description: 'Une soirée de stand-up comedy avec les meilleurs humoristes congolais. Rires garantis !',
    date: '2026-08-05', time: '20:00',
    location: 'Le Palace, Brazzaville',
    image: 'https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=1080&q=80&fit=crop',
    price: 20000, currency: 'FCFA', category: 'Humour',
    maxAttendees: 300, attendees: 210,
    isLive: false, isFeatured: false, isFavorite: true, status: 'published',
  },
  {
    countryCode: 'CG',
    title: 'Marathon de Brazzaville',
    description: 'Course annuelle à travers les plus beaux quartiers de Brazzaville. 10 km, semi-marathon et marathon complet.',
    date: '2026-09-01', time: '07:00',
    location: 'Centre-Ville, Brazzaville',
    image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1080&q=80&fit=crop',
    price: 5000, currency: 'FCFA', category: 'Sport',
    maxAttendees: 2000, attendees: 850,
    isLive: false, isFeatured: false, isFavorite: true, status: 'published',
  },
  {
    countryCode: 'CG',
    title: 'Soirée Afrobeats',
    description: "Dance floor géant avec les meilleurs DJ d'afrobeats et de rumba congolaise. La soirée incontournable de l'été.",
    date: '2026-07-30', time: '22:00',
    location: 'Club La Terrasse, Brazzaville',
    image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1080&q=80&fit=crop',
    price: 10000, currency: 'FCFA', category: 'Musique',
    maxAttendees: 600, attendees: 420,
    isLive: false, isFeatured: false, isFavorite: false, status: 'published',
  },

  // ═══════════════════════════════════════════════════════════════
  //  🇨🇩  RDC (CD) — Kinshasa / Lubumbashi
  // ═══════════════════════════════════════════════════════════════
  {
    countryCode: 'CD',
    title: 'Kinshasa Jazz Live',
    description: "Grande soirée jazz en streaming depuis l'emblématique Kin Jazz Club. Les meilleurs musiciens de RDC réunis pour une nuit inoubliable.",
    date: '2026-07-20', time: '19:00',
    location: 'Kin Jazz Club, Kinshasa',
    image: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=1080&q=80&fit=crop',
    price: 20000, currency: 'CDF', category: 'Jazz',
    maxAttendees: 1000, attendees: 480,
    isLive: true, isFeatured: true, isFavorite: false, status: 'published',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    countryCode: 'CD',
    title: 'Festival Rumba Congolaise',
    description: "Célébration de la rumba congolaise, patrimoine mondial de l'UNESCO. Concerts, défilés et ateliers de danse dans tout Kinshasa.",
    date: '2026-08-12', time: '15:00',
    location: 'Stade des Martyrs, Kinshasa',
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1080&q=80&fit=crop',
    price: 15000, currency: 'CDF', category: 'Musique',
    maxAttendees: 10000, attendees: 5200,
    isLive: false, isFeatured: true, isFavorite: true, status: 'published',
  },
  {
    countryCode: 'CD',
    title: 'Forum Tech Kinshasa',
    description: "Conférence internationale sur l'innovation technologique et le numérique en Afrique centrale. Startups, investisseurs et makers.",
    date: '2026-09-05', time: '09:00',
    location: 'Hôtel Fleuve Congo, Kinshasa',
    image: 'https://images.unsplash.com/photo-1582192904915-d89c7250b235?w=1080&q=80&fit=crop',
    price: 25000, currency: 'CDF', category: 'Conférence',
    maxAttendees: 800, attendees: 310,
    isLive: false, isFeatured: false, isFavorite: false, status: 'published',
  },
  {
    countryCode: 'CD',
    title: 'Concert Gospel Live — Lubumbashi',
    description: 'Soirée gospel en streaming depuis la cathédrale Saints-Pierre-et-Paul. Chœurs, orchestres et solistes de renommée internationale.',
    date: '2026-07-26', time: '18:00',
    location: 'Cathédrale Saints-Pierre-et-Paul, Lubumbashi',
    image: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1080&q=80&fit=crop',
    price: 10000, currency: 'CDF', category: 'Musique',
    maxAttendees: 2000, attendees: 780,
    isLive: true, isFeatured: false, isFavorite: true, status: 'published',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  },
  {
    countryCode: 'CD',
    title: 'Salon de la Mode Africaine',
    description: "Défilés de créateurs congolais et africains. Wax, bazin riche et prêt-à-porter contemporain au rendez-vous de la mode kinoise.",
    date: '2026-08-28', time: '14:00',
    location: 'Palais du Peuple, Kinshasa',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1080&q=80&fit=crop',
    price: 12000, currency: 'CDF', category: 'Art & Culture',
    maxAttendees: 500, attendees: 220,
    isLive: false, isFeatured: false, isFavorite: false, status: 'published',
  },

  // ═══════════════════════════════════════════════════════════════
  //  🇬🇦  GABON (GA) — Libreville / Port-Gentil
  // ═══════════════════════════════════════════════════════════════
  {
    countryCode: 'GA',
    title: 'Gabon Music Fest Live',
    description: "Le grand festival musical du Gabon en streaming HD. Artistes gabonais et internationaux dans une ambiance électrique.",
    date: '2026-07-19', time: '20:00',
    location: 'Palais des Sports, Libreville',
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1080&q=80&fit=crop',
    price: 10000, currency: 'XAF', category: 'Musique',
    maxAttendees: 5000, attendees: 2300,
    isLive: true, isFeatured: true, isFavorite: false, status: 'published',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    countryCode: 'GA',
    title: 'Forum Pétrole & Transition Énergétique',
    description: "Conférence internationale sur la transition énergétique en Afrique centrale. Experts, ministres et investisseurs réunis à Libreville.",
    date: '2026-09-08', time: '09:00',
    location: 'Radisson Blu, Libreville',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1080&q=80&fit=crop',
    price: 50000, currency: 'XAF', category: 'Conférence',
    maxAttendees: 400, attendees: 190,
    isLive: false, isFeatured: false, isFavorite: false, status: 'published',
  },
  {
    countryCode: 'GA',
    title: 'Soirée Ndombolo & Coupé Décalé',
    description: "La fête ultime entre Ndombolo et Coupé Décalé au bord de l'Estuaire. DJ sets, live music et ambiance garantie jusqu'au matin.",
    date: '2026-08-02', time: '22:00',
    location: "Beach Club L'Estuaire, Libreville",
    image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1080&q=80&fit=crop',
    price: 8000, currency: 'XAF', category: 'Musique',
    maxAttendees: 700, attendees: 380,
    isLive: false, isFeatured: false, isFavorite: true, status: 'published',
  },
  {
    countryCode: 'GA',
    title: 'Exposition Art Gabonais Contemporain',
    description: "Découverte de la scène artistique gabonaise. Masques, sculptures, peintures et installations numériques des artistes émergents.",
    date: '2026-07-25', time: '10:00',
    location: 'Musée National des Arts, Libreville',
    image: 'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=1080&q=80&fit=crop',
    price: 5000, currency: 'XAF', category: 'Art & Culture',
    maxAttendees: 250, attendees: 110,
    isLive: false, isFeatured: true, isFavorite: false, status: 'published',
  },

  // ═══════════════════════════════════════════════════════════════
  //  🇨🇮  CÔTE D'IVOIRE (CI) — Abidjan / Bouaké
  // ═══════════════════════════════════════════════════════════════
  {
    countryCode: 'CI',
    title: 'Abidjan Urban Fest Live',
    description: "Le festival urbain d'Abidjan : afrobeat, coupé-décalé, rap ivoirien et dancehall en streaming live depuis le Sofitel.",
    date: '2026-07-17', time: '21:00',
    location: 'Sofitel Hôtel Ivoire, Abidjan',
    image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1080&q=80&fit=crop',
    price: 15000, currency: 'XOF', category: 'Musique',
    maxAttendees: 8000, attendees: 4500,
    isLive: true, isFeatured: true, isFavorite: true, status: 'published',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    countryCode: 'CI',
    title: 'MASA — Marché des Arts du Spectacle',
    description: "Le plus grand marché des arts du spectacle en Afrique subsaharienne. Théâtre, danse, musique et cirque venus des 4 coins du continent.",
    date: '2026-08-20', time: '10:00',
    location: 'Palais de la Culture, Abidjan',
    image: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1080&q=80&fit=crop',
    price: 20000, currency: 'XOF', category: 'Art & Culture',
    maxAttendees: 3000, attendees: 1800,
    isLive: false, isFeatured: true, isFavorite: false, status: 'published',
  },
  {
    countryCode: 'CI',
    title: 'Comedy Nuit Abidjan',
    description: "Les plus grands noms du stand-up ivoirien et africain sur scène. Une soirée pour se tenir les côtes au Palais des Congrès.",
    date: '2026-08-08', time: '20:00',
    location: 'Palais des Congrès, Abidjan',
    image: 'https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=1080&q=80&fit=crop',
    price: 18000, currency: 'XOF', category: 'Humour',
    maxAttendees: 1200, attendees: 560,
    isLive: false, isFeatured: false, isFavorite: true, status: 'published',
  },
  {
    countryCode: 'CI',
    title: 'Forum Économique Côte d\'Ivoire 2026',
    description: "Rencontre annuelle des acteurs économiques ivoiriens et de la diaspora. Table rondes, networking et opportunités d'investissement.",
    date: '2026-09-15', time: '09:00',
    location: 'Hôtel du Plateau, Abidjan',
    image: 'https://images.unsplash.com/photo-1551818255-e6e10975bc17?w=1080&q=80&fit=crop',
    price: 35000, currency: 'XOF', category: 'Conférence',
    maxAttendees: 600, attendees: 290,
    isLive: false, isFeatured: false, isFavorite: false, status: 'published',
  },
  {
    countryCode: 'CI',
    title: 'Bouaké Carnaval 2026',
    description: "Le carnaval de Bouaké, fête populaire incontournable de Côte d'Ivoire. Défilés de chars, costumes colorés, musique et danse toute la journée.",
    date: '2026-08-30', time: '10:00',
    location: 'Avenue Houphouët-Boigny, Bouaké',
    image: 'https://images.unsplash.com/photo-1485872299829-c673f5194813?w=1080&q=80&fit=crop',
    price: 0, currency: 'XOF', category: 'Art & Culture',
    maxAttendees: 20000, attendees: 8500,
    isLive: false, isFeatured: false, isFavorite: true, status: 'published',
  },
];

export async function seedEvents(prisma: PrismaClient, organizerId: string) {
  await prisma.payoutTransaction.deleteMany({
    where: { transaction: { event: { organizerId } } },
  });
  await prisma.transactionStatusHistory.deleteMany({
    where: { transaction: { event: { organizerId } } },
  });
  await prisma.transaction.deleteMany({
    where: { event: { organizerId } },
  });
  await prisma.deliveryAddress.deleteMany({
    where: { ticket: { event: { organizerId } } },
  });
  await prisma.ticket.deleteMany({
    where: { event: { organizerId } },
  });
  await prisma.event.deleteMany({ where: { organizerId } });

  let count = 0;
  for (const event of eventsData) {
    await prisma.event.create({ data: { ...event, organizerId } });
    count++;
  }

  const byCountry: Record<string, number> = {};
  eventsData.forEach(e => { byCountry[e.countryCode] = (byCountry[e.countryCode] ?? 0) + 1; });
  console.log(`✅ ${count} événements créés :`);
  for (const [code, n] of Object.entries(byCountry)) {
    console.log(`   • ${code} — ${n} événements`);
  }
}
