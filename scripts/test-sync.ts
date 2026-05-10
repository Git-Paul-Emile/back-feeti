import 'dotenv/config';
import { firestoreSyncService } from './src/services/firestore-sync.service.js';

async function run() {
  console.log("FIRESTORE_SYNC_ENABLED:", process.env.FIRESTORE_SYNC_ENABLED);
  
  const dummyEvent = {
    id: "test-event-" + Date.now(),
    title: "Test Event",
    description: "Testing firestore sync",
    date: "2026-05-10",
    time: "20:00",
    location: "Paris",
    image: "",
    price: 1000,
    vipPrice: null,
    category: "Concert",
    eventType: "PRESENTIEL",
    status: "published",
    maxAttendees: 100,
    attendees: 0,
    salesBlocked: false,
    isFeatured: false,
    isLive: false,
    organizerId: "test-organizer",
    createdAt: new Date(),
    updatedAt: new Date()
  };

  try {
    const result = await firestoreSyncService.syncEvent(dummyEvent);
    console.log("Sync result:", result);
  } catch (err) {
    console.error("Crash during sync:", err);
  }
  
  process.exit(0);
}

run();
