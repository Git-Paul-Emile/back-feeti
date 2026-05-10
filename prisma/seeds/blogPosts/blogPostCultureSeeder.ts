import { PrismaClient } from '../../../src/generated/prisma/client.js';

export const culturePostsData = [
  {
    title: "L'Art Contemporain Congolais : Une Renaissance Culturelle",
    excerpt: "Exploration de la scène artistique contemporaine au Congo et de son impact sur la culture locale.",
    content: `<p>La scène artistique contemporaine en République du Congo vit une renaissance spectaculaire. Des artistes talentueux émergent et repoussent les frontières de la créativité, mêlant tradition et modernité dans des œuvres qui racontent l'histoire et les aspirations d'un peuple.</p>

<h2>Les Nouvelles Voix de l'Art Congolais</h2>
<p>Une nouvelle génération d'artistes s'impose sur la scène internationale, portant avec fierté les couleurs de la culture congolaise. Leurs œuvres explorent des thèmes universels — identité, mémoire, espoir — à travers un prisme résolument africain.</p>

<h2>Les Galeries et Espaces Culturels</h2>
<p>Brazzaville et Pointe-Noire voient fleurir de nouveaux espaces dédiés à l'art contemporain. Ces lieux de création et d'exposition deviennent des carrefours culturels où se rencontrent artistes locaux et internationaux, favorisant les échanges et les collaborations.</p>

<h2>L'Art comme Vecteur Social</h2>
<p>Au-delà de l'esthétique, l'art contemporain congolais joue un rôle social important. Il interroge, questionne, et propose des alternatives face aux défis contemporains de la société. Des fresques murales aux installations interactives, les artistes investissent l'espace public pour dialoguer avec les citoyens.</p>

<h2>La Reconnaissance Internationale</h2>
<p>Plusieurs artistes congolais participent désormais aux grandes biennales et expositions internationales. Cette visibilité accrue renforce le rayonnement culturel du Congo et ouvre de nouveaux marchés pour les créateurs locaux.</p>

<p>Cette renaissance culturelle est le signe d'une vitalité créatrice extraordinaire, et annonce un avenir radieux pour les arts au Congo.</p>`,
    categorySlug: 'culture',
    tags: JSON.stringify(['art', 'culture', 'congo', 'contemporain', 'galerie']),
    featuredImage: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop&crop=entropy',
    status: 'published',
    isFeatured: false,
    views: 567,
    comments: 8,
    readTime: 6,
    publishDate: new Date('2024-01-08'),
  },
  {
    title: 'Patrimoine Musical : Les Légendes du Congo',
    excerpt: "Retour sur les grands noms de la musique congolaise qui ont marqué l'histoire et continuent d'inspirer.",
    content: `<p>La musique congolaise est un patrimoine inestimable qui rayonne bien au-delà des frontières du pays. De la rumba congolaise au ndombolo, en passant par le soukous, les artistes congolais ont su créer un genre musical unique qui a conquis le monde entier.</p>

<h2>Les Pionniers de la Rumba Congolaise</h2>
<p>Grand Kallé, Franco Luambo Makiadi, Tabu Ley Rochereau… Ces noms sont gravés dans l'histoire de la musique africaine. Ils ont posé les bases d'un style musical qui continue d'influencer des générations d'artistes à travers le continent et au-delà.</p>

<h2>L'Évolution vers le Soukous</h2>
<p>Dans les années 70-80, la rumba s'est transformée pour donner naissance au soukous, un rythme plus rapide et plus dansant qui a conquis les pistes de danse du monde entier. Des artistes comme Papa Wemba et Kanda Bongo Man ont porté ce style à son apogée.</p>

<h2>La Scène Contemporaine</h2>
<p>Aujourd'hui, une nouvelle génération d'artistes congolais perpétue cette tradition musicale tout en l'adaptant aux sonorités modernes. Fally Ipupa, Ferré Gola, Innoss'B et bien d'autres continuent de faire rayonner la musique congolaise sur la scène internationale.</p>

<h2>La Rumba, Patrimoine Mondial de l'UNESCO</h2>
<p>En 2021, la rumba congolaise a été inscrite au patrimoine culturel immatériel de l'UNESCO, consacrant ainsi sa valeur universelle et son importance pour l'humanité. Une fierté immense pour tout le peuple congolais.</p>`,
    categorySlug: 'culture',
    tags: JSON.stringify(['musique', 'patrimoine', 'rumba', 'légendes', 'histoire', 'UNESCO']),
    featuredImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop&crop=entropy',
    status: 'published',
    isFeatured: false,
    views: 934,
    comments: 27,
    readTime: 7,
    publishDate: new Date('2024-01-01'),
  },
  {
    title: 'La Littérature Congolaise Moderne : Voix et Engagements',
    excerpt: "Portrait de la nouvelle génération d'écrivains congolais qui réinventent la narration africaine contemporaine.",
    content: `<p>La littérature congolaise vit un renouveau fascinant. Une nouvelle génération d'écrivains s'empare de la plume pour raconter le Congo d'aujourd'hui, avec ses contradictions, ses espoirs et sa beauté singulière.</p>

<h2>La Tradition Littéraire Congolaise</h2>
<p>Le Congo possède une riche tradition littéraire dont les pionniers comme Sony Labou Tansi, Henri Lopes ou Tchicaya U Tam'si ont marqué les lettres africaines francophones. Leurs œuvres, empreintes de poésie et d'engagement politique, restent des références incontournables.</p>

<h2>Les Nouvelles Plumes</h2>
<p>Aujourd'hui, de jeunes auteurs congolais explorent de nouvelles formes narratives. Romans, nouvelles, poésie, récits autobiographiques… ils diversifient les genres et les approches pour raconter une Afrique contemporaine complexe et nuancée.</p>

<h2>Les Thèmes de Prédilection</h2>
<p>La mémoire coloniale, l'identité diasporique, les mutations sociales des grandes villes, la condition féminine, et la jeunesse en quête de repères sont les grands thèmes qui traversent la littérature congolaise actuelle.</p>

<h2>La Diffusion et les Prix Littéraires</h2>
<p>Les auteurs congolais figurent de plus en plus dans les sélections des grands prix littéraires africains et francophones. Cette reconnaissance encourage une nouvelle génération à prendre la plume et à faire entendre la voix du Congo dans le monde.</p>`,
    categorySlug: 'culture',
    tags: JSON.stringify(['littérature', 'écrivains', 'livres', 'francophonie', 'culture']),
    featuredImage: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&h=600&fit=crop&crop=entropy',
    status: 'published',
    isFeatured: false,
    views: 389,
    comments: 14,
    readTime: 8,
    publishDate: new Date('2024-02-12'),
  },
  {
    title: 'Le Cinéma Congolais : Entre Tradition et Modernité',
    excerpt: "Comment le 7ème art s'éveille au Congo et tente de raconter ses propres histoires à l'écran.",
    content: `<p>Le cinéma congolais est en train de s'écrire. Portés par la passion et souvent de petits budgets, des cinéastes congolais multiplient les courts et longs métrages pour offrir une vision authentique de leur pays, loin des clichés véhiculés par le cinéma occidental.</p>

<h2>Les Pionniers du Cinéma Congolais</h2>
<p>Les premiers films congolais datent des années 70. Des cinéastes visionnaires ont posé les bases d'un cinéma national ancré dans les réalités locales, mais leurs œuvres restaient peu diffusées faute de salles et de circuits de distribution adaptés.</p>

<h2>La Révolution Numérique</h2>
<p>L'avènement du numérique a démocratisé la production cinématographique. Aujourd'hui, un smartphone et un logiciel de montage suffisent pour réaliser un film. Cette accessibilité a permis l'émergence d'une nouvelle vague de jeunes cinéastes congolais.</p>

<h2>Les Festivals et la Visibilité</h2>
<p>Les festivals de cinéma africain — FESPACO, FIFF de Namur, ou le Festival Écrans Noirs de Yaoundé — offrent une vitrine internationale aux films congolais. Ces rendez-vous sont essentiels pour le rayonnement de ce cinéma émergent.</p>

<h2>Les Défis à Surmonter</h2>
<p>Le manque de financement, l'absence de salles de cinéma modernes (Brazzaville ne compte plus que quelques écrans actifs), et la difficulté à toucher le grand public restent les principaux obstacles au développement du cinéma congolais.</p>`,
    categorySlug: 'culture',
    tags: JSON.stringify(['cinéma', 'films', '7ème art', 'réalisateurs', 'culture']),
    featuredImage: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=600&fit=crop&crop=entropy',
    status: 'draft',
    isFeatured: false,
    views: 0,
    comments: 0,
    readTime: 7,
    publishDate: null,
  },
];

export async function seedBlogPostsCulture(prisma: PrismaClient, authorId: string, slugify: (s: string) => string) {
  for (const post of culturePostsData) {
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
  console.log(`  ✔ ${culturePostsData.length} articles Culture`);
}
