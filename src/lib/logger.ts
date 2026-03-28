const TAG = "[saycut]";

function ts(): string {
  return new Date().toISOString();
}

function fmt(level: string, scope: string, msg: string, data?: unknown): void {
  const prefix = `${TAG} ${ts()} ${level} [${scope}]`;
  if (data !== undefined) {
    console.log(prefix, msg, JSON.stringify(data, null, 2));
  } else {
    console.log(prefix, msg);
  }
}

export const log = {
  info: (scope: string, msg: string, data?: unknown) =>
    fmt("INFO", scope, msg, data),

  debug: (scope: string, msg: string, data?: unknown) =>
    fmt("DEBUG", scope, msg, data),

  warn: (scope: string, msg: string, data?: unknown) =>
    fmt("WARN", scope, msg, data),

  error: (scope: string, msg: string, error?: unknown) => {
    const prefix = `${TAG} ${ts()} ERROR [${scope}]`;
    if (error instanceof Error) {
      console.error(prefix, msg, {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else if (error !== undefined) {
      console.error(prefix, msg, error);
    } else {
      console.error(prefix, msg);
    }
  },
} as const;
