export function logInfo(message: string, meta: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "INFO", message, ...meta }));
}

export function logError(message: string, error?: unknown, meta: Record<string, unknown> = {}) {
  const errorMessage = error instanceof Error ? error.message : typeof error === "string" ? error : error ? String(error) : undefined;
  
  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level: "ERROR",
    message,
    ...meta,
  };
  
  if (errorMessage) {
    payload.error = errorMessage;
  }
  
  console.error(JSON.stringify(payload));
}

export function logWarn(message: string, meta: Record<string, unknown> = {}) {
  console.warn(JSON.stringify({ timestamp: new Date().toISOString(), level: "WARN", message, ...meta }));
}
