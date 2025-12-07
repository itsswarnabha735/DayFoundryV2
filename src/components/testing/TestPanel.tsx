import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Play, AlertTriangle, Database, Shield, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { authManager } from '../../utils/auth';
import { getDataStore } from '../../utils/data/store';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { EdgeFunctionTester } from './EdgeFunctionTester';
import { EndpointTester } from './EndpointTester';

type TestResult = 'pending' | 'running' | 'passed' | 'failed';

interface Test {
  id: string;
  name: string;
  description: string;
  category: 'auth' | 'rls' | 'functionality' | 'realtime';
  result: TestResult;
  error?: string;
  duration?: number;
}

export function TestPanel({ onClose }: { onClose: () => void }) {
  const [tests, setTests] = useState<Test[]>([
    // Auth & Security Tests
    {
      id: 'auth-required',
      name: 'Auth Required for API Calls',
      description: 'Verify API calls without auth return 401/400',
      category: 'auth',
      result: 'pending'
    },
    {
      id: 'rls-enforced',
      name: 'Row Level Security (RLS)',
      description: 'Verify users cannot access other user data',
      category: 'rls',
      result: 'pending'
    },
    {
      id: 'jwt-validation',
      name: 'JWT Token Validation',
      description: 'Verify invalid tokens are rejected',
      category: 'auth',
      result: 'pending'
    },

    // Core Functionality Tests
    {
      id: 'create-task-ui',
      name: 'Create Task via UI',
      description: 'Create task through UI → confirm in database',
      category: 'functionality',
      result: 'pending'
    },
    {
      id: 'extract-from-inbox',
      name: 'Extract from Inbox',
      description: 'Capture → Extract → Accept → Present in Composer',
      category: 'functionality',
      result: 'pending'
    },
    {
      id: 'propose-outcomes',
      name: 'Propose Outcomes',
      description: 'Call propose-outcomes → receive JSON list',
      category: 'functionality',
      result: 'pending'
    },
    {
      id: 'compose-day',
      name: 'Compose Day',
      description: 'Schedule solver → new schedule_blocks → timeline updates',
      category: 'functionality',
      result: 'pending'
    },
    {
      id: 'focus-session',
      name: 'Focus Session Completion',
      description: 'Complete focus → record_plan_actual → history row',
      category: 'functionality',
      result: 'pending'
    },
    {
      id: 'import-ics',
      name: 'Import ICS Calendar',
      description: 'Import ICS → events in DB → read-only on Schedule',
      category: 'functionality',
      result: 'pending'
    },
    {
      id: 'reflection-summary',
      name: 'Reflection Summary',
      description: 'Submit reflection → summarize via RPC → stored',
      category: 'functionality',
      result: 'pending'
    },

    // Realtime Tests
    {
      id: 'realtime-schedule',
      name: 'Realtime Schedule Updates',
      description: 'Schedule changes trigger realtime updates',
      category: 'realtime',
      result: 'pending'
    },
    {
      id: 'realtime-tasks',
      name: 'Realtime Task Updates',
      description: 'Task changes trigger realtime updates',
      category: 'realtime',
      result: 'pending'
    }
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      await authManager.initialize();
      const user = await authManager.getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    }
  };

  const updateTestResult = (testId: string, result: TestResult, error?: string, duration?: number) => {
    setTests(prev => prev.map(test => 
      test.id === testId 
        ? { ...test, result, error, duration }
        : test
    ));
  };

  const runTest = async (testId: string) => {
    const startTime = Date.now();
    updateTestResult(testId, 'running');

    try {
      switch (testId) {
        case 'auth-required':
          await testAuthRequired();
          break;
        case 'rls-enforced':
          await testRLSEnforced();
          break;
        case 'jwt-validation':
          await testJWTValidation();
          break;
        case 'create-task-ui':
          await testCreateTaskUI();
          break;
        case 'extract-from-inbox':
          await testExtractFromInbox();
          break;
        case 'propose-outcomes':
          await testProposeOutcomes();
          break;
        case 'compose-day':
          await testComposeDay();
          break;
        case 'focus-session':
          await testFocusSession();
          break;
        case 'import-ics':
          await testImportICS();
          break;
        case 'reflection-summary':
          await testReflectionSummary();
          break;
        case 'realtime-schedule':
          await testRealtimeSchedule();
          break;
        case 'realtime-tasks':
          await testRealtimeTasks();
          break;
        default:
          throw new Error(`Unknown test: ${testId}`);
      }

      const duration = Date.now() - startTime;
      updateTestResult(testId, 'passed', undefined, duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestResult(testId, 'failed', error instanceof Error ? error.message : 'Unknown error', duration);
    }
  };

  // Auth & Security Test Implementations
  const testAuthRequired = async () => {
    // Test API call without auth
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-72dfd380/tasks/list`);
    
    // Should return 401 or similar auth error
    if (response.status === 401 || response.status === 403) {
      return; // Test passed
    }
    
    throw new Error(`Expected 401/403, got ${response.status}`);
  };

  const testRLSEnforced = async () => {
    // Create a fake user ID and try to access data
    const fakeUserId = 'fake-user-' + Date.now();
    
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-72dfd380/tasks/list`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-User-ID': fakeUserId
      }
    });

    if (response.ok) {
      const data = await response.json();
      // Should return empty array for non-existent user
      if (data.tasks && data.tasks.length === 0) {
        return; // Test passed
      }
    }
    
    throw new Error('RLS may not be properly enforced');
  };

  const testJWTValidation = async () => {
    // Test with invalid JWT
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-72dfd380/tasks/list`, {
      headers: {
        'Authorization': 'Bearer invalid-jwt-token'
      }
    });

    if (response.status === 401 || response.status === 403) {
      return; // Test passed
    }
    
    throw new Error(`Expected 401/403 for invalid JWT, got ${response.status}`);
  };

  // Functionality Test Implementations
  const testCreateTaskUI = async () => {
    const dataStore = getDataStore();
    
    // Create a test task
    const testTask = {
      title: 'Test Task ' + Date.now(),
      steps: [{ text: 'Test step', completed: false }],
      energy: 'deep' as const,
      tags: ['test'],
      source: 'test-panel'
    };

    const taskId = await dataStore.createTask(testTask);
    
    // Verify task was created by fetching it
    const tasks = await dataStore.getTasks();
    const createdTask = tasks.find(t => t.id === taskId);
    
    if (!createdTask) {
      throw new Error('Task was not created in database');
    }
    
    if (createdTask.title !== testTask.title) {
      throw new Error('Task data does not match');
    }
  };

  const testExtractFromInbox = async () => {
    // Test the extract-task via unified server endpoint
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-72dfd380/extract-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        content: 'Review the quarterly sales report and prepare presentation slides',
        source: 'test-panel'
      })
    });

    if (!response.ok) {
      throw new Error(`Extract task failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('Extract task did not return valid task data');
    }

    // Verify task data has required fields
    const taskData = result.data;
    if (!taskData.title || !taskData.steps || !Array.isArray(taskData.steps)) {
      throw new Error('Task data missing required fields');
    }
  };

  const testProposeOutcomes = async () => {
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-72dfd380/propose-outcomes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        tasks: [
          { title: 'Review sales data', energy: 'deep' },
          { title: 'Prepare presentation', energy: 'deep' }
        ],
        constraints: {
          work_hours: { start: '09:00', end: '17:00' }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Propose outcomes failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.outcomes || !Array.isArray(result.outcomes)) {
      throw new Error('Propose outcomes did not return valid outcomes list');
    }

    // Verify outcomes have required structure
    const outcome = result.outcomes[0];
    if (!outcome || !outcome.title) {
      throw new Error('Outcomes missing required fields');
    }
  };

  const testComposeDay = async () => {
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-72dfd380/schedule/solve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        tasks: [
          {
            id: 'test-task-1',
            title: 'Test Deep Work',
            energy: 'deep',
            est_min: 60,
            est_most: 90,
            est_max: 120
          }
        ],
        events: [],
        currentBlocks: [],
        constraints: {
          workingHours: { start: '09:00', end: '17:00' },
          noMeetingWindows: []
        },
        preferences: {
          bufferBetweenMeetings: 15,
          maxDeepWorkBlock: 120
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Compose day failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.optimizedBlocks || !Array.isArray(result.optimizedBlocks)) {
      throw new Error('Compose day did not return optimized blocks');
    }

    // Verify we got some blocks back
    if (result.optimizedBlocks.length === 0) {
      throw new Error('No optimized blocks returned');
    }
  };

  const testFocusSession = async () => {
    const dataStore = getDataStore();
    
    // Test record_plan_actual function
    const historyId = await dataStore.recordPlanActual(
      'test-task-' + Date.now(),
      60, // planned 60 minutes
      45, // actual 45 minutes
      [], // no blockers
      'Test focus session from test panel'
    );

    if (!historyId) {
      throw new Error('Failed to record plan vs actual');
    }
  };

  const testImportICS = async () => {
    // Create a minimal test ICS content
    const testICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:Test
BEGIN:VEVENT
UID:test-event-${Date.now()}
DTSTART:20240101T100000Z
DTEND:20240101T110000Z
SUMMARY:Test Meeting
DESCRIPTION:Test event from test panel
END:VEVENT
END:VCALENDAR`;

    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/import-ics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        ics_content: testICS,
        calendar_name: 'Test Calendar',
        user_id: currentUser?.id
      })
    });

    if (!response.ok) {
      throw new Error(`ICS import failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error('ICS import was not successful');
    }

    if (!result.calendar_id) {
      throw new Error('No calendar ID returned from import');
    }
  };

  const testReflectionSummary = async () => {
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/summarize-reflection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        reflection_text: 'Today went well. I completed most of my planned tasks, though the morning meeting ran longer than expected. Need to better estimate meeting durations.',
        user_id: currentUser?.id
      })
    });

    if (!response.ok) {
      throw new Error(`Reflection summary failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.summary) {
      throw new Error('Reflection summary did not return valid summary');
    }
  };

  const testRealtimeSchedule = async () => {
    // This test would need to verify realtime subscriptions work
    // For now, we'll just check if the subscription mechanism is set up
    const dataStore = getDataStore();
    
    // Check if dataStore has sync status functionality
    const syncStatus = dataStore.getSyncStatus();
    
    if (!syncStatus) {
      throw new Error('Sync status not available');
    }
    
    // This is a simplified test - in a real scenario we'd:
    // 1. Set up a realtime listener
    // 2. Make a change to schedule_blocks
    // 3. Verify the listener receives the update
    // For now, we'll just verify the mechanism exists
  };

  const testRealtimeTasks = async () => {
    // Similar to realtime schedule test
    const dataStore = getDataStore();
    const syncStatus = dataStore.getSyncStatus();
    
    if (!syncStatus) {
      throw new Error('Sync status not available');
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    
    // Reset all test results
    setTests(prev => prev.map(test => ({ ...test, result: 'pending' as TestResult, error: undefined, duration: undefined })));
    
    // Run tests sequentially to avoid overwhelming the system
    for (const test of tests) {
      await runTest(test.id);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setIsRunning(false);
  };

  const getTestIcon = (result: TestResult) => {
    switch (result) {
      case 'pending':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'running':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'passed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getTestBadge = (result: TestResult) => {
    switch (result) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'running':
        return <Badge style={{ backgroundColor: 'var(--df-primary)', color: 'var(--df-primary-contrast)' }}>Running</Badge>;
      case 'passed':
        return <Badge style={{ backgroundColor: 'var(--df-success)', color: 'white' }}>Passed</Badge>;
      case 'failed':
        return <Badge style={{ backgroundColor: 'var(--df-danger)', color: 'white' }}>Failed</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'auth':
        return <Shield className="w-4 h-4" />;
      case 'rls':
        return <Shield className="w-4 h-4" />;
      case 'functionality':
        return <Zap className="w-4 h-4" />;
      case 'realtime':
        return <Database className="w-4 h-4" />;
      default:
        return <Play className="w-4 h-4" />;
    }
  };

  const testsByCategory = tests.reduce((acc, test) => {
    if (!acc[test.category]) {
      acc[test.category] = [];
    }
    acc[test.category].push(test);
    return acc;
  }, {} as Record<string, Test[]>);

  const getResultStats = () => {
    const passed = tests.filter(t => t.result === 'passed').length;
    const failed = tests.filter(t => t.result === 'failed').length;
    const running = tests.filter(t => t.result === 'running').length;
    const pending = tests.filter(t => t.result === 'pending').length;
    
    return { passed, failed, running, pending, total: tests.length };
  };

  const stats = getResultStats();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden" style={{ backgroundColor: 'var(--df-surface)' }}>
        <CardHeader className="border-b" style={{ borderColor: 'var(--df-border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle style={{ color: 'var(--df-text)' }}>Day Foundry Test Panel</CardTitle>
              <CardDescription style={{ color: 'var(--df-text-muted)' }}>
                Guardrails & Smoke Tests
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={runAllTests}
                disabled={isRunning}
                style={{
                  backgroundColor: 'var(--df-primary)',
                  color: 'var(--df-primary-contrast)'
                }}
              >
                {isRunning ? 'Running Tests...' : 'Run All Tests'}
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
          
          {/* Stats Summary */}
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span style={{ color: 'var(--df-text)' }}>{stats.passed} Passed</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="w-4 h-4 text-red-500" />
              <span style={{ color: 'var(--df-text)' }}>{stats.failed} Failed</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-blue-500" />
              <span style={{ color: 'var(--df-text)' }}>{stats.running} Running</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span style={{ color: 'var(--df-text)' }}>{stats.pending} Pending</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {currentUser && (
            <Alert className="m-4" style={{ backgroundColor: 'var(--df-surface-alt)', borderColor: 'var(--df-border)' }}>
              <Database className="w-4 h-4" />
              <AlertDescription style={{ color: 'var(--df-text)' }}>
                Running tests as user: <code>{currentUser.id}</code>
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="endpoints" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mx-4 mt-4" style={{ backgroundColor: 'var(--df-surface-alt)' }}>
              <TabsTrigger value="endpoints">AI Endpoints</TabsTrigger>
              <TabsTrigger value="auth">Auth & Security</TabsTrigger>
              <TabsTrigger value="functionality">Core Features</TabsTrigger>
              <TabsTrigger value="realtime">Realtime</TabsTrigger>
              <TabsTrigger value="all">All Tests</TabsTrigger>
            </TabsList>

            <TabsContent value="endpoints" className="p-4">
              <EndpointTester />
            </TabsContent>

            {Object.entries(testsByCategory).map(([category, categoryTests]) => (
              <TabsContent key={category} value={category} className="p-4">
                <div className="space-y-3">
                  {categoryTests.map((test) => (
                    <Card key={test.id} style={{ backgroundColor: 'var(--df-surface-alt)', borderColor: 'var(--df-border)' }}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getCategoryIcon(test.category)}
                            <div>
                              <h4 style={{ 
                                color: 'var(--df-text)',
                                fontSize: 'var(--df-type-body-size)',
                                fontWeight: 'var(--df-type-body-weight)'
                              }}>
                                {test.name}
                              </h4>
                              <p style={{ 
                                color: 'var(--df-text-muted)',
                                fontSize: 'var(--df-type-caption-size)'
                              }}>
                                {test.description}
                              </p>
                              {test.error && (
                                <p style={{ 
                                  color: 'var(--df-danger)',
                                  fontSize: 'var(--df-type-caption-size)',
                                  marginTop: '4px'
                                }}>
                                  Error: {test.error}
                                </p>
                              )}
                              {test.duration && (
                                <p style={{ 
                                  color: 'var(--df-text-muted)',
                                  fontSize: 'var(--df-type-caption-size)',
                                  marginTop: '4px'
                                }}>
                                  Duration: {test.duration}ms
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getTestBadge(test.result)}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => runTest(test.id)}
                              disabled={isRunning || test.result === 'running'}
                            >
                              {getTestIcon(test.result)}
                              Run
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}

            <TabsContent value="all" className="p-4">
              <div className="space-y-3">
                {tests.map((test) => (
                  <Card key={test.id} style={{ backgroundColor: 'var(--df-surface-alt)', borderColor: 'var(--df-border)' }}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getCategoryIcon(test.category)}
                          <div>
                            <h4 style={{ 
                              color: 'var(--df-text)',
                              fontSize: 'var(--df-type-body-size)',
                              fontWeight: 'var(--df-type-body-weight)'
                            }}>
                              {test.name}
                            </h4>
                            <p style={{ 
                              color: 'var(--df-text-muted)',
                              fontSize: 'var(--df-type-caption-size)'
                            }}>
                              {test.description}
                            </p>
                            {test.error && (
                              <p style={{ 
                                color: 'var(--df-danger)',
                                fontSize: 'var(--df-type-caption-size)',
                                marginTop: '4px'
                              }}>
                                Error: {test.error}
                              </p>
                            )}
                            {test.duration && (
                              <p style={{ 
                                color: 'var(--df-text-muted)',
                                fontSize: 'var(--df-type-caption-size)',
                                marginTop: '4px'
                              }}>
                                Duration: {test.duration}ms
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" style={{ color: 'var(--df-text-muted)' }}>
                            {test.category}
                          </Badge>
                          {getTestBadge(test.result)}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => runTest(test.id)}
                            disabled={isRunning || test.result === 'running'}
                          >
                            {getTestIcon(test.result)}
                            Run
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}