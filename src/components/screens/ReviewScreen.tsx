import React, { useState, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock, 
  Zap,
  CheckCircle2,
  AlertTriangle,
  Info,
  Send,
  Sparkles,
  BarChart3,
  Calendar
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Alert, AlertDescription } from '../ui/alert';
import { Sparkline } from '../ui/sparkline';
import { useDataStore } from '../../hooks/useSimpleDataStore';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { useEdgeFunctions } from '../../hooks/useEdgeFunctions';
import { LearningSection } from '../review/LearningSection';
import { WeeklyStatusGenerator } from '../review/WeeklyStatusGenerator';

interface DailyReflection {
  wins: string;
  blockers: string;
  changeForTomorrow: string;
  blockerTags: string[];
  date: string;
}

interface EstimateError {
  taskType: string;
  actualVsEstimate: number; // percentage
  weekData: number[]; // 7 days of data for sparkline
}

interface WeeklyBlocker {
  name: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
}

const BLOCKER_TAGS = [
  { id: 'overrun', label: 'Time Overrun', color: 'var(--df-warning)' },
  { id: 'interruption', label: 'Interruption', color: 'var(--df-danger)' },
  { id: 'missing_info', label: 'Missing Info', color: 'var(--df-primary)' },
  { id: 'tech_issues', label: 'Tech Issues', color: 'var(--df-text-muted)' },
  { id: 'external_deps', label: 'External Deps', color: 'var(--df-warning)' },
  { id: 'unclear_reqs', label: 'Unclear Reqs', color: 'var(--df-primary)' }
];

export function ReviewScreen() {
  const { data } = useDataStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
  const { summarizeReflection } = useEdgeFunctions();
  
  // Reflection form state
  const [reflection, setReflection] = useState<DailyReflection>({
    wins: '',
    blockers: '',
    changeForTomorrow: '',
    blockerTags: [],
    date: new Date().toISOString().split('T')[0]
  });
  
  // Mock data for trends (in real app, this would come from DataStore)
  const estimateErrors: EstimateError[] = [
    {
      taskType: 'Deep Work',
      actualVsEstimate: 115, // 15% over estimate
      weekData: [110, 120, 105, 115, 125, 108, 115]
    },
    {
      taskType: 'Admin',
      actualVsEstimate: 95, // 5% under estimate
      weekData: [98, 92, 100, 95, 90, 97, 95]
    },
    {
      taskType: 'Meetings',
      actualVsEstimate: 103, // 3% over estimate
      weekData: [100, 105, 98, 103, 107, 101, 103]
    }
  ];

  const topBlockers: WeeklyBlocker[] = [
    { name: 'Interruptions', count: 12, trend: 'up' },
    { name: 'Time Overrun', count: 8, trend: 'down' },
    { name: 'Missing Info', count: 5, trend: 'stable' }
  ];

  const handleBlockerTagToggle = (tagId: string) => {
    setReflection(prev => ({
      ...prev,
      blockerTags: prev.blockerTags.includes(tagId)
        ? prev.blockerTags.filter(id => id !== tagId)
        : [...prev.blockerTags, tagId]
    }));
  };

  const handleSubmitReflection = async () => {
    if (!reflection.wins.trim() || !reflection.blockers.trim() || !reflection.changeForTomorrow.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Call edge function to summarize reflection and store in DB
      const result = await summarizeReflection(
        reflection.wins,
        reflection.blockers, 
        reflection.changeForTomorrow
      );

      console.log('Reflection summary:', result.summary);
      console.log('Stored reflection:', result.reflection);

      // Reset form
      setReflection({
        wins: '',
        blockers: '',
        changeForTomorrow: '',
        blockerTags: [],
        date: new Date().toISOString().split('T')[0]
      });

      // Show success feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }

    } catch (error) {
      console.error('Error submitting reflection:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });

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
        <div>
          <h1 
            style={{
              fontSize: 'var(--df-type-title-size)',
              fontWeight: 'var(--df-type-title-weight)',
              color: 'var(--df-text)',
              marginBottom: '2px'
            }}
          >
            Review
          </h1>
          <p 
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)'
            }}
          >
            {formattedDate}
          </p>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTrends(!showTrends)}
          style={{
            borderColor: 'var(--df-border)',
            color: showTrends ? 'var(--df-primary)' : 'var(--df-text)',
            fontSize: 'var(--df-type-caption-size)',
            minHeight: '44px'
          }}
        >
          <BarChart3 size={16} className="mr-2" />
          {showTrends ? 'Daily' : 'Trends'}
        </Button>
      </div>

      {/* Content */}
      <div 
        className="flex-1 overflow-auto px-4 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 24px)' }}
      >
        {!showTrends ? (
          // Daily Reflection View
          <>
            {/* Daily Reflection Form */}
            <section className="mb-6">
              <h2 
                className="mb-4"
                style={{
                  fontSize: 'var(--df-type-subtitle-size)',
                  fontWeight: 'var(--df-type-subtitle-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Daily Reflection
              </h2>

              <div className="space-y-6">
                {/* Wins */}
                <div>
                  <label 
                    className="flex items-center mb-3"
                    style={{
                      fontSize: 'var(--df-type-body-size)',
                      fontWeight: 'var(--df-type-body-weight)',
                      color: 'var(--df-text)'
                    }}
                  >
                    <CheckCircle2 
                      size={20} 
                      style={{ color: 'var(--df-success)', marginRight: 'var(--df-space-8)' }}
                    />
                    What went well today?
                  </label>
                  <Textarea
                    value={reflection.wins}
                    onChange={(e) => setReflection(prev => ({ ...prev, wins: e.target.value }))}
                    placeholder="Share your wins, breakthroughs, or moments of flow..."
                    className="min-h-[80px] resize-none"
                    style={{
                      backgroundColor: 'var(--df-surface)',
                      borderColor: 'var(--df-border)',
                      color: 'var(--df-text)',
                      fontSize: 'var(--df-type-body-size)',
                      borderRadius: 'var(--df-radius-sm)'
                    }}
                  />
                </div>

                {/* Blockers */}
                <div>
                  <label 
                    className="flex items-center mb-3"
                    style={{
                      fontSize: 'var(--df-type-body-size)',
                      fontWeight: 'var(--df-type-body-weight)',
                      color: 'var(--df-text)'
                    }}
                  >
                    <AlertTriangle 
                      size={20} 
                      style={{ color: 'var(--df-warning)', marginRight: 'var(--df-space-8)' }}
                    />
                    What blocked or slowed you down?
                  </label>
                  <Textarea
                    value={reflection.blockers}
                    onChange={(e) => setReflection(prev => ({ ...prev, blockers: e.target.value }))}
                    placeholder="Describe the challenges, interruptions, or obstacles you faced..."
                    className="min-h-[80px] resize-none"
                    style={{
                      backgroundColor: 'var(--df-surface)',
                      borderColor: 'var(--df-border)',
                      color: 'var(--df-text)',
                      fontSize: 'var(--df-type-body-size)',
                      borderRadius: 'var(--df-radius-sm)'
                    }}
                  />
                  
                  {/* Quick Blocker Tags */}
                  <div className="mt-3">
                    <p 
                      className="mb-2"
                      style={{
                        fontSize: 'var(--df-type-caption-size)',
                        color: 'var(--df-text-muted)'
                      }}
                    >
                      Quick tags:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {BLOCKER_TAGS.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant={reflection.blockerTags.includes(tag.id) ? "default" : "outline"}
                          className="cursor-pointer transition-colors"
                          style={{
                            borderColor: reflection.blockerTags.includes(tag.id) ? tag.color : 'var(--df-border)',
                            backgroundColor: reflection.blockerTags.includes(tag.id) ? tag.color : 'transparent',
                            color: reflection.blockerTags.includes(tag.id) ? 'var(--df-primary-contrast)' : tag.color,
                            fontSize: 'var(--df-type-caption-size)',
                            minHeight: '32px'
                          }}
                          onClick={() => handleBlockerTagToggle(tag.id)}
                        >
                          {tag.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Change for Tomorrow */}
                <div>
                  <label 
                    className="flex items-center mb-3"
                    style={{
                      fontSize: 'var(--df-type-body-size)',
                      fontWeight: 'var(--df-type-body-weight)',
                      color: 'var(--df-text)'
                    }}
                  >
                    <Sparkles 
                      size={20} 
                      style={{ color: 'var(--df-primary)', marginRight: 'var(--df-space-8)' }}
                    />
                    What will you change tomorrow?
                  </label>
                  <Textarea
                    value={reflection.changeForTomorrow}
                    onChange={(e) => setReflection(prev => ({ ...prev, changeForTomorrow: e.target.value }))}
                    placeholder="Identify one specific adjustment to make tomorrow better..."
                    className="min-h-[80px] resize-none"
                    style={{
                      backgroundColor: 'var(--df-surface)',
                      borderColor: 'var(--df-border)',
                      color: 'var(--df-text)',
                      fontSize: 'var(--df-type-body-size)',
                      borderRadius: 'var(--df-radius-sm)'
                    }}
                  />
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleSubmitReflection}
                  disabled={isSubmitting || !reflection.wins.trim() || !reflection.blockers.trim() || !reflection.changeForTomorrow.trim()}
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
                  {isSubmitting ? (
                    'Processing...'
                  ) : (
                    <>
                      <Send size={16} className="mr-2" />
                      Complete Reflection
                    </>
                  )}
                </Button>
              </div>
            </section>

            {/* Helper Note */}
            <Alert 
              className="mb-6"
              style={{ 
                borderColor: 'var(--df-primary)', 
                backgroundColor: 'rgba(37, 99, 235, 0.1)'
              }}
            >
              <Info size={16} style={{ color: 'var(--df-primary)' }} />
              <AlertDescription style={{ color: 'var(--df-primary)' }}>
                Your reflection will be summarized using AI and logged to your learning history.
              </AlertDescription>
            </Alert>

            {/* Today's Summary */}
            <TodaySummaryCard />
          </>
        ) : (
          // Trends View
          <>
            {/* Weekly Status Generator */}
            <WeeklyStatusGenerator />

            <Separator className="mb-6" style={{ backgroundColor: 'var(--df-border)' }} />

            {/* Estimate Accuracy Trends */}
            <section className="mb-6">
              <h2 
                className="mb-4"
                style={{
                  fontSize: 'var(--df-type-subtitle-size)',
                  fontWeight: 'var(--df-type-subtitle-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Estimate Accuracy by Task Type
              </h2>
              
              <div className="space-y-3">
                {estimateErrors.map((error) => (
                  <EstimateErrorCard key={error.taskType} error={error} />
                ))}
              </div>
            </section>

            <Separator className="mb-6" style={{ backgroundColor: 'var(--df-border)' }} />

            {/* Top Blockers This Week */}
            <section className="mb-6">
              <h2 
                className="mb-4"
                style={{
                  fontSize: 'var(--df-type-subtitle-size)',
                  fontWeight: 'var(--df-type-subtitle-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Top 3 Blockers This Week
              </h2>
              
              <div className="space-y-3">
                {topBlockers.map((blocker, index) => (
                  <TopBlockerCard key={blocker.name} blocker={blocker} rank={index + 1} />
                ))}
              </div>
            </section>

            <Separator className="mb-6" style={{ backgroundColor: 'var(--df-border)' }} />

            {/* Learning Section */}
            <LearningSection 
              onApplyDefaults={(category, multiplier) => {
                console.log(`Applied ${multiplier}x multiplier as default for ${category}`);
                // In real app, this would update user preferences in DataStore
              }} 
            />

            <Separator className="mb-6" style={{ backgroundColor: 'var(--df-border)' }} />

            {/* Weekly Summary */}
            <WeeklySummaryCard />
          </>
        )}
      </div>
    </div>
  );
}

// Today's Summary Component
function TodaySummaryCard() {
  return (
    <Card 
      className="p-4"
      style={{
        backgroundColor: 'var(--df-surface-alt)',
        borderColor: 'var(--df-border)',
        borderRadius: 'var(--df-radius-md)',
        boxShadow: 'var(--df-shadow-sm)'
      }}
    >
      <h3 
        className="mb-3"
        style={{
          fontSize: 'var(--df-type-body-size)',
          fontWeight: 'var(--df-type-body-weight)',
          color: 'var(--df-text)'
        }}
      >
        Today at a Glance
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <div 
            style={{
              fontSize: 'var(--df-type-title-size)',
              fontWeight: 'var(--df-type-title-weight)',
              color: 'var(--df-success)'
            }}
          >
            3/4
          </div>
          <div 
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)'
            }}
          >
            Outcomes
          </div>
        </div>
        
        <div className="text-center">
          <div 
            style={{
              fontSize: 'var(--df-type-title-size)',
              fontWeight: 'var(--df-type-title-weight)',
              color: 'var(--df-primary)'
            }}
          >
            4.2h
          </div>
          <div 
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)'
            }}
          >
            Focus Time
          </div>
        </div>
      </div>
    </Card>
  );
}

// Estimate Error Card Component
interface EstimateErrorCardProps {
  error: EstimateError;
}

function EstimateErrorCard({ error }: EstimateErrorCardProps) {
  const isOverEstimate = error.actualVsEstimate > 100;
  const errorPercentage = Math.abs(error.actualVsEstimate - 100);
  
  return (
    <Card 
      className="p-4"
      style={{
        backgroundColor: 'var(--df-surface)',
        borderColor: 'var(--df-border)',
        borderRadius: 'var(--df-radius-md)',
        boxShadow: 'var(--df-shadow-sm)'
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 
          style={{
            fontSize: 'var(--df-type-body-size)',
            fontWeight: 'var(--df-type-body-weight)',
            color: 'var(--df-text)'
          }}
        >
          {error.taskType}
        </h4>
        
        <div className="text-right">
          <div 
            style={{
              fontSize: 'var(--df-type-body-size)',
              fontWeight: 'var(--df-type-body-weight)',
              color: isOverEstimate ? 'var(--df-warning)' : 'var(--df-success)'
            }}
          >
            {isOverEstimate ? '+' : '-'}{errorPercentage}%
          </div>
          <div 
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)'
            }}
          >
            {isOverEstimate ? 'Over' : 'Under'}
          </div>
        </div>
      </div>
      
      {/* Sparkline Chart */}
      <div className="flex justify-center mt-2">
        <Sparkline 
          data={error.weekData}
          width={120}
          height={32}
          color={isOverEstimate ? 'var(--df-warning)' : 'var(--df-success)'}
          baseline={100}
        />
      </div>
    </Card>
  );
}

// Top Blocker Card Component
interface TopBlockerCardProps {
  blocker: WeeklyBlocker;
  rank: number;
}

function TopBlockerCard({ blocker, rank }: TopBlockerCardProps) {
  const getTrendIcon = () => {
    switch (blocker.trend) {
      case 'up':
        return <TrendingUp size={14} style={{ color: 'var(--df-danger)' }} />;
      case 'down':
        return <TrendingDown size={14} style={{ color: 'var(--df-success)' }} />;
      default:
        return <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--df-text-muted)' }} />;
    }
  };

  return (
    <Card 
      className="p-4"
      style={{
        backgroundColor: 'var(--df-surface)',
        borderColor: 'var(--df-border)',
        borderRadius: 'var(--df-radius-md)',
        boxShadow: 'var(--df-shadow-sm)'
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div 
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: rank === 1 ? 'var(--df-danger)' : rank === 2 ? 'var(--df-warning)' : 'var(--df-primary)',
              color: 'var(--df-primary-contrast)',
              fontSize: 'var(--df-type-caption-size)',
              fontWeight: 'var(--df-type-caption-weight)'
            }}
          >
            {rank}
          </div>
          
          <div>
            <h4 
              style={{
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                color: 'var(--df-text)'
              }}
            >
              {blocker.name}
            </h4>
            <p 
              style={{
                fontSize: 'var(--df-type-caption-size)',
                color: 'var(--df-text-muted)'
              }}
            >
              {blocker.count} occurrences
            </p>
          </div>
        </div>
        
        {getTrendIcon()}
      </div>
    </Card>
  );
}

// Weekly Summary Card Component
function WeeklySummaryCard() {
  return (
    <Card 
      className="p-4"
      style={{
        backgroundColor: 'var(--df-surface-alt)',
        borderColor: 'var(--df-border)',
        borderRadius: 'var(--df-radius-md)',
        boxShadow: 'var(--df-shadow-sm)'
      }}
    >
      <h3 
        className="mb-4"
        style={{
          fontSize: 'var(--df-type-body-size)',
          fontWeight: 'var(--df-type-body-weight)',
          color: 'var(--df-text)'
        }}
      >
        This Week's Performance
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div 
            style={{
              fontSize: 'var(--df-type-title-size)',
              fontWeight: 'var(--df-type-title-weight)',
              color: 'var(--df-text)'
            }}
          >
            85%
          </div>
          <div 
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)'
            }}
          >
            Estimate Accuracy
          </div>
        </div>
        
        <div>
          <div 
            style={{
              fontSize: 'var(--df-type-title-size)',
              fontWeight: 'var(--df-type-title-weight)',
              color: 'var(--df-text)'
            }}
          >
            18.5h
          </div>
          <div 
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)'
            }}
          >
            Deep Work
          </div>
        </div>
      </div>
    </Card>
  );
}