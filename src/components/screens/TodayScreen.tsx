import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Settings, ChevronRight, Clock, User, LogOut } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { ProgressRing } from '../ui/progress-ring';
import { SyncIndicator } from '../sync/SyncIndicator';
import { useDataStore } from '../../hooks/useDataStore';
import { SettingsScreen } from './SettingsScreen';
import { ComposeSheet } from '../compose/ComposeSheet';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { authManager } from '../../utils/auth';
import { Task } from '../../utils/data/DataStore';

interface TodayScreenProps {
  isDark?: boolean;
  toggleTheme?: () => void;
}

export interface TodayScreenRef {
  showCompose: () => void;
}

export const TodayScreen = forwardRef<TodayScreenRef, TodayScreenProps>(
  ({ isDark, toggleTheme }, ref) => {
    const [showSettings, setShowSettings] = useState(false);
    const [showCompose, setShowCompose] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      showCompose: () => setShowCompose(true)
    }));

    // Get current user
    useEffect(() => {
      const getCurrentUser = async () => {
        const user = await authManager.getCurrentUser();
        setCurrentUser(user);
      };
      getCurrentUser();

      // Listen for auth changes
      const unsubscribe = authManager.onAuthStateChange(setCurrentUser);
      return unsubscribe;
    }, []);

    const handleSignOut = async () => {
      try {
        await authManager.signOut();
      } catch (error) {
        console.error('Sign out error:', error);
      }
    };

    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });

    const { data, loading, refresh } = useDataStore();

    // Listen for realtime updates
    useEffect(() => {
      const handleDataUpdate = (event: CustomEvent) => {
        const { table } = event.detail;

        // Refresh data when tasks are updated via realtime
        if (table === 'tasks') {
          refresh();
        }
      };

      window.addEventListener('data-updated', handleDataUpdate as EventListener);

      return () => {
        window.removeEventListener('data-updated', handleDataUpdate as EventListener);
      };
    }, [refresh]);

    // Compute dashboard data locally
    const todayStr = today.toISOString().split('T')[0];

    const todayTasks = data.tasks.filter(task => {
      // Tasks created today
      return task.created_at.startsWith(todayStr);
    });

    const overdueTasks = data.tasks.filter(task => {
      // Tasks created before today and not completed
      const isCompleted = task.steps.length > 0 && task.steps.every(step => step.completed);
      return !isCompleted && task.created_at < todayStr;
    });

    const completedTodayTasks = todayTasks.filter(task =>
      task.steps.length > 0 && task.steps.every(step => step.completed)
    );

    const completionPercentage = todayTasks.length > 0
      ? (completedTodayTasks.length / todayTasks.length) * 100
      : 0;

    const outcomes = data.outcomes || [];
    const nextBlock = null; // We'll implement this later when we have proper schedule blocks

    return (
      <div className="flex flex-col h-full">
        {/* Top App Bar */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderBottomColor: 'var(--df-border)',
            paddingTop: 'calc(env(safe-area-inset-top, 0) + 12px)',
            minHeight: '56px'
          }}
        >
          <div className="flex items-center space-x-3">
            <div>
              <h1
                className="font-semibold"
                style={{
                  fontSize: 'var(--df-type-title-size)',
                  fontWeight: 'var(--df-type-title-weight)',
                  color: 'var(--df-text)'
                }}
              >
                {formattedDate}
              </h1>
            </div>
            <ProgressRing
              progress={loading ? 0 : completionPercentage}
              size={32}
              strokeWidth={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <SyncIndicator />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  style={{
                    color: 'var(--df-text-muted)',
                    minHeight: '44px',
                    minWidth: '44px'
                  }}
                >
                  <Settings size={20} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56"
                style={{
                  backgroundColor: 'var(--df-surface)',
                  borderColor: 'var(--df-border)',
                  boxShadow: 'var(--df-shadow-md)'
                }}
              >
                {currentUser && (
                  <>
                    <div className="flex items-center space-x-3 px-3 py-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: 'var(--df-primary)',
                          color: 'var(--df-primary-contrast)',
                          fontSize: 'var(--df-type-caption-size)',
                          fontWeight: 'var(--df-type-caption-weight)'
                        }}
                      >
                        {currentUser.name?.charAt(0)?.toUpperCase() || currentUser.email?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="truncate"
                          style={{
                            fontSize: 'var(--df-type-body-size)',
                            fontWeight: 'var(--df-type-body-weight)',
                            color: 'var(--df-text)'
                          }}
                        >
                          {currentUser.name || 'User'}
                        </p>
                        <p
                          className="truncate"
                          style={{
                            fontSize: 'var(--df-type-caption-size)',
                            color: 'var(--df-text-muted)'
                          }}
                        >
                          {currentUser.email}
                        </p>
                      </div>
                    </div>
                    <DropdownMenuSeparator style={{ backgroundColor: 'var(--df-border)' }} />
                  </>
                )}

                <DropdownMenuItem
                  onClick={() => setShowSettings(true)}
                  className="flex items-center space-x-2 px-3 py-2 cursor-pointer"
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    color: 'var(--df-text)'
                  }}
                >
                  <Settings size={16} />
                  <span>Settings</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="flex items-center space-x-2 px-3 py-2 cursor-pointer"
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    color: 'var(--df-text)'
                  }}
                >
                  <LogOut size={16} />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-auto px-4 py-4"
          style={{ paddingBottom: 'var(--df-space-24)' }}
        >
          {/* Today's Tasks */}
          <section className="mb-6">
            <h2
              className="mb-3"
              style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)'
              }}
            >
              Today's Tasks ({completedTodayTasks.length}/{todayTasks.length})
            </h2>

            <Card
              className="p-4"
              style={{
                backgroundColor: 'var(--df-surface)',
                borderColor: 'var(--df-border)',
                borderRadius: 'var(--df-radius-md)',
                boxShadow: 'var(--df-shadow-sm)'
              }}
            >
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-start space-x-3">
                      <Skeleton className="w-5 h-5 rounded" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              ) : todayTasks.length > 0 ? (
                <div className="space-y-3">
                  {todayTasks.slice(0, 5).map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                    />
                  ))}
                  {todayTasks.length > 5 && (
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--df-border)' }}>
                      <p style={{
                        fontSize: 'var(--df-type-caption-size)',
                        color: 'var(--df-text-muted)',
                        textAlign: 'center'
                      }}>
                        +{todayTasks.length - 5} more tasks
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p style={{
                    fontSize: 'var(--df-type-body-size)',
                    color: 'var(--df-text-muted)'
                  }}>
                    No tasks created today
                  </p>
                  <p style={{
                    fontSize: 'var(--df-type-caption-size)',
                    color: 'var(--df-text-muted)',
                    marginTop: 'var(--df-space-4)'
                  }}>
                    Use the + button to capture new tasks
                  </p>
                </div>
              )}
            </Card>
          </section>

          {/* Overdue Tasks */}
          {overdueTasks.length > 0 && (
            <section className="mb-6">
              <h2
                className="mb-3"
                style={{
                  fontSize: 'var(--df-type-subtitle-size)',
                  fontWeight: 'var(--df-type-subtitle-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Overdue Tasks ({overdueTasks.length})
              </h2>

              <Card
                className="p-4"
                style={{
                  backgroundColor: 'var(--df-surface)',
                  borderColor: 'var(--df-border)',
                  borderRadius: 'var(--df-radius-md)',
                  boxShadow: 'var(--df-shadow-sm)'
                }}
              >
                <div className="space-y-3">
                  {overdueTasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      isOverdue={true}
                    />
                  ))}
                </div>
              </Card>
            </section>
          )}

          {/* Next Up */}
          <section className="mb-6">
            <h2
              className="mb-3"
              style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)'
              }}
            >
              Next Up
            </h2>

            <Card
              className="p-4"
              style={{
                backgroundColor: 'var(--df-surface)',
                borderColor: 'var(--df-border)',
                borderRadius: 'var(--df-radius-md)',
                boxShadow: 'var(--df-shadow-sm)'
              }}
            >
              {loading ? (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="w-5 h-5" />
                </div>
              ) : nextBlock ? (
                <div className="flex items-center justify-between">
                  <div>
                    <h3
                      style={{
                        fontSize: 'var(--df-type-body-size)',
                        fontWeight: 'var(--df-type-body-weight)',
                        color: 'var(--df-text)'
                      }}
                    >
                      {nextBlock.block_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}: {nextBlock.rationale || 'Scheduled work'}
                    </h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Clock size={14} style={{ color: 'var(--df-text-muted)' }} />
                      <p
                        style={{
                          fontSize: 'var(--df-type-caption-size)',
                          color: 'var(--df-text-muted)'
                        }}
                      >
                        {new Date(nextBlock.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(nextBlock.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    size={20}
                    style={{ color: 'var(--df-text-muted)' }}
                  />
                </div>
              ) : (
                <div className="text-center py-4">
                  <p style={{
                    fontSize: 'var(--df-type-body-size)',
                    color: 'var(--df-text-muted)'
                  }}>
                    No upcoming schedule blocks
                  </p>
                  <p style={{
                    fontSize: 'var(--df-type-caption-size)',
                    color: 'var(--df-text-muted)',
                    marginTop: 'var(--df-space-4)'
                  }}>
                    Plan your day in the Schedule tab
                  </p>
                </div>
              )}
            </Card>
          </section>

          {/* Quick Actions */}
          <section>
            <h2
              className="mb-3"
              style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)'
              }}
            >
              Quick Actions
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <QuickActionCard
                title="Compose Day"
                description="Plan today's outcomes"
                onClick={() => setShowCompose(true)}
              />
              <QuickActionCard
                title="Start Focus"
                description="Begin deep work session"
              />
              <QuickActionCard
                title="Review Inbox"
                description="Process captured items"
              />
              <QuickActionCard
                title="Update Schedule"
                description="Adjust time blocks"
              />
            </div>
          </section>
        </div>

        {/* Settings Sheet */}
        <Sheet open={showSettings} onOpenChange={setShowSettings}>
          <SheetContent
            side="right"
            className="w-full p-0"
            style={{
              backgroundColor: 'var(--df-surface)',
              borderColor: 'var(--df-border)'
            }}
          >
            <SheetTitle className="sr-only">Settings</SheetTitle>
            <SheetDescription className="sr-only">
              Access app settings and preferences
            </SheetDescription>
            <SettingsScreen
              onClose={() => setShowSettings(false)}
              isDark={isDark}
              toggleTheme={toggleTheme}
            />
          </SheetContent>
        </Sheet>

        {/* Compose Sheet */}
        <ComposeSheet
          open={showCompose}
          onOpenChange={setShowCompose}
        />
      </div>
    );
  });

TodayScreen.displayName = 'TodayScreen';

interface TaskItemProps {
  task: Task;
  isOverdue?: boolean;
}

function TaskItem({ task, isOverdue }: TaskItemProps) {
  const isCompleted = task.steps.length > 0 && task.steps.every(step => step.completed);

  // Format estimate
  const getEstimateText = () => {
    if (task.est_min && task.est_max) {
      if (task.est_min === task.est_max) return `${task.est_min}m`;
      return `${task.est_min}-${task.est_max}m`;
    }
    if (task.est_most) return `${task.est_most}m`;
    return null;
  };

  const estimateText = getEstimateText();

  // Format overdue date
  const getOverdueText = () => {
    if (!isOverdue) return null;
    const createdDate = new Date(task.created_at);
    return `Overdue since ${createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  return (
    <div className="flex items-start space-x-3 py-1">
      <div
        className="flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5"
        style={{
          backgroundColor: isCompleted ? 'var(--df-success)' : 'transparent',
          borderColor: isCompleted ? 'var(--df-success)' : 'var(--df-border)'
        }}
      >
        {isCompleted && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6L4.5 8L9.5 3"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span
          className={isCompleted ? 'line-through' : ''}
          style={{
            fontSize: 'var(--df-type-body-size)',
            color: isCompleted ? 'var(--df-text-muted)' : 'var(--df-text)',
            display: 'block',
            marginBottom: '4px'
          }}
        >
          {task.title}
        </span>

        <div className="flex flex-wrap gap-2 items-center">
          {isOverdue && (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--df-danger)',
                fontWeight: 500
              }}
            >
              {getOverdueText()}
            </span>
          )}

          {estimateText && (
            <div
              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                backgroundColor: 'var(--df-surface-alt)',
                color: 'var(--df-text-muted)',
                border: '1px solid var(--df-border)'
              }}
            >
              {estimateText}
            </div>
          )}

          {task.energy && (
            <div
              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                backgroundColor: task.energy === 'deep' ? 'var(--df-surface-alt)' : 'var(--df-surface-alt)',
                color: task.energy === 'deep' ? 'var(--df-primary)' : 'var(--df-text-muted)',
                border: '1px solid var(--df-border)'
              }}
            >
              {task.energy.charAt(0).toUpperCase() + task.energy.slice(1)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface QuickActionCardProps {
  title: string;
  description: string;
  onClick?: () => void;
}

function QuickActionCard({ title, description, onClick }: QuickActionCardProps) {
  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md transition-shadow"
      style={{
        backgroundColor: 'var(--df-surface)',
        borderColor: 'var(--df-border)',
        borderRadius: 'var(--df-radius-md)',
        boxShadow: 'var(--df-shadow-sm)',
        minHeight: '80px'
      }}
      onClick={onClick}
    >
      <h3
        className="mb-1"
        style={{
          fontSize: 'var(--df-type-body-size)',
          fontWeight: 'var(--df-type-body-weight)',
          color: 'var(--df-text)'
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 'var(--df-type-caption-size)',
          color: 'var(--df-text-muted)'
        }}
      >
        {description}
      </p>
    </Card>
  );
}