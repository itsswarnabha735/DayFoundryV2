import React, { useState, useEffect } from 'react';
import { Bell, Clock, Volume2, VolumeX, Smartphone, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Card } from '../ui/card';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import NotificationService, { 
  NotificationSettings as INotificationSettings,
  NotificationPermissionState,
  NotificationCategory,
  QuietHours 
} from '../../utils/notifications/NotificationService';

interface NotificationSettingsProps {
  onClose?: () => void;
}

export function NotificationSettings({ onClose }: NotificationSettingsProps) {
  const [settings, setSettings] = useState<INotificationSettings | null>(null);
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>({ 
    permission: 'default', 
    isSupported: false 
  });
  const [isLoading, setIsLoading] = useState(true);

  const notificationService = NotificationService.getInstance();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const currentSettings = notificationService.getSettings();
    const currentPermission = notificationService.getPermissionState();
    
    setSettings(currentSettings);
    setPermissionState(currentPermission);
    setIsLoading(false);
  };

  const handleRequestPermission = async () => {
    const newPermissionState = await notificationService.requestPermission();
    setPermissionState(newPermissionState);
  };

  const handleCategoryToggle = (categoryId: string, enabled: boolean) => {
    notificationService.updateCategory(categoryId, enabled);
    loadSettings();
  };

  const handleQuietHoursToggle = (enabled: boolean) => {
    notificationService.updateQuietHours({ enabled });
    loadSettings();
  };

  const handleQuietHoursTimeChange = (field: 'startTime' | 'endTime', value: string) => {
    notificationService.updateQuietHours({ [field]: value });
    loadSettings();
  };

  const handleSoundToggle = (soundEnabled: boolean) => {
    notificationService.updateSettings({ soundEnabled });
    loadSettings();
  };

  const handleVibrationToggle = (vibrationEnabled: boolean) => {
    notificationService.updateSettings({ vibrationEnabled });
    loadSettings();
  };

  const testNotification = () => {
    if (permissionState.permission === 'granted') {
      new Notification('Day Foundry Test', {
        body: 'Notifications are working correctly!',
        icon: '/favicon.ico',
      });
    }
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        options.push({ value: timeString, label: displayTime });
      }
    }
    return options;
  };

  if (isLoading || !settings) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--df-surface-alt)' }} />
          ))}
        </div>
      </div>
    );
  }

  const timeOptions = generateTimeOptions();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 border-b"
        style={{ 
          borderBottomColor: 'var(--df-border)',
          minHeight: '64px'
        }}
      >
        <div className="flex items-center gap-3">
          <Bell size={24} style={{ color: 'var(--df-primary)' }} />
          <h1 
            style={{ 
              fontSize: 'var(--df-type-title-size)',
              fontWeight: 'var(--df-type-title-weight)',
              color: 'var(--df-text)'
            }}
          >
            Notifications
          </h1>
        </div>
        {onClose && (
          <Button 
            variant="ghost" 
            onClick={onClose}
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            ✕
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Permission Status */}
        <Card 
          className="p-4"
          style={{ 
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="p-2 rounded-full"
                style={{ backgroundColor: 'var(--df-surface-alt)' }}
              >
                {permissionState.permission === 'granted' ? (
                  <CheckCircle size={20} style={{ color: 'var(--df-success)' }} />
                ) : (
                  <XCircle size={20} style={{ color: 'var(--df-danger)' }} />
                )}
              </div>
              <div>
                <p 
                  style={{ 
                    fontSize: 'var(--df-type-subtitle-size)',
                    fontWeight: 'var(--df-type-subtitle-weight)',
                    color: 'var(--df-text)'
                  }}
                >
                  Notification Permission
                </p>
                <p 
                  style={{ 
                    fontSize: 'var(--df-type-caption-size)',
                    color: 'var(--df-text-muted)'
                  }}
                >
                  {permissionState.permission === 'granted' 
                    ? 'Notifications are enabled'
                    : permissionState.permission === 'denied'
                    ? 'Notifications are blocked'
                    : 'Permission not requested'
                  }
                </p>
              </div>
            </div>
            {permissionState.permission !== 'granted' && permissionState.isSupported && (
              <Button 
                onClick={handleRequestPermission}
                style={{ 
                  backgroundColor: 'var(--df-primary)',
                  color: 'var(--df-primary-contrast)',
                  minHeight: '44px'
                }}
              >
                Enable
              </Button>
            )}
          </div>

          {permissionState.permission === 'granted' && (
            <div className="mt-4 pt-4" style={{ borderTopColor: 'var(--df-border)' }}>
              <Button 
                variant="outline" 
                onClick={testNotification}
                style={{ minHeight: '44px' }}
              >
                Test Notification
              </Button>
            </div>
          )}
        </Card>

        {!permissionState.isSupported && (
          <Alert>
            <Bell size={16} />
            <AlertDescription>
              Notifications are not supported in this browser or environment.
            </AlertDescription>
          </Alert>
        )}

        {/* Notification Categories */}
        <div className="space-y-4">
          <h2 
            style={{ 
              fontSize: 'var(--df-type-subtitle-size)',
              fontWeight: 'var(--df-type-subtitle-weight)',
              color: 'var(--df-text)'
            }}
          >
            Notification Types
          </h2>
          
          <div className="space-y-3">
            {settings.categories.map((category) => (
              <Card 
                key={category.id}
                className="p-4"
                style={{ 
                  backgroundColor: 'var(--df-surface)',
                  borderColor: 'var(--df-border)',
                  borderRadius: 'var(--df-radius-md)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p 
                      style={{ 
                        fontSize: 'var(--df-type-body-size)',
                        fontWeight: 'var(--df-type-body-weight)',
                        color: 'var(--df-text)'
                      }}
                    >
                      {category.name}
                    </p>
                    <p 
                      style={{ 
                        fontSize: 'var(--df-type-caption-size)',
                        color: 'var(--df-text-muted)',
                        marginTop: '4px'
                      }}
                    >
                      {category.description}
                    </p>
                  </div>
                  <Switch
                    checked={category.enabled}
                    onCheckedChange={(checked) => handleCategoryToggle(category.id, checked)}
                    disabled={permissionState.permission !== 'granted'}
                  />
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Separator style={{ backgroundColor: 'var(--df-border)' }} />

        {/* Quiet Hours */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock size={20} style={{ color: 'var(--df-primary)' }} />
              <h2 
                style={{ 
                  fontSize: 'var(--df-type-subtitle-size)',
                  fontWeight: 'var(--df-type-subtitle-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Quiet Hours
              </h2>
            </div>
            <Switch
              checked={settings.quietHours.enabled}
              onCheckedChange={handleQuietHoursToggle}
              disabled={permissionState.permission !== 'granted'}
            />
          </div>

          {settings.quietHours.enabled && (
            <Card 
              className="p-4"
              style={{ 
                backgroundColor: 'var(--df-surface)',
                borderColor: 'var(--df-border)',
                borderRadius: 'var(--df-radius-md)'
              }}
            >
              <div className="space-y-4">
                <p 
                  style={{ 
                    fontSize: 'var(--df-type-caption-size)',
                    color: 'var(--df-text-muted)'
                  }}
                >
                  No notifications will be sent during these hours
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label 
                      style={{ 
                        fontSize: 'var(--df-type-caption-size)',
                        fontWeight: 'var(--df-type-caption-weight)',
                        color: 'var(--df-text)',
                        display: 'block',
                        marginBottom: '8px'
                      }}
                    >
                      Start Time
                    </label>
                    <Select
                      value={settings.quietHours.startTime}
                      onValueChange={(value) => handleQuietHoursTimeChange('startTime', value)}
                    >
                      <SelectTrigger style={{ minHeight: '44px' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label 
                      style={{ 
                        fontSize: 'var(--df-type-caption-size)',
                        fontWeight: 'var(--df-type-caption-weight)',
                        color: 'var(--df-text)',
                        display: 'block',
                        marginBottom: '8px'
                      }}
                    >
                      End Time
                    </label>
                    <Select
                      value={settings.quietHours.endTime}
                      onValueChange={(value) => handleQuietHoursTimeChange('endTime', value)}
                    >
                      <SelectTrigger style={{ minHeight: '44px' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        <Separator style={{ backgroundColor: 'var(--df-border)' }} />

        {/* Sound & Vibration */}
        <div className="space-y-4">
          <h2 
            style={{ 
              fontSize: 'var(--df-type-subtitle-size)',
              fontWeight: 'var(--df-type-subtitle-weight)',
              color: 'var(--df-text)'
            }}
          >
            Feedback
          </h2>
          
          <Card 
            className="p-4"
            style={{ 
              backgroundColor: 'var(--df-surface)',
              borderColor: 'var(--df-border)',
              borderRadius: 'var(--df-radius-md)'
            }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {settings.soundEnabled ? (
                    <Volume2 size={20} style={{ color: 'var(--df-text-muted)' }} />
                  ) : (
                    <VolumeX size={20} style={{ color: 'var(--df-text-muted)' }} />
                  )}
                  <div>
                    <p 
                      style={{ 
                        fontSize: 'var(--df-type-body-size)',
                        color: 'var(--df-text)'
                      }}
                    >
                      Sound
                    </p>
                    <p 
                      style={{ 
                        fontSize: 'var(--df-type-caption-size)',
                        color: 'var(--df-text-muted)'
                      }}
                    >
                      Play notification sounds
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.soundEnabled}
                  onCheckedChange={handleSoundToggle}
                  disabled={permissionState.permission !== 'granted'}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone size={20} style={{ color: 'var(--df-text-muted)' }} />
                  <div>
                    <p 
                      style={{ 
                        fontSize: 'var(--df-type-body-size)',
                        color: 'var(--df-text)'
                      }}
                    >
                      Vibration
                    </p>
                    <p 
                      style={{ 
                        fontSize: 'var(--df-type-caption-size)',
                        color: 'var(--df-text-muted)'
                      }}
                    >
                      Vibrate on mobile devices
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.vibrationEnabled}
                  onCheckedChange={handleVibrationToggle}
                  disabled={permissionState.permission !== 'granted'}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}