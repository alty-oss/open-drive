interface ClientErrorDetails {
  [key: string]: unknown;
}

export function logClientError(
  event: string,
  error: unknown,
  details: ClientErrorDetails = {},
) {
  console.error({
    timestamp: new Date().toISOString(),
    level: "error",
    event,
    ...details,
    error:
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { message: String(error) },
  });
}
