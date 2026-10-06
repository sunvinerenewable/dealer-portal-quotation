/**
 * Sunvine Solar EPC - Push & Slack Notification Service
 * Manages W3C Web Push registration, OS-level permissions, and dual Slack + Web Push notification dispatch.
 */

import { slackNotificationService } from './slackNotificationService';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushNotificationService = {
  /**
   * Check if the current browser/device supports Web Push
   */
  isPushSupported() {
    return (
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  },

  /**
   * Detailed diagnostic reason why push is not supported
   */
  getIncompatibilityReason() {
    if (typeof window === 'undefined') return 'Environment is not a browser.';
    if (!window.isSecureContext) {
      return 'Web Push requires HTTPS (Secure Context). Browsers strictly block Service Workers & Push on plain HTTP (e.g. http://192.168.x.x). Please test on localhost or via HTTPS (e.g. Vercel deployment).';
    }
    if (!('serviceWorker' in navigator)) {
      return 'Service Worker is disabled or not supported in this browser.';
    }
    if (!('PushManager' in window)) {
      return 'PushManager is not available. On iPhone (iOS), Web Push requires adding the app to Home Screen via Safari/Chrome (PWA mode, iOS 16.4+).';
    }
    if (!('Notification' in window)) {
      return 'Notification API is not available in this browser.';
    }
    return 'Web Push is not supported in this browser.';
  },

  /**
   * Current notification permission state ('granted', 'denied', 'default', 'unsupported')
   */
  getPermissionState() {
    if (!this.isPushSupported()) return 'unsupported';
    return Notification.permission;
  },

  /**
   * Get server VAPID Public Key (from env or backend API)
   */
  async getVapidPublicKey() {
    const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (envKey) return envKey;

    try {
      const res = await fetch('/api/push-subscription');
      if (res.ok) {
        const data = await res.json();
        return data.vapidPublicKey || null;
      }
    } catch (e) {
      console.warn('[pushNotificationService] Could not fetch VAPID key:', e);
    }
    return null;
  },

  /**
   * Check if current browser session has an active Push Subscription
   */
  async isSubscribed() {
    if (!this.isPushSupported()) return false;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch {
      return false;
    }
  },

  /**
   * Request permission and subscribe device to Push Notifications
   */
  async subscribeUser({ userId = 'admin', role = 'admin' } = {}) {
    if (!this.isPushSupported()) {
      return { success: false, error: this.getIncompatibilityReason() };
    }

    try {
      // 1. Request OS / Browser notification permission
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        return { success: false, error: 'Notification permission was not granted by user.' };
      }

      // 2. Obtain VAPID Public Key
      const vapidPublicKey = await this.getVapidPublicKey();
      if (!vapidPublicKey) {
        return { success: false, error: 'VAPID public key not found.' };
      }

      // 3. Register push with Service Worker PushManager
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });
      }

      // 4. Send subscription payload to backend
      const subJson = subscription.toJSON();
      const res = await fetch('/api/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subscribe',
          subscription: subJson,
          userId,
          role,
          userAgent: navigator.userAgent
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to sync push subscription with server.');
      }

      localStorage.setItem('sunvine_push_registered', 'true');
      return { success: true, subscription };
    } catch (err) {
      console.error('[pushNotificationService] Subscription error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Automatically re-synchronize push subscription in background if permission is already granted
   */
  async autoSyncIfPermitted({ userId, role } = {}) {
    if (!this.isPushSupported()) return false;
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const res = await this.subscribeUser({ userId, role });
        return res?.success || false;
      }
    } catch (_) {}
    return false;
  },

  /**
   * Unsubscribe device from Push Notifications
   */
  async unsubscribeUser() {
    if (!this.isPushSupported()) return { success: true };
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Notify backend
        await fetch('/api/push-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unsubscribe', endpoint })
        }).catch(() => {});
      }
      localStorage.removeItem('sunvine_push_registered');
      return { success: true };
    } catch (err) {
      console.error('[pushNotificationService] Unsubscribe error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Dispatch real-time alert (Web Push + Slack) when a dealer or staff registers a new application
   */
  async sendApplicationCreatedPush({
    fileId,
    customerName,
    solarKw,
    sanctionedLoadKw,
    dealerId,
    dealerName,
    assignedStaffId,
    assignedStaffName,
    city,
    discom,
    financeType,
    roofType
  }) {
    // 1. Direct Slack notification dispatch
    slackNotificationService.notifyApplicationCreated({
      fileId,
      customerName,
      solarKw,
      sanctionedLoadKw,
      dealerId,
      dealerName,
      assignedStaffId,
      assignedStaffName,
      city,
      discom,
      financeType,
      roofType
    }).catch(() => {});

    // 2. Server-side dual WebPush + Slack webhook dispatch
    try {
      const payload = {
        action: 'new-application',
        fileId,
        customerName,
        solarKw,
        sanctionedLoadKw,
        dealerId,
        dealerName,
        assignedStaffId: assignedStaffId || 'STF-DIRECT',
        assignedStaffName: assignedStaffName || 'Direct to Company (HQ Desk)',
        city,
        discom,
        financeType,
        roofType
      };

      const res = await fetch('/api/push-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[pushNotificationService] Push dispatch non-blocking notice:', err.message);
    }
    return { success: true };
  },

  /**
   * Dispatch real-time alert on application stage progression
   */
  async sendFileStageUpdatedNotification({
    fileId,
    customerName,
    oldStage,
    newStage,
    status,
    dealerName,
    actor = 'Staff Desk',
    notes = ''
  }) {
    // 1. Client-side Slack dispatch
    slackNotificationService.notifyStageChanged({
      fileId,
      customerName,
      oldStage,
      newStage,
      status,
      dealerName,
      actor,
      notes
    }).catch(() => {});

    // 2. Server-side dispatch
    try {
      await fetch('/api/push-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stage-update',
          fileId,
          customerName,
          stageName: newStage,
          status,
          dealerName,
          actor,
          notes
        })
      }).catch(() => {});
    } catch (_) {}
  },

  /**
   * Dispatch real-time alert on customer document upload
   */
  async sendDocumentUploadedNotification({
    fileId,
    customerName,
    docTitle,
    filename,
    uploadedBy = 'Dealer Partner'
  }) {
    // 1. Client-side Slack dispatch
    slackNotificationService.notifyDocumentUploaded({
      fileId,
      customerName,
      docTitle,
      filename,
      uploadedBy
    }).catch(() => {});

    // 2. Server-side dispatch
    try {
      await fetch('/api/push-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'document-upload',
          fileId,
          customerName,
          docTitle,
          filename,
          actor: uploadedBy
        })
      }).catch(() => {});
    } catch (_) {}
  },

  /**
   * Dispatch real-time alert on customer file cancellation
   */
  async sendFileCancelledNotification({
    fileId,
    customerName,
    reason,
    cancelledBy
  }) {
    slackNotificationService.notifyApplicationCancelled({
      fileId,
      customerName,
      reason,
      cancelledBy
    }).catch(() => {});

    try {
      await fetch('/api/push-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'file-cancel',
          fileId,
          customerName,
          reason,
          cancelledBy
        })
      }).catch(() => {});
    } catch (_) {}
  },

  /**
   * Dispatch real-time alert on customer file restoration
   */
  async sendFileRestoredNotification({
    fileId,
    customerName,
    restoredBy
  }) {
    slackNotificationService.notifyApplicationRestored({
      fileId,
      customerName,
      restoredBy
    }).catch(() => {});

    try {
      await fetch('/api/push-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'file-restore',
          fileId,
          customerName,
          restoredBy
        })
      }).catch(() => {});
    } catch (_) {}
  },

  /**
   * Send a test push + Slack notification to verify delivery channels
   */
  async sendTestPush({ targetUserId, role = 'admin' } = {}) {
    // Also trigger test slack alert
    slackNotificationService.notifyTestAlert({
      targetUser: targetUserId || (role === 'admin' ? 'Admin Desk' : 'Staff User'),
      role
    }).catch(() => {});

    try {
      const res = await fetch('/api/push-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          targetUserId,
          role
        })
      });

      if (res.ok) {
        return await res.json();
      }
      const err = await res.json();
      return { success: false, error: err.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
