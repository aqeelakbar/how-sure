type RetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
};

function getStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "number"
  ) {
    return (error as { code: number }).code;
  }

  return undefined;
}

function getMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isTemporaryProviderError(error: unknown) {
  const status = getStatus(error);
  const message = getMessage(error).toLowerCase();

  return (
    status === 429 ||
    status === 503 ||
    message.includes('"code":429') ||
    message.includes('"code":503') ||
    message.includes("resource_exhausted") ||
    message.includes("high demand") ||
    message.includes("temporarily unavailable") ||
    message.includes("unavailable")
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withProviderRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<{
  value: T;
  retryCount: number;
}> {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 900;

  let attempt = 0;

  while (true) {
    try {
      return {
        value: await operation(),
        retryCount: attempt,
      };
    } catch (error) {
      if (!isTemporaryProviderError(error) || attempt >= maxRetries) {
        throw error;
      }

      const delay =
        baseDelayMs * Math.pow(2, attempt) +
        Math.floor(Math.random() * 250);

      await wait(delay);
      attempt += 1;
    }
  }
}
