const getApiBaseUrl = () => process.env.FEETIPLAY_API_URL ?? "http://localhost:8001/api";
const getSyncSecret = () => process.env.FEETI_SYNC_SECRET ?? "";

export interface SyncedLiveEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  duration: string;
  image: string;
  category: string;
  isLive: boolean;
  isReplay: boolean;
  isFeatured: boolean;
  streamUrl: string | null;
  videoUrl: string | null;
  isFree: boolean;
  price: number;
  currency: string;
  channelName: string;
  organizerId: string;
  location: string;
  source: "feeti2";
  createdAt: string;
  updatedAt?: string;
}

interface SyncPayload {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  duration?: string;
  image?: string;
  category: string;
  isLive?: boolean;
  isFeatured?: boolean;
  streamUrl?: string;
  videoUrl?: string;
  price?: number;
  currency?: string;
  organizerId: string;
  organizerName: string;
  location: string;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FEETIPLAY sync failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as { data?: T };
  if (!json.data) {
    throw new Error("FEETIPLAY sync returned an empty payload");
  }

  return json.data;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const secret = getSyncSecret();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-feeti-sync-secret": secret,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(10_000),
  });

  return parseResponse<T>(response);
}

export const feetiPlaySyncService = {
  async upsertLiveEvent(payload: SyncPayload): Promise<SyncedLiveEvent> {
    return request<SyncedLiveEvent>("/integration/feeti2-live-events", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getLiveEventById(id: string): Promise<SyncedLiveEvent> {
    return request<SyncedLiveEvent>(`/integration/feeti2-live-events/${encodeURIComponent(id)}`);
  },

  async listOrganizerLiveEvents(organizerId: string): Promise<SyncedLiveEvent[]> {
    return request<SyncedLiveEvent[]>(
      `/integration/feeti2-live-events?organizerId=${encodeURIComponent(organizerId)}`
    );
  },

  async deleteLiveEvent(id: string): Promise<void> {
    await request<{ deleted: true }>(`/integration/feeti2-live-events/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};
