export interface NotificationPermissionState {
  permission: NotificationPermission;
  isSupported: boolean;
}

export interface NotificationCategory {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface QuietHours {
  enabled: boolean;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
}

export interface NotificationSettings {
  categories: NotificationCategory[];
  quietHours: QuietHours;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface ScheduledNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  scheduledAt: Date;
  data?: Record<string, any>;
}

class NotificationService {
  private static instance: NotificationService;
  private registrations: Map<string, number> = new Map();
  private settings: NotificationSettings;

  private constructor() {
    this.settings = this.getDefaultSettings();
    this.loadSettings();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private getDefaultSettings(): NotificationSettings {
    return {
      categories: [
        {
          id: 'focus-reminders',
          name: 'Focus Reminders',
          description: 'Notifications to start scheduled focus sessions',
          enabled: true,
        },
        {
          id: 'micro-breaks',
          name: 'Micro-breaks',
          description: 'Short break reminders during focus sessions',
          enabled: true,
        },
        {
          id: 'interruption-recovery',
          name: 'Recovery Nudges',
          description: 'Reminders to resume work after interruptions',
          enabled: true,
        },
        {
          id: 'daily-planning',
          name: 'Daily Planning',
          description: 'Reminders to plan your day and review outcomes',
          enabled: false,
        },
      ],
      quietHours: {
        enabled: true,
        startTime: '22:00',
        endTime: '08:00',
      },
      soundEnabled: true,
      vibrationEnabled: true,
    };
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem('df-notification-settings');
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        // Merge with defaults to handle new categories
        this.settings = {
          ...this.getDefaultSettings(),
          ...parsedSettings,
          categories: this.mergeCategories(
            this.getDefaultSettings().categories,
            parsedSettings.categories || []
          ),
        };
      }
    } catch (error) {
      console.warn('Failed to load notification settings:', error);
    }
  }

  private mergeCategories(
    defaultCategories: NotificationCategory[],
    storedCategories: NotificationCategory[]
  ): NotificationCategory[] {
    const storedMap = new Map(storedCategories.map(cat => [cat.id, cat]));
    
    return defaultCategories.map(defaultCat => ({
      ...defaultCat,
      enabled: storedMap.get(defaultCat.id)?.enabled ?? defaultCat.enabled,
    }));
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('df-notification-settings', JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Failed to save notification settings:', error);
    }
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    if (!('Notification' in window)) {
      return { permission: 'denied', isSupported: false };
    }

    let permission = Notification.permission;

    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    return { permission, isSupported: true };
  }

  getPermissionState(): NotificationPermissionState {
    if (!('Notification' in window)) {
      return { permission: 'denied', isSupported: false };
    }

    return { permission: Notification.permission, isSupported: true };
  }

  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  updateSettings(updates: Partial<NotificationSettings>): void {
    this.settings = { ...this.settings, ...updates };
    this.saveSettings();
  }

  updateCategory(categoryId: string, enabled: boolean): void {
    this.settings.categories = this.settings.categories.map(cat =>
      cat.id === categoryId ? { ...cat, enabled } : cat
    );
    this.saveSettings();
  }

  updateQuietHours(quietHours: Partial<QuietHours>): void {
    this.settings.quietHours = { ...this.settings.quietHours, ...quietHours };
    this.saveSettings();
  }

  private isInQuietHours(): boolean {
    if (!this.settings.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = this.settings.quietHours.startTime.split(':').map(Number);
    const [endHour, endMin] = this.settings.quietHours.endTime.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    }
    
    return currentTime >= startTime && currentTime <= endTime;
  }

  private isCategoryEnabled(categoryId: string): boolean {
    const category = this.settings.categories.find(cat => cat.id === categoryId);
    return category?.enabled ?? false;
  }

  private canShowNotification(categoryId: string): boolean {
    const permissionState = this.getPermissionState();
    
    return (
      permissionState.isSupported &&
      permissionState.permission === 'granted' &&
      this.isCategoryEnabled(categoryId) &&
      !this.isInQuietHours()
    );
  }

  async scheduleNotification(notification: ScheduledNotification): Promise<void> {
    if (!this.canShowNotification(notification.category)) {
      return;
    }

    const delay = notification.scheduledAt.getTime() - Date.now();
    
    if (delay <= 0) {
      // Show immediately if scheduled time has passed
      this.showNotification(notification);
      return;
    }

    // Clear existing notification with same ID
    this.cancelNotification(notification.id);

    // Schedule the notification
    const timeoutId = window.setTimeout(() => {
      this.showNotification(notification);
      this.registrations.delete(notification.id);
    }, delay);

    this.registrations.set(notification.id, timeoutId);
  }

  private showNotification(notification: ScheduledNotification): void {
    if (!this.canShowNotification(notification.category)) {
      return;
    }

    const options: NotificationOptions = {
      body: notification.body,
      icon: '/favicon.ico', // You might want to use a specific icon
      badge: '/favicon.ico',
      data: notification.data,
      requireInteraction: notification.category === 'focus-reminders',
      silent: !this.settings.soundEnabled,
    };

    // Add vibration for mobile devices
    if (this.settings.vibrationEnabled && 'vibrate' in navigator) {
      options.vibrate = [200, 100, 200];
    }

    new Notification(notification.title, options);
  }

  cancelNotification(id: string): void {
    const timeoutId = this.registrations.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.registrations.delete(id);
    }
  }

  clearAllNotifications(): void {
    this.registrations.forEach(timeoutId => clearTimeout(timeoutId));
    this.registrations.clear();
  }

  // Specific notification helpers
  scheduleFocusReminder(
    focusSessionId: string,
    title: string,
    startTime: Date,
    reminderMinutes: number = 5
  ): void {
    const reminderTime = new Date(startTime.getTime() - reminderMinutes * 60 * 1000);
    
    this.scheduleNotification({
      id: `focus-reminder-${focusSessionId}`,
      category: 'focus-reminders',
      title: '🎯 Focus Session Starting',
      body: `"${title}" starts in ${reminderMinutes} minutes`,
      scheduledAt: reminderTime,
      data: { focusSessionId, type: 'focus-reminder' },
    });
  }

  scheduleMicroBreak(
    focusSessionId: string,
    breakNumber: number,
    breakTime: Date
  ): void {
    this.scheduleNotification({
      id: `micro-break-${focusSessionId}-${breakNumber}`,
      category: 'micro-breaks',
      title: '☕ Time for a Micro-break',
      body: 'Take 2-3 minutes to rest your mind and body',
      scheduledAt: breakTime,
      data: { focusSessionId, breakNumber, type: 'micro-break' },
    });
  }

  scheduleInterruptionRecovery(
    focusSessionId: string,
    taskTitle: string,
    recoveryTime: Date
  ): void {
    this.scheduleNotification({
      id: `recovery-${focusSessionId}`,
      category: 'interruption-recovery',
      title: '🔄 Ready to Resume?',
      body: `Continue working on "${taskTitle}"`,
      scheduledAt: recoveryTime,
      data: { focusSessionId, type: 'interruption-recovery' },
    });
  }

  scheduleDailyPlanningReminder(time: Date): void {
    this.scheduleNotification({
      id: `daily-planning-${time.toDateString()}`,
      category: 'daily-planning',
      title: '📋 Plan Your Day',
      body: 'Take a moment to set your outcomes for today',
      scheduledAt: time,
      data: { type: 'daily-planning' },
    });
  }

  // Cancel specific notification types
  cancelFocusReminders(focusSessionId: string): void {
    this.cancelNotification(`focus-reminder-${focusSessionId}`);
  }

  cancelMicroBreaks(focusSessionId: string): void {
    // Cancel all micro-breaks for this session
    Array.from(this.registrations.keys())
      .filter(id => id.startsWith(`micro-break-${focusSessionId}`))
      .forEach(id => this.cancelNotification(id));
  }

  cancelInterruptionRecovery(focusSessionId: string): void {
    this.cancelNotification(`recovery-${focusSessionId}`);
  }
}

export default NotificationService;