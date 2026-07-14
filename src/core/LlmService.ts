import { Message } from "../database/Storage";

export class LlmService {
  private provider: string;
  private geminiKey: string;
  private deepseekKey: string;
  private openrouterKey: string;

  constructor() {
    this.provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase();
    this.geminiKey = process.env.GEMINI_API_KEY || "";
    this.deepseekKey = process.env.DEEPSEEK_API_KEY || "";
    this.openrouterKey = process.env.OPENROUTER_API_KEY || "";
  }

  async generateResponse(messages: Message[]): Promise<string> {
    switch (this.provider) {
      case "gemini":
        return this.callGemini(messages);
      case "deepseek":
        return this.callDeepseek(messages);
      case "openrouter":
        return this.callOpenrouter(messages);
      default:
        throw new Error(`Unsupported LLM provider: ${this.provider}`);
    }
  }

  private async callGemini(messages: Message[]): Promise<string> {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    if (!this.geminiKey) {
      throw new Error("GEMINI_API_KEY is not configured in environment variables.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiKey}`;

    // Filter messages, extract system prompt
    let systemInstruction = "";
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction += msg.content + "\n";
      } else {
        // Translate roles for Gemini compatibility (gemini expects 'user' or 'model')
        const role = msg.role === "assistant" ? "model" : "user";
        contents.push({
          role,
          parts: [{ text: msg.content }],
        });
      }
    }

    const body: any = { contents };
    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction.trim() }],
      };
    }
    body.generationConfig = {
      temperature: 0.1,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini API returned an empty completion response.");
    }

    return text;
  }

  private async callDeepseek(messages: Message[]): Promise<string> {
    const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
    if (!this.deepseekKey) {
      throw new Error("DEEPSEEK_API_KEY is not configured in environment variables.");
    }

    return this.callOpenAiCompatible(
      "https://api.deepseek.com/chat/completions",
      this.deepseekKey,
      model,
      messages
    );
  }

  private async callOpenrouter(messages: Message[]): Promise<string> {
    const model = process.env.OPENROUTER_MODEL || "nousresearch/hermes-3-llama-3-8b";
    if (!this.openrouterKey) {
      throw new Error("OPENROUTER_API_KEY is not configured in environment variables.");
    }

    return this.callOpenAiCompatible(
      "https://openrouter.ai/api/v1/chat/completions",
      this.openrouterKey,
      model,
      messages
    );
  }

  private async callOpenAiCompatible(
    url: string,
    apiKey: string,
    model: string,
    messages: Message[]
  ): Promise<string> {
    const formattedMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error (${res.status}) on ${url}: ${errText}`);
    }

    const data = (await res.json()) as any;
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("API returned an empty completions response.");
    }

    return text;
  }
}
