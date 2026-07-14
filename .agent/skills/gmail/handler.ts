import { getAccessToken, getGoogleAuthUrl } from "../../../src/core/googleAuth";

export async function execute(
  args: {
    action: "listEmails" | "getEmail" | "sendEmail";
    q?: string;
    messageId?: string;
    to?: string;
    subject?: string;
    body?: string;
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

  const { action, q, messageId, to, subject, body } = args;

  switch (action) {
    case "listEmails": {
      let url = "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5";
      if (q) {
        url += `&q=${encodeURIComponent(q)}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 401 || res.status === 403) {
          return { success: false, error: "NOT_AUTHENTICATED", authUrl: getGoogleAuthUrl(chatId) };
        }
        throw new Error(`Gmail API failed with status ${res.status}: ${errText}`);
      }
      
      const data = await res.json() as any;
      const messages = data.messages || [];

      // Fetch headers (subject, from, date) for each message in parallel
      const detailedMessages = await Promise.all(
        messages.map(async (msg: any) => {
          const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!detailRes.ok) return { id: msg.id, snippet: "Error loading metadata" };
          const detail = await detailRes.json() as any;
          
          const headers = detail.payload?.headers || [];
          const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value || "(No Subject)";
          const fromHeader = headers.find((h: any) => h.name.toLowerCase() === "from")?.value || "(Unknown Sender)";
          const dateHeader = headers.find((h: any) => h.name.toLowerCase() === "date")?.value || "";

          return {
            id: msg.id,
            from: fromHeader,
            subject: subjectHeader,
            date: dateHeader,
            snippet: detail.snippet
          };
        })
      );

      return { success: true, messages: detailedMessages };
    }

    case "getEmail": {
      if (!messageId) throw new Error("Parameter 'messageId' is required for action 'getEmail'.");
      
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 401 || res.status === 403) {
          return { success: false, error: "NOT_AUTHENTICATED", authUrl: getGoogleAuthUrl(chatId) };
        }
        throw new Error(`Gmail API failed with status ${res.status}: ${errText}`);
      }
      
      const detail = await res.json() as any;
      const headers = detail.payload?.headers || [];
      const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value || "(No Subject)";
      const fromHeader = headers.find((h: any) => h.name.toLowerCase() === "from")?.value || "(Unknown Sender)";
      const dateHeader = headers.find((h: any) => h.name.toLowerCase() === "date")?.value || "";

      // Extract body text simply
      let bodyText = detail.snippet || "";
      const parts = detail.payload?.parts || [];
      const bodyPart = parts.find((p: any) => p.mimeType === "text/plain");
      if (bodyPart?.body?.data) {
        bodyText = Buffer.from(bodyPart.body.data, "base64").toString("utf-8");
      }

      return {
        success: true,
        messageId,
        from: fromHeader,
        subject: subjectHeader,
        date: dateHeader,
        body: bodyText
      };
    }

    case "sendEmail": {
      if (!to || !subject || !body) {
        throw new Error("Parameters 'to', 'subject', and 'body' are required for action 'sendEmail'.");
      }

      // Construct plain MIME message RFC 2822
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
      const emailLines = [
        `To: ${to}`,
        `Subject: ${utf8Subject}`,
        "Content-Type: text/plain; charset=utf-8",
        "MIME-Version: 1.0",
        "",
        body
      ];
      const rawMime = Buffer.from(emailLines.join("\r\n"))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw: rawMime })
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 401 || res.status === 403) {
          return { success: false, error: "NOT_AUTHENTICATED", authUrl: getGoogleAuthUrl(chatId) };
        }
        throw new Error(`Gmail API failed with status ${res.status}: ${errText}`);
      }
      
      const sentData = await res.json() as any;
      return { success: true, messageId: sentData.id, message: `Email sent successfully to ${to}.` };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
