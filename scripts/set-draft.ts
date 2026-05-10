import 'dotenv/config';
import { connectToDatabase, prisma } from './src/config/database.js';

async function setSomeEventsToDraft() {
  await connectToDatabase();
  
  // Prendre 2 événements au hasard et les mettre en "draft"
  const events = await prisma.event.findMany({ take: 2 });
  
  for (const event of events) {
    console.log(`Mise en 'draft' de l'événement : ${event.title}`);
    await prisma.event.update({
      where: { id: event.id },
      data: { status: 'draft' }
    });
  }

  console.log("Attente de la synchro Firestore...");
  await new Promise(r => setTimeout(r, 3000));
  await prisma.$disconnect();
  console.log("Terminé !");
}

setSomeEventsToDraft();
