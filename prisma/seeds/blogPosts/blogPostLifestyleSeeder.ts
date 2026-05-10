import { PrismaClient } from '../../../src/generated/prisma/client.js';

export const lifestylePostsData = [
  {
    title: 'Lifestyle Digital : Vivre Connecté à Brazzaville',
    excerpt: "Comment la technologie transforme notre quotidien dans la capitale congolaise.",
    content: `<p>Brazzaville entre de plain-pied dans l'ère du digital. Smartphones, applications mobiles, réseaux sociaux… la technologie redéfinit le quotidien des Brazzavillois et ouvre de nouvelles perspectives dans tous les domaines de la vie.</p>

<h2>La Révolution Mobile</h2>
<p>Avec un taux de pénétration mobile en constante augmentation, les Brazzavillois utilisent leur smartphone pour tout : payer leurs achats, réserver des transports, commander de la nourriture, et rester connectés avec leur famille à travers le pays et le monde.</p>

<h2>Les Entrepreneurs Digitaux</h2>
<p>Une nouvelle génération d'entrepreneurs congolais mise sur le digital pour développer leurs activités. Startups tech, agences de communication digitale, influenceurs… l'économie numérique crée de nouvelles opportunités d'emploi et de revenus, notamment pour les jeunes diplômés.</p>

<h2>Les Défis à Relever</h2>
<p>Malgré ces avancées, des défis persistent : accès à Internet encore limité dans certaines zones périurbaines, coût des données mobiles relativement élevé, et nécessité de former la population aux outils numériques pour éviter la fracture digitale.</p>

<p>La transformation digitale de Brazzaville est en marche, et les opportunités sont immenses pour ceux qui sauront s'adapter et innover.</p>`,
    categorySlug: 'lifestyle',
    tags: JSON.stringify(['digital', 'technologie', 'brazzaville', 'lifestyle', 'mobile']),
    featuredImage: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop&crop=entropy',
    status: 'published',
    isFeatured: false,
    views: 420,
    comments: 12,
    readTime: 5,
    publishDate: new Date('2024-01-05'),
  },
  {
    title: "Les Secrets d'une Cuisine Événementielle d'Exception",
    excerpt: "Découvrez les coulisses de la gastronomie événementielle et les chefs qui marquent la scène culinaire congolaise.",
    content: `<p>La gastronomie événementielle congolaise est en pleine effervescence. Des chefs talentueux revisitent les recettes traditionnelles pour créer des expériences culinaires mémorables qui ravivent la fierté culturelle tout en séduisant les palais les plus exigeants.</p>

<h2>La Cuisine Traditionnelle Réinventée</h2>
<p>Le poulet nyembwe, le maboke de poisson, le saka-saka… ces plats emblématiques de la cuisine congolaise sont réinterprétés avec créativité pour les banquets et événements haut de gamme, sans perdre leur authenticité. Les chefs jouent avec les textures, les présentations et les associations d'épices pour surprendre les convives.</p>

<h2>Les Tendances du Buffet Moderne</h2>
<p>Les buffets thématiques gagnent en popularité. Stations de cuisine en direct, dressage en live, et présentation soignée transforment le repas en véritable spectacle gastronomique. Le concept de "food station" permet aux convives de personnaliser leur assiette selon leurs envies.</p>

<h2>Marier Local et International</h2>
<p>Les chefs congolais excellent dans l'art de marier les saveurs locales aux techniques culinaires internationales, créant ainsi une cuisine fusion unique qui reflète l'ouverture du Congo sur le monde. Cette approche attire une clientèle internationale et valorise les produits locaux.</p>

<h2>Logistique et Organisation</h2>
<p>Derrière chaque repas réussi se cache une organisation millimétrée : approvisionnement en produits frais, gestion des équipes, respect des normes d'hygiène HACCP… la cuisine événementielle est avant tout une affaire de rigueur et de passion.</p>`,
    categorySlug: 'lifestyle',
    tags: JSON.stringify(['cuisine', 'gastronomie', 'chef', 'événements', 'restaurant']),
    featuredImage: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop&crop=entropy',
    status: 'published',
    isFeatured: false,
    views: 756,
    comments: 19,
    readTime: 10,
    publishDate: new Date('2024-01-03'),
  },
  {
    title: 'Brazzaville by Night : Les Spots Incontournables',
    excerpt: "Guide complet des meilleurs endroits pour sortir et s'amuser dans la capitale congolaise.",
    content: `<p>Brazzaville possède une vie nocturne vibrante et diversifiée que beaucoup méconnaissent. Des bars branchés aux clubs de musique live, en passant par les restaurants gastronomiques, la capitale congolaise offre une multitude de possibilités pour passer une excellente soirée.</p>

<h2>Le Centre-ville et la Zone de la Mairie</h2>
<p>Le centre de Brazzaville concentre les établissements les plus prisés. Les bars à cocktails et les restaurants de la zone de la Mairie proposent des ambiances variées, du plus intime au plus festif. C'est ici que se retrouvent les professionnels en fin de semaine.</p>

<h2>Les Clubs de Musique Live</h2>
<p>La rumba congolaise et le ndombolo rythment les nuits brazzavilloises. Plusieurs clubs accueillent des orchestres live qui font danser les noctambules jusqu'aux petites heures du matin. Ces établissements sont l'âme de la vie nocturne de Brazzaville.</p>

<h2>La Corniche : Vue sur le Fleuve Congo</h2>
<p>La Corniche offre un cadre exceptionnel avec une vue imprenable sur le fleuve Congo et les lumières de Kinshasa en face. Les restaurants et bars de la Corniche sont idéaux pour un dîner romantique ou un apéritif entre amis au coucher du soleil.</p>

<h2>La Restauration Nocturne</h2>
<p>Les amateurs de bonne cuisine trouveront leur bonheur dans les nombreux restaurants ouverts en soirée, proposant aussi bien des spécialités locales que des cuisines du monde. Les maquis traditionnels restent des incontournables pour une expérience authentique.</p>`,
    categorySlug: 'lifestyle',
    tags: JSON.stringify(['brazzaville', 'sortir', 'nuit', 'bars', 'clubs', 'restaurants']),
    featuredImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=600&fit=crop&crop=entropy',
    status: 'published',
    isFeatured: false,
    views: 583,
    comments: 16,
    readTime: 6,
    publishDate: new Date('2024-02-08'),
  },
  {
    title: 'Bien-être et Sport à Brazzaville : Les Nouvelles Habitudes',
    excerpt: "La culture du sport et du bien-être gagne du terrain dans la capitale congolaise. Tour d'horizon d'un phénomène en plein essor.",
    content: `<p>Brazzaville bouge ! La culture du sport et du bien-être connaît un essor remarquable dans la capitale congolaise. Des salles de fitness aux cours de yoga en plein air, les Brazzavillois adoptent de nouvelles habitudes saines qui transforment leur rapport au corps et à la santé.</p>

<h2>L'Explosion des Salles de Fitness</h2>
<p>Ces dernières années, le nombre de salles de sport modernes a considérablement augmenté à Brazzaville. Équipées d'appareils dernière génération et animées par des coaches professionnels, ces établissements attirent une clientèle jeune et dynamique soucieuse de son image et de sa santé.</p>

<h2>Le Running : Une Passion Collective</h2>
<p>Les courses à pied organisées dans les rues de Brazzaville rassemblent des centaines de participants. Le Brazza City Run et d'autres événements sportifs populaires créent une communauté de runners passionnés qui se retrouvent aussi bien pour s'entraîner que pour socialiser.</p>

<h2>Le Yoga et la Méditation</h2>
<p>Longtemps perçues comme des pratiques occidentales, le yoga et la méditation trouvent désormais leur place à Brazzaville. Des studios spécialisés et des cours en plein air sur la Corniche offrent une alternative douce pour gérer le stress de la vie urbaine.</p>

<h2>L'Alimentation Saine : Une Tendance de Fond</h2>
<p>Parallèlement à la pratique sportive, les Brazzavillois sont de plus en plus attentifs à leur alimentation. Les restaurants healthy, les jus de fruits frais et les produits biologiques locaux connaissent une popularité grandissante.</p>`,
    categorySlug: 'lifestyle',
    tags: JSON.stringify(['sport', 'bien-être', 'fitness', 'santé', 'brazzaville']),
    featuredImage: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop&crop=entropy',
    status: 'draft',
    isFeatured: false,
    views: 0,
    comments: 0,
    readTime: 7,
    publishDate: null,
  },
];

export async function seedBlogPostsLifestyle(prisma: PrismaClient, authorId: string, slugify: (s: string) => string) {
  for (const post of lifestylePostsData) {
    const slug = slugify(post.title);
    await prisma.blogPost.upsert({
      where: { slug },
      update: {
        title: post.title, excerpt: post.excerpt, content: post.content,
        featuredImage: post.featuredImage, categorySlug: post.categorySlug,
        tags: post.tags, status: post.status, isFeatured: post.isFeatured,
        views: post.views, comments: post.comments, readTime: post.readTime,
        publishDate: post.publishDate,
      },
      create: {
        slug, title: post.title, excerpt: post.excerpt, content: post.content,
        featuredImage: post.featuredImage, categorySlug: post.categorySlug,
        tags: post.tags, status: post.status, isFeatured: post.isFeatured,
        views: post.views, comments: post.comments, readTime: post.readTime,
        publishDate: post.publishDate, authorId,
      },
    });
  }
  console.log(`  ✔ ${lifestylePostsData.length} articles Lifestyle`);
}
