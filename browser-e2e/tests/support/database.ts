import { expect, type APIRequestContext } from "@playwright/test";

const testingApiUrl = "http://127.0.0.1:3001/testing/reset-db";

export async function resetDatabase(request: APIRequestContext): Promise<void> {
  const response = await request.get(testingApiUrl);
  await expect(response).toBeOK();
}
