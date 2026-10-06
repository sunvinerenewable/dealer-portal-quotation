import { query, getSupabaseServiceClient, ensureEnvLoaded } from './db.js';
import { hashBcrypt } from './security.js';

ensureEnvLoaded();

/**
 * POST /api/auth/manage-credentials
 *
 * Centralized server-side credential and account management endpoint.
 * Ensures consistent Bcrypt password hashing ($2a$10$...) for PostgreSQL
 * across Dealer Onboarding, Staff Creation, and Verification Desk management.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const { action, payload } = req.body || {};

  if (!action || !payload) {
    return res.status(400).json({ error: 'action and payload are required.' });
  }

  try {
    switch (action) {
      case 'create-dealer': {
        const {
          dealerCode,
          firmName,
          contactPerson,
          mobile,
          email,
          city,
          state,
          discom,
          tier,
          maxMarginCapPerKw,
          password,
          status,
          address,
          gstin,
          pan,
          discomLicense
        } = payload;

        const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
        if (cleanMobile.length !== 10) {
          return res.status(400).json({ error: 'Valid 10-digit mobile number is required.' });
        }
        if (!firmName || !contactPerson) {
          return res.status(400).json({ error: 'Firm name and contact person are required.' });
        }

        const plainPassword = String(password || 'Sunvine@2026').trim();
        const passwordHash = hashBcrypt(plainPassword, 10);
        const code = dealerCode || `SV-DLR-0${Math.floor(800 + Math.random() * 100)}`;
        const cleanTier = tier || 'Gold EPC Partner';
        const cleanCap = Number(maxMarginCapPerKw) || 6000;
        const cleanStatus = (status || 'Active').toLowerCase();
        const cleanEmail = email || `${cleanMobile}@sunvinedealer.in`;
        const cleanCity = city || 'Ahmedabad';
        const cleanState = state || 'Gujarat';
        const cleanDiscom = discom || 'UGVCL';
        const assignedStaffId = payload.assignedStaffId || 'STF-DIRECT';
        const assignedStaffName = assignedStaffId === 'STF-DIRECT' 
          ? 'Direct to Company (HQ Desk)' 
          : (payload.assignedStaffName || 'Sunvine Sales Staff');
        const pricingConfig = JSON.stringify({
          ...(payload.pricingConfig || {}),
          assignedStaffId,
          assignedStaffName
        });

        const sql = `
          INSERT INTO dealer_accounts (
            dealer_code, firm_name, contact_person, mobile_number, email,
            password_hash, city, state, discom, tier, max_margin_cap_per_kw,
            status, gst_number, pan_number, assigned_staff_id, assigned_staff_name, pricing_config, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, NOW(), NOW())
          ON CONFLICT (dealer_code) DO UPDATE SET
            firm_name = EXCLUDED.firm_name,
            contact_person = EXCLUDED.contact_person,
            mobile_number = EXCLUDED.mobile_number,
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            discom = EXCLUDED.discom,
            tier = EXCLUDED.tier,
            max_margin_cap_per_kw = EXCLUDED.max_margin_cap_per_kw,
            status = EXCLUDED.status,
            gst_number = EXCLUDED.gst_number,
            pan_number = EXCLUDED.pan_number,
            assigned_staff_id = EXCLUDED.assigned_staff_id,
            assigned_staff_name = EXCLUDED.assigned_staff_name,
            pricing_config = EXCLUDED.pricing_config,
            updated_at = NOW()
          RETURNING id, dealer_code, firm_name, contact_person, mobile_number, email, status, tier, max_margin_cap_per_kw, assigned_staff_id, assigned_staff_name;
        `;

        const qRes = await query(sql, [
          code,
          firmName,
          contactPerson,
          cleanMobile,
          cleanEmail,
          passwordHash,
          cleanCity,
          cleanState,
          cleanDiscom,
          cleanTier,
          cleanCap,
          cleanStatus,
          gstin || null,
          pan || null,
          assignedStaffId,
          assignedStaffName,
          pricingConfig
        ]);

        return res.status(200).json({
          success: true,
          message: `Dealer ${firmName} onboarded successfully with secure credentials.`,
          dealer: qRes.rows[0]
        });
      }

      case 'update-dealer-credentials': {
        const { id, dealerCode, mobile, password, email, firmName, contactPerson, status } = payload;
        const targetId = dealerCode || id;

        if (!targetId && !mobile) {
          return res.status(400).json({ error: 'Dealer ID, dealerCode or mobile is required.' });
        }

        const updates = [];
        const params = [];
        let idx = 1;

        if (mobile) {
          const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
          updates.push(`mobile_number = $${idx++}`);
          params.push(cleanMobile);
        }

        if (password && String(password).trim().length >= 1) {
          const passwordHash = hashBcrypt(String(password).trim(), 10);
          updates.push(`password_hash = $${idx++}`);
          params.push(passwordHash);
        }

        if (email !== undefined) {
          const cleanEmailVal = (email && String(email).trim()) ? String(email).trim() : null;
          updates.push(`email = $${idx++}`);
          params.push(cleanEmailVal);
        }

        if (firmName) {
          updates.push(`firm_name = $${idx++}`);
          params.push(firmName.trim());
        }

        if (contactPerson) {
          updates.push(`contact_person = $${idx++}`);
          params.push(contactPerson.trim());
        }

        if (status) {
          updates.push(`status = $${idx++}`);
          params.push(status.toLowerCase());
        }

        if (payload.assignedStaffId) {
          updates.push(`assigned_staff_id = $${idx++}`);
          params.push(payload.assignedStaffId);
          const staffName = payload.assignedStaffId === 'STF-DIRECT'
            ? 'Direct to Company (HQ Desk)'
            : (payload.assignedStaffName || 'Sunvine Sales Staff');
          updates.push(`assigned_staff_name = $${idx++}`);
          params.push(staffName);
        } else if (payload.assignedStaffName) {
          updates.push(`assigned_staff_name = $${idx++}`);
          params.push(payload.assignedStaffName);
        }

        if (payload.pricingConfig) {
          updates.push(`pricing_config = $${idx++}::jsonb`);
          params.push(JSON.stringify(payload.pricingConfig));
        }

        updates.push(`updated_at = NOW()`);

        if (updates.length === 1) {
          return res.status(400).json({ error: 'No fields provided to update.' });
        }

        let whereClause = '';
        if (targetId) {
          whereClause = `dealer_code = $${idx} OR id::text = $${idx}`;
          params.push(targetId);
        } else {
          const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
          whereClause = `mobile_number = $${idx}`;
          params.push(cleanMobile);
        }

        const sql = `UPDATE dealer_accounts SET ${updates.join(', ')} WHERE ${whereClause} RETURNING id, dealer_code, firm_name, mobile_number, email, status, assigned_staff_id, assigned_staff_name;`;
        const qRes = await query(sql, params);

        return res.status(200).json({
          success: true,
          message: 'Dealer credentials updated successfully.',
          dealer: qRes.rows[0]
        });
      }

      case 'create-staff': {
        const { id, name, phone, email, role, zone, city, password, department, status } = payload;
        const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);

        if (cleanPhone.length !== 10) {
          return res.status(400).json({ error: 'Valid 10-digit mobile number required for staff.' });
        }
        if (!name) {
          return res.status(400).json({ error: 'Staff name is required.' });
        }

        const staffId = id || `STF-${String(Math.floor(100 + Math.random() * 899))}`;
        const staffRole = role || 'Field Sales Executive';
        const isVerification = staffRole.toLowerCase().includes('verification') || String(department || '').toLowerCase().includes('verification');
        const finalDepartment = isVerification ? 'verification' : (String(department || 'sales').toLowerCase());
        const plainPassword = String(password || 'Sunvine@2026').trim();
        const passwordHash = hashBcrypt(plainPassword, 10);
        const cleanEmail = email || `${cleanPhone}@sunvine.in`;
        const cleanStatus = (status || 'active').toLowerCase();

        // Check if an account already exists with this phone or ID
        let existingId = null;
        try {
          const checkRes = await query(
            'SELECT id FROM staff_accounts WHERE phone = $1 OR mobile_number = $1 OR id = $2 LIMIT 1',
            [cleanPhone, staffId]
          );
          if (checkRes.rows && checkRes.rows.length > 0) {
            existingId = checkRes.rows[0].id;
          }
        } catch (_) {}

        let staffRecord = null;
        if (existingId) {
          const updateSql = `
            UPDATE staff_accounts SET
              name = $1,
              phone = $2,
              mobile_number = $2,
              email = $3,
              role = $4,
              department = $5,
              zone = $6,
              city = $7,
              status = $8,
              password_hash = $9,
              updated_at = NOW()
            WHERE id = $10
            RETURNING id, name, phone, mobile_number, email, role, department, zone, city, status;
          `;
          const qRes = await query(updateSql, [
            name.trim(),
            cleanPhone,
            cleanEmail,
            staffRole,
            finalDepartment,
            zone || 'Gujarat',
            city || 'Ahmedabad',
            cleanStatus,
            passwordHash,
            existingId
          ]);
          staffRecord = qRes.rows?.[0];
        } else {
          const insertSql = `
            INSERT INTO staff_accounts (
              id, name, phone, mobile_number, email, role, department, zone, city,
              status, password_hash, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              phone = EXCLUDED.phone,
              mobile_number = EXCLUDED.mobile_number,
              email = EXCLUDED.email,
              role = EXCLUDED.role,
              department = EXCLUDED.department,
              zone = EXCLUDED.zone,
              city = EXCLUDED.city,
              status = EXCLUDED.status,
              password_hash = EXCLUDED.password_hash,
              updated_at = NOW()
            RETURNING id, name, phone, mobile_number, email, role, department, zone, city, status;
          `;
          const qRes = await query(insertSql, [
            staffId,
            name.trim(),
            cleanPhone,
            cleanPhone,
            cleanEmail,
            staffRole,
            finalDepartment,
            zone || 'Gujarat',
            city || 'Ahmedabad',
            cleanStatus,
            passwordHash
          ]);
          staffRecord = qRes.rows?.[0];
        }

        return res.status(200).json({
          success: true,
          message: `${isVerification ? 'Verification Desk' : 'Staff'} account created successfully.`,
          staff: staffRecord || { id: staffId, name: name.trim(), phone: cleanPhone, email: cleanEmail, role: staffRole }
        });
      }

      case 'update-staff-credentials': {
        const { id, staffId, name, phone, email, role, zone, city, password, department, status } = payload;
        const targetStaffId = id || staffId;

        if (!targetStaffId && !phone) {
          return res.status(400).json({ error: 'Staff ID or phone is required.' });
        }

        const updates = [];
        const params = [];
        let idx = 1;

        if (name) {
          updates.push(`name = $${idx++}`);
          params.push(name.trim());
        }

        if (phone) {
          const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
          updates.push(`phone = $${idx++}`);
          params.push(cleanPhone);
          updates.push(`mobile_number = $${idx++}`);
          params.push(cleanPhone);
        }

        if (email !== undefined) {
          const cleanStaffEmail = (email && String(email).trim()) ? String(email).trim() : null;
          updates.push(`email = $${idx++}`);
          params.push(cleanStaffEmail);
        }

        if (role) {
          updates.push(`role = $${idx++}`);
          params.push(role);
          const isVerification = role.toLowerCase().includes('verification');
          updates.push(`department = $${idx++}`);
          params.push(isVerification ? 'verification' : (String(department || 'sales').toLowerCase()));
        } else if (department) {
          updates.push(`department = $${idx++}`);
          params.push(String(department).toLowerCase());
        }

        if (zone) {
          updates.push(`zone = $${idx++}`);
          params.push(zone);
        }

        if (city) {
          updates.push(`city = $${idx++}`);
          params.push(city);
        }

        if (status) {
          updates.push(`status = $${idx++}`);
          params.push(String(status).toLowerCase());
        }

        if (password && String(password).trim().length >= 1) {
          const passwordHash = hashBcrypt(String(password).trim(), 10);
          updates.push(`password_hash = $${idx++}`);
          params.push(passwordHash);
        }

        updates.push(`updated_at = NOW()`);

        let whereClause = '';
        if (targetStaffId) {
          whereClause = `id = $${idx}`;
          params.push(targetStaffId);
        } else {
          const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
          whereClause = `phone = $${idx} OR mobile_number = $${idx}`;
          params.push(cleanPhone);
        }

        const sql = `UPDATE staff_accounts SET ${updates.join(', ')} WHERE ${whereClause} RETURNING id, name, phone, mobile_number, email, role, department, status;`;
        const qRes = await query(sql, params);

        return res.status(200).json({
          success: true,
          message: 'Staff profile and credentials updated successfully.',
          staff: qRes.rows[0]
        });
      }

      case 'delete-dealer': {
        const { id, dealerCode } = payload;
        const target = dealerCode || id;
        if (!target) return res.status(400).json({ error: 'Dealer identifier required.' });
        await query('DELETE FROM dealer_accounts WHERE dealer_code = $1 OR id::text = $1', [target]);
        return res.status(200).json({ success: true, message: `Dealer ${target} removed.` });
      }

      case 'delete-staff': {
        const { id, staffId } = payload;
        const target = id || staffId;
        if (!target) return res.status(400).json({ error: 'Staff ID required.' });
        await query('DELETE FROM staff_accounts WHERE id = $1', [target]);
        return res.status(200).json({ success: true, message: `Staff ${target} removed.` });
      }

      case 'get-accounts': {
        const adminsRes = await query('SELECT id, email, full_name, role, mobile_number, two_factor_enabled, last_login, created_at FROM admin_accounts ORDER BY created_at ASC');
        const dealersRes = await query('SELECT id, dealer_code, firm_name, contact_person, mobile_number, email, city, state, discom, tier, max_margin_cap_per_kw, status, assigned_staff_id, assigned_staff_name, pricing_config, created_at, updated_at FROM dealer_accounts ORDER BY updated_at DESC');
        const staffRes = await query('SELECT id, name, role, department, phone, email, status, onboarded_date, zone, city, created_at, updated_at FROM staff_accounts ORDER BY created_at ASC');
        return res.status(200).json({
          success: true,
          admins: adminsRes.rows,
          dealers: dealersRes.rows,
          staff: staffRes.rows
        });
      }

      case 'create-admin': {
        const { fullName, email, mobileNumber, role, password } = payload;
        if (!fullName || !email) {
          return res.status(400).json({ error: 'Full name and email are required.' });
        }
        const cleanMobile = String(mobileNumber || '').replace(/\D/g, '').slice(-10);
        if (cleanMobile.length !== 10) {
          return res.status(400).json({ error: 'Valid 10-digit mobile number is required.' });
        }
        const plainPassword = String(password || 'admin123').trim();
        const passwordHash = hashBcrypt(plainPassword, 10);
        const adminRole = role || 'admin';

        const sql = `
          INSERT INTO admin_accounts (
            email, full_name, mobile_number, role, password_hash, two_factor_enabled, created_at
          ) VALUES ($1, $2, $3, $4, $5, false, NOW())
          RETURNING id, email, full_name, mobile_number, role, created_at;
        `;
        const qRes = await query(sql, [email.trim().toLowerCase(), fullName.trim(), cleanMobile, adminRole, passwordHash]);
        return res.status(200).json({
          success: true,
          message: `Admin ${fullName} created successfully.`,
          admin: qRes.rows[0]
        });
      }

      case 'update-admin': {
        const { id, fullName, email, mobileNumber, role, password } = payload;
        if (!id) return res.status(400).json({ error: 'Admin ID is required.' });

        const updates = [];
        const params = [];
        let idx = 1;

        if (fullName) {
          updates.push(`full_name = $${idx++}`);
          params.push(fullName.trim());
        }
        if (email) {
          updates.push(`email = $${idx++}`);
          params.push(email.trim().toLowerCase());
        }
        if (mobileNumber) {
          const cleanMobile = String(mobileNumber).replace(/\D/g, '').slice(-10);
          updates.push(`mobile_number = $${idx++}`);
          params.push(cleanMobile);
        }
        if (role) {
          updates.push(`role = $${idx++}`);
          params.push(role);
        }
        if (password && String(password).trim().length >= 1) {
          const passwordHash = hashBcrypt(String(password).trim(), 10);
          updates.push(`password_hash = $${idx++}`);
          params.push(passwordHash);
        }

        if (updates.length === 0) {
          return res.status(400).json({ error: 'No fields provided to update.' });
        }

        params.push(id);
        const sql = `UPDATE admin_accounts SET ${updates.join(', ')} WHERE id::text = $${idx} RETURNING id, email, full_name, mobile_number, role;`;
        const qRes = await query(sql, params);
        return res.status(200).json({
          success: true,
          message: 'Admin updated successfully.',
          admin: qRes.rows[0]
        });
      }

      case 'delete-admin': {
        const { id } = payload;
        if (!id) return res.status(400).json({ error: 'Admin ID required.' });
        const countRes = await query('SELECT count(*) FROM admin_accounts');
        if (parseInt(countRes.rows[0].count, 10) <= 1) {
          return res.status(400).json({ error: 'Cannot delete the only remaining admin account.' });
        }
        await query('DELETE FROM admin_accounts WHERE id::text = $1', [id]);
        return res.status(200).json({ success: true, message: 'Admin account deleted.' });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('[manage-credentials] Error:', err);
    return res.status(500).json({ error: err.message || 'Server error managing credentials.' });
  }
}
