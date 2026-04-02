/**
 * Lightweight client-side logger for offline-safe diagnostics.
 * Logs are kept in memory (last 100 entries) and can be retrieved for debugging.
 * No PII is logged — only action types, timestamps, and error codes.
 */

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  context: string;
  message: string;
}

const MAX_ENTRIES = 100;
const entries: LogEntry[] = [];

function addEntry(level: LogEntry['level'], context: string, message: string) {
  entries.push({
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
  });
  if (entries.length > MAX_ENTRIES) {
    entries.shift();
  }
}

export const clientLogger = {
  info(context: string, message: string) {
    addEntry('info', context, message);
  },

  warn(context: string, message: string) {
    addEntry('warn', context, message);
  },

  error(context: string, message: string) {
    addEntry('error', context, message);
  },

  /** Get recent log entries for diagnostic display */
  getEntries(): readonly LogEntry[] {
    return entries;
  },

  /** Clear all log entries */
  clear() {
    entries.length = 0;
  },
};
