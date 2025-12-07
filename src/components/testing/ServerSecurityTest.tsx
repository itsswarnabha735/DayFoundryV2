import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface SecurityTestResult {
  endpoint: string;
  method: string;
  description: string;
  expectedStatus: number;
  actualStatus?: number;
  passed?: boolean;
  error?: string;
}

export function ServerSecurityTest() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<SecurityTestResult[]>([]);

  const securityTests: Omit<SecurityTestResult, 'actualStatus' | 'passed' | 'error'>[] = [
    {
      endpoint: '/make-server-72dfd380/tasks/list',
      method: 'GET',
      description: 'Tasks endpoint without auth should return 401',
      expectedStatus: 401
    },
    {
      endpoint: '/make-server-72dfd380/schedule/solve',
      method: 'POST',
      description: 'Schedule solver without auth should return 401',
      expectedStatus: 401
    },
    {
      endpoint: '/make-server-72dfd380/calendar/events',
      method: 'GET',
      description: 'Calendar events without auth should return 401',
      expectedStatus: 401
    },
    {
      endpoint: '/make-server-72dfd380/schedule/save',
      method: 'POST',
      description: 'Schedule save without auth should return 401',
      expectedStatus: 401
    }
  ];

  const runSecurityTests = async () => {
    setTesting(true);
    const testResults: SecurityTestResult[] = [];

    for (const test of securityTests) {
      try {
        console.log(`Testing ${test.method} ${test.endpoint}`);
        
        const requestOptions: RequestInit = {
          method: test.method,
          headers: {
            'Content-Type': 'application/json'
            // Intentionally no Authorization header
          }
        };

        // For POST requests, add an empty body
        if (test.method === 'POST') {
          requestOptions.body = JSON.stringify({});
        }

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1${test.endpoint}`,
          requestOptions
        );

        const passed = response.status === test.expectedStatus;
        
        testResults.push({
          ...test,
          actualStatus: response.status,
          passed,
          error: passed ? undefined : `Expected ${test.expectedStatus}, got ${response.status}`
        });

      } catch (error) {
        testResults.push({
          ...test,
          actualStatus: undefined,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setResults(testResults);
    setTesting(false);
  };

  const testJWTValidation = async () => {
    setTesting(true);
    const jwtTests: SecurityTestResult[] = [];

    // Test with invalid JWT tokens
    const invalidTokens = [
      'invalid-jwt',
      'Bearer invalid',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
      ''
    ];

    for (const token of invalidTokens) {
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-72dfd380/tasks/list`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        const passed = response.status === 401 || response.status === 403;
        
        jwtTests.push({
          endpoint: '/tasks/list',
          method: 'GET',
          description: `Invalid JWT: "${token || 'empty'}"`,
          expectedStatus: 401,
          actualStatus: response.status,
          passed,
          error: passed ? undefined : `Expected 401/403, got ${response.status}`
        });

      } catch (error) {
        jwtTests.push({
          endpoint: '/tasks/list',
          method: 'GET',
          description: `Invalid JWT: "${token || 'empty'}"`,
          expectedStatus: 401,
          actualStatus: undefined,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setResults(prev => [...prev, ...jwtTests]);
    setTesting(false);
  };

  const testRLSEnforcement = async () => {
    setTesting(true);
    const rlsTests: SecurityTestResult[] = [];

    // Test with fake user IDs
    const fakeUserIds = [
      'fake-user-123',
      'another-user-456',
      'hacker-attempt-789'
    ];

    for (const fakeUserId of fakeUserIds) {
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-72dfd380/tasks/list`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'X-User-ID': fakeUserId
            }
          }
        );

        let passed = false;
        let error = undefined;

        if (response.ok) {
          const data = await response.json();
          // Should return empty data for non-existent user
          passed = !data.tasks || data.tasks.length === 0;
          error = passed ? undefined : 'RLS may be allowing access to other user data';
        } else {
          // If it returns an error, that's also acceptable
          passed = true;
        }
        
        rlsTests.push({
          endpoint: '/tasks/list',
          method: 'GET',
          description: `RLS test with fake user: ${fakeUserId}`,
          expectedStatus: 200,
          actualStatus: response.status,
          passed,
          error
        });

      } catch (error) {
        rlsTests.push({
          endpoint: '/tasks/list',
          method: 'GET',
          description: `RLS test with fake user: ${fakeUserId}`,
          expectedStatus: 200,
          actualStatus: undefined,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setResults(prev => [...prev, ...rlsTests]);
    setTesting(false);
  };

  const getTestIcon = (result: SecurityTestResult) => {
    if (result.passed === undefined) {
      return <Shield className="w-4 h-4 text-gray-400" />;
    }
    return result.passed 
      ? <CheckCircle className="w-4 h-4 text-green-500" />
      : <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getTestColor = (result: SecurityTestResult) => {
    if (result.passed === undefined) return 'var(--df-text-muted)';
    return result.passed ? 'var(--df-success)' : 'var(--df-danger)';
  };

  const passedCount = results.filter(r => r.passed === true).length;
  const failedCount = results.filter(r => r.passed === false).length;
  const totalCount = results.length;

  return (
    <Card style={{ backgroundColor: 'var(--df-surface)', borderColor: 'var(--df-border)' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ color: 'var(--df-text)' }}>
          <Shield className="w-5 h-5" />
          Server Security Tests
        </CardTitle>
        <div className="flex gap-4 text-sm">
          <span style={{ color: 'var(--df-success)' }}>✓ {passedCount} Passed</span>
          <span style={{ color: 'var(--df-danger)' }}>✗ {failedCount} Failed</span>
          <span style={{ color: 'var(--df-text-muted)' }}>Total: {totalCount}</span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={runSecurityTests}
            disabled={testing}
            size="sm"
            style={{
              backgroundColor: 'var(--df-primary)',
              color: 'var(--df-primary-contrast)'
            }}
          >
            {testing ? 'Testing...' : 'Test Auth Required'}
          </Button>
          
          <Button
            onClick={testJWTValidation}
            disabled={testing}
            size="sm"
            variant="outline"
          >
            Test JWT Validation
          </Button>
          
          <Button
            onClick={testRLSEnforcement}
            disabled={testing}
            size="sm"
            variant="outline"
          >
            Test RLS Enforcement
          </Button>
        </div>

        {!projectId && (
          <Alert style={{ backgroundColor: 'var(--df-surface-alt)', borderColor: 'var(--df-border)' }}>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription style={{ color: 'var(--df-text)' }}>
              Project ID not configured. Security tests may not work properly.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2 max-h-64 overflow-auto">
          {results.map((result, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded border"
              style={{ 
                backgroundColor: 'var(--df-surface-alt)',
                borderColor: 'var(--df-border)'
              }}
            >
              <div className="flex items-center gap-3">
                {getTestIcon(result)}
                <div>
                  <div style={{ 
                    color: 'var(--df-text)',
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)'
                  }}>
                    {result.method} {result.endpoint}
                  </div>
                  <div style={{ 
                    color: 'var(--df-text-muted)',
                    fontSize: 'var(--df-type-caption-size)'
                  }}>
                    {result.description}
                  </div>
                  {result.error && (
                    <div style={{ 
                      color: 'var(--df-danger)',
                      fontSize: 'var(--df-type-caption-size)'
                    }}>
                      {result.error}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <div style={{ 
                  color: getTestColor(result),
                  fontSize: 'var(--df-type-caption-size)',
                  fontWeight: 'var(--df-type-caption-weight)'
                }}>
                  {result.actualStatus !== undefined 
                    ? `${result.actualStatus}` 
                    : 'Pending'
                  }
                </div>
                <div style={{ 
                  color: 'var(--df-text-muted)',
                  fontSize: 'var(--df-type-caption-size)'
                }}>
                  Expected: {result.expectedStatus}
                </div>
              </div>
            </div>
          ))}
        </div>

        {results.length === 0 && !testing && (
          <div className="text-center py-8">
            <Shield className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--df-text-muted)' }} />
            <p style={{ color: 'var(--df-text-muted)' }}>
              Run security tests to verify authentication and RLS enforcement
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}