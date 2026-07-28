import { z } from "zod";

const envSchema = z.object({
  VITE_API_ENDPOINT: z
    .string()
    .min(1, "VITE_API_ENDPOINT is required")
    .url("VITE_API_ENDPOINT must be a valid URL"),

  VITE_APP_URL: z
    .string()
    .min(1, "VITE_APP_URL is required")
    .url("VITE_APP_URL must be a valid URL"),

  VITE_APP_NAME: z.string().min(1).default("Dental SaaS"),
});

const parsedEnv = envSchema.safeParse({
  VITE_API_ENDPOINT: import.meta.env.VITE_API_ENDPOINT,
  VITE_APP_URL: import.meta.env.VITE_APP_URL,
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
});

if (!parsedEnv.success) {
  console.error(
    "Invalid environment variables:",
    parsedEnv.error.flatten().fieldErrors,
  );

  throw new Error("Các giá trị khai báo trong file .env không hợp lệ");
}

export const env = {
  apiEndpoint: parsedEnv.data.VITE_API_ENDPOINT,
  appUrl: parsedEnv.data.VITE_APP_URL,
  appName: parsedEnv.data.VITE_APP_NAME,
  mode: import.meta.env.MODE,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
