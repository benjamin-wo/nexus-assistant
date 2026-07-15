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
      expect(callCount).toBe(1); // No retries
    }
  });
});
