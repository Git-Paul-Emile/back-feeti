import { PrismaClient } from '../../../src/generated/prisma/client.js';

export const eventsPostsData = [
  {
    title: 'Les Tendances Événementielles 2024 en Afrique Centrale',
    excerpt: "Découvrez les nouvelles tendances qui façonnent l'industrie événementielle en République du Congo et dans la région.",
    content: `<p>L'industrie événementielle en Afrique Centrale connaît une transformation remarquable en 2024. Avec l'émergence de nouvelles technologies et l'évolution des attentes du public, les organisateurs d'événements doivent s'adapter pour créer des expériences mémorables et innovantes.</p>

<h2>1. L'Hybridation des Événements</h2>
<p>La tendance principale de cette année est sans conteste l'hybridation. Les événements combinent désormais le présentiel et le digital pour toucher un public plus large. En République du Congo, nous observons une augmentation de 70% des événements hybrides par rapport à 2023.</p>

<h2>2. La Durabilité au Cœur des Préoccupations</h2>
<p>Les organisateurs intègrent de plus en plus des pratiques durables dans leurs événements. Utilisation de matériaux recyclables, réduction des déchets, et sensibilisation environnementale deviennent des critères essentiels.</p>

<h2>3. L'Expérience Immersive</h2>
<p>Les technologies de réalité virtuelle et augmentée commencent à faire leur apparition dans les événements locaux, offrant des expériences uniques aux participants.</p>

<h2>4. La Personnalisation</h2>
<p>Grâce aux données collectées, les organisateurs peuvent désormais créer des expériences personnalisées pour chaque participant, améliorant ainsi la satisfaction et l'engagement.</p>

<p>Ces tendances redéfinissent l'industrie événementielle en Afrique Centrale et ouvrent de nouvelles opportunités pour les professionnels du secteur.</p>`,
    categorySlug: 'events',
    tags: JSON.stringify(['tendances', 'événements', 'afrique', '2024']),
    featuredImage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop&crop=entropy',
    status: 'published',
    isFeatured: true,
    views: 1250,
    comments: 23,
    readTime: 8,
    publishDate: new Date('2024-01-15'),
  },
  {
    title: 'Comment Organiser un Festival de Musique Réussi',
    excerpt: "Guide pratique pour organiser un festival de musique mémorable, de la planification à l'exécution.",
    content: `<p>Organiser un festival de musique est une aventure passionnante qui requiert une planification méticuleuse et une gestion rigoureuse. Voici notre guide complet pour vous aider à réussir votre événement musical.</p>

<h2>Étape 1 : Définir le Concept</h2>
<p>Avant tout, définissez clairement le genre musical, le public cible, et l'ambiance souhaitée. Un festival de rumba congolaise n'aura pas les mêmes besoins qu'un festival de jazz ou de musique électronique.</p>

<h2>Étape 2 : Le Budget</h2>
<p>Établissez un budget détaillé incluant : cachets des artistes, location du site, équipement sonore et lumières, sécurité, communication, et une réserve pour les imprévus (minimum 15% du budget total).</p>

<h2>Étape 3 : Choisir le Site</h2>
<p>Le choix du lieu est crucial. Vérifiez la capacité d'accueil, l'accessibilité, les autorisations nécessaires, et la proximité des infrastructures (parking, transports, hébergements).</p>

<h2>Étape 4 : Les Artistes</h2>
<p>Négociez avec les artistes et leurs managers en amont. Prévoyez des contrats clairs avec les conditions techniques requises (rider technique) et les modalités de paiement.</p>

<h2>Étape 5 : La Communication</h2>
<p>Lancez votre campagne de communication au moins 3 mois avant l'événement. Utilisez les réseaux sociaux, la radio locale, et les influenceurs pour maximiser la visibilité.</p>`,
    categorySlug: 'events',
    tags: JSON.stringify(['festival', 'musique', 'organisation', 'guide']),
    featuredImage: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=600&fit=crop&crop=entropy',
    status: 'published',
    isFeatured: false,
    views: 890,
    comments: 15,
    readTime: 12,
    publishDate: new Date('2024-01-10'),
  },
  {
    title: 'Gestion de Crise lors d\'un Grand Événement : Leçons Pratiques',
    excerpt: "Comment anticiper et gérer les imprévus pour que votre événement se déroule sans accroc, même face à l'adversité.",
    content: `<p>Tout organisateur d'événements redoute les imprévus : panne de courant, intempéries, absence d'un artiste vedette, débordements dans la foule… La gestion de crise est une compétence indispensable que tout professionnel de l'événementiel doit maîtriser.</p>

<h2>Anticiper : Le Plan de Continuité</h2>
<p>La meilleure gestion de crise commence bien avant l'événement. Établissez un plan de continuité qui identifie les risques potentiels et leurs solutions. Pour chaque scénario catastrophe, ayez un plan B clairement défini et connu de toute l'équipe.</p>

<h2>La Communication en Temps de Crise</h2>
<p>Désignez un responsable communication unique pour éviter les messages contradictoires. Préparez des modèles de messages pour les situations d'urgence les plus probables. La transparence avec le public reste toujours la meilleure approche.</p>

<h2>La Sécurité Avant Tout</h2>
<p>Établissez des procédures d'évacuation claires, formez votre équipe aux premiers secours, et assurez une présence médicale adaptée à la jauge de votre événement. En République du Congo, collaborez avec la Croix-Rouge locale pour les événements de grande envergure.</p>

<h2>L'Après-Crise</h2>
<p>Une fois la situation gérée, faites un débriefing complet avec toutes les équipes. Documentez ce qui s'est passé, ce qui a fonctionné et ce qui doit être amélioré. Chaque crise est une opportunité d'amélioration pour les événements futurs.</p>`,
    categorySlug: 'events',
    tags: JSON.stringify(['gestion', 'crise', 'événements', 'sécurité', 'organisation']),
    featuredImage: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop&crop=entropy',
    status: 'published',
    isFeatured: false,
    views: 445,
    comments: 9,
    readTime: 9,
    publishDate: new Date('2024-02-05'),
  },
  {
    title: 'Le Marketing Événementiel sur les Réseaux Sociaux en Afrique',
    excerpt: "Stratégies concrètes pour promouvoir vos événements sur Facebook, Instagram et TikTok auprès du public africain.",
    content: `<p>Avec plus de 500 millions d'utilisateurs africains sur les réseaux sociaux, le marketing digital est devenu incontournable pour promouvoir ses événements. Voici comment maximiser votre impact en ligne.</p>

<h2>Facebook : La Plateforme Reine en Afrique Centrale</h2>
<p>Facebook reste le réseau social le plus utilisé en Afrique Centrale. Créez un événement Facebook dédié, activez les options de billetterie intégrées, et utilisez la publicité ciblée pour atteindre votre audience idéale. Les Facebook Lives en amont de l'événement génèrent un fort engagement.</p>

<h2>Instagram : L'Image avant Tout</h2>
<p>Instagram est parfait pour construire l'identité visuelle de votre événement. Investissez dans des visuels de qualité, utilisez les Stories pour la communication quotidienne, et collaborez avec des influenceurs locaux qui partagent les valeurs de votre événement.</p>

<h2>TikTok : La Plateforme des Jeunes</h2>
<p>Pour toucher un public de moins de 30 ans, TikTok est désormais indispensable. Les défis viraux (#challenge), les coulisses de la préparation, et les teasers créatifs peuvent générer un buzz considérable avant l'événement.</p>

<h2>Mesurer le ROI de vos Actions</h2>
<p>Utilisez les outils analytiques intégrés à chaque plateforme pour suivre vos indicateurs clés : portée, engagement, clics vers la billetterie, coût par conversion. Ces données vous permettront d'optimiser votre budget marketing.</p>`,
    categorySlug: 'events',
    tags: JSON.stringify(['marketing', 'réseaux sociaux', 'promotion', 'digital', 'événements']),
    featuredImage: 'https://images.unsplash.com/photo-1611926653458-09294b3142bf?w=800&h=600&fit=crop&crop=entropy',
    status: 'published',
    isFeatured: false,
    views: 621,
    comments: 11,
    readTime: 7,
    publishDate: new Date('2024-02-20'),
  },
];

export async function seedBlogPostsEvents(prisma: PrismaClient, authorId: string, slugify: (s: string) => string) {
  for (const post of eventsPostsData) {
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
  console.log(`  ✔ ${eventsPostsData.length} articles Événements`);
}
