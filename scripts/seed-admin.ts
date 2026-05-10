import 'dotenv/config';
import { connectToDatabase, prisma } from './src/config/database.js';
import bcrypt from 'bcrypt';

async function seedNewAdmin() {
  try {
    // 1. Initialiser la connexion Prisma AVEC l'extension Firestore
    await connectToDatabase();
    
    console.log('🌱 Création du nouvel administrateur...');
    const passwordHash = await bcrypt.hash('superadmin123', 10);
    
    // 2. Création avec upsert. L'extension captera cela et l'enverra sur Firestore !
    const newAdmin = await prisma.user.upsert({
      where: { email: 'superadmin@feeti.cg' },
      update: {},
      create: {
        name: 'Super Admin',
        email: 'superadmin@feeti.cg',
        passwordHash,
        role: 'super_admin', // ou 'admin'
      }
    });

    console.log('✅ Nouvel admin créé avec succès dans PostgreSQL !');
    console.log(`📧 Email : ${newAdmin.email}`);
    console.log(`🔑 Mot de passe : superadmin123`);
    console.log('⏳ Synchronisation Firestore en cours (attente de 5s pour laisser l\'extension finir)...');

    // On attend 5 secondes avant de déconnecter Prisma pour laisser le temps à 
    // l'extension Prisma (qui tourne en asynchrone) d'envoyer la donnée à Firebase.
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await prisma.$disconnect();
    console.log('🚀 Terminé ! L\'admin est sur PostgreSQL et Firestore.');

  } catch (error) {
    console.error('❌ Erreur lors de la création :', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

seedNewAdmin();
