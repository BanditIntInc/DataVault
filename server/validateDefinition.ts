import { IApiDefinition } from '../core/interfaces/IApiDefinition';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:']);
const MIN_POLL_INTERVAL_MS = 1_000;

// Blocks loopback, link-local, and RFC-1918 private ranges to prevent SSRF
function isPrivateHost(hostname: string): boolean {
  if (['localhost', '0.0.0.0', '::1', '[::1]'].includes(hostname)) return true;
  if (/^127\./.test(hostname)) return true;                          // 127.0.0.0/8
  if (/^10\./.test(hostname)) return true;                           // 10.0.0.0/8
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;    // 172.16.0.0/12
  if (/^192\.168\./.test(hostname)) return true;                     // 192.168.0.0/16
  if (/^169\.254\./.test(hostname)) return true;                     // 169.254.0.0/16 (AWS metadata)
  if (/^fc00:/i.test(hostname)) return true;                         // IPv6 ULA
  return false;
}

export function validateDefinitionUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `Invalid URL: "${url}"`;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return `URL protocol must be http, https, ws, or wss. Got: "${parsed.protocol}"`;
  }

  if (isPrivateHost(parsed.hostname)) {
    return `URL targets a private or loopback address which is not allowed.`;
  }

  return null;
}

export function validateDefinition(def: unknown): string | null {
  if (!def || typeof def !== 'object') return 'Definition must be an object.';

  const d = def as Record<string, unknown>;

  if (!d.key || typeof d.key !== 'string') return 'Definition must have a string "key".';
  if (!d.type || !['rest', 'websocket', 'poll', 'minio'].includes(d.type as string)) {
    return 'Definition "type" must be "rest", "websocket", "poll", or "minio".';
  }

  if (d.type === 'minio') {
    if (!d.bucket || typeof d.bucket !== 'string') return 'MinIO definitions must have a string "bucket".';
    if (!d.objectKey || typeof d.objectKey !== 'string') return 'MinIO definitions must have a string "objectKey".';
  } else {
    if (!d.url || typeof d.url !== 'string') return 'Definition must have a string "url".';
    const urlError = validateDefinitionUrl(d.url as string);
    if (urlError) return urlError;
  }

  if (d.type === 'poll') {
    const interval = d.pollInterval as number | undefined;
    if (interval !== undefined && interval < MIN_POLL_INTERVAL_MS) {
      return `pollInterval must be at least ${MIN_POLL_INTERVAL_MS}ms.`;
    }
  }

  if (d.cacheTTL !== undefined && (typeof d.cacheTTL !== 'number' || d.cacheTTL < 0)) {
    return 'cacheTTL must be a non-negative number.';
  }

  return null;
}
