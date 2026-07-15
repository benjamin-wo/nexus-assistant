import { StorageService, GoogleCredentials } from "./database/Storage";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const LABEL_NAME = "Logged-Expense";

async function refreshGoogleToken(credentials: GoogleCredentials, chatId: string, storage: StorageService): Promise<string> {
  if (Date.now() < credentials.expiry_date - 60000) {
    return credentials.access_token;
  }
  
  console.log(`[EmailPoller] Refreshing token for chat ${chatId}...`);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: credentials.refresh_token,
      grant_type: "refresh_token"
    })
  });

  const data = await response.json();
  if (data.error) {
    console.error(`[EmailPoller] Failed to refresh token for chat ${chatId}:`, data);
    throw new Error("Token refresh failed");
  }

  credentials.access_token = data.access_token;
  credentials.expiry_date = Date.now() + (data.expires_in * 1000);
  
  await storage.saveGoogleCredentials(chatId, credentials);
  return credentials.access_token;
}

async function getOrCreateLabel(accessToken: string): Promise<string> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  const existingLabel = data.labels?.find((l: any) => l.name === LABEL_NAME);
  
  if (existingLabel) {
    return existingLabel.id;
  }

  console.log(`[EmailPoller] Creating label "${LABEL_NAME}"...`);
  const createRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: LABEL_NAME,
      labelListVisibility: "labelShow",
      messageListVisibility: "show"
    })
  });
  
  const createData = await createRes.json();
  return createData.id;
}

function getEmailBody(payload: any): string {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  
  let body = '';
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.parts) {
        body += getEmailBody(part);
      }
    }
  }
  return body;
}

async function extractExpense(content: string, subject: string): Promise<{amount: number, category: string, description: string} | null> {
  const prompt = `
You are an expense extraction agent. Below is the subject and text of an email. 
Check if this email represents a transaction, receipt, or invoice.
If it does, extract the total amount, category, and a short description.
If it is NOT a valid receipt or if the amount is missing/0, return {"error": "Not an expense"}.

Return ONLY valid JSON matching this schema:
{
  "amount": 12.50,
  "category": "Food",
  "description": "Lunch at McDonald's"
}

Email Subject: ${subject}

Email Text:
${content}
`;

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1
    })
  });

  if (!response.ok) {
    console.error("[EmailPoller] LLM API Error");
    return null;
  }

  const data = await response.json();
  const text = data.choices[0].message.content;
  try {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*?}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
    const parsed = JSON.parse(jsonStr);
    
    if (parsed.error || !parsed.amount) {
      return null;
    }
    return {
      amount: Number(parsed.amount),
      category: parsed.category || "Uncategorized",
      description: parsed.description || "Unknown Expense"
    };
  } catch (err) {
    console.error("[EmailPoller] Failed to parse LLM response:", err);
    return null;
  }
}

async function processUser(chatId: string, credentials: GoogleCredentials, storage: StorageService) {
  try {
    const accessToken = await refreshGoogleToken(credentials, chatId, storage);
    const labelId = await getOrCreateLabel(accessToken);
    
    // search for unlabeled expense emails
    const query = `-label:${LABEL_NAME} (invoice OR receipt OR transaction OR payment OR order)`;
    const searchRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=5`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const searchData = await searchRes.json();
    if (!searchData.messages || searchData.messages.length === 0) {
      return; // No new emails
    }

    console.log(`[EmailPoller] Found ${searchData.messages.length} potential expense emails for chat ${chatId}`);

    for (const msg of searchData.messages) {
      // get full message
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const msgData = await msgRes.json();
      
      const subjectHeader = msgData.payload.headers.find((h: any) => h.name.toLowerCase() === 'subject');
      const subject = subjectHeader ? subjectHeader.value : "No Subject";
      
      console.log(`[EmailPoller] Processing message ${msg.id} ("${subject}")`);
      
      // try to extract full body, fallback to snippet
      let textBody = getEmailBody(msgData.payload);
      if (!textBody || textBody.trim().length === 0) {
        textBody = msgData.snippet || "";
      }
      
      const expense = await extractExpense(textBody.substring(0, 4000), subject); // limit to 4000 chars to save tokens
      
      if (expense) {
        console.log(`[EmailPoller] Logged expense: $${expense.amount} for ${expense.description}`);
        await storage.createExpense({
          chatId,
          amount: expense.amount,
          category: expense.category,
          description: expense.description
        });
      } else {
        console.log(`[EmailPoller] Not an expense or un-parseable.`);
      }

      // Add label so we don't process it again
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/modify`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          addLabelIds: [labelId]
        })
      });
      console.log(`[EmailPoller] Label applied to ${msg.id}`);
    }

  } catch (err) {
    console.error(`[EmailPoller] Error processing user ${chatId}:`, err);
  }
}

async function main() {
  console.log("[EmailPoller] Starting poll cycle...");
  const storage = new StorageService();
  await storage.initialize();

  const allCreds = await storage.getAllGoogleCredentials();
  console.log(`[EmailPoller] Found ${allCreds.length} users with Google Credentials.`);

  for (const { chatId, credentials } of allCreds) {
    await processUser(chatId, credentials, storage);
  }

  await storage.close();
  console.log("[EmailPoller] Cycle complete.");
}

main().catch(console.error);
