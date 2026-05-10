import { PrismaClient } from '../../../src/generated/prisma/client.js';

export const techPostsData = [
  {
    title: 'La Tech au Service de la Billetterie en Afrique',
    excerpt: "Comment les solutions numériques révolutionnent la vente de billets et la gestion d'événements en Afrique.",
    content: `<p>La transformation numérique de la billetterie événementielle en Afrique s'accélère. Des solutions innovantes émergent pour répondre aux besoins spécifiques du continent et faciliter l'accès aux événements culturels et sportifs.</p>

<h2>La Billetterie Mobile</h2>
<p>Avec la démocratisation des smartphones, la billetterie mobile s'impose comme la solution de référence. Les codes QR et les billets électroniques éliminent les fraudes et simplifient le contrôle d'accès. Fini les files d'attente interminables et les billets contrefaits.</p>

<h2>Les Paiements Digitaux</h2>
<p>L'intégration des solutions de paiement mobile (MTN Mobile Money, Airtel Money) dans les plateformes de billetterie a révolutionné l'accès aux événements, permettant à des millions d'Africains d'acheter leurs billets sans compte bancaire.</p>

<h2>La Data au Service des Organisateurs</h2>
<p>Les outils d'analyse des données permettent aux organisateurs de mieux comprendre leur public, d'optimiser leurs prix, et de personnaliser leur communication pour maximiser les ventes. Ces insights transforment la manière dont les événements sont planifiés et marketing.</p>

<h2>Les Défis de la Connectivité</h2>
<p>Malgré ces avancées, la connectivité reste un défi en Afrique. Les solutions hors-ligne et les systèmes de cache intelligents permettent de traiter les transactions même en cas de réseau instable, garantissant une expérience utilisateur fluide.</p>`,
    categorySlug: 'tech',
    tags: JSON.stringify(['technologie', 'billetterie', 'numérique', 'afrique', 'mobile-money']),
    featuredImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop&crop=entropy',
    status: 'published',
    isFeatured: false,
    views: 312,
    comments: 6,
    readTime: 6,
    publishDate: new Date('2024-01-20'),
  },
  {
    title: 'Intelligence Artificielle et Événementiel : Ce qui Arrive en Afrique',
    excerpt: "L'IA commence à transformer l'organisation d'événements. Quels sont les cas d'usage concrets pour les organisateurs africains ?",
    content: `<p>L'intelligence artificielle n'est plus réservée aux géants de la Silicon Valley. Des solutions accessibles et adaptées au contexte africain émergent et transforment progressivement l'industrie événementielle sur le continent.</p>

<h2>La Recommandation Personnalisée</h2>
<p>Des algorithmes de recommandation permettent désormais de suggérer des événements pertinents aux utilisateurs en fonction de leurs préférences, de leur historique d'achat et de leur localisation. Cette personnalisation augmente significativement le taux de conversion et la satisfaction des utilisateurs.</p>

<h2>Les Chatbots au Service des Participants</h2>
<p>Les chatbots alimentés par l'IA gèrent les questions fréquentes des participants 24h/24 : informations pratiques, modalités de remboursement, accès pour les personnes à mobilité réduite… Ils déchargent les équipes organisatrices et améliorent l'expérience participant.</p>

<h2>L'Analyse des Sentiments sur les Réseaux Sociaux</h2>
<p>Les outils d'analyse des sentiments permettent de surveiller en temps réel ce qui se dit sur un événement sur les réseaux sociaux. Ces insights précieux aident les organisateurs à réagir rapidement aux problèmes et à capitaliser sur les moments positifs.</p>

<h2>La Reconnaissance Faciale et la Sécurité</h2>
<p>Certains grands événements africains expérimentent la reconnaissance faciale pour le contrôle d'accès. Si cette technologie pose des questions éthiques légitimes, elle offre une efficacité et une rapidité incomparables pour les événements à forte affluence.</p>

<h2>L'Avenir de l'IA dans l'Événementiel Africain</h2>
<p>Les prochaines années verront une adoption croissante de l'IA dans l'événementiel africain. Les startups locales développent des solutions adaptées aux contraintes du continent, notamment en matière de connectivité et de diversité linguistique.</p>`,
    categorySlug: 'tech',
    tags: JSON.stringify(['IA', 'intelligence artificielle', 'innovation', 'événementiel', 'futur']),
    featuredImage: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&h=600&fit=crop&crop=entropy',
    status: 'published',
    isFeatured: false,
    views: 487,
    comments: 18,
    readTime: 9,
    publishDate: new Date('2024-02-14'),
  },
  {
    title: 'Les Startups Tech Congolaises à Suivre en 2024',
    excerpt: "Portrait des entreprises technologiques émergentes qui transforment l'économie numérique au Congo.",
    content: `<p>L'écosystème des startups tech congolaises est en pleine effervescence. Des entrepreneurs audacieux développent des solutions innovantes pour résoudre les problèmes locaux et créer de la valeur sur le continent.</p>

<h2>Fintech : Révolutionner les Paiements</h2>
<p>Plusieurs startups congolaises s'attaquent aux services financiers, un secteur où l'exclusion reste importante. Des solutions de paiement mobile, de microcrédit digital et d'épargne collective émergent pour offrir des services financiers aux populations non bancarisées.</p>

<h2>Agritech : Nourrir le Congo de Demain</h2>
<p>L'agriculture représente une part importante de l'économie congolaise. Des startups développent des outils pour aider les agriculteurs : prévisions météo, plateformes de mise en relation avec les acheteurs, gestion des stocks… Ces solutions améliorent les revenus et réduisent les pertes post-récolte.</p>

<h2>Edtech : Démocratiser l'Éducation</h2>
<p>L'accès à une éducation de qualité reste un défi majeur. Des plateformes d'apprentissage en ligne adaptées aux conditions de connectivité africaine permettent à des milliers d'élèves et d'étudiants d'accéder à des contenus pédagogiques de qualité.</p>

<h2>Healthtech : La Santé Numérique</h2>
<p>Des applications de téléconsultation médicale, de gestion des dossiers patients et de suivi épidémiologique émergent pour pallier le manque de professionnels de santé dans certaines régions. La healthtech congolaise sauve des vies.</p>

<h2>L'Écosystème de Soutien</h2>
<p>Les incubateurs, accélérateurs et espaces de coworking se multiplient à Brazzaville et Pointe-Noire, offrant aux entrepreneurs les ressources, le mentorat et le réseau nécessaires pour faire croître leurs projets.</p>`,
    categorySlug: 'tech',
    tags: JSON.stringify(['startups', 'tech', 'innovation', 'congo', 'entrepreneuriat']),
    featuredImage: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=600&fit=crop&crop=entropy',
    status: 'published',
    isFeatured: false,
    views: 263,
    comments: 7,
    readTime: 8,
    publishDate: new Date('2024-03-01'),
  },
  {
    title: 'Streaming Live d\'Événements : Guide Technique pour les Débutants',
    excerpt: "Tout ce qu'il faut savoir pour diffuser un événement en direct sur les réseaux sociaux avec un budget limité.",
    content: `<p>Le streaming live d'événements est devenu accessible à tous. Avec un smartphone récent et une connexion Internet correcte, il est possible de diffuser un événement en direct à des milliers de spectateurs. Voici comment s'y prendre.</p>

<h2>L'Équipement Minimum</h2>
<p>Pour démarrer, vous n'avez besoin que d'un smartphone avec une bonne caméra (la plupart des modèles récents conviennent), d'une connexion 4G stable ou d'une connexion WiFi fiable, et d'un trépied pour stabiliser votre image. Un micro externe améliore considérablement la qualité audio.</p>

<h2>Les Plateformes de Streaming</h2>
<p>Facebook Live, YouTube Live, et Instagram Live sont les plateformes les plus utilisées en Afrique Centrale. Facebook Live offre la meilleure portée organique grâce à sa base d'utilisateurs massive. YouTube est préférable pour conserver les vidéos et les rendre accessibles après l'événement.</p>

<h2>Optimiser la Qualité du Signal</h2>
<p>La qualité du streaming dépend directement de votre connexion Internet. Testez votre débit en amont, positionnez-vous proche de la borne WiFi si possible, et prévoyez un plan B (partage de connexion via un autre smartphone) en cas de problème.</p>

<h2>Engager votre Audience en Temps Réel</h2>
<p>Le streaming live n'est pas un simple enregistrement vidéo : c'est une interaction en temps réel avec votre audience. Désignez quelqu'un pour modérer les commentaires, lire les questions, et maintenir l'engagement du public virtuel tout au long de l'événement.</p>`,
    categorySlug: 'tech',
    tags: JSON.stringify(['streaming', 'live', 'guide', 'technique', 'vidéo', 'réseaux sociaux']),
    featuredImage: 'https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=800&h=600&fit=crop&crop=entropy',
    status: 'draft',
    isFeatured: false,
    views: 0,
    comments: 0,
    readTime: 8,
    publishDate: null,
  },
];

export async function seedBlogPostsTech(prisma: PrismaClient, authorId: string, slugify: (s: string) => string) {
  for (const post of techPostsData) {
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
  console.log(`  ✔ ${techPostsData.length} articles Technologie`);
}
