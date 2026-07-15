import { expect, test, mock, describe, beforeEach } from "bun:test";
import { LlmService } from "../src/core/LlmService";
import { GeminiEmptyResponseError, GeminiApiError } from "../src/core/errors";

describe("LlmService API Reliability", () => {
  let llmService: LlmService;

  beforeEach(() => {
    // Reset environment variables
    process.env.LLM_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test_key";
    llmService = new LlmService();
    
    // Clear mocks
    mock.restore();
  });

  test("Exponential backoff retries on transient errors (503)", async () => {
    let callCount = 0;
    
    // Mock global fetch
    global.fetch = mock(async () => {
      callCount++;
      if (callCount < 3) {
        return {
          ok: false,
          status: 503,
          text: async () => "Service Unavailable",
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "Success!" }] } }],
        }),
      } as Response;
    });

    const start = Date.now();
    const result = await llmService.generateResponse([{ role: "user", content: "hello" }]);
    const elapsed = Date.now() - start;

    expect(result).toBe("Success!");
    expect(callCount).toBe(3);
    
    // First retry delay is 1000ms, second is 2000ms, so at least 3000ms elapsed
    // In actual unit tests, this takes 3s to run, which is fine for integration logic
    expect(elapsed).toBeGreaterThanOrEqual(2800);
  }, 10000); // increase timeout for sleep

  test("Throws GeminiEmptyResponseError when response text is empty", async () => {
    global.fetch = mock(async () => {
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "" }] } }],
        }),
      } as Response;
    });

    try {
      await llmService.generateResponse([{ role: "user", content: "hello" }]);
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error).toBeInstanceOf(GeminiEmptyResponseError);
      expect(error.message).toBe("Gemini API returned an empty completion response.");
    }
  });

  test("Fails immediately on non-transient errors (400)", async () => {
    let callCount = 0;
    global.fetch = mock(async () => {
      callCount++;
      return {
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      } as Response;
    });

    try {
      await llmService.generateResponse([{ role: "user", content: "hello" }]);
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error).toBeInstanceOf(GeminiApiError);
      expect(error.statusCode).toBe(400);
      expect(callCount).toBe(2); // 1 Gemini call, 1 Deepseek fallback call
    }
  });

  test("Validation: Rejects empty prompt", async () => {
    const result = await llmService.generateResponse([{ role: "user", content: "" }]);
    expect(result).toBe("I'm sorry, I couldn't process that request.");
  });

  test("Validation: Rejects prompt over 500000 chars", async () => {
    const longString = "A".repeat(500001);
    const result = await llmService.generateResponse([{ role: "user", content: longString }]);
    expect(result).toBe("I'm sorry, I couldn't process that request.");
  });

  test("Fallback: Uses DeepSeek if Gemini fails completely", async () => {
    // Force Gemini to fail completely (e.g. 400 Bad Request)
    global.fetch = mock(async (req: any) => {
      // Mock Gemini endpoint failing
      if (typeof req === 'string' && req.includes("generativelanguage")) {
        return {
          ok: false,
          status: 400,
          text: async () => "Bad Request",
        } as Response;
      }
      
      // Mock Deepseek endpoint succeeding
      if (typeof req === 'string' && req.includes("deepseek")) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "Deepseek Fallback Success" } }]
          })
        } as Response;
      }
      
      throw new Error(`Unexpected fetch call to ${req}`);
    });

    process.env.DEEPSEEK_API_KEY = "test_deepseek_key";
    
    // We expect it to try Gemini, fail immediately on 400, then fallback to deepseek and succeed
    const result = await llmService.generateResponse([{ role: "user", content: "hello" }]);
    expect(result).toBe("Deepseek Fallback Success");
  });
});
