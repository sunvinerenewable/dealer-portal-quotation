/**
 * Sunvine Enterprise Streamlined Runtime Crash Reporter
 * High-precision, clean, executive-grade Slack diagnostic notifications.
 */

const SLACK_WEBHOOK_URL = import.meta.env.VITE_SLACK_CRASH_WEBHOOK_URL;

// In-memory deduplication set to avoid spamming Slack on continuous render loops
const recentErrors = new Map();
const DEDUPE_WINDOW_MS = 60000; // 1 minute dedupe per unique error message

let cachedGeo = null;
let geoPromise = null;

/**
 * Fast Geo & IP resolver with fallback
 */
async function fetchClientGeo() {
  if (cachedGeo) return cachedGeo;
  if (geoPromise) return geoPromise;

  geoPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('https://ipwho.is/', { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data && data.success !== false) {
          cachedGeo = {
            ip: data.ip || 'Unknown IP',
            city: data.city || '',
            region: data.region || '',
            country: data.country || 'India'
          };
          return cachedGeo;
        }
      }
    } catch (_) {}

    try {
      const res = await fetch('https://api.ipify.org?format=json');
      if (res.ok) {
        const data = await res.json();
        cachedGeo = { ip: data.ip || 'Unknown IP', city: '', region: '', country: 'India' };
        return cachedGeo;
      }
    } catch (_) {}

    return { ip: 'Undetected', city: '', region: '', country: '' };
  })();

  return geoPromise;
}

/**
 * Clean User Identity & Account Details extractor
 */
function getCleanUserContext() {
  try {
    const role = localStorage.getItem('sunvine_role');
    const path = typeof window !== 'undefined' ? window.location.pathname : '';

    // 1. Check Admin Desk
    if (role === 'admin' || path.startsWith('/admin')) {
      let adminEmail = 'admin@sunvinesolar.com';
      try {
        const adminSession = localStorage.getItem('sunvine_admin_session');
        if (adminSession && adminSession.startsWith('{')) {
          const parsed = JSON.parse(adminSession);
          if (parsed?.email) adminEmail = parsed.email;
        }
      } catch (_) {}
      return {
        name: 'System Administrator',
        email: adminEmail,
        roleBadge: 'Admin Desk'
      };
    }

    // 2. Check Staff Desk
    if (role === 'staff' || path.startsWith('/staff')) {
      const staffStr =
        localStorage.getItem('sunvine_current_staff') ||
        sessionStorage.getItem('sunvine_current_staff') ||
        localStorage.getItem('sunvine_staff_user');
      if (staffStr && staffStr !== 'null') {
        const s = JSON.parse(staffStr);
        if (s && typeof s === 'object') {
          return {
            name: s.name || s.full_name || s.username || 'Staff Member',
            email: s.email || s.email_id || 'Internal Staff',
            roleBadge: `Staff (${s.role || s.designation || 'Engineer'})`
          };
        }
      }
      return {
        name: 'Staff Member',
        email: 'Internal Staff',
        roleBadge: 'Staff Desk'
      };
    }

    // 3. Check Dealer Account
    const dealerStr =
      localStorage.getItem('sunvine_current_dealer') ||
      sessionStorage.getItem('sunvine_current_dealer');
    if (dealerStr && dealerStr !== 'null') {
      const d = JSON.parse(dealerStr);
      if (d && typeof d === 'object') {
        const name = d.name || d.dealer_name || d.full_name || d.contactPerson || 'Dealer User';
        const email = d.email || d.email_id || d.phone || d.mobile || 'Registered Dealer';
        const account = d.businessName || d.firm_name || d.dealerCode || 'Channel Partner';
        return {
          name: `${name} [${account}]`,
          email: email,
          roleBadge: 'Dealer Partner'
        };
      }
    }
  } catch (_) {}

  return {
    name: 'Unauthenticated Visitor',
    email: 'Guest Session',
    roleBadge: 'Public / Guest'
  };
}

/**
 * Concise Browser & OS info
 */
function getConciseDevice() {
  if (typeof window === 'undefined') return 'Node/SSR';
  const ua = navigator.userAgent;
  let browser = 'Chrome';
  let os = 'Windows';

  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';

  return `${browser} on ${os}`;
}

/**
 * Sends clean, executive error report to Slack
 * @param {Error|string|Event} error
 * @param {Object} [extraContext]
 */
export async function reportCrash(error, extraContext = {}) {
  if (!SLACK_WEBHOOK_URL) return;

  const rawMessage =
    error?.message ||
    (typeof error === 'string' ? error : 'Unknown runtime exception');

  // Strip repeated error prefixes / redundant markers
  const cleanMessage = rawMessage.replace(/^[a-zA-Z]*Error:\s*/, '').replace(/[<>&]/g, '');
  const errorStack = error?.stack || extraContext?.componentStack || 'No stack trace captured.';
  const errorType = extraContext?.type || error?.name || 'RuntimeError';
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'Unknown URL';
  const pathname = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';

  const timestamp = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // Deduplication check
  const dedupeKey = `${cleanMessage}:${errorType}`;
  const now = Date.now();
  if (recentErrors.has(dedupeKey)) {
    const lastSent = recentErrors.get(dedupeKey);
    if (now - lastSent < DEDUPE_WINDOW_MS) return;
  }
  recentErrors.set(dedupeKey, now);

  const [geo, user, device] = await Promise.all([
    fetchClientGeo(),
    Promise.resolve(getCleanUserContext()),
    Promise.resolve(getConciseDevice())
  ]);

  const locationText = [geo.city, geo.region, geo.country].filter(Boolean).join(', ') || 'India';

  // Format clean trimmed stack trace (up to 7 lines)
  const trimmedStack = errorStack
    .split('\n')
    .slice(0, 7)
    .map((line) => line.trim())
    .join('\n')
    .slice(0, 600);

  const payload = {
    text: `<!channel> 🚨 *CRITICAL RUNTIME CRASH:* ${cleanMessage} (${errorType})`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 Application Runtime Crash',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Type:* \`${errorType}\`\n*Error:* *${cleanMessage}*`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `👤 *Account:*\n*${user.name}*\n\`${user.email}\` • _${user.roleBadge}_`
          },
          {
            type: 'mrkdwn',
            text: `📍 *Active Route:*\n*<${currentUrl}|${pathname || currentUrl}>*`
          },
          {
            type: 'mrkdwn',
            text: `🌐 *Client IP & Geo:*\n\`${geo.ip}\`\n_${locationText}_`
          },
          {
            type: 'mrkdwn',
            text: `💻 *Device & Time:*\n*${device}*\n_${timestamp} IST_`
          }
        ]
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Stack Trace Diagnostics:*\n\`\`\`${trimmedStack}\`\`\``
        }
      }
    ]
  };

  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('[CrashReporter] Failed to send crash alert to Slack:', err);
  }
}

/**
 * Initializes global window error listeners
 */
export function initCrashReporter() {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    if (
      event.message?.includes('ResizeObserver') ||
      event.message?.includes('Script error.') ||
      event.filename?.includes('extension')
    ) {
      return;
    }
    reportCrash(event.error || event.message, {
      type: 'UncaughtException',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason?.name === 'AbortError') return;

    reportCrash(reason instanceof Error ? reason : new Error(String(reason)), {
      type: 'UnhandledPromiseRejection'
    });
  });

  console.info('🛡️ [Sunvine Crash Reporter] Active & monitoring runtime exceptions.');
}
