import React, { useState } from 'react';
import { Database, Trash2, Plus, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { getDataStore } from '../../utils/data/store';

export function TestDataGenerator() {
  const [generating, setGenerating] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');

  const generateSampleTasks = async () => {
    setGenerating(true);
    setLastAction('');
    
    try {
      const dataStore = getDataStore();
      
      const sampleTasks = [
        {
          title: 'Review quarterly sales report',
          steps: [
            { text: 'Download Q3 sales data', completed: false },
            { text: 'Analyze revenue trends', completed: false },
            { text: 'Identify key growth areas', completed: false },
            { text: 'Prepare summary presentation', completed: false }
          ],
          energy: 'deep' as const,
          tags: ['work', 'analysis'],
          source: 'test-data-generator',
          deadline: new Date().toISOString().split('T')[0]
        },
        {
          title: 'Update project documentation',
          steps: [
            { text: 'Review current docs', completed: true },
            { text: 'Update API reference', completed: false },
            { text: 'Add usage examples', completed: false }
          ],
          energy: 'shallow' as const,
          tags: ['documentation', 'development'],
          source: 'test-data-generator'
        },
        {
          title: 'Plan team retrospective meeting',
          steps: [
            { text: 'Send calendar invites', completed: false },
            { text: 'Prepare agenda', completed: false },
            { text: 'Book meeting room', completed: false }
          ],
          energy: 'shallow' as const,
          tags: ['meeting', 'team'],
          source: 'test-data-generator'
        },
        {
          title: 'Research new development tools',
          steps: [
            { text: 'Evaluate testing frameworks', completed: false },
            { text: 'Compare CI/CD options', completed: false },
            { text: 'Create recommendation doc', completed: false }
          ],
          energy: 'deep' as const,
          tags: ['research', 'tools'],
          source: 'test-data-generator'
        }
      ];

      for (const task of sampleTasks) {
        await dataStore.createTask(task);
      }

      setLastAction(`Generated ${sampleTasks.length} sample tasks`);
    } catch (error) {
      setLastAction(`Error generating tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  const generateSampleOutcomes = async () => {
    setGenerating(true);
    setLastAction('');
    
    try {
      const dataStore = getDataStore();
      
      const sampleOutcomes = [
        {
          title: 'Complete Q3 analysis and present findings',
          risks: [
            { 
              text: 'Data might be incomplete or inaccurate', 
              mitigation: 'Verify data sources and cross-check with finance team' 
            },
            { 
              text: 'Presentation might run over time', 
              mitigation: 'Practice timing and prepare executive summary' 
            }
          ]
        },
        {
          title: 'Launch new feature by end of sprint',
          risks: [
            { 
              text: 'Technical debt might slow development', 
              mitigation: 'Allocate time for refactoring critical paths' 
            },
            { 
              text: 'Testing might reveal blocking bugs', 
              mitigation: 'Start testing early and have rollback plan' 
            }
          ]
        },
        {
          title: 'Improve team collaboration processes',
          risks: [
            { 
              text: 'Team might resist process changes', 
              mitigation: 'Involve team in designing new processes' 
            }
          ]
        }
      ];

      for (const outcome of sampleOutcomes) {
        await dataStore.createOutcome(outcome);
      }

      setLastAction(`Generated ${sampleOutcomes.length} sample outcomes`);
    } catch (error) {
      setLastAction(`Error generating outcomes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  const generateSampleEvents = async () => {
    setGenerating(true);
    setLastAction('');
    
    try {
      const dataStore = getDataStore();
      
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const sampleEvents = [
        {
          title: 'Team Standup',
          start_at: new Date(tomorrow.getTime() + 9 * 60 * 60 * 1000).toISOString(), // 9 AM tomorrow
          end_at: new Date(tomorrow.getTime() + 9.5 * 60 * 60 * 1000).toISOString(), // 9:30 AM tomorrow
          location: 'Conference Room A',
          description: 'Daily team synchronization',
          hard: true,
          source: 'test-data-generator'
        },
        {
          title: 'Client Review Meeting',
          start_at: new Date(tomorrow.getTime() + 14 * 60 * 60 * 1000).toISOString(), // 2 PM tomorrow
          end_at: new Date(tomorrow.getTime() + 15 * 60 * 60 * 1000).toISOString(), // 3 PM tomorrow
          location: 'Zoom',
          description: 'Present project progress to client',
          hard: true,
          source: 'test-data-generator'
        },
        {
          title: 'Documentation Review',
          start_at: new Date(tomorrow.getTime() + 16 * 60 * 60 * 1000).toISOString(), // 4 PM tomorrow
          end_at: new Date(tomorrow.getTime() + 17 * 60 * 60 * 1000).toISOString(), // 5 PM tomorrow
          description: 'Review and approve updated documentation',
          hard: false,
          source: 'test-data-generator'
        }
      ];

      for (const event of sampleEvents) {
        await dataStore.createEvent(event);
      }

      setLastAction(`Generated ${sampleEvents.length} sample events`);
    } catch (error) {
      setLastAction(`Error generating events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  const clearTestData = async () => {
    setGenerating(true);
    setLastAction('');
    
    try {
      const dataStore = getDataStore();
      
      // Get all data
      const tasks = await dataStore.getTasks();
      const outcomes = await dataStore.getOutcomes();
      
      // Delete test data (items with source 'test-data-generator')
      const testTasks = tasks.filter(task => task.source === 'test-data-generator');
      const testOutcomes = outcomes.filter(outcome => outcome.title.includes('Q3') || outcome.title.includes('sprint') || outcome.title.includes('collaboration'));
      
      for (const task of testTasks) {
        await dataStore.deleteTask(task.id);
      }

      // Note: We don't have a deleteOutcome method, so outcomes will remain
      // This is fine for testing purposes
      
      setLastAction(`Cleared ${testTasks.length} test tasks`);
    } catch (error) {
      setLastAction(`Error clearing test data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card style={{ backgroundColor: 'var(--df-surface)', borderColor: 'var(--df-border)' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ color: 'var(--df-text)' }}>
          <Database className="w-5 h-5" />
          Test Data Generator
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={generateSampleTasks}
            disabled={generating}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Sample Tasks
          </Button>
          
          <Button
            onClick={generateSampleOutcomes}
            disabled={generating}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Sample Outcomes
          </Button>
          
          <Button
            onClick={generateSampleEvents}
            disabled={generating}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Sample Events
          </Button>
          
          <Button
            onClick={clearTestData}
            disabled={generating}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            style={{ color: 'var(--df-danger)' }}
          >
            <Trash2 className="w-4 h-4" />
            Clear Test Data
          </Button>
        </div>

        {lastAction && (
          <Alert style={{ backgroundColor: 'var(--df-surface-alt)', borderColor: 'var(--df-border)' }}>
            <CheckCircle className="w-4 h-4" />
            <AlertDescription style={{ color: 'var(--df-text)' }}>
              {lastAction}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-sm" style={{ color: 'var(--df-text-muted)' }}>
          <p>Generate sample data for testing core functionality:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Tasks with various completion states and energy levels</li>
            <li>Outcomes with realistic risks and mitigations</li>
            <li>Events scheduled for tomorrow to test calendar integration</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}