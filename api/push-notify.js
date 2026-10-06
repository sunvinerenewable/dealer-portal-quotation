import webpush from 'web-push';
import { ensureEnvLoaded, query } from './_lib/db.js';

ensureEnvLoaded();

// Configure VAPID details for Web Push protocol
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@sunvinesolar.com';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.error('[api/push-notify] VAPID initialization error:', err.message);
  }
}

// Configure Slack Webhook for Customer Files & Pipeline Updates
const slackWebhookUrl = process.env.SLACK_FILES_UPDATE || process.env.VITE_SLACK_FILES_UPDATE;

function getTimestampIST() {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Dispatch rich Block Kit notification to Slack incoming webhook
 */
async function sendSlackNotification(slackPayload) {
  if (!slackWebhookUrl || !slackPayload) return false;
  try {
    const res = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof slackPayload === 'string' ? slackPayload : JSON.stringify(slackPayload)
    });
    return res.ok;
  } catch (err) {
    console.warn('[api/push-notify] Slack notification warning:', err.message);
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    action = 'new-application',
    fileId,
    customerName,
    solarKw,
    sanctionedLoadKw,
    dealerId,
    dealerName,
    assignedStaffId,
    assignedStaffName,
    targetUserId,
    role,
    city,
    discom,
    financeType,
    roofType,
    stageName,
    status,
    notes,
    actor,
    docTitle,
    filename,
    reason,
    cancelledBy,
    restoredBy,
    slackPayload
  } = req.body || {};

  // Handle direct Slack raw proxy request
  if (action === 'slack-raw' && slackPayload) {
    const slackOk = await sendSlackNotification(slackPayload);
    return res.status(200).json({ success: true, slackSent: slackOk });
  }

  try {
    let targets = ['admin'];
    let notificationPayload = null;
    let computedSlackPayload = null;
    const timestamp = getTimestampIST();

    if (action === 'test') {
      const userTarget = targetUserId || (role === 'admin' ? 'admin' : null);
      if (userTarget) targets = [userTarget];

      notificationPayload = JSON.stringify({
        title: '⚡ Sunvine Solar EPC Test Alert',
        body: `OS push notifications are active and connected! (Target: ${userTarget || role || 'User'})`,
        icon: '/pwa-192x192.png',
        badge: '/favicon.ico',
        url: '/?tab=dashboard',
        data: {
          test: true,
          url: '/?tab=dashboard',
          timestamp: Date.now()
        }
      });

      computedSlackPayload = {
        text: `⚡ Sunvine Solar EPC Test Alert: Push & Slack channel verified for ${userTarget || role || 'User'}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '⚡ Sunvine Notification Channel Verified',
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Status:* 🟢 *Active & Operational*\n*Channel:* \`Slack Files Update\` + \`VAPID OS Push\`\n*Target User:* *${userTarget || role || 'User'}*`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `🕒 _${timestamp} IST_ • 🚀 *Sunvine Renewable Energy*`
              }
            ]
          }
        ]
      };
    } else if (action === 'stage-update' || action === 'status-update') {
      const safeCust = (customerName || 'Customer').trim();
      const safeStage = (stageName || status || 'Updated').replace(/_/g, ' ');
      const safeDealer = (dealerName || dealerId || 'Authorized Dealer').trim();

      computedSlackPayload = {
        text: `🔄 Application Stage Progressed: ${safeCust} (${fileId || 'N/A'}) → ${safeStage}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🔄 Application Stage Progressed',
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Customer:* *${safeCust}* (\`${fileId || 'N/A'}\`)\n*New Stage:* *${safeStage}*\n${notes ? `*Notes:* _${notes}_` : ''}`
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `🏢 *Dealer Partner:*\n*${safeDealer}*`
              },
              {
                type: 'mrkdwn',
                text: `👤 *Updated By:*\n*${actor || 'Staff Desk'}*`
              }
            ]
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `🕒 _${timestamp} IST_ • 🚀 *Sunvine Solar Pipeline*`
              }
            ]
          }
        ]
      };
    } else if (action === 'document-upload') {
      const safeCust = (customerName || 'Customer').trim();

      computedSlackPayload = {
        text: `📄 Document Uploaded: ${docTitle || 'Document'} for ${safeCust} (${fileId || 'N/A'})`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '📄 Customer Document Secured in Vault',
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Customer:* *${safeCust}* (\`${fileId || 'N/A'}\`)\n*Document:* *${docTitle || 'Customer Document'}*\n*File:* \`${filename || 'document.pdf'}\``
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `👤 *Uploaded By:* ${actor || 'Dealer Partner'} • 🕒 _${timestamp} IST_ • ☁️ *Cloudflare R2 Vault*`
              }
            ]
          }
        ]
      };
    } else if (action === 'file-cancel') {
      const safeCust = (customerName || 'Customer').trim();

      computedSlackPayload = {
        text: `⚠️ Application Cancelled: ${safeCust} (${fileId || 'N/A'})`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '⚠️ Application Cancelled',
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Customer:* *${safeCust}* (\`${fileId || 'N/A'}\`)\n*Reason:* _${reason || 'Cancelled'}_\n*Cancelled By:* *${cancelledBy || 'Admin Desk'}*`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `🕒 _${timestamp} IST_ • ⏳ _14-day recovery window active_`
              }
            ]
          }
        ]
      };
    } else if (action === 'file-restore') {
      const safeCust = (customerName || 'Customer').trim();

      computedSlackPayload = {
        text: `♻️ Application Restored: ${safeCust} (${fileId || 'N/A'})`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '♻️ Application Restored to Active Pipeline',
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Customer:* *${safeCust}* (\`${fileId || 'N/A'}\`)\n*Restored By:* *${restoredBy || 'Admin Desk'}*`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `🕒 _${timestamp} IST_ • 🚀 *Sunvine Solar Pipeline*`
              }
            ]
          }
        ]
      };
    } else {
      // action === 'new-application' (Default)
      // 1. Admin ALWAYS receives notification
      // 2. Salesman receives ONLY IF assigned (not STF-DIRECT)
      // 3. Direct to company (STF-DIRECT): ONLY Admin receives
      const isDirect = !assignedStaffId || assignedStaffId === 'STF-DIRECT';
      if (!isDirect && typeof assignedStaffId === 'string' && assignedStaffId.startsWith('STF-')) {
        targets.push(assignedStaffId);
      }

      const safeKw = parseFloat(solarKw) || 0;
      const safeLoad = parseFloat(sanctionedLoadKw) || safeKw;
      const safeCust = (customerName || 'Customer').trim();
      const safeDealer = (dealerName || dealerId || 'Authorized Dealer').trim();
      const safeStaff = (assignedStaffName || assignedStaffId || 'HQ Desk').trim();
      const attribTag = isDirect ? 'Direct Company Desk' : `Sales: ${safeStaff}`;
      const deepLinkUrl = fileId ? `/?openFile=${fileId}&tab=applications` : '/?tab=applications';

      notificationPayload = JSON.stringify({
        title: `📁 New Application: ${safeCust} (${safeKw} kW)`,
        body: `Dealer ${safeDealer} registered a new application. [${attribTag}]`,
        icon: '/pwa-192x192.png',
        badge: '/favicon.ico',
        fileId: fileId || '',
        url: deepLinkUrl,
        data: {
          fileId: fileId || '',
          dealerId: dealerId || '',
          dealerName: safeDealer,
          assignedStaffId: assignedStaffId || 'STF-DIRECT',
          url: deepLinkUrl,
          timestamp: Date.now()
        }
      });

      computedSlackPayload = {
        text: `⚡ New Solar EPC Application: ${safeCust} (${safeKw} kW) — ${safeDealer}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '⚡ New Solar EPC Application Registered',
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Customer:* *${safeCust}*\n*System Capacity:* \`${safeKw} kW\` • *Sanctioned Load:* \`${safeLoad} kW\``
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
                text: `🤝 *Sourced By:*\n*${safeDealer}*\n\`${dealerId || 'DEALER'}\``
              },
              {
                type: 'mrkdwn',
                text: `🎯 *Attribution:*\n*${isDirect ? '🏢 Direct HQ Desk' : `👨‍💼 Sales: ${safeStaff}`}*`
              },
              {
                type: 'mrkdwn',
                text: `📍 *Location & DISCOM:*\n*${city || 'Gujarat'}* • \`${discom || 'DISCOM'}\``
              },
              {
                type: 'mrkdwn',
                text: `💳 *Payment / Roof:*\n\`${financeType || 'CASH'}\` • _${roofType || 'Flat RCC'}_`
              }
            ]
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `📁 *File ID:* \`${fileId || 'N/A'}\` • 🕒 _${timestamp} IST_ • 🚀 *Sunvine Solar Dealer Portal*`
              }
            ]
          }
        ]
      };
    }

    // 1. Dispatch Slack notification asynchronously
    let slackSent = false;
    if (computedSlackPayload) {
      slackSent = await sendSlackNotification(computedSlackPayload);
    }

    // 2. Dispatch Web Push if VAPID keys and notification payload are active
    if (!vapidPublicKey || !vapidPrivateKey || !notificationPayload) {
      return res.status(200).json({
        success: true,
        slackSent,
        webPush: false,
        message: 'Slack notification dispatched; VAPID Web Push skipped or payload empty.'
      });
    }

    // Query active push subscriptions for the resolved targets (and any admin)
    const sql = `
      SELECT id, user_id, role, endpoint, p256dh, auth 
      FROM public.push_subscriptions 
      WHERE user_id = ANY($1) OR role = 'admin'
    `;
    const subResult = await query(sql, [targets]);
    const subscriptions = subResult.rows || [];

    if (subscriptions.length === 0) {
      return res.status(200).json({
        success: true,
        slackSent,
        targets,
        sentCount: 0,
        message: 'Slack dispatched. No active device push subscriptions registered for target recipients.'
      });
    }

    let sentCount = 0;
    let failedCount = 0;
    const staleEndpoints = [];

    // Dispatch Web Push to all matching subscriptions concurrently
    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(pushConfig, notificationPayload, {
            TTL: 60 * 60 * 24 // 24 hours delivery window
          });
          sentCount++;
        } catch (pushErr) {
          failedCount++;
          if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
            staleEndpoints.push(sub.endpoint);
          } else {
            console.warn(`[api/push-notify] Push delivery warning for ${sub.user_id}:`, pushErr.message);
          }
        }
      })
    );

    // Clean up stale subscriptions automatically
    if (staleEndpoints.length > 0) {
      try {
        await query('DELETE FROM public.push_subscriptions WHERE endpoint = ANY($1)', [staleEndpoints]);
      } catch (cleanupErr) {
        console.warn('[api/push-notify] Stale endpoint cleanup warning:', cleanupErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      slackSent,
      targets,
      totalMatched: subscriptions.length,
      sentCount,
      failedCount,
      staleCleaned: staleEndpoints.length
    });
  } catch (err) {
    console.error('[api/push-notify] Dispatch exception:', err);
    return res.status(500).json({ error: err.message || 'Notification dispatch failed' });
  }
}
