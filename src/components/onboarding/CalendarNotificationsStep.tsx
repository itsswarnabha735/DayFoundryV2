import React, { useState } from 'react';
import { Calendar, Bell, Upload, Link, ChevronLeft, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { OnboardingData } from './OnboardingFlow';

interface CalendarNotificationsStepProps {
  onNext: (data: Partial<OnboardingData>) => void;
  onBack?: () => void;
  data: Partial<OnboardingData>;
  isDark: boolean;
}

export function CalendarNotificationsStep({ onNext, onBack, data }: CalendarNotificationsStepProps) {
  const [calendarUrl, setCalendarUrl] = useState(data.calendarUrl || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(data.notificationsEnabled || false);
  const [notificationStep, setNotificationStep] = useState<'prompt' | 'pending' | 'granted' | 'denied'>('prompt');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.endsWith('.ics')) {
      setSelectedFile(file);
    }
  };

  const handleNotificationRequest = async () => {
    if ('Notification' in window) {
      setNotificationStep('pending');
      
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotificationsEnabled(true);
          setNotificationStep('granted');
        } else {
          setNotificationStep('denied');
        }
      } catch (error) {
        setNotificationStep('denied');
      }
    }
  };

  const handleFinish = () => {
    onNext({
      calendarUrl: calendarUrl || undefined,
      notificationsEnabled
    });
  };

  const canFinish = notificationStep !== 'pending';

  return (
    <div className="flex flex-col h-full px-6 py-8">
      {/* Header */}
      <div className="flex items-center mb-8">
        {onBack && (
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="mr-4"
            style={{ 
              color: 'var(--df-text-muted)',
              minHeight: '44px',
              minWidth: '44px'
            }}
          >
            <ChevronLeft size={20} />
          </Button>
        )}
        
        <div className="flex-1 text-center">
          <div 
            className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: 'var(--df-primary)',
              color: 'var(--df-primary-contrast)'
            }}
          >
            <Calendar size={24} />
          </div>
          
          <h1 
            className="mb-2"
            style={{
              fontSize: 'var(--df-type-title-size)',
              fontWeight: 'var(--df-type-title-weight)',
              color: 'var(--df-text)'
            }}
          >
            Calendar & notifications
          </h1>
          
          <p 
            style={{
              fontSize: 'var(--df-type-body-size)',
              color: 'var(--df-text-muted)'
            }}
          >
            Import your calendar and enable notifications
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-md mx-auto w-full space-y-6">
        {/* Calendar Import */}
        <Card 
          style={{
            padding: 'var(--df-space-24)',
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)',
            boxShadow: 'var(--df-shadow-sm)'
          }}
        >
          {/* Header Section */}
          <div style={{ marginBottom: 'var(--df-space-24)' }}>
            <h3 
              style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)',
                marginBottom: 'var(--df-space-8)',
                lineHeight: 1.4
              }}
            >
              Import calendar (optional)
            </h3>
            <p 
              style={{
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                color: 'var(--df-text-muted)',
                lineHeight: 1.5,
                margin: 0
              }}
            >
              Import your existing calendar to help Day Foundry schedule around your meetings
            </p>
          </div>

          {/* Tabs Section */}
          <Tabs defaultValue="url" className="w-full">
            <TabsList 
              className="grid w-full grid-cols-2"
              style={{
                backgroundColor: 'var(--df-surface-alt)',
                borderRadius: 'var(--df-radius-sm)',
                padding: 'var(--df-space-4)',
                marginBottom: 'var(--df-space-24)',
                border: `1px solid var(--df-border)`,
                height: 'auto',
                gap: 'var(--df-space-4)'
              }}
            >
              <TabsTrigger 
                value="url"
                className="flex-1 text-center"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  borderRadius: 'var(--df-radius-sm)',
                  minHeight: '44px',
                  padding: 'var(--df-space-12) var(--df-space-16)',
                  backgroundColor: 'transparent',
                  color: 'var(--df-text-muted)',
                  border: 'none',
                  transition: 'all var(--df-anim-fast) ease-in-out',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1.4
                }}
                data-state="inactive"
              >
                ICS URL
              </TabsTrigger>
              <TabsTrigger 
                value="file"
                className="flex-1 text-center"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  borderRadius: 'var(--df-radius-sm)',
                  minHeight: '44px',
                  padding: 'var(--df-space-12) var(--df-space-16)',
                  backgroundColor: 'transparent',
                  color: 'var(--df-text-muted)',
                  border: 'none',
                  transition: 'all var(--df-anim-fast) ease-in-out',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1.4
                }}
                data-state="inactive"
              >
                Upload file
              </TabsTrigger>
            </TabsList>
            
            {/* URL Tab Content */}
            <TabsContent value="url" style={{ marginTop: 0 }}>
              <div style={{ marginBottom: 'var(--df-space-16)' }}>
                <label 
                  style={{
                    display: 'block',
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)',
                    color: 'var(--df-text)',
                    marginBottom: 'var(--df-space-8)',
                    lineHeight: 1.4
                  }}
                >
                  Calendar URL
                </label>
                <Input
                  type="url"
                  placeholder="https://calendar.example.com/feed.ics"
                  value={calendarUrl}
                  onChange={(e) => setCalendarUrl(e.target.value)}
                  style={{
                    minHeight: '48px',
                    borderColor: 'var(--df-border)',
                    backgroundColor: 'var(--df-surface)',
                    color: 'var(--df-text)',
                    borderRadius: 'var(--df-radius-sm)',
                    fontSize: 'var(--df-type-body-size)',
                    padding: 'var(--df-space-12) var(--df-space-16)'
                  }}
                />
              </div>
              
              {/* Help Section */}
              <div 
                style={{
                  padding: 'var(--df-space-16)',
                  backgroundColor: 'var(--df-surface-alt)',
                  borderRadius: 'var(--df-radius-sm)',
                  border: `1px solid var(--df-border)`
                }}
              >
                <div className="flex items-start" style={{ gap: 'var(--df-space-12)' }}>
                  <Link 
                    size={20} 
                    style={{ 
                      color: 'var(--df-primary)',
                      flexShrink: 0,
                      marginTop: '2px'
                    }} 
                  />
                  <div>
                    <p 
                      style={{
                        fontSize: 'var(--df-type-body-size)',
                        fontWeight: 'var(--df-type-body-weight)',
                        color: 'var(--df-text)',
                        marginBottom: 'var(--df-space-12)',
                        lineHeight: 1.4
                      }}
                    >
                      Find your calendar's ICS URL in:
                    </p>
                    <ul style={{ 
                      listStyle: 'none', 
                      padding: 0, 
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--df-space-8)'
                    }}>
                      <li style={{
                        fontSize: 'var(--df-type-caption-size)',
                        fontWeight: 'var(--df-type-caption-weight)',
                        color: 'var(--df-text-muted)',
                        lineHeight: 1.3,
                        paddingLeft: 'var(--df-space-12)',
                        position: 'relative'
                      }}>
                        <span style={{ position: 'absolute', left: 0, color: 'var(--df-primary)' }}>•</span>
                        Google Calendar → Settings → Integrate calendar
                      </li>
                      <li style={{
                        fontSize: 'var(--df-type-caption-size)',
                        fontWeight: 'var(--df-type-caption-weight)',
                        color: 'var(--df-text-muted)',
                        lineHeight: 1.3,
                        paddingLeft: 'var(--df-space-12)',
                        position: 'relative'
                      }}>
                        <span style={{ position: 'absolute', left: 0, color: 'var(--df-primary)' }}>•</span>
                        Outlook → Calendar settings → Shared calendars
                      </li>
                      <li style={{
                        fontSize: 'var(--df-type-caption-size)',
                        fontWeight: 'var(--df-type-caption-weight)',
                        color: 'var(--df-text-muted)',
                        lineHeight: 1.3,
                        paddingLeft: 'var(--df-space-12)',
                        position: 'relative'
                      }}>
                        <span style={{ position: 'absolute', left: 0, color: 'var(--df-primary)' }}>•</span>
                        Apple Calendar → Calendar → Export
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            {/* File Tab Content */}
            <TabsContent value="file" style={{ marginTop: 0 }}>
              <div>
                <label 
                  style={{
                    display: 'block',
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)',
                    color: 'var(--df-text)',
                    marginBottom: 'var(--df-space-8)',
                    lineHeight: 1.4
                  }}
                >
                  Upload ICS file
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".ics"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ minHeight: '48px' }}
                  />
                  <div 
                    className="flex items-center justify-center border-2 border-dashed cursor-pointer transition-colors duration-200 hover:border-opacity-70"
                    style={{
                      borderColor: selectedFile ? 'var(--df-success)' : 'var(--df-border)',
                      backgroundColor: selectedFile ? 'rgba(22, 163, 74, 0.05)' : 'var(--df-surface-alt)',
                      borderRadius: 'var(--df-radius-sm)',
                      minHeight: '96px',
                      padding: 'var(--df-space-16)'
                    }}
                  >
                    <div className="text-center">
                      {selectedFile ? (
                        <div>
                          <CheckCircle 
                            size={32} 
                            style={{ 
                              color: 'var(--df-success)',
                              margin: '0 auto var(--df-space-8)'
                            }}
                          />
                          <p style={{ 
                            fontSize: 'var(--df-type-body-size)',
                            fontWeight: 'var(--df-type-body-weight)',
                            color: 'var(--df-text)',
                            lineHeight: 1.4,
                            margin: 0
                          }}>
                            {selectedFile.name}
                          </p>
                          <p style={{ 
                            fontSize: 'var(--df-type-caption-size)',
                            fontWeight: 'var(--df-type-caption-weight)',
                            color: 'var(--df-text-muted)',
                            lineHeight: 1.3,
                            margin: 'var(--df-space-4) 0 0'
                          }}>
                            File ready to import
                          </p>
                        </div>
                      ) : (
                        <div>
                          <Upload 
                            size={32} 
                            style={{ 
                              color: 'var(--df-text-muted)',
                              margin: '0 auto var(--df-space-8)'
                            }}
                          />
                          <p style={{ 
                            fontSize: 'var(--df-type-body-size)',
                            fontWeight: 'var(--df-type-body-weight)',
                            color: 'var(--df-text)',
                            lineHeight: 1.4,
                            margin: 0
                          }}>
                            Click to upload .ics file
                          </p>
                          <p style={{ 
                            fontSize: 'var(--df-type-caption-size)',
                            fontWeight: 'var(--df-type-caption-weight)',
                            color: 'var(--df-text-muted)',
                            lineHeight: 1.3,
                            margin: 'var(--df-space-4) 0 0'
                          }}>
                            Drag and drop or click to browse
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Notifications */}
        <Card 
          className="p-6"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)',
            boxShadow: 'var(--df-shadow-sm)'
          }}
        >
          <div className="mb-4">
            <h3 
              className="mb-2 flex items-center space-x-2"
              style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)'
              }}
            >
              <Bell size={20} />
              <span>Enable notifications</span>
            </h3>
            <p 
              style={{
                fontSize: 'var(--df-type-caption-size)',
                color: 'var(--df-text-muted)'
              }}
            >
              Get gentle reminders for breaks, focus sessions, and important tasks
            </p>
          </div>

          {notificationStep === 'prompt' && (
            <div className="space-y-4">
              <div 
                className="p-4 rounded"
                style={{
                  backgroundColor: 'var(--df-surface-alt)',
                  borderRadius: 'var(--df-radius-sm)'
                }}
              >
                <h4 
                  className="mb-2"
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)',
                    color: 'var(--df-text)'
                  }}
                >
                  Why notifications help
                </h4>
                <ul 
                  className="space-y-2"
                  style={{
                    fontSize: 'var(--df-type-caption-size)',
                    color: 'var(--df-text-muted)'
                  }}
                >
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500">•</span>
                    <span>Gentle reminders to take breaks when you need them</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500">•</span>
                    <span>Focus session start/end notifications</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500">•</span>
                    <span>Daily outcome completion reminders</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500">•</span>
                    <span>Smart suggestions when your schedule changes</span>
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleNotificationRequest}
                className="w-full"
                style={{
                  backgroundColor: 'var(--df-primary)',
                  color: 'var(--df-primary-contrast)',
                  borderRadius: 'var(--df-radius-sm)',
                  minHeight: '48px',
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)'
                }}
              >
                <Bell size={20} className="mr-2" />
                Enable notifications
              </Button>

              <p 
                className="text-center"
                style={{
                  fontSize: 'var(--df-type-caption-size)',
                  color: 'var(--df-text-muted)'
                }}
              >
                You can always change this later in Settings
              </p>
            </div>
          )}

          {notificationStep === 'pending' && (
            <div className="text-center py-4">
              <div 
                className="w-8 h-8 mx-auto mb-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
              />
              <p 
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  color: 'var(--df-text)'
                }}
              >
                Waiting for permission...
              </p>
              <p 
                style={{
                  fontSize: 'var(--df-type-caption-size)',
                  color: 'var(--df-text-muted)'
                }}
              >
                Please respond to the browser notification prompt
              </p>
            </div>
          )}

          {notificationStep === 'granted' && (
            <div className="text-center py-4">
              <CheckCircle 
                size={48} 
                className="mx-auto mb-3"
                style={{ color: 'var(--df-success)' }}
              />
              <p 
                className="mb-2"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  color: 'var(--df-text)'
                }}
              >
                Notifications enabled!
              </p>
              <p 
                style={{
                  fontSize: 'var(--df-type-caption-size)',
                  color: 'var(--df-text-muted)'
                }}
              >
                You'll receive gentle reminders to help you stay focused and balanced
              </p>
            </div>
          )}

          {notificationStep === 'denied' && (
            <div className="text-center py-4">
              <div 
                className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--df-warning)',
                  color: 'white'
                }}
              >
                <Bell size={24} />
              </div>
              <p 
                className="mb-2"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  color: 'var(--df-text)'
                }}
              >
                Notifications blocked
              </p>
              <p 
                style={{
                  fontSize: 'var(--df-type-caption-size)',
                  color: 'var(--df-text-muted)'
                }}
              >
                You can enable them later in your browser settings or in Day Foundry Settings
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Finish Button */}
      <div className="pb-6 mt-6">
        <Button
          onClick={handleFinish}
          disabled={!canFinish}
          className="w-full"
          style={{
            backgroundColor: canFinish ? 'var(--df-primary)' : 'var(--df-border)',
            color: canFinish ? 'var(--df-primary-contrast)' : 'var(--df-text-muted)',
            borderRadius: 'var(--df-radius-sm)',
            minHeight: '48px',
            fontSize: 'var(--df-type-body-size)',
            fontWeight: 'var(--df-type-body-weight)'
          }}
        >
          {notificationStep === 'pending' ? 'Waiting...' : 'Complete setup'}
        </Button>
        
        {canFinish && (
          <p 
            className="text-center mt-3"
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)'
            }}
          >
            🎉 You're all set! Welcome to Day Foundry
          </p>
        )}
      </div>
    </div>
  );
}