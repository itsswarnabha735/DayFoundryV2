import React, { useState, useEffect, useRef } from 'react';
import { Home, Inbox, Calendar, Focus, BarChart3, Plus, Moon, Sun } from 'lucide-react';
import { Button } from './components/ui/button';
import { ErrorBoundary } from './components/ui/error-boundary';
import { TodayScreen, TodayScreenRef } from './components/screens/TodayScreen';
import { InboxScreen, InboxScreenRef } from './components/screens/InboxScreen';
import { ScheduleScreen } from './components/screens/ScheduleScreen';
import { FocusScreen, FocusScreenRef } from './components/screens/FocusScreen';
import { ReviewScreen } from './components/screens/ReviewScreen';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { DatabaseSetup } from './components/setup/DatabaseSetup';
import { AuthScreen } from './components/auth/AuthScreen';
import { OAuthCallback } from './components/auth/OAuthCallback';
import { DataStoreProvider } from './contexts/DataStoreContext';
import { globalErrorHandler } from './utils/error-handler';
import { authManager, User } from './utils/auth';

type Tab = 'today' | 'inbox' | 'schedule' | 'focus' | 'review';

// Deep link action types
type DeepLinkAction = 'quick-capture' | 'start-focus' | 'add-outcome' | null;

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [pendingAction, setPendingAction] = useState<DeepLinkAction>(null);
  const todayScreenRef = useRef<TodayScreenRef>(null);
  const inboxScreenRef = useRef<InboxScreenRef>(null);
  const focusScreenRef = useRef<FocusScreenRef>(null);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Initialize authentication
  useEffect(() => {
    let unsubscribeAuth: (() => void) | undefined;

    const initAuth = async () => {
      try {
        console.log('App: Initializing authentication...');
        await authManager.initialize();
        const user = await authManager.getCurrentUser();
        setCurrentUser(user);

        // Load onboarding status for the current user if they exist
        if (user) {
          const userOnboardingKey = `df-onboarding-completed-${user.id}`;
          const userDatabaseKey = `df-database-ready-${user.id}`;
          const hasCompletedOnboardingForUser = localStorage.getItem(userOnboardingKey) === 'true';
          const hasDatabaseReadyForUser = localStorage.getItem(userDatabaseKey) === 'true';

          console.log(`App: Initial load for user ${user.id} onboarding status:`, {
            hasCompletedOnboardingForUser,
            hasDatabaseReadyForUser
          });

          setHasCompletedOnboarding(hasCompletedOnboardingForUser);
          setIsDatabaseReady(hasDatabaseReadyForUser);
        }

        setAuthInitialized(true);

        // Set up auth state listener
        unsubscribeAuth = authManager.onAuthStateChange((user) => {
          console.log('App: Auth state changed to user:', user?.id);
          setCurrentUser(user);

          // Reset onboarding state if user changes
          if (!user) {
            setHasCompletedOnboarding(false);
            setIsDatabaseReady(false);
            // Clean up old global keys if they exist
            localStorage.removeItem('df-onboarding-completed');
            localStorage.removeItem('df-database-ready');
          } else {
            // Check if this user has completed onboarding
            const userOnboardingKey = `df-onboarding-completed-${user.id}`;
            const userDatabaseKey = `df-database-ready-${user.id}`;
            const hasCompletedOnboardingForUser = localStorage.getItem(userOnboardingKey) === 'true';
            const hasDatabaseReadyForUser = localStorage.getItem(userDatabaseKey) === 'true';

            console.log(`App: Loading user ${user.id} onboarding status:`, {
              hasCompletedOnboardingForUser,
              hasDatabaseReadyForUser
            });

            setHasCompletedOnboarding(hasCompletedOnboardingForUser);
            setIsDatabaseReady(hasDatabaseReadyForUser);
          }
        });

        console.log('App: Authentication initialization completed');
      } catch (error) {
        console.error('Auth initialization error:', error);
        setAuthInitialized(true); // Still set to true to prevent loading state
      }
    };

    initAuth();

    // Cleanup on unmount
    return () => {
      if (unsubscribeAuth) {
        unsubscribeAuth();
      }
    };
  }, []);

  // Deep link and quick action detection
  useEffect(() => {
    const handleDeepLink = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const action = urlParams.get('action') || hashParams.get('action');

      // Support multiple URL schemes for deep links
      if (window.location.protocol === 'dayFoundry:' || action) {
        const deepLinkAction = action || window.location.pathname.slice(1);

        switch (deepLinkAction) {
          case 'quick-capture':
          case 'capture':
            setPendingAction('quick-capture');
            break;
          case 'start-focus':
          case 'focus':
            setPendingAction('start-focus');
            break;
          case 'add-outcome':
          case 'outcome':
            setPendingAction('add-outcome');
            break;
        }
      }
    };

    // Check for deep links on load
    handleDeepLink();

    // Listen for hash changes (for web-based deep links)
    window.addEventListener('hashchange', handleDeepLink);
    window.addEventListener('popstate', handleDeepLink);

    return () => {
      window.removeEventListener('hashchange', handleDeepLink);
      window.removeEventListener('popstate', handleDeepLink);
    };
  }, []);

  // Handle pending actions when screens are ready and user is authenticated
  useEffect(() => {
    if (!pendingAction || !currentUser || !isDatabaseReady || !hasCompletedOnboarding) return;

    const executePendingAction = async () => {
      // Small delay to ensure screens are mounted
      setTimeout(() => {
        handleQuickAction(pendingAction);
        setPendingAction(null);
      }, 300);
    };

    executePendingAction();
  }, [pendingAction, currentUser, isDatabaseReady, hasCompletedOnboarding]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  // Quick action handlers
  const handleQuickAction = (action: DeepLinkAction) => {
    if (!action) return;

    switch (action) {
      case 'quick-capture':
        handleQuickCapture();
        break;
      case 'start-focus':
        handleStartFocus();
        break;
      case 'add-outcome':
        handleAddOutcome();
        break;
    }
  };

  const handleQuickCapture = () => {
    // Navigate to inbox and trigger capture
    setActiveTab('inbox');
    setTimeout(() => {
      inboxScreenRef.current?.focusCapture();
    }, 100);
  };

  const handleStartFocus = () => {
    // Navigate to focus and start session
    setActiveTab('focus');
    setTimeout(() => {
      focusScreenRef.current?.startFocusSession();
    }, 100);
  };

  const handleAddOutcome = () => {
    // Navigate to today and show compose for outcomes
    setActiveTab('today');
    setTimeout(() => {
      todayScreenRef.current?.showCompose();
    }, 100);
  };

  // Expose quick actions globally for widget/shortcut access
  useEffect(() => {
    // @ts-ignore - Global functions for external widget access
    window.dayFoundryQuickActions = {
      quickCapture: () => handleQuickAction('quick-capture'),
      startFocus: () => handleQuickAction('start-focus'),
      addOutcome: () => handleQuickAction('add-outcome')
    };

    return () => {
      // @ts-ignore
      delete window.dayFoundryQuickActions;
    };
  }, []);

  const showFAB = activeTab === 'today' || activeTab === 'inbox' || activeTab === 'schedule';

  const handleAuthSuccess = () => {
    // Auth state will be updated by the auth manager listener
    console.log('Authentication successful');
  };

  const handleDatabaseSetupComplete = () => {
    setIsDatabaseReady(true);
    if (currentUser) {
      localStorage.setItem(`df-database-ready-${currentUser.id}`, 'true');
    }
  };

  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
    if (currentUser) {
      localStorage.setItem(`df-onboarding-completed-${currentUser.id}`, 'true');
    }
  };

  // Show loading state while auth initializes
  if (!authInitialized) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{
          backgroundColor: 'var(--df-surface)',
          color: 'var(--df-text)'
        }}
      >
        <div className="text-center">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'var(--df-primary)' }}
          >
            <span
              className="font-semibold"
              style={{
                color: 'var(--df-primary-contrast)',
                fontSize: 'var(--df-type-body-size)'
              }}
            >
              DF
            </span>
          </div>
          <p style={{ color: 'var(--df-text-muted)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Show authentication screen if not authenticated
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} isDark={isDark} />;
  }

  // Show database setup if not ready
  if (!isDatabaseReady) {
    return <DatabaseSetup onComplete={handleDatabaseSetupComplete} />;
  }

  // Show onboarding if not completed
  if (!hasCompletedOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} isDark={isDark} />;
  }

  // At this point we have an authenticated user and are ready for the main app
  // Wrap the main app content with DataStoreProvider

  const renderScreen = () => {
    switch (activeTab) {
      case 'today':
        return <TodayScreen ref={todayScreenRef} isDark={isDark} toggleTheme={toggleTheme} />;
      case 'inbox':
        return <InboxScreen ref={inboxScreenRef} />;
      case 'schedule':
        return <ScheduleScreen />;
      case 'focus':
        return <FocusScreen ref={focusScreenRef} />;
      case 'review':
        return <ReviewScreen />;
      default:
        return <TodayScreen ref={todayScreenRef} isDark={isDark} toggleTheme={toggleTheme} />;
    }
  };

  return (
    <DataStoreProvider currentUser={currentUser}>
      <OAuthCallback />
      <div
        className="h-screen flex flex-col"
        style={{
          backgroundColor: 'var(--df-surface)',
          color: 'var(--df-text)'
        }}
      >


        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {renderScreen()}
        </div>

        {/* Floating Action Button */}
        {showFAB && (
          <Button
            className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg"
            style={{
              backgroundColor: 'var(--df-primary)',
              color: 'var(--df-primary-contrast)',
              boxShadow: 'var(--df-shadow-lg)',
              minHeight: '56px',
              minWidth: '56px'
            }}
            onClick={() => {
              if (activeTab === 'inbox') {
                // Trigger capture input focus
                const textInput = document.querySelector('input[placeholder="Type to capture..."]') as HTMLInputElement;
                textInput?.focus();
              } else if (activeTab === 'today') {
                // Show compose sheet
                todayScreenRef.current?.showCompose();
              } else {
                // Handle other capture actions
                console.log('Capture action');
              }
            }}
          >
            <Plus size={24} />
          </Button>
        )}

        {/* Bottom Tab Bar */}
        <div
          className="flex border-t"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderTopColor: 'var(--df-border)',
            paddingBottom: 'env(safe-area-inset-bottom, 0)',
            minHeight: '80px'
          }}
        >
          <TabButton
            icon={Home}
            label="Today"
            isActive={activeTab === 'today'}
            onClick={() => setActiveTab('today')}
          />
          <TabButton
            icon={Inbox}
            label="Inbox"
            isActive={activeTab === 'inbox'}
            onClick={() => setActiveTab('inbox')}
          />
          <TabButton
            icon={Calendar}
            label="Schedule"
            isActive={activeTab === 'schedule'}
            onClick={() => setActiveTab('schedule')}
          />
          <TabButton
            icon={Focus}
            label="Focus"
            isActive={activeTab === 'focus'}
            onClick={() => setActiveTab('focus')}
          />
          <TabButton
            icon={BarChart3}
            label="Review"
            isActive={activeTab === 'review'}
            onClick={() => setActiveTab('review')}
          />
        </div>
      </div>
    </DataStoreProvider>
  );
}

interface TabButtonProps {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function TabButton({ icon: Icon, label, isActive, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center py-2 px-1 transition-colors duration-200"
      style={{
        color: isActive ? 'var(--df-primary)' : 'var(--df-text-muted)',
        minHeight: '44px'
      }}
    >
      <Icon size={24} />
      <span
        className="text-xs mt-1"
        style={{
          fontSize: 'var(--df-type-caption-size)',
          fontWeight: 'var(--df-type-caption-weight)'
        }}
      >
        {label}
      </span>
    </button>
  );
}

export default function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('App Error Boundary caught error:', error, errorInfo);

        // Report through global error handler
        globalErrorHandler.reportError({
          message: `React Error Boundary: ${error.message}`,
          stack: error.stack,
          url: window.location.href,
          timestamp: new Date(),
          userAgent: navigator.userAgent
        });
      }}
    >
      <AppContent />
    </ErrorBoundary>
  );
}