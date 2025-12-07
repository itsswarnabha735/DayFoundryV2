import { useState, useEffect, useCallback } from 'react';
import NotificationService, {
  NotificationSettings,
  NotificationPermissionState,
} from '../utils/notifications/NotificationService';

export function useNotifications() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>({
    permission: 'default',
    isSupported: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  const notificationService = NotificationService.getInstance();

  const loadSettings = useCallback(() => {
    const currentSettings = notificationService.getSettings();
    const currentPermission = notificationService.getPermissionState();
    
    setSettings(currentSettings);
    setPermissionState(currentPermission);
    setIsLoading(false);
  }, [notificationService]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const requestPermission = useCallback(async () => {
    setIsLoading(true);
    try {
      const newPermissionState = await notificationService.requestPermission();
      setPermissionState(newPermissionState);
      return newPermissionState;
    } finally {
      setIsLoading(false);
    }
  }, [notificationService]);

  const updateCategory = useCallback((categoryId: string, enabled: boolean) => {
    notificationService.updateCategory(categoryId, enabled);
    loadSettings();
  }, [notificationService, loadSettings]);

  const updateQuietHours = useCallback((quietHours: Parameters<typeof notificationService.updateQuietHours>[0]) => {
    notificationService.updateQuietHours(quietHours);
    loadSettings();
  }, [notificationService, loadSettings]);

  const updateSettings = useCallback((updates: Partial<NotificationSettings>) => {
    notificationService.updateSettings(updates);
    loadSettings();
  }, [notificationService, loadSettings]);

  // Notification scheduling helpers
  const scheduleFocusReminder = useCallback((
    focusSessionId: string,
    title: string,
    startTime: Date,
    reminderMinutes?: number
  ) => {
    notificationService.scheduleFocusReminder(focusSessionId, title, startTime, reminderMinutes);
  }, [notificationService]);

  const scheduleMicroBreak = useCallback((
    focusSessionId: string,
    breakNumber: number,
    breakTime: Date
  ) => {
    notificationService.scheduleMicroBreak(focusSessionId, breakNumber, breakTime);
  }, [notificationService]);

  const scheduleInterruptionRecovery = useCallback((
    focusSessionId: string,
    taskTitle: string,
    recoveryTime: Date
  ) => {
    notificationService.scheduleInterruptionRecovery(focusSessionId, taskTitle, recoveryTime);
  }, [notificationService]);

  const scheduleDailyPlanningReminder = useCallback((time: Date) => {
    notificationService.scheduleDailyPlanningReminder(time);
  }, [notificationService]);

  // Cancellation helpers
  const cancelFocusReminders = useCallback((focusSessionId: string) => {
    notificationService.cancelFocusReminders(focusSessionId);
  }, [notificationService]);

  const cancelMicroBreaks = useCallback((focusSessionId: string) => {
    notificationService.cancelMicroBreaks(focusSessionId);
  }, [notificationService]);

  const cancelInterruptionRecovery = useCallback((focusSessionId: string) => {
    notificationService.cancelInterruptionRecovery(focusSessionId);
  }, [notificationService]);

  const cancelAllNotifications = useCallback(() => {
    notificationService.clearAllNotifications();
  }, [notificationService]);

  return {
    // State
    settings,
    permissionState,
    isLoading,
    
    // Actions
    requestPermission,
    updateCategory,
    updateQuietHours,
    updateSettings,
    
    // Scheduling
    scheduleFocusReminder,
    scheduleMicroBreak,
    scheduleInterruptionRecovery,
    scheduleDailyPlanningReminder,
    
    // Cancellation
    cancelFocusReminders,
    cancelMicroBreaks,
    cancelInterruptionRecovery,
    cancelAllNotifications,
    
    // Utils
    refresh: loadSettings,
  };
}