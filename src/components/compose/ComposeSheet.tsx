import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Zap, Calendar, AlertTriangle, CheckCircle, X, RefreshCw, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Task, Settings } from '../../utils/data';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { useEdgeFunctions } from '../../hooks/useEdgeFunctions';
import { useDataStore } from '../../hooks/useDataStore';

interface ProposeOutcomeResponse {
  outcomes: {
    id: string;
    title: string;
    steps: string[];
    risk_note: string;
    confidence: number;
  }[];
}

interface ComposeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComposeSheet({ open, onOpenChange }: ComposeSheetProps) {
  const [proposedOutcomes, setProposedOutcomes] = useState<ProposeOutcomeResponse['outcomes']>([]);
  const [outcomeStates, setOutcomeStates] = useState<Record<string, 'pending' | 'accepted' | 'replaced'>>({});
  const [isProposing, setIsProposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { proposeOutcomes: proposeOutcomesEdge } = useEdgeFunctions();
  const { data, loading: dataLoading, createOutcome } = useDataStore();

  // Compute candidate tasks from data
  const candidateTasks = useMemo(() => {
    if (!data?.tasks || data.tasks.length === 0) return [];

    // Filter to candidate tasks (incomplete, with deadlines soon)
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    return data.tasks.filter(task => {
      const isIncomplete = !task.steps || !task.steps.every(step => step.completed);
      const hasUpcomingDeadline = task.deadline && new Date(task.deadline) <= nextWeek;
      return isIncomplete && (hasUpcomingDeadline || !task.deadline);
    });
  }, [data?.tasks]);

  const proposeOutcomes = async () => {
    if (candidateTasks.length === 0) return;

    setIsProposing(true);
    setError(null);

    try {
      const taskData = candidateTasks.map(task => ({
        id: task.id,
        title: task.title,
        steps: task.steps,
        deadline: task.deadline,
        energy: task.energy,
        est_min: task.est_min,
        est_most: task.est_most,
        est_max: task.est_max
      }));

      const constraints = {
        work_hours: data?.settings?.work_hours || {},
        no_meeting_windows: data?.settings?.no_meeting_windows || [],
        break_prefs: data?.settings?.break_prefs || { interval_min: 90, break_min: 15 }
      };

      const outcomes = await proposeOutcomesEdge(taskData, constraints);

      // Map edge function outcomes to our expected format
      const mappedOutcomes = outcomes.map((outcome, index) => ({
        id: `outcome-${index}`,
        title: outcome.title,
        steps: outcome.linked_task_ids || [],
        risk_note: outcome.risks.join(', '),
        confidence: 80 // Default confidence
      }));

      setProposedOutcomes(mappedOutcomes);

      // Initialize all outcomes as pending
      const initialStates: Record<string, 'pending' | 'accepted' | 'replaced'> = {};
      mappedOutcomes.forEach(outcome => {
        initialStates[outcome.id] = 'pending';
      });
      setOutcomeStates(initialStates);

    } catch (err) {
      console.error('Error proposing outcomes:', err);
      setError(err instanceof Error ? err.message : 'Failed to propose outcomes');
    } finally {
      setIsProposing(false);
    }
  };

  const handleOutcomeAction = (outcomeId: string, action: 'accept' | 'replace') => {
    setOutcomeStates(prev => ({
      ...prev,
      [outcomeId]: action === 'accept' ? 'accepted' : 'replaced'
    }));
  };

  const sendToScheduler = async () => {
    const acceptedOutcomes = proposedOutcomes.filter(outcome =>
      outcomeStates[outcome.id] === 'accepted'
    );

    if (acceptedOutcomes.length === 0) {
      setError('Please accept at least one outcome before sending to scheduler');
      return;
    }

    try {
      // Create outcomes in the data store
      await Promise.all(
        acceptedOutcomes.map(outcome =>
          createOutcome({
            title: outcome.title,
            risks: [{ text: outcome.risk_note }]
          })
        )
      );

      // Close the compose sheet
      onOpenChange(false);

      // Reset state
      setProposedOutcomes([]);
      setOutcomeStates({});

    } catch (err) {
      console.error('Error sending to scheduler:', err);
      setError('Failed to send outcomes to scheduler');
    }
  };

  const formatWorkHours = (workHours: Record<string, { start: string; end: string }>) => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const todayHours = workHours[today];

    if (!todayHours) return 'No work hours set';

    return `${todayHours.start} - ${todayHours.end}`;
  };

  const getEnergyColorClass = (energy: string) => {
    return energy === 'deep' ? 'var(--df-primary)' : 'var(--df-text-muted)';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] p-0 flex flex-col"
        style={{
          backgroundColor: 'var(--df-surface)',
          borderColor: 'var(--df-border)'
        }}
      >
        <SheetHeader className="p-4 pb-0">
          <SheetTitle style={{
            fontSize: 'var(--df-type-title-size)',
            fontWeight: 'var(--df-type-title-weight)',
            color: 'var(--df-text)'
          }}>
            Compose Day
          </SheetTitle>
          <SheetDescription style={{
            fontSize: 'var(--df-type-body-size)',
            color: 'var(--df-text-muted)'
          }}>
            Review candidate tasks and propose 3-5 outcomes for today
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 min-h-0">
          <div className="space-y-6 pb-4">
            {/* Today's Constraints */}
            <section>
              <h3 style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)',
                marginBottom: 'var(--df-space-12)'
              }}>
                Today's Constraints
              </h3>

              <Card className="p-4" style={{
                backgroundColor: 'var(--df-surface)',
                borderColor: 'var(--df-border)',
                borderRadius: 'var(--df-radius-md)',
                boxShadow: 'var(--df-shadow-sm)'
              }}>
                {dataLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Clock size={16} style={{ color: 'var(--df-text-muted)' }} />
                      <span style={{
                        fontSize: 'var(--df-type-body-size)',
                        color: 'var(--df-text)'
                      }}>
                        Work hours: {data?.settings ? formatWorkHours(data.settings.work_hours) : 'Not set'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Calendar size={16} style={{ color: 'var(--df-text-muted)' }} />
                      <span style={{
                        fontSize: 'var(--df-type-body-size)',
                        color: 'var(--df-text)'
                      }}>
                        No-meeting windows: {data?.settings?.no_meeting_windows?.length || 0} configured
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Zap size={16} style={{ color: 'var(--df-text-muted)' }} />
                      <span style={{
                        fontSize: 'var(--df-type-body-size)',
                        color: 'var(--df-text)'
                      }}>
                        Energy heatmap: Morning peak (placeholder)
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            </section>

            {/* Candidate Tasks */}
            <section>
              <h3 style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)',
                marginBottom: 'var(--df-space-12)'
              }}>
                Candidate Tasks ({candidateTasks.length})
              </h3>

              {dataLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="p-4">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </Card>
                  ))}
                </div>
              ) : candidateTasks.length > 0 ? (
                <div className="space-y-3">
                  {candidateTasks.map(task => (
                    <Card key={task.id} className="p-4" style={{
                      backgroundColor: 'var(--df-surface)',
                      borderColor: 'var(--df-border)',
                      borderRadius: 'var(--df-radius-md)',
                      boxShadow: 'var(--df-shadow-sm)'
                    }}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 style={{
                            fontSize: 'var(--df-type-body-size)',
                            fontWeight: 'var(--df-type-body-weight)',
                            color: 'var(--df-text)',
                            marginBottom: 'var(--df-space-4)'
                          }}>
                            {task.title}
                          </h4>

                          <div className="flex items-center space-x-4 text-sm">
                            <Badge
                              variant="outline"
                              style={{
                                backgroundColor: task.energy === 'deep' ? 'rgba(37, 99, 235, 0.1)' : 'rgba(91, 100, 114, 0.1)',
                                color: getEnergyColorClass(task.energy),
                                borderColor: getEnergyColorClass(task.energy)
                              }}
                            >
                              {task.energy === 'deep' ? 'Deep' : 'Shallow'}
                            </Badge>

                            {task.deadline && (
                              <span style={{
                                fontSize: 'var(--df-type-caption-size)',
                                color: 'var(--df-text-muted)'
                              }}>
                                Due: {new Date(task.deadline).toLocaleDateString()}
                              </span>
                            )}

                            {(task.est_min || task.est_most) && (
                              <span style={{
                                fontSize: 'var(--df-type-caption-size)',
                                color: 'var(--df-text-muted)'
                              }}>
                                Est: {task.est_min || task.est_most}min
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center" style={{
                  backgroundColor: 'var(--df-surface)',
                  borderColor: 'var(--df-border)',
                  borderRadius: 'var(--df-radius-md)',
                  boxShadow: 'var(--df-shadow-sm)'
                }}>
                  <p style={{
                    fontSize: 'var(--df-type-body-size)',
                    color: 'var(--df-text-muted)'
                  }}>
                    No candidate tasks found
                  </p>
                  <p style={{
                    fontSize: 'var(--df-type-caption-size)',
                    color: 'var(--df-text-muted)',
                    marginTop: 'var(--df-space-4)'
                  }}>
                    Add tasks with deadlines to get started
                  </p>
                </Card>
              )}
            </section>

            {/* Propose Outcomes Button */}
            {candidateTasks.length > 0 && proposedOutcomes.length === 0 && (
              <div className="flex justify-center">
                <Button
                  onClick={proposeOutcomes}
                  disabled={isProposing || dataLoading}
                  style={{
                    backgroundColor: 'var(--df-primary)',
                    color: 'var(--df-primary-contrast)',
                    minHeight: '48px',
                    padding: '0 var(--df-space-24)'
                  }}
                >
                  {isProposing ? (
                    <>
                      <RefreshCw size={20} className="mr-2 animate-spin" />
                      Proposing...
                    </>
                  ) : (
                    'Propose 3–5 Outcomes'
                  )}
                </Button>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <Card className="p-4 border-red-200 bg-red-50">
                <div className="flex items-center space-x-2">
                  <AlertTriangle size={16} className="text-red-600" />
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              </Card>
            )}

            {/* Proposed Outcomes */}
            {proposedOutcomes.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 style={{
                    fontSize: 'var(--df-type-subtitle-size)',
                    fontWeight: 'var(--df-type-subtitle-weight)',
                    color: 'var(--df-text)'
                  }}>
                    Proposed Outcomes ({proposedOutcomes.length})
                  </h3>

                  <Button
                    onClick={sendToScheduler}
                    disabled={!Object.values(outcomeStates).some(state => state === 'accepted')}
                    style={{
                      backgroundColor: 'var(--df-success)',
                      color: 'var(--df-primary-contrast)',
                      minHeight: '44px'
                    }}
                  >
                    <Send size={16} className="mr-2" />
                    Send to Scheduler
                  </Button>
                </div>

                <div className="space-y-4">
                  {proposedOutcomes.map(outcome => (
                    <Card key={outcome.id} className="p-4" style={{
                      backgroundColor: 'var(--df-surface)',
                      borderColor: outcomeStates[outcome.id] === 'accepted'
                        ? 'var(--df-success)'
                        : outcomeStates[outcome.id] === 'replaced'
                          ? 'var(--df-text-muted)'
                          : 'var(--df-border)',
                      borderRadius: 'var(--df-radius-md)',
                      boxShadow: 'var(--df-shadow-sm)',
                      opacity: outcomeStates[outcome.id] === 'replaced' ? 0.6 : 1
                    }}>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <h4 style={{
                            fontSize: 'var(--df-type-body-size)',
                            fontWeight: 'var(--df-type-body-weight)',
                            color: 'var(--df-text)'
                          }}>
                            {outcome.title}
                          </h4>

                          <div className="flex items-center space-x-2">
                            {outcomeStates[outcome.id] === 'accepted' && (
                              <CheckCircle size={20} style={{ color: 'var(--df-success)' }} />
                            )}
                            {outcomeStates[outcome.id] === 'replaced' && (
                              <X size={20} style={{ color: 'var(--df-text-muted)' }} />
                            )}
                          </div>
                        </div>

                        <div>
                          <p style={{
                            fontSize: 'var(--df-type-caption-size)',
                            color: 'var(--df-text-muted)',
                            marginBottom: 'var(--df-space-8)'
                          }}>
                            Key Steps:
                          </p>
                          <ul className="space-y-1">
                            {outcome.steps.map((step, index) => (
                              <li key={index} style={{
                                fontSize: 'var(--df-type-caption-size)',
                                color: 'var(--df-text)',
                                paddingLeft: 'var(--df-space-12)',
                                position: 'relative'
                              }}>
                                <span style={{
                                  position: 'absolute',
                                  left: '0',
                                  color: 'var(--df-text-muted)'
                                }}>
                                  •
                                </span>
                                {step}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex items-start space-x-2 p-3 rounded" style={{
                          backgroundColor: 'var(--df-surface-alt)'
                        }}>
                          <AlertTriangle size={14} style={{
                            color: 'var(--df-warning)',
                            marginTop: '2px',
                            flexShrink: 0
                          }} />
                          <p style={{
                            fontSize: 'var(--df-type-caption-size)',
                            color: 'var(--df-text-muted)'
                          }}>
                            <strong>Risk:</strong> {outcome.risk_note}
                          </p>
                        </div>

                        {outcomeStates[outcome.id] === 'pending' && (
                          <div className="flex space-x-2 pt-2">
                            <Button
                              size="sm"
                              onClick={() => handleOutcomeAction(outcome.id, 'accept')}
                              style={{
                                backgroundColor: 'var(--df-success)',
                                color: 'var(--df-primary-contrast)'
                              }}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOutcomeAction(outcome.id, 'replace')}
                              style={{
                                borderColor: 'var(--df-border)',
                                color: 'var(--df-text-muted)'
                              }}
                            >
                              Replace
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}