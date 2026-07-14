import { getAccessToken } from "../../../src/core/googleAuth";

export async function execute(
  args: {
    action: "listEvents" | "createEvent";
    timeMin?: string;
    summary?: string;
    location?: string;
    start?: string;
    end?: string;
  },
  context?: { chatId: string }
) {
  const chatId = context?.chatId || "cli_chat_session";

  // 1. Get access token (or throw NOT_AUTHENTICATED error with OAuth URL)
  let token: string;
  try {
    token = await getAccessToken(chatId);
  } catch (err: any) {
    if (err.message.includes("NOT_AUTHENTICATED")) {
      return { success: false, error: "NOT_AUTHENTICATED", authUrl: err.message.split(": ").slice(1).join(": ") };
    }
    throw err;
  }

  const { action, timeMin, summary, location, start, end } = args;

  switch (action) {
    case "listEvents": {
      const minTime = timeMin || new Date().toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
        minTime
      )}&maxResults=10&orderBy=startTime&singleEvents=true`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Google Calendar API failed with status ${res.status}: ${await res.text()}`);
      
      const data = await res.json() as any;
      const items = (data.items || []).map((e: any) => ({
        id: e.id,
        summary: e.summary,
        location: e.location || "",
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        htmlLink: e.htmlLink
      }));

      return { success: true, events: items };
    }

    case "createEvent": {
      if (!summary || !start || !end) {
        throw new Error("Parameters 'summary', 'start', and 'end' are required for action 'createEvent'.");
      }

      const body: any = {
        summary,
        start: { dateTime: start },
        end: { dateTime: end }
      };
      if (location) {
        body.location = location;
      }

      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error(`Google Calendar API failed with status ${res.status}: ${await res.text()}`);
      
      const data = await res.json() as any;
      return {
        success: true,
        eventId: data.id,
        summary: data.summary,
        start: data.start?.dateTime,
        htmlLink: data.htmlLink,
        message: `Event '${summary}' scheduled successfully.`
      };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
