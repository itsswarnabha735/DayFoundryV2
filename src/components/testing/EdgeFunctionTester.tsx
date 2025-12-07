import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { edgeFunctionService } from '../../utils/services/EdgeFunctionService';

interface TestResult {
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  data?: any;
  duration?: number;
}

export function EdgeFunctionTester() {
  const [extractTaskResult, setExtractTaskResult] = useState<TestResult>({ status: 'pending', message: 'Not tested' });
  const [proposeOutcomesResult, setProposeOutcomesResult] = useState<TestResult>({ status: 'pending', message: 'Not tested' });
  const [isRunning, setIsRunning] = useState(false);
  const [testText, setTestText] = useState('Plan marketing strategy for Q1 including content calendar, social media campaigns, and email sequences. Need to coordinate with design team and set up analytics tracking.');

  const testExtractTask = async () => {
    setExtractTaskResult({ status: 'pending', message: 'Testing task extraction...' });
    const startTime = Date.now();
    
    try {
      console.log('Testing extract-task with text:', testText);
      const result = await edgeFunctionService.extractTask(testText);
      const duration = Date.now() - startTime;
      
      console.log('Extract-task test result:', result);
      
      setExtractTaskResult({
        status: 'success',
        message: `Task extracted successfully in ${duration}ms`,
        data: result,
        duration
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Extract-task test error:', error);
      
      setExtractTaskResult({
        status: 'error',
        message: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      });
    }
  };

  const testProposeOutcomes = async () => {
    setProposeOutcomesResult({ status: 'pending', message: 'Testing outcome generation...' });
    const startTime = Date.now();
    
    try {
      const mockTasks = [
        {
          id: 'test-1',
          title: 'Complete project proposal',
          steps: [{ text: 'Research requirements' }, { text: 'Write draft' }, { text: 'Review and finalize' }],
          energy: 'deep',
          est_most: 120,
          deadline: null
        },
        {
          id: 'test-2', 
          title: 'Update team documentation',
          steps: [{ text: 'Audit current docs' }, { text: 'Update outdated sections' }],
          energy: 'shallow',
          est_most: 60,
          deadline: null
        }
      ];
      
      const mockConstraints = {
        work_hours: { start: '09:00', end: '17:00' },
        no_meeting_windows: [],
        break_prefs: { micro_break_every_min: 50 }
      };
      
      console.log('Testing propose-outcomes with tasks:', mockTasks);
      const result = await edgeFunctionService.proposeOutcomes(mockTasks, mockConstraints);
      const duration = Date.now() - startTime;
      
      console.log('Propose-outcomes test result:', result);
      
      setProposeOutcomesResult({
        status: 'success',
        message: `Outcomes generated successfully in ${duration}ms`,
        data: result,
        duration
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Propose-outcomes test error:', error);
      
      setProposeOutcomesResult({
        status: 'error',
        message: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      });
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    await testExtractTask();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause between tests
    await testProposeOutcomes();
    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      pending: 'secondary',
      success: 'default',
      error: 'destructive',
      warning: 'outline'
    } as const;
    
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Edge Function LLM Testing</CardTitle>
          <p className="text-sm text-muted-foreground">
            Test the AI-powered task extraction and outcome generation functions
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Test Content</label>
            <Textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Enter some text to extract a task from..."
              className="min-h-20"
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={runAllTests} 
              disabled={isRunning}
              className="flex-1"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running Tests...
                </>
              ) : (
                'Run All Tests'
              )}
            </Button>
            <Button 
              onClick={testExtractTask} 
              disabled={isRunning}
              variant="outline"
            >
              Test Extract
            </Button>
            <Button 
              onClick={testProposeOutcomes} 
              disabled={isRunning}
              variant="outline"
            >
              Test Outcomes
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Task Extraction</CardTitle>
              <div className="flex items-center gap-2">
                {getStatusIcon(extractTaskResult.status)}
                {getStatusBadge(extractTaskResult.status)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{extractTaskResult.message}</p>
            {extractTaskResult.duration && (
              <p className="text-xs text-muted-foreground">Duration: {extractTaskResult.duration}ms</p>
            )}
            {extractTaskResult.data && (
              <div className="bg-muted rounded p-3">
                <p className="text-sm font-medium mb-2">Extracted Task:</p>
                <div className="text-xs space-y-1">
                  <p><strong>Title:</strong> {extractTaskResult.data.task?.title}</p>
                  <p><strong>Steps:</strong> {extractTaskResult.data.task?.steps?.length || 0} steps</p>
                  <p><strong>Energy:</strong> {extractTaskResult.data.task?.energy || 'not specified'}</p>
                  {extractTaskResult.data.task?.est_range && (
                    <p><strong>Estimate:</strong> {extractTaskResult.data.task.est_range.min}-{extractTaskResult.data.task.est_range.max} min</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Outcome Generation</CardTitle>
              <div className="flex items-center gap-2">
                {getStatusIcon(proposeOutcomesResult.status)}
                {getStatusBadge(proposeOutcomesResult.status)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{proposeOutcomesResult.message}</p>
            {proposeOutcomesResult.duration && (
              <p className="text-xs text-muted-foreground">Duration: {proposeOutcomesResult.duration}ms</p>
            )}
            {proposeOutcomesResult.data && (
              <div className="bg-muted rounded p-3">
                <p className="text-sm font-medium mb-2">Generated Outcomes:</p>
                <div className="text-xs space-y-2">
                  {proposeOutcomesResult.data.outcomes?.map((outcome: any, i: number) => (
                    <div key={i} className="border-l-2 border-primary/20 pl-2">
                      <p><strong>{outcome.title}</strong></p>
                      {outcome.risks?.length > 0 && (
                        <p className="text-muted-foreground">Risks: {outcome.risks.join(', ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Setup Requirements:</strong></p>
            <p>1. GEMINI_API_KEY environment variable must be set</p>
            <p>2. Database RLS policies must be properly configured</p>
            <p>3. Edge functions must be deployed and accessible</p>
            <p>4. Network connectivity to Gemini API required</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}