import React, { useState } from 'react';
import { Play, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { getDataStore } from '../../utils/data/store';
import { authManager } from '../../utils/auth';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface QuickTest {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  error?: string;
  duration?: number;
}

export function QuickTestRunner() {
  const [tests, setTests] = useState<QuickTest[]>([
    {
      id: 'auth-init',
      name: 'Auth Manager Init',
      description: 'Initialize auth and get current user',
      status: 'pending'
    },
    {
      id: 'datastore-health',
      name: 'DataStore Health',
      description: 'Verify DataStore is healthy and connected',
      status: 'pending'
    },
    {
      id: 'task-crud',
      name: 'Task CRUD',
      description: 'Create, read, update task via DataStore',
      status: 'pending'
    },
    {
      id: 'extract-api',
      name: 'Extract Task API',
      description: 'Call extract-task edge function',
      status: 'pending'
    },
    {
      id: 'propose-outcomes',
      name: 'Propose Outcomes API',
      description: 'Call propose-outcomes edge function',
      status: 'pending'
    }
  ]);

  const [isRunning, setIsRunning] = useState(false);

  const updateTest = (id: string, updates: Partial<QuickTest>) => {
    setTests(prev => prev.map(test => 
      test.id === id ? { ...test, ...updates } : test
    ));
  };

  const runTest = async (testId: string) => {
    const startTime = Date.now();
    updateTest(testId, { status: 'running' });

    try {
      switch (testId) {
        case 'auth-init':
          await testAuthInit();
          break;
        case 'datastore-health':
          await testDataStoreHealth();
          break;
        case 'task-crud':
          await testTaskCRUD();
          break;
        case 'extract-api':
          await testExtractAPI();
          break;
        case 'propose-outcomes':
          await testProposeOutcomes();
          break;
        default:
          throw new Error(`Unknown test: ${testId}`);
      }

      const duration = Date.now() - startTime;
      updateTest(testId, { status: 'passed', duration, error: undefined });
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTest(testId, { 
        status: 'failed', 
        duration, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  };

  const testAuthInit = async () => {
    await authManager.initialize();
    const user = await authManager.getCurrentUser();
    if (!user) {
      throw new Error('No user returned from AuthManager');
    }
    if (!user.id) {
      throw new Error('User has no ID');
    }
  };

  const testDataStoreHealth = async () => {
    const dataStore = getDataStore();
    if (!dataStore.isHealthy()) {
      throw new Error('DataStore health check failed');
    }
    
    const syncStatus = dataStore.getSyncStatus();
    if (!syncStatus) {
      throw new Error('No sync status available');
    }
  };

  const testTaskCRUD = async () => {
    const dataStore = getDataStore();
    
    // Create test task
    const testTask = {
      title: 'Quick Test Task ' + Date.now(),
      steps: [{ text: 'Test step', completed: false }],
      energy: 'deep' as const,
      tags: ['test'],
      source: 'quick-test'
    };

    const taskId = await dataStore.createTask(testTask);
    if (!taskId) {
      throw new Error('Failed to create task');
    }

    // Read tasks
    const tasks = await dataStore.getTasks();
    const createdTask = tasks.find(t => t.id === taskId);
    if (!createdTask) {
      throw new Error('Created task not found in list');
    }

    // Update task
    await dataStore.updateTask(taskId, { 
      title: 'Updated ' + testTask.title 
    });

    // Verify update
    const updatedTasks = await dataStore.getTasks();
    const updatedTask = updatedTasks.find(t => t.id === taskId);
    if (!updatedTask || !updatedTask.title.startsWith('Updated')) {
      throw new Error('Task update not reflected');
    }

    // Clean up - delete task
    await dataStore.deleteTask(taskId);
  };

  const testExtractAPI = async () => {
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/extract-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        content: 'Write unit tests for the authentication system',
        context: 'Development task from quick test'
      })
    });

    if (!response.ok) {
      throw new Error(`Extract API failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success || !result.task_draft) {
      throw new Error('Extract API did not return valid task draft');
    }

    const draft = result.task_draft;
    if (!draft.title || !draft.steps || !Array.isArray(draft.steps)) {
      throw new Error('Task draft missing required fields');
    }
  };

  const testProposeOutcomes = async () => {
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/propose-outcomes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({
        context: 'Complete development sprint and prepare for demo',
        tasks: [
          { title: 'Finish feature implementation', energy: 'deep' },
          { title: 'Write documentation', energy: 'shallow' },
          { title: 'Prepare demo presentation', energy: 'deep' }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Propose outcomes failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success || !result.outcomes || !Array.isArray(result.outcomes)) {
      throw new Error('Propose outcomes did not return valid outcomes');
    }

    if (result.outcomes.length === 0) {
      throw new Error('No outcomes returned');
    }

    const outcome = result.outcomes[0];
    if (!outcome.title || !outcome.risks) {
      throw new Error('Outcome missing required fields');
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    
    // Reset all tests
    setTests(prev => prev.map(test => ({ 
      ...test, 
      status: 'pending' as const, 
      error: undefined, 
      duration: undefined 
    })));

    // Run tests sequentially
    for (const test of tests) {
      await runTest(test.id);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: QuickTest['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'running':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'passed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: QuickTest['status']) => {
    switch (status) {
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

  const passedCount = tests.filter(t => t.status === 'passed').length;
  const failedCount = tests.filter(t => t.status === 'failed').length;

  return (
    <Card style={{ backgroundColor: 'var(--df-surface)', borderColor: 'var(--df-border)' }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2" style={{ color: 'var(--df-text)' }}>
            <Play className="w-5 h-5" />
            Quick Smoke Tests
          </CardTitle>
          <Button
            onClick={runAllTests}
            disabled={isRunning}
            size="sm"
            style={{
              backgroundColor: 'var(--df-primary)',
              color: 'var(--df-primary-contrast)'
            }}
          >
            {isRunning ? 'Running...' : 'Run All'}
          </Button>
        </div>
        
        <div className="flex gap-4 text-sm">
          <span style={{ color: 'var(--df-success)' }}>✓ {passedCount}</span>
          <span style={{ color: 'var(--df-danger)' }}>✗ {failedCount}</span>
          <span style={{ color: 'var(--df-text-muted)' }}>of {tests.length} tests</span>
        </div>
      </CardHeader>
      
      <CardContent>
        {!projectId && (
          <div className="mb-4 p-3 rounded border" style={{ 
            backgroundColor: 'var(--df-surface-alt)',
            borderColor: 'var(--df-warning)',
            color: 'var(--df-warning)'
          }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Project ID not configured - tests may fail</span>
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          {tests.map((test) => (
            <div
              key={test.id}
              className="flex items-center justify-between p-3 rounded border"
              style={{ 
                backgroundColor: 'var(--df-surface-alt)',
                borderColor: 'var(--df-border)'
              }}
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(test.status)}
                <div>
                  <div style={{ 
                    color: 'var(--df-text)',
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)'
                  }}>
                    {test.name}
                  </div>
                  <div style={{ 
                    color: 'var(--df-text-muted)',
                    fontSize: 'var(--df-type-caption-size)'
                  }}>
                    {test.description}
                  </div>
                  {test.error && (
                    <div style={{ 
                      color: 'var(--df-danger)',
                      fontSize: 'var(--df-type-caption-size)',
                      marginTop: '4px'
                    }}>
                      {test.error}
                    </div>
                  )}
                  {test.duration && (
                    <div style={{ 
                      color: 'var(--df-text-muted)',
                      fontSize: 'var(--df-type-caption-size)',
                      marginTop: '2px'
                    }}>
                      {test.duration}ms
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {getStatusBadge(test.status)}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runTest(test.id)}
                  disabled={isRunning || test.status === 'running'}
                >
                  Run
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}