import React, { useState } from 'react';
import { ArrowLeft, Bell, Palette, Database, Shield, HelpCircle, Moon, Sun, Calendar, Code, Zap, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { NotificationSettings } from '../settings/NotificationSettings';
import { CalendarImport } from '../settings/CalendarImport';
import { QuickActionsSetup } from '../settings/QuickActionsSetup';
import { WorkPreferencesSettings } from '../settings/WorkPreferencesSettings';
import { TestPanel } from '../testing/TestPanel';
import { ServerSecurityTest } from '../testing/ServerSecurityTest';
import { QuickTestRunner } from '../testing/QuickTestRunner';
import { TestDataGenerator } from '../testing/TestDataGenerator';
import { projectId } from '../../utils/supabase/info';

type SettingsSection = 'main' | 'notifications' | 'preferences' | 'appearance' | 'data' | 'privacy' | 'help' | 'calendar' | 'shortcuts' | 'developer';

interface SettingsScreenProps {
  onClose?: () => void;
  isDark?: boolean;
  toggleTheme?: () => void;
}

export function SettingsScreen({ onClose, isDark, toggleTheme }: SettingsScreenProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('main');

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'notifications':
        return <NotificationSettings onClose={() => setActiveSection('main')} />;
      case 'preferences':
        return <WorkPreferencesSettings onClose={() => setActiveSection('main')} />;
      case 'appearance':
        return <AppearanceSettings onClose={() => setActiveSection('main')} isDark={isDark} toggleTheme={toggleTheme} />;
      case 'data':
        return <DataSettings onClose={() => setActiveSection('main')} />;
      case 'privacy':
        return <PrivacySettings onClose={() => setActiveSection('main')} />;
      case 'help':
        return <HelpSettings onClose={() => setActiveSection('main')} />;
      case 'calendar':
        return <CalendarImport onClose={() => setActiveSection('main')} />;
      case 'shortcuts':
        return (
          <div>
            <div className="flex items-center mb-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection('main')}
                style={{
                  color: 'var(--df-text-muted)',
                  minHeight: '44px',
                  minWidth: '44px'
                }}
              >
                <ArrowLeft size={20} />
              </Button>
              <h2
                className="ml-2"
                style={{
                  fontSize: 'var(--df-type-title-size)',
                  fontWeight: 'var(--df-type-title-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Quick Actions & Shortcuts
              </h2>
            </div>
            <QuickActionsSetup />
          </div>
        );
      case 'developer':
        return <DeveloperSettings onClose={() => setActiveSection('main')} />;
      default:
        return <MainSettings onSectionSelect={setActiveSection} onClose={onClose} />;
    }
  };

  return (
    <div
      className="h-full flex flex-col"
      style={{ backgroundColor: 'var(--df-surface)' }}
    >
      {renderSectionContent()}
    </div>
  );
}

interface MainSettingsProps {
  onSectionSelect: (section: SettingsSection) => void;
  onClose?: () => void;
}

function MainSettings({ onSectionSelect, onClose }: MainSettingsProps) {
  const settingsItems = [
    {
      id: 'notifications' as SettingsSection,
      icon: Bell,
      title: 'Notifications',
      description: 'Manage alerts and quiet hours',
    },
    {
      id: 'preferences' as SettingsSection,
      icon: Clock,
      title: 'Work & Scheduling',
      description: 'Work hours, breaks, and focus time',
    },
    {
      id: 'appearance' as SettingsSection,
      icon: Palette,
      title: 'Appearance',
      description: 'Theme and display preferences',
    },
    {
      id: 'calendar' as SettingsSection,
      icon: Calendar,
      title: 'Calendar Import',
      description: 'Import external calendars',
    },
    {
      id: 'shortcuts' as SettingsSection,
      icon: Zap,
      title: 'Quick Actions',
      description: 'Home screen shortcuts and widgets',
    },
    {
      id: 'data' as SettingsSection,
      icon: Database,
      title: 'Data & Sync',
      description: 'Backup and synchronization',
    },
    {
      id: 'privacy' as SettingsSection,
      icon: Shield,
      title: 'Privacy & Security',
      description: 'Privacy mode and data protection',
    },
    {
      id: 'help' as SettingsSection,
      icon: HelpCircle,
      title: 'Help & About',
      description: 'Support and app information',
    },
    {
      id: 'developer' as SettingsSection,
      icon: Code,
      title: 'Developer Tools',
      description: 'Testing and debugging utilities',
    },
  ];

  return (
    <>
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{
          borderBottomColor: 'var(--df-border)',
          minHeight: '64px'
        }}
      >
        <h1
          style={{
            fontSize: 'var(--df-type-title-size)',
            fontWeight: 'var(--df-type-title-weight)',
            color: 'var(--df-text)'
          }}
        >
          Settings
        </h1>
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

      {/* Settings List */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {settingsItems.map((item) => (
          <Card
            key={item.id}
            className="p-0 cursor-pointer transition-colors duration-200 hover:bg-opacity-80"
            style={{
              backgroundColor: 'var(--df-surface)',
              borderColor: 'var(--df-border)',
              borderRadius: 'var(--df-radius-md)'
            }}
            onClick={() => onSectionSelect(item.id)}
          >
            <div className="flex items-center p-4 gap-4">
              <div
                className="p-2 rounded-full"
                style={{ backgroundColor: 'var(--df-surface-alt)' }}
              >
                <item.icon size={20} style={{ color: 'var(--df-primary)' }} />
              </div>
              <div className="flex-1">
                <h3
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)',
                    color: 'var(--df-text)'
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontSize: 'var(--df-type-caption-size)',
                    color: 'var(--df-text-muted)',
                    marginTop: '2px'
                  }}
                >
                  {item.description}
                </p>
              </div>
              <div
                style={{
                  color: 'var(--df-text-muted)',
                  fontSize: '18px'
                }}
              >
                ›
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

// Placeholder components for other settings sections
function AppearanceSettings({ onClose, isDark, toggleTheme }: { onClose: () => void; isDark?: boolean; toggleTheme?: () => void }) {
  return (
    <>
      <div
        className="flex items-center gap-3 p-4 border-b"
        style={{
          borderBottomColor: 'var(--df-border)',
          minHeight: '64px'
        }}
      >
        <Button
          variant="ghost"
          onClick={onClose}
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          <ArrowLeft size={20} />
        </Button>
        <h1
          style={{
            fontSize: 'var(--df-type-title-size)',
            fontWeight: 'var(--df-type-title-weight)',
            color: 'var(--df-text)'
          }}
        >
          Appearance
        </h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {/* Theme Toggle */}
        <Card
          className="p-0 mb-4"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)'
          }}
        >
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div
                className="p-2 rounded-full"
                style={{ backgroundColor: 'var(--df-surface-alt)' }}
              >
                {isDark ? (
                  <Moon size={20} style={{ color: 'var(--df-primary)' }} />
                ) : (
                  <Sun size={20} style={{ color: 'var(--df-primary)' }} />
                )}
              </div>
              <div>
                <h3
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)',
                    color: 'var(--df-text)'
                  }}
                >
                  Theme
                </h3>
                <p
                  style={{
                    fontSize: 'var(--df-type-caption-size)',
                    color: 'var(--df-text-muted)',
                    marginTop: '2px'
                  }}
                >
                  {isDark ? 'Dark mode' : 'Light mode'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={toggleTheme}
              disabled={!toggleTheme}
              style={{
                minHeight: '44px',
                minWidth: '44px',
                color: 'var(--df-primary)'
              }}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
          </div>
        </Card>

        {/* Other appearance settings placeholder */}
        <div className="mt-8 text-center">
          <p style={{ color: 'var(--df-text-muted)' }}>
            Additional appearance settings coming soon
          </p>
        </div>
      </div>
    </>
  );
}

function DataSettings({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div
        className="flex items-center gap-3 p-4 border-b"
        style={{
          borderBottomColor: 'var(--df-border)',
          minHeight: '64px'
        }}
      >
        <Button
          variant="ghost"
          onClick={onClose}
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          <ArrowLeft size={20} />
        </Button>
        <h1
          style={{
            fontSize: 'var(--df-type-title-size)',
            fontWeight: 'var(--df-type-title-weight)',
            color: 'var(--df-text)'
          }}
        >
          Data & Sync
        </h1>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <p style={{ color: 'var(--df-text-muted)' }}>
          Data and sync settings coming soon
        </p>
      </div>
    </>
  );
}

function PrivacySettings({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div
        className="flex items-center gap-3 p-4 border-b"
        style={{
          borderBottomColor: 'var(--df-border)',
          minHeight: '64px'
        }}
      >
        <Button
          variant="ghost"
          onClick={onClose}
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          <ArrowLeft size={20} />
        </Button>
        <h1
          style={{
            fontSize: 'var(--df-type-title-size)',
            fontWeight: 'var(--df-type-title-weight)',
            color: 'var(--df-text)'
          }}
        >
          Privacy & Security
        </h1>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <p style={{ color: 'var(--df-text-muted)' }}>
          Privacy settings coming soon
        </p>
      </div>
    </>
  );
}

function HelpSettings({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div
        className="flex items-center gap-3 p-4 border-b"
        style={{
          borderBottomColor: 'var(--df-border)',
          minHeight: '64px'
        }}
      >
        <Button
          variant="ghost"
          onClick={onClose}
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          <ArrowLeft size={20} />
        </Button>
        <h1
          style={{
            fontSize: 'var(--df-type-title-size)',
            fontWeight: 'var(--df-type-title-weight)',
            color: 'var(--df-text)'
          }}
        >
          Help & About
        </h1>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <p style={{ color: 'var(--df-text-muted)' }}>
          Help and about information coming soon
        </p>
      </div>
    </>
  );
}

function DeveloperSettings({ onClose }: { onClose: () => void }) {
  const [showTestPanel, setShowTestPanel] = useState(false);

  return (
    <>
      <div
        className="flex items-center gap-3 p-4 border-b"
        style={{
          borderBottomColor: 'var(--df-border)',
          minHeight: '64px'
        }}
      >
        <Button
          variant="ghost"
          onClick={onClose}
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          <ArrowLeft size={20} />
        </Button>
        <h1
          style={{
            fontSize: 'var(--df-type-title-size)',
            fontWeight: 'var(--df-type-title-weight)',
            color: 'var(--df-text)'
          }}
        >
          Developer Tools
        </h1>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-2">
        {/* Test Panel */}
        <Card
          className="p-0 cursor-pointer transition-colors duration-200 hover:bg-opacity-80"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)'
          }}
          onClick={() => setShowTestPanel(true)}
        >
          <div className="flex items-center p-4 gap-4">
            <div
              className="p-2 rounded-full"
              style={{ backgroundColor: 'var(--df-surface-alt)' }}
            >
              <Code size={20} style={{ color: 'var(--df-primary)' }} />
            </div>
            <div className="flex-1">
              <h3
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Run System Tests
              </h3>
              <p
                style={{
                  fontSize: 'var(--df-type-caption-size)',
                  color: 'var(--df-text-muted)',
                  marginTop: '2px'
                }}
              >
                Guardrails & smoke tests for authentication, RLS, and core functionality
              </p>
            </div>
            <div
              style={{
                color: 'var(--df-text-muted)',
                fontSize: '18px'
              }}
            >
              ›
            </div>
          </div>
        </Card>

        {/* Environment Info */}
        <Card
          className="p-4"
          style={{
            backgroundColor: 'var(--df-surface-alt)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)'
          }}
        >
          <h3
            style={{
              fontSize: 'var(--df-type-body-size)',
              fontWeight: 'var(--df-type-body-weight)',
              color: 'var(--df-text)',
              marginBottom: '8px'
            }}
          >
            Environment Info
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span style={{ color: 'var(--df-text-muted)' }}>Project ID:</span>
              <code style={{
                color: 'var(--df-text)',
                fontSize: 'var(--df-type-caption-size)',
                backgroundColor: 'var(--df-surface)',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                {projectId || 'Not configured'}
              </code>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--df-text-muted)' }}>Auth Status:</span>
              <span style={{ color: 'var(--df-success)' }}>Anonymous</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--df-text-muted)' }}>Realtime:</span>
              <span style={{ color: 'var(--df-success)' }}>Connected</span>
            </div>
          </div>
        </Card>

        {/* Quick Test Runner */}
        <QuickTestRunner />

        {/* Test Data Generator */}
        <TestDataGenerator />

        {/* Server Security Tests */}
        <ServerSecurityTest />
      </div>

      {/* Test Panel Modal */}
      {showTestPanel && (
        <TestPanel onClose={() => setShowTestPanel(false)} />
      )}
    </>
  );
}