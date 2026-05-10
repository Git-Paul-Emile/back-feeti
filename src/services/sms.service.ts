export interface SmsResult {
  provider: "webhook" | "simulation";
  delivered: boolean;
}

class SmsService {
  async send(to: string, message: string): Promise<SmsResult> {
    const webhookUrl = process.env.SMS_WEBHOOK_URL;
    if (!webhookUrl) {
      console.log(`[SMS simulation] ${to}: ${message}`);
      return { provider: "simulation", delivered: true };
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, message }),
    });

    if (!response.ok) {
      throw new Error(`SMS provider error: ${response.status}`);
    }

    return { provider: "webhook", delivered: true };
  }
}

export const smsService = new SmsService();
