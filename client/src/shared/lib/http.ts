import { env } from "../../config/env";
import { SHARED_ENDPOINTS } from "../constants/endpoint.constants";
import { HTTP_STATUS } from "../constants/http-status.constants";
import { authEvents } from "../events/auth.events";
import { ApiError } from "./error";

// Biến để theo dõi trạng thái refresh token
let isRefreshing = false;
const refreshSubscribers: ((success: boolean) => void)[] = [];

type QueryValue =
  string | number | boolean | null | undefined | string[] | number[];

export type CustomOptions = Omit<RequestInit, "body" | "method"> & {
  body?: unknown;
  baseUrl?: string | undefined;
  params?: Record<string, QueryValue>;
  timeout?: number; // ms
  // default true - Xác định có cần mở login modal không khi không login
  authRequired?: boolean;
};

export const isClient = () => typeof window !== "undefined";

/**
 * Phát sự kiện yêu cầu mở modal login
 */
export const triggerLoginRequired = () => {
  // Phát sự kiện token hết hạn
  authEvents.tokenExpired();
};

/**
 * Xây dựng URL với params query
 */
const buildUrl = (
  url: string,
  baseURL: string,
  params?: Record<string, QueryValue>,
): string => {
  // Nếu url đã là URL đầy đủ, sử dụng nó trực tiếp
  const fullUrl = url.startsWith("http")
    ? url
    : `${baseURL.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;

  if (!params) return fullUrl;

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        if (value.length === 0) return;

        searchParams.append(key, value.join(","));
        return;
      }

      searchParams.append(key, String(value));
    }
  });

  const separator = fullUrl.includes("?") ? "&" : "?";
  return `${fullUrl}${separator}${searchParams.toString()}`;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === HTTP_STATUS.NO_CONTENT) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    return response.json() as Promise<T>;
  } else if (contentType?.includes("text/")) {
    return response.text() as unknown as Promise<T>;
  }

  return response.blob() as unknown as Promise<T>;
};

/**
 * Thực hiện refresh token
 */
const handleRefreshToken = async (): Promise<boolean> => {
  if (isRefreshing) {
    // Nếu đang refresh, đợi kết quả
    return new Promise((resolve) => {
      refreshSubscribers.push(resolve);
    });
  }

  isRefreshing = true;

  try {
    const response = await fetch(
      `${env.apiEndpoint}${SHARED_ENDPOINTS.AUTH.REFRESH}`,
      {
        method: "POST",
        credentials: "include",
      },
    );
    if (!response.ok) {
      throw new Error(`Refresh failed with status: ${response.status}`);
    }

    // Thông báo cho tất cả các request đang chờ rằng refresh thành công
    refreshSubscribers.forEach((resolve) => resolve(true));
    refreshSubscribers.length = 0;

    return true;
  } catch {
    // Thông báo cho tất cả các request đang chờ rằng refresh thất bại
    refreshSubscribers.forEach((resolve) => resolve(false));
    refreshSubscribers.length = 0;

    return false;
  } finally {
    isRefreshing = false;
  }
};

/**
 * Xử lý lỗi từ API response
 */
const handleErrorResponse = async <T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  url: string,
  options: CustomOptions,
  errorResponse: { status: number; payload: unknown },
  authRequired: boolean,
): Promise<{ status: number; payload: T }> => {
  if (errorResponse.status === HTTP_STATUS.UNAUTHORIZED) {
    // Login sai thông tin: trả lỗi về form bình thường.
    if (url === SHARED_ENDPOINTS.AUTH.LOGIN) {
      throw new ApiError(errorResponse);
    }

    const refreshSuccess = await handleRefreshToken();

    if (refreshSuccess) {
      return request(method, url, options);
    }

    if (authRequired) {
      triggerLoginRequired();
    }
  }

  // Bao gồm cả 422: ApiError tự parse payload.errors.
  throw new ApiError(errorResponse);
};

const processError = (error: unknown, timeout?: number): Error => {
  if (error instanceof Error && error.name === "AbortError") {
    return new Error(
      timeout ? `Request timeout after ${timeout}ms` : "Request was cancelled",
    );
  }

  if (error instanceof Error) return error;

  return new Error("Unknown error occurred");
};

/**
 * Tạo AbortController cho timeout nếu chưa có signal.
 * Sử dụng signal từ options hoặc từ timeout controller
 */
const resolveSignal = (
  timeout?: number,
  externalSignal?: AbortSignal | null,
): { signal?: AbortSignal; controller?: AbortController } => {
  if (externalSignal) return { signal: externalSignal };

  if (!timeout) return {};

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);

  return { signal: controller.signal, controller };
};

const request = async <T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  url: string,
  options: CustomOptions = {},
): Promise<{ status: number; payload: T }> => {
  const {
    params,
    body,
    headers = {},
    timeout,
    signal,
    authRequired = true,
    // Nếu không truyền baseUrl (hoặc baseUrl = undefined) thì lấy từ envConfig.NEXT_PUBLIC_API_ENDPOINT
    // Nếu truyền baseUrl thì lấy giá trị truyền vào
    // Truyền vào '' thì đồng nghĩa với việc chúng ta gọi API đến Next.js Server
    baseUrl = env.apiEndpoint,
    ...fetchOptions
  } = options;

  let parsedBody: FormData | string | undefined = undefined;
  if (body instanceof FormData) {
    parsedBody = body;
  } else if (body !== undefined && body !== null) {
    const serializedBody = JSON.stringify(body);
    if (serializedBody !== undefined) {
      parsedBody = serializedBody;
    }
  }

  const baseHeaders: {
    [key: string]: string;
  } =
    parsedBody instanceof FormData
      ? {}
      : {
          "Content-Type": "application/json",
        };

  const fullUrl = buildUrl(url, baseUrl, params);

  const { signal: finalSignal } = resolveSignal(timeout, signal);

  const requestOptions: RequestInit = {
    ...fetchOptions,
    credentials: "include",
    headers: {
      ...baseHeaders,
      ...headers,
    },
    body: parsedBody,
    method,
    signal: finalSignal,
  };

  try {
    const res = await fetch(fullUrl, requestOptions);

    const payload = await parseResponse<Response>(res);

    const data = {
      status: res.status,
      payload: payload as T,
    };

    if (!res.ok) {
      return handleErrorResponse(method, url, options, data, authRequired);
    }

    return data;
  } catch (error) {
    throw processError(error, timeout);
  }
};

const http = {
  get<Response>(
    url: string,
    options?: Omit<CustomOptions, "body"> | undefined,
  ) {
    return request<Response>("GET", url, options);
  },
  post<Response>(
    url: string,
    body?: unknown,
    options?: Omit<CustomOptions, "body"> | undefined,
  ) {
    return request<Response>("POST", url, { ...options, body });
  },
  put<Response>(
    url: string,
    body?: unknown,
    options?: Omit<CustomOptions, "body"> | undefined,
  ) {
    return request<Response>("PUT", url, { ...options, body });
  },
  patch<Response>(
    url: string,
    body?: unknown,
    options?: Omit<CustomOptions, "body"> | undefined,
  ) {
    return request<Response>("PATCH", url, { ...options, body });
  },
  delete<Response>(
    url: string,
    options?: Omit<CustomOptions, "body"> | undefined,
  ) {
    return request<Response>("DELETE", url, { ...options });
  },
};

export default http;
