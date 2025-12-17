import React, { useState, useEffect } from 'react';
import { Copy, Send, Edit3, CheckCircle, Briefcase, Home, Calendar, Target, TrendingUp } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Alert, AlertDescription } from '../ui/alert';
import { useDataStore } from '../../hooks/useSimpleDataStore';
import { useEdgeFunctions } from '../../hooks/useEdgeFunctions';
import { toast } from 'sonner@2.0.3';

interface WeeklyData {
  completedOutcomes: Array<{
    title: string;
    category: 'work' | 'personal' | 'health' | 'learning';
    completedDate: string;
    keySteps: string[];
  }>;
  reflections: Array<{
    date: string;
    wins: string;
    blockers: string;
    improvements: string;
  }>;
  stats: {
    totalOutcomes: number;
    completedOutcomes: number;
    focusHours: number;
    meetingsCount: number;
  };
}

interface GeneratedUpdates {
  work: string;
  personal: string;
}

export function WeeklyStatusGenerator() {
  const { data } = useDataStore();
  const { generateWeeklyStatus } = useEdgeFunctions();
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [generatedUpdates, setGeneratedUpdates] = useState<GeneratedUpdates | null>(null);
  const [editableUpdates, setEditableUpdates] = useState<GeneratedUpdates>({ work: '', personal: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'work' | 'personal'>('work');

  // Get current week date range
  const getWeekRange = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek); // Sunday

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    return {
      start: startOfWeek,
      end: endOfWeek,
      label: `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    };
  };

  const weekRange = getWeekRange();

  // Gather weekly data from real data store
  const gatherWeeklyData = (): WeeklyData => {
    const tasks = data.tasks || [];
    const events = data.events || [];

    // Get completed tasks this week
    const completedTasks = tasks.filter(t => t.completed);

    // Map tasks to outcome format
    const completedOutcomes = completedTasks.map(task => {
      // Determine category based on tags
      let category: 'work' | 'personal' | 'health' | 'learning' = 'work';
      if (task.tags?.some(t => ['personal', 'home', 'family'].includes(t.toLowerCase()))) {
        category = 'personal';
      } else if (task.tags?.some(t => ['health', 'fitness', 'exercise'].includes(t.toLowerCase()))) {
        category = 'health';
      } else if (task.tags?.some(t => ['learning', 'course', 'study'].includes(t.toLowerCase()))) {
        category = 'learning';
      }

      return {
        title: task.title,
        category,
        completedDate: new Date().toISOString().split('T')[0],
        keySteps: task.steps?.map(s => s.text) || []
      };
    });

    // Calculate stats
    const totalTasks = tasks.length;
    const completedCount = completedTasks.length;

    // Estimate focus hours from completed tasks' estimated time
    const focusMinutes = completedTasks.reduce((sum, t) => sum + (t.est_most || 30), 0);
    const focusHours = Math.round(focusMinutes / 60 * 10) / 10;

    // Count events as meetings
    const meetingsCount = events.length;

    return {
      completedOutcomes,
      reflections: [], // Will be populated when we fetch from reflections table in future
      stats: {
        totalOutcomes: totalTasks,
        completedOutcomes: completedCount,
        focusHours,
        meetingsCount
      }
    };
  };

  useEffect(() => {
    // Load weekly data on component mount
    const data = gatherWeeklyData();
    setWeeklyData(data);
  }, []);

  const handleGenerateUpdates = async () => {
    if (!weeklyData) return;

    setIsGenerating(true);

    try {
      // Call edge function to generate updates
      const result = await generateWeeklyStatus(weeklyData);

      const updates = {
        work: result.workUpdate,
        personal: result.personalUpdate
      };

      setGeneratedUpdates(updates);
      setEditableUpdates(updates);

      toast.success('Weekly status updates generated!');
    } catch (error) {
      console.error('Error generating updates:', error);
      toast.error('Failed to generate updates. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };



  const handleCopyToClipboard = async (content: string, type: 'work' | 'personal') => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success(`${type === 'work' ? 'Work' : 'Personal'} update copied to clipboard!`);

      // Haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate([50]);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'work': return <Briefcase size={14} />;
      case 'personal': return <Home size={14} />;
      case 'learning': return <Target size={14} />;
      case 'health': return <TrendingUp size={14} />;
      default: return <CheckCircle size={14} />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'work': return 'var(--df-primary)';
      case 'personal': return 'var(--df-success)';
      case 'learning': return 'var(--df-warning)';
      case 'health': return 'var(--df-danger)';
      default: return 'var(--df-text-muted)';
    }
  };

  if (!weeklyData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Calendar size={48} style={{ color: 'var(--df-text-muted)', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--df-text-muted)', fontSize: 'var(--df-type-body-size)' }}>
            Loading weekly data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2
            style={{
              fontSize: 'var(--df-type-subtitle-size)',
              fontWeight: 'var(--df-type-subtitle-weight)',
              color: 'var(--df-text)'
            }}
          >
            Weekly Status
          </h2>
          <p
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)'
            }}
          >
            {weekRange.label}
          </p>
        </div>

        {!generatedUpdates && (
          <Button
            onClick={handleGenerateUpdates}
            disabled={isGenerating}
            style={{
              backgroundColor: 'var(--df-primary)',
              color: 'var(--df-primary-contrast)',
              borderRadius: 'var(--df-radius-sm)',
              minHeight: '44px'
            }}
          >
            {isGenerating ? (
              'Generating...'
            ) : (
              <>
                <Send size={16} className="mr-2" />
                Generate Updates
              </>
            )}
          </Button>
        )}
      </div>

      {/* Weekly Summary Card */}
      <Card
        className="p-4 mb-4"
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
          Week Summary
        </h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div
              style={{
                fontSize: 'var(--df-type-title-size)',
                fontWeight: 'var(--df-type-title-weight)',
                color: 'var(--df-success)'
              }}
            >
              {weeklyData.stats.completedOutcomes}/{weeklyData.stats.totalOutcomes}
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

          <div>
            <div
              style={{
                fontSize: 'var(--df-type-title-size)',
                fontWeight: 'var(--df-type-title-weight)',
                color: 'var(--df-primary)'
              }}
            >
              {weeklyData.stats.focusHours}h
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

        {/* Completed Outcomes */}
        <div className="space-y-2">
          <h4
            style={{
              fontSize: 'var(--df-type-caption-size)',
              fontWeight: 'var(--df-type-caption-weight)',
              color: 'var(--df-text)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            Completed This Week
          </h4>
          {weeklyData.completedOutcomes.map((outcome, index) => (
            <div key={index} className="flex items-center gap-3">
              <div
                className="flex items-center gap-1"
                style={{ color: getCategoryColor(outcome.category) }}
              >
                {getCategoryIcon(outcome.category)}
              </div>
              <span
                className="flex-1"
                style={{
                  fontSize: 'var(--df-type-caption-size)',
                  color: 'var(--df-text)'
                }}
              >
                {outcome.title}
              </span>
              <Badge
                variant="outline"
                style={{
                  borderColor: getCategoryColor(outcome.category),
                  color: getCategoryColor(outcome.category),
                  fontSize: 'var(--df-type-caption-size)',
                  textTransform: 'capitalize'
                }}
              >
                {outcome.category}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Generated Updates */}
      {generatedUpdates && (
        <>
          {/* Tab Selector */}
          <div
            className="flex rounded-lg p-1 mb-4"
            style={{
              backgroundColor: 'var(--df-surface-alt)',
              border: '1px solid var(--df-border)'
            }}
          >
            <button
              onClick={() => setActiveTab('work')}
              className="flex-1 flex items-center justify-center py-2 px-3 rounded-md transition-colors"
              style={{
                backgroundColor: activeTab === 'work' ? 'var(--df-surface)' : 'transparent',
                color: activeTab === 'work' ? 'var(--df-text)' : 'var(--df-text-muted)',
                fontSize: 'var(--df-type-caption-size)',
                fontWeight: 'var(--df-type-caption-weight)',
                minHeight: '40px',
                boxShadow: activeTab === 'work' ? 'var(--df-shadow-sm)' : 'none'
              }}
            >
              <Briefcase size={16} className="mr-2" />
              Work Update
            </button>
            <button
              onClick={() => setActiveTab('personal')}
              className="flex-1 flex items-center justify-center py-2 px-3 rounded-md transition-colors"
              style={{
                backgroundColor: activeTab === 'personal' ? 'var(--df-surface)' : 'transparent',
                color: activeTab === 'personal' ? 'var(--df-text)' : 'var(--df-text-muted)',
                fontSize: 'var(--df-type-caption-size)',
                fontWeight: 'var(--df-type-caption-weight)',
                minHeight: '40px',
                boxShadow: activeTab === 'personal' ? 'var(--df-shadow-sm)' : 'none'
              }}
            >
              <Home size={16} className="mr-2" />
              Personal Update
            </button>
          </div>

          {/* Update Editor */}
          <Card
            className="p-4"
            style={{
              backgroundColor: 'var(--df-surface)',
              borderColor: 'var(--df-border)',
              borderRadius: 'var(--df-radius-md)',
              boxShadow: 'var(--df-shadow-sm)'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Edit3 size={16} style={{ color: 'var(--df-primary)' }} />
                <h4
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)',
                    color: 'var(--df-text)'
                  }}
                >
                  {activeTab === 'work' ? 'Work Update' : 'Personal Update'}
                </h4>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyToClipboard(editableUpdates[activeTab], activeTab)}
                style={{
                  borderColor: 'var(--df-border)',
                  color: 'var(--df-text)',
                  fontSize: 'var(--df-type-caption-size)',
                  minHeight: '36px'
                }}
              >
                <Copy size={14} className="mr-2" />
                Copy
              </Button>
            </div>

            <Textarea
              value={editableUpdates[activeTab]}
              onChange={(e) => setEditableUpdates(prev => ({
                ...prev,
                [activeTab]: e.target.value
              }))}
              className="min-h-[200px] resize-none font-mono"
              style={{
                backgroundColor: 'var(--df-surface)',
                borderColor: 'var(--df-border)',
                color: 'var(--df-text)',
                fontSize: 'var(--df-type-caption-size)',
                lineHeight: '1.5',
                borderRadius: 'var(--df-radius-sm)'
              }}
              placeholder={`Edit your ${activeTab} update...`}
            />

            <Alert
              className="mt-3"
              style={{
                borderColor: 'var(--df-primary)',
                backgroundColor: 'rgba(37, 99, 235, 0.1)'
              }}
            >
              <CheckCircle size={16} style={{ color: 'var(--df-primary)' }} />
              <AlertDescription style={{ color: 'var(--df-primary)' }}>
                Edit the generated text as needed, then copy to share with your team or family.
              </AlertDescription>
            </Alert>
          </Card>

          {/* Regenerate Options */}
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={handleGenerateUpdates}
              disabled={isGenerating}
              style={{
                borderColor: 'var(--df-border)',
                color: 'var(--df-text)',
                fontSize: 'var(--df-type-caption-size)',
                minHeight: '44px'
              }}
            >
              Regenerate
            </Button>
          </div>
        </>
      )}
    </section>
  );
}