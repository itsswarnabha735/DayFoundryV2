import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { edgeFunctionService } from '../../utils/services/EdgeFunctionService';

interface TestResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  duration?: number;
}

export function EndpointTester() {
  const [results, setResults] = useState<Record<string, TestResult>>({
    extractTask: { status: 'idle', message: 'Not tested' },
    proposeOutcomes: { status: 'idle', message: 'Not tested' },
    generateWeeklyStatus: { status: 'idle', message: 'Not tested' }
  });

  const updateResult = (endpoint: string, result: TestResult) => {
    setResults(prev => ({ ...prev, [endpoint]: result }));
  };

  const testExtractTask = async () => {
    updateResult('extractTask', { status: 'loading', message: 'Testing...' });
    const startTime = Date.now();
    
    try {
      await edgeFunctionService.extractTask('Write a comprehensive test plan for the new API endpoints including unit tests and integration tests');
      const duration = Date.now() - startTime;
      updateResult('extractTask', {
        status: 'success',
        message: `Task extraction successful`,
        duration
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      updateResult('extractTask', {
        status: 'error',
        message: `Failed: ${error.message}`,
        duration
      });
    }
  };

  const testProposeOutcomes = async () => {
    updateResult('proposeOutcomes', { status: 'loading', message: 'Testing...' });
    const startTime = Date.now();
    
    try {
      const mockTasks = [
        { id: '1', title: 'Complete project documentation', energy: 'deep', est_most: 60 },
        { id: '2', title: 'Review pull requests', energy: 'shallow', est_most: 30 }
      ];
      
      await edgeFunctionService.proposeOutcomes(mockTasks, { work_hours: { start: '09:00', end: '17:00' } });
      const duration = Date.now() - startTime;
      updateResult('proposeOutcomes', {
        status: 'success',
        message: `Outcome generation successful`,
        duration
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      updateResult('proposeOutcomes', {
        status: 'error',
        message: `Failed: ${error.message}`,
        duration
      });
    }
  };

  const testGenerateWeeklyStatus = async () => {
    updateResult('generateWeeklyStatus', { status: 'loading', message: 'Testing...' });
    const startTime = Date.now();
    
    try {
      const mockWeeklyData = {
        completedOutcomes: [
          { title: 'Complete API testing', category: 'work', completedDate: '2024-01-15', keySteps: ['Write tests', 'Run tests', 'Fix issues'] }
        ],
        reflections: [
          { date: '2024-01-15', wins: 'Great progress on testing', blockers: 'None', improvements: 'Better test coverage' }
        ],
        stats: { totalOutcomes: 3, completedOutcomes: 2, focusHours: 6, meetingsCount: 4 }
      };
      
      await edgeFunctionService.callFunction('generate-weekly-status', { weeklyData: mockWeeklyData });
      const duration = Date.now() - startTime;
      updateResult('generateWeeklyStatus', {
        status: 'success',
        message: `Weekly status generation successful`,
        duration
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      updateResult('generateWeeklyStatus', {
        status: 'error',
        message: `Failed: ${error.message}`,
        duration
      });
    }
  };

  const runAllTests = async () => {
    await testExtractTask();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testProposeOutcomes();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testGenerateWeeklyStatus();
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      idle: 'secondary',
      loading: 'secondary',
      success: 'default',
      error: 'destructive'
    } as const;
    
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Edge Function Endpoint Tests</CardTitle>
          <p className="text-sm text-muted-foreground">
            Test all AI-powered endpoints to verify they're working correctly
          </p>
        </CardHeader>
        <CardContent>
          <Button onClick={runAllTests} className="w-full mb-4">
            Run All Tests
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {Object.entries(results).map(([endpoint, result]) => (
          <Card key={endpoint}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{endpoint}</h3>
                <div className="flex items-center gap-2">
                  {getStatusIcon(result.status)}
                  {getStatusBadge(result.status)}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{result.message}</p>
              {result.duration && (
                <p className="text-xs text-muted-foreground mt-1">
                  Duration: {result.duration}ms
                </p>
              )}
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (endpoint === 'extractTask') testExtractTask();
                    else if (endpoint === 'proposeOutcomes') testProposeOutcomes();
                    else if (endpoint === 'generateWeeklyStatus') testGenerateWeeklyStatus();
                  }}
                  disabled={result.status === 'loading'}
                >
                  Test {endpoint}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Fix Applied:</strong></p>
            <p>✅ Updated EdgeFunctionService to call unified server endpoints</p>
            <p>✅ Fixed authentication token retrieval</p>
            <p>✅ Added proper fallback handling</p>
            <p>✅ Updated endpoint mapping for server routes</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}