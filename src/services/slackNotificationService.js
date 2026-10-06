/**
 * Sunvine Enterprise Slack Notification Service
 * Dispatches executive-grade real-time event notifications (Applications, Stage changes, Document uploads)
 * to the configured Slack incoming webhook.
 */

const SLACK_WEBHOOK_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SLACK_FILES_UPDATE) ||
  (typeof process !== 'undefined' && (process.env?.SLACK_FILES_UPDATE || process.env?.VITE_SLACK_FILES_UPDATE)) ||
  '';

/**
 * Format IST timestamp
 */
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
 * Raw dispatch to Slack Incoming Webhook (Client-side / Browser safe)
 */
async function postToSlack(payload) {
  // If webhook is not configured, silently return
  if (!SLACK_WEBHOOK_URL) {
    return { success: false, reason: 'SLACK_WEBHOOK_NOT_CONFIGURED' };
  }

  try {
    // We use text/plain or no-cors fallback to ensure compatibility with browser fetch to Slack Webhooks
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      return { success: true };
    }
    return { success: false, status: res.status };
  } catch (err) {
    // Attempt fallback via backend serverless proxy /api/push-notify
    try {
      const proxyRes = await fetch('/api/push-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'slack-raw',
          slackPayload: payload
        })
      });
      if (proxyRes.ok) return { success: true };
    } catch (_) {}

    console.warn('[SlackNotificationService] Webhook dispatch warning:', err?.message || err);
    return { success: false, error: err?.message };
  }
}

export const slackNotificationService = {
  isConfigured() {
    return Boolean(SLACK_WEBHOOK_URL);
  },

  /**
   * 1. Dispatch alert on New Application / Customer File Registration
   */
  async notifyApplicationCreated({
    fileId,
    customerName,
    solarKw,
    sanctionedLoadKw,
    dealerId,
    dealerName,
    assignedStaffId,
    assignedStaffName,
    city = 'Gujarat',
    discom = 'DISCOM',
    financeType = 'CASH',
    roofType = 'Flat RCC'
  } = {}) {
    const timestamp = getTimestampIST();
    const safeCust = (customerName || 'Customer').trim();
    const safeKw = parseFloat(solarKw) || 0;
    const safeLoad = parseFloat(sanctionedLoadKw) || safeKw;
    const safeDealer = (dealerName || dealerId || 'Authorized Dealer').trim();
    const safeStaff = (assignedStaffName || assignedStaffId || 'HQ Desk').trim();
    const isDirect = !assignedStaffId || assignedStaffId === 'STF-DIRECT';
    const attribBadge = isDirect ? '🏢 Direct HQ Desk' : `👨‍💼 Sales: ${safeStaff}`;

    const payload = {
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
              text: `🎯 *Attribution:*\n*${attribBadge}*`
            },
            {
              type: 'mrkdwn',
              text: `📍 *Location & DISCOM:*\n*${city}* • \`${discom}\``
            },
            {
              type: 'mrkdwn',
              text: `💳 *Payment / Roof:*\n\`${financeType}\` • _${roofType}_`
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

    return await postToSlack(payload);
  },

  /**
   * 2. Dispatch alert on Application Stage / Status Progressed
   */
  async notifyStageChanged({
    fileId,
    customerName,
    oldStage,
    newStage,
    status,
    dealerName,
    actor = 'Staff Desk',
    notes = ''
  } = {}) {
    const timestamp = getTimestampIST();
    const safeCust = (customerName || 'Customer').trim();
    const safeStage = (newStage || status || 'Updated').replace(/_/g, ' ');

    const payload = {
      text: `🔄 Application Stage Progressed: ${safeCust} (${fileId}) → ${safeStage}`,
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
              text: `🏢 *Dealer Partner:*\n*${dealerName || 'Authorized Dealer'}*`
            },
            {
              type: 'mrkdwn',
              text: `👤 *Updated By:*\n*${actor}*`
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

    return await postToSlack(payload);
  },

  /**
   * 3. Dispatch alert on Document Upload
   */
  async notifyDocumentUploaded({
    fileId,
    customerName,
    docTitle,
    filename,
    uploadedBy = 'Dealer Partner'
  } = {}) {
    const timestamp = getTimestampIST();
    const safeCust = (customerName || 'Customer').trim();

    const payload = {
      text: `📄 Document Uploaded: ${docTitle || 'Document'} for ${safeCust} (${fileId})`,
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
              text: `👤 *Uploaded By:* ${uploadedBy} • 🕒 _${timestamp} IST_ • ☁️ *Cloudflare R2 Vault*`
            }
          ]
        }
      ]
    };

    return await postToSlack(payload);
  },

  /**
   * 4. Dispatch alert on Application Cancellation
   */
  async notifyApplicationCancelled({
    fileId,
    customerName,
    reason = 'Cancelled by user',
    cancelledBy = 'Admin Desk'
  } = {}) {
    const timestamp = getTimestampIST();
    const safeCust = (customerName || 'Customer').trim();

    const payload = {
      text: `⚠️ Application Cancelled: ${safeCust} (${fileId})`,
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
            text: `*Customer:* *${safeCust}* (\`${fileId || 'N/A'}\`)\n*Reason:* _${reason}_\n*Cancelled By:* *${cancelledBy}*`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🕒 _${timestamp} IST_ • ⏳ _14-day retention recovery window active_`
            }
          ]
        }
      ]
    };

    return await postToSlack(payload);
  },

  /**
   * 5. Dispatch alert on Application Restoration
   */
  async notifyApplicationRestored({
    fileId,
    customerName,
    restoredBy = 'Admin Desk'
  } = {}) {
    const timestamp = getTimestampIST();
    const safeCust = (customerName || 'Customer').trim();

    const payload = {
      text: `♻️ Application Restored: ${safeCust} (${fileId})`,
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
            text: `*Customer:* *${safeCust}* (\`${fileId || 'N/A'}\`)\n*Restored By:* *${restoredBy}*`
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

    return await postToSlack(payload);
  },

  /**
   * 6. Test Alert
   */
  async notifyTestAlert({ targetUser = 'Admin', role = 'admin' } = {}) {
    const timestamp = getTimestampIST();
    const payload = {
      text: `⚡ Sunvine Solar EPC Test Alert: Notifications active for ${targetUser}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚡ Sunvine Solar Notification Channel Verified',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Status:* 🟢 *Active & Operational*\n*Channel:* \`Slack Files Update\` + \`VAPID OS Push\`\n*Triggered By:* *${targetUser}* (\`${role}\`)`
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

    return await postToSlack(payload);
  }
};
