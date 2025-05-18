import { format, parseISO } from 'date-fns';
/**
 * Formats a request log message with colored status codes and cleaned up remote address
 * @param message - Raw log message containing "remoteaddr method url status responseTime"
 * @returns Formatted log string with colored status code and cleaned up address
 */
export function formatRequestLog(message: string): string {
  const [remoteaddr, method, url, status, responseTime] = message.split(' ');
  const statusCode = parseInt(status, 10);
  const color =
    statusCode >= 500
      ? '\x1b[31m'
      : statusCode >= 400
        ? '\x1b[33m'
        : statusCode >= 300
          ? '\x1b[36m'
          : statusCode >= 200
            ? '\x1b[32m'
            : '\x1b[0m';
  let addr = remoteaddr.lastIndexOf(':') > -1 ? remoteaddr.split(':').pop() : remoteaddr;
  const reset = '\x1b[0m';
  const coloredStatus = `${color}${status}${reset}`;

  const formattedLog = `${addr} -- ${method} - ${url} - ${coloredStatus} - ${responseTime?.trim()}ms`;
  return formattedLog;
}

/**
 * Formats a timestamp string into a standardized date-time format
 * @param timestamp - ISO timestamp string
 * @returns Formatted date-time string in "yyyy-MM-dd HH:mm:ss" format
 */
export function formatTimestamp(timestamp: string): string {
  const date = parseISO(timestamp);
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}