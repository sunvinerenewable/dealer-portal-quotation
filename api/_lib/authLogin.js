import { checkDistributedRateLimit, resetRateLimit, recordFailedAttempt, getClientIp } from './rateLimiter.js';
import { verifyPassword } from './security.js';
import { signJwt, createAuthCookieHeader } from './jwt.js';
import { query, getSupabaseServiceClient } from './db.js';

/**
 * POST /api/auth/login
 *
 * Authentication flow (server-side only):
 * 1. Distributed Rate-limit check by client IP (Upstash Redis)
 * 2. Validate input shape
 * 3. Look up the user in Supabase via PostgreSQL direct connection or service-role client
 * 4. Verify password via PBKDF2/bcrypt comparison server-side
 * 5. Issue a signed JWT in an HTTP-only cookie
 *
 * NO plaintext passwords. NO hardcoded credentials. NO bypass lists.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const clientIp = getClientIp(req);

  // ── 1. Distributed Rate limiting (Upstash Redis) ──────────────────────────
  const rateCheck = await checkDistributedRateLimit(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
  res.setHeader('RateLimit-Limit', '10');
  res.setHeader('RateLimit-Remaining', String(rateCheck.remaining));
  res.setHeader('RateLimit-Reset', String(rateCheck.resetSeconds));

  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: `Too many login attempts. Try again in ${rateCheck.resetSeconds} seconds.`,
      retryAfter: rateCheck.resetSeconds
    });
  }

  // ── 2. Input validation ───────────────────────────────────────────────────
  const { identifier, password, role } = req.body || {};

  if (!identifier || !password || !role) {
    return res.status(400).json({ error: 'identifier, password, and role are required.' });
  }

  const cleanIdentifier = String(identifier).trim();
  const cleanRole = String(role).toLowerCase();

  if (!['admin', 'dealer', 'staff'].includes(cleanRole)) {
    return res.status(400).json({ error: 'Invalid role. Must be admin, dealer, or staff.' });
  }

  if (!password || password.length < 1 || password.length > 128) {
    recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  // ── 3. Database lookup ────────────────────────────────────────────────────
  try {
    let userRecord = null;
    let userPayload = null;

    if (cleanRole === 'admin') {
      const isEmail = cleanIdentifier.includes('@');
      let candidates = [];

      try {
        const table = 'admin_accounts';
        const sql = isEmail
          ? `SELECT id, email, full_name, role, password_hash, mobile_number FROM ${table} WHERE LOWER(email) = LOWER($1)`
          : `SELECT id, email, full_name, role, password_hash, mobile_number FROM ${table} WHERE mobile_number = $1`;
        const qRes = await query(sql, [cleanIdentifier]);
        candidates = qRes.rows || [];
      } catch (dbErr) {
        console.error('[auth/login] PostgreSQL admin lookup failed:', dbErr.message);
        try {
          const db = getSupabaseServiceClient();
          let qRes = await db
            .from('admin_accounts')
            .select('id, email, full_name, role, password_hash, mobile_number')
            .eq(isEmail ? 'email' : 'mobile_number', cleanIdentifier);
          if ((!qRes.data || qRes.data.length === 0) && !qRes.error) {
            qRes = await db
              .from('admin_users')
              .select('id, email, full_name, role, password_hash, mobile_number')
              .eq(isEmail ? 'email' : 'mobile_number', cleanIdentifier);
          }
          candidates = qRes.data || [];
        } catch (supErr) {
          console.error('[auth/login] Supabase admin lookup also failed:', supErr.message);
        }
      }

      if (!candidates || candidates.length === 0) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      // Verify BOTH mobile/email AND password across all candidate admin accounts
      let matchedAdmin = null;
      for (const cand of candidates) {
        const isValid =
          verifyPassword(password, cand.password_hash) ||
          verifyPassword(password.replace(/\s+/g, ''), cand.password_hash) ||
          verifyPassword(password.trim(), cand.password_hash);
        if (isValid) {
          matchedAdmin = cand;
          break;
        }
      }

      if (!matchedAdmin) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      userRecord = matchedAdmin;
      userPayload = {
        id: userRecord.id,
        role: 'admin',
        email: userRecord.email,
        name: userRecord.full_name,
        adminRole: userRecord.role
      };

    } else if (cleanRole === 'dealer') {
      const cleanMobile = cleanIdentifier.replace(/\D/g, '').slice(-10);
      if (cleanMobile.length !== 10) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid mobile number.' });
      }
      let candidates = [];

      try {
        const sql = 'SELECT id, dealer_code, firm_name, contact_person, mobile_number, email, password_hash, status, city, state, discom, tier, max_margin_cap_per_kw, assigned_staff_id, assigned_staff_name, pricing_config FROM dealer_accounts WHERE mobile_number = $1';
        const qRes = await query(sql, [cleanMobile]);
        candidates = qRes.rows || [];
      } catch (dbErr) {
        console.error('[auth/login] PostgreSQL dealer lookup failed:', dbErr.message);
        try {
          const db = getSupabaseServiceClient();
          const qRes = await db
            .from('dealer_accounts')
            .select('id, dealer_code, firm_name, contact_person, mobile_number, email, password_hash, status, city, state, discom, tier, max_margin_cap_per_kw, assigned_staff_id, assigned_staff_name, pricing_config')
            .eq('mobile_number', cleanMobile);
          candidates = qRes.data || [];
        } catch (supErr) {
          console.error('[auth/login] Supabase dealer lookup also failed:', supErr.message);
        }
      }

      if (!candidates || candidates.length === 0) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      // Verify BOTH mobile number AND password across all candidate dealer accounts
      let matchedDealer = null;
      for (const cand of candidates) {
        const isValid =
          verifyPassword(password, cand.password_hash) ||
          verifyPassword(password.replace(/\s+/g, ''), cand.password_hash) ||
          verifyPassword(password.trim(), cand.password_hash);
        if (isValid) {
          matchedDealer = cand;
          break;
        }
      }

      if (!matchedDealer) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      if (matchedDealer.status === 'suspended' || matchedDealer.status === 'inactive') {
        return res.status(403).json({ error: 'Account suspended. Contact Sunvine support.' });
      }

      const isDirect = matchedDealer.assigned_staff_id === 'STF-DIRECT';
      userPayload = {
        id: matchedDealer.id,
        dealer_id: matchedDealer.id,
        dealerCode: matchedDealer.dealer_code,
        role: 'dealer',
        mobile: matchedDealer.mobile_number,
        firmName: matchedDealer.firm_name,
        contactPerson: matchedDealer.contact_person,
        city: matchedDealer.city,
        state: matchedDealer.state,
        discom: matchedDealer.discom,
        tier: matchedDealer.tier,
        maxMarginCapPerKw: matchedDealer.max_margin_cap_per_kw || 6000,
        assignedStaffId: matchedDealer.assigned_staff_id || 'STF-DIRECT',
        assignedStaffName: matchedDealer.assigned_staff_name || (isDirect ? 'Direct to Company (HQ Desk)' : 'Sunvine Sales Staff'),
        pricingConfig: matchedDealer.pricing_config || {}
      };

    } else {
      // staff
      const { staffRole: reqStaffRole } = req.body || {};
      const cleanMobile = cleanIdentifier.replace(/\D/g, '').slice(-10);
      if (cleanMobile.length !== 10) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid mobile number.' });
      }
      let candidates = [];
      const isReqVerification = String(reqStaffRole || '').toLowerCase().includes('verification');

      try {
        const sql = `
          SELECT id, name, phone, mobile_number, email, role, department, city, zone, status, password_hash 
          FROM staff_accounts 
          WHERE phone = $1 OR mobile_number = $1 OR phone = $2 OR mobile_number = $2
        `;
        const qRes = await query(sql, [cleanMobile, `+91${cleanMobile}`]);
        candidates = qRes.rows || [];
      } catch (dbErr) {
        console.error('[auth/login] PostgreSQL staff lookup failed:', dbErr.message);
        try {
          const db = getSupabaseServiceClient();
          const qRes = await db
            .from('staff_accounts')
            .select('id, name, phone, mobile_number, email, role, department, city, zone, status, password_hash')
            .or(`phone.eq.${cleanMobile},mobile_number.eq.${cleanMobile},phone.eq.+91${cleanMobile},mobile_number.eq.+91${cleanMobile}`);
          candidates = qRes.data || [];
        } catch (supErr) {
          console.error('[auth/login] Supabase staff lookup also failed:', supErr.message);
        }
      }

      if (!candidates || candidates.length === 0) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      // Verify BOTH mobile number AND password across all candidate staff accounts.
      // If reqStaffRole is set (e.g. verification vs sales), prefer the candidate that matches the department/role.
      let matchedStaff = null;

      // Pass 1: Match BOTH password AND requested department/role
      for (const cand of candidates) {
        const passMatch =
          verifyPassword(password, cand.password_hash) ||
          verifyPassword(password.replace(/\s+/g, ''), cand.password_hash) ||
          verifyPassword(password.trim(), cand.password_hash);

        if (passMatch) {
          const isCandVerification =
            (cand.department || '').toLowerCase().includes('verification') ||
            (cand.role || '').toLowerCase().includes('verification') ||
            cand.id === 'STF-800' ||
            cand.id === 'STF-003';

          if (reqStaffRole) {
            if (isCandVerification === isReqVerification) {
              matchedStaff = cand;
              break;
            }
          } else {
            matchedStaff = cand;
            break;
          }
        }
      }

      // Pass 2: If no role-specific match found, check any candidate matching password
      if (!matchedStaff) {
        for (const cand of candidates) {
          const passMatch =
            verifyPassword(password, cand.password_hash) ||
            verifyPassword(password.replace(/\s+/g, ''), cand.password_hash) ||
            verifyPassword(password.trim(), cand.password_hash);
          if (passMatch) {
            matchedStaff = cand;
            break;
          }
        }
      }

      if (!matchedStaff) {
        recordFailedAttempt(clientIp, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      if (matchedStaff.status === 'suspended' || matchedStaff.status === 'inactive') {
        return res.status(403).json({ error: 'Account suspended. Contact Sunvine support.' });
      }

      const isVerification =
        (matchedStaff.department || '').toLowerCase().includes('verification') ||
        (matchedStaff.role || '').toLowerCase().includes('verification') ||
        matchedStaff.id === 'STF-800' ||
        matchedStaff.id === 'STF-003';

      userPayload = {
        id: matchedStaff.id,
        staff_id: matchedStaff.id,
        role: 'staff',
        name: matchedStaff.name,
        phone: matchedStaff.phone || matchedStaff.mobile_number || cleanMobile,
        mobile: matchedStaff.mobile_number || matchedStaff.phone || cleanMobile,
        email: matchedStaff.email || `${cleanMobile}@sunvine.in`,
        department: matchedStaff.department,
        city: matchedStaff.city,
        zone: matchedStaff.zone,
        staffRole: isVerification ? 'verification' : 'sales'
      };
    }

    // ── 4. Issue JWT ────────────────────────────────────────────────────────
    await resetRateLimit(clientIp);
    const token = signJwt(userPayload, 24 * 60 * 60);
    res.setHeader('Set-Cookie', createAuthCookieHeader(token, 24 * 60 * 60));

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      user: userPayload
    });

  } catch (err) {
    console.error('[API auth/login] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal authentication error. Please try again.' });
  }
}
