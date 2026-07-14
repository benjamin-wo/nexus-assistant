import { StorageService, GoogleCredentials } from "../database/Storage";

export function getGoogleAuthUrl(chatId: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const webappUrl = process.env.WEBAPP_URL || `http://localhost:${process.env.PORT || 3000}`;
  const base = webappUrl.endsWith("/") ? webappUrl.slice(0, -1) : webappUrl;
  const redirectUri = `${base}/api/oauth/callback`;
  const scopes = encodeURIComponent(
    "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar"
  );
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${scopes}&state=${chatId}&access_type=offline&prompt=consent`;
}

export async function getAccessToken(chatId: string): Promise<string> {
  const storage = new StorageService();
  await storage.initialize();

  try {
    const credentials = await storage.getGoogleCredentials(chatId);
    if (!credentials) {
      const authUrl = getGoogleAuthUrl(chatId);
      throw new Error(`NOT_AUTHENTICATED: Please authorize Google access first by visiting: ${authUrl}`);
    }

    const now = Date.now();
    // Refresh token if it expires in less than 60 seconds
    if (credentials.expiry_date - now < 60 * 1000) {
      console.log(`[Google Auth] Access token expired or close to expiry. Refreshing for chat ${chatId}...`);
      
      const clientId = process.env.GOOGLE_CLIENT_ID || "";
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
      
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: credentials.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to refresh Google token (${res.status}): ${errText}`);
      }

      const data = (await res.json()) as any;
      const updatedCreds: GoogleCredentials = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || credentials.refresh_token,
        expiry_date: Date.now() + (data.expires_in * 1000),
      };

      await storage.saveGoogleCredentials(chatId, updatedCreds);
      return updatedCreds.access_token;
    }

    return credentials.access_token;
  } finally {
    await storage.close();
  }
}
