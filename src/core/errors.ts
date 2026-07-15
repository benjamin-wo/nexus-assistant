export class GeminiEmptyResponseError extends Error {
  constructor(message: string = "Gemini API returned an empty completion response.") {
    super(message);
    this.name = "GeminiEmptyResponseError";
  }
}

export class GeminiApiError extends Error {
  public statusCode: number;
  public responseText: string;

  constructor(statusCode: number, responseText: string) {
    super(`Gemini API error (${statusCode}): ${responseText}`);
    this.name = "GeminiApiError";
    this.statusCode = statusCode;
    this.responseText = responseText;
  }
}
