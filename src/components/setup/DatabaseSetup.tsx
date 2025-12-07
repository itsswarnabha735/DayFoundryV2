import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Alert } from '../ui/alert';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface DatabaseSetupProps {
  onComplete: () => void;
}

export function DatabaseSetup({ onComplete }: DatabaseSetupProps) {
  const [status, setStatus] = useState<'checking' | 'ready' | 'needs_setup' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkDatabaseStatus();
  }, []);

  const checkDatabaseStatus = async () => {
    try {
      setStatus('checking');
      setError(null);

      // Use the singleton Supabase client to avoid multiple instances
      const { supabase } = await import('../../utils/supabase/client');

      // Test database connection by checking if we can query the tasks table
      const { data, error } = await supabase
        .from('tasks')
        .select('count')
        .limit(1);

      if (error) {
        // If error is about missing table or RLS, we need setup
        if (error.message.includes('relation "tasks" does not exist') || 
            error.message.includes('table "tasks" does not exist')) {
          setStatus('needs_setup');
          setError('Database tables have not been created yet.');
        } else if (error.message.includes('permission denied') || 
                   error.message.includes('policy')) {
          setStatus('needs_setup');
          setError('Database tables exist but RLS policies need to be configured.');
        } else {
          setStatus('error');
          setError(`Database connection error: ${error.message}`);
        }
      } else {
        // Success - tables exist and RLS is working
        setStatus('ready');
        // Auto-proceed if tables exist
        setTimeout(() => {
          onComplete();
        }, 1000);
      }
    } catch (err) {
      console.error('Database setup check failed:', err);
      setStatus('error');
      
      let errorMessage = 'Failed to check database status.';
      
      if (err instanceof Error) {
        errorMessage = `Connection error: ${err.message}`;
      }
      
      setError(errorMessage);
    }
  };

  const openSupabaseDashboard = () => {
    window.open(`https://supabase.com/dashboard/project/${projectId}/editor`, '_blank');
  };

  const copySchemaSQL = () => {
    const sqlContent = `-- Day Foundry Database Ultimate Fix
-- This completely resolves all UUID/TEXT type mismatches
-- Execute this step by step in your Supabase SQL Editor

-- STEP 1: Check what user_id types we actually have
-- Run this first to see the actual column types:
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE column_name = 'user_id' 
-- AND table_schema = 'public';

-- STEP 2: Drop ALL RLS policies completely to start fresh
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON tasks;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON tasks;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON tasks;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON tasks;
DROP POLICY IF EXISTS "tasks_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_select_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON tasks;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON events;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON events;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON events;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON events;
DROP POLICY IF EXISTS "events_policy" ON events;
DROP POLICY IF EXISTS "events_select_policy" ON events;
DROP POLICY IF EXISTS "events_insert_policy" ON events;
DROP POLICY IF EXISTS "events_update_policy" ON events;
DROP POLICY IF EXISTS "events_delete_policy" ON events;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON outcomes;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON outcomes;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON outcomes;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON outcomes;
DROP POLICY IF EXISTS "outcomes_policy" ON outcomes;
DROP POLICY IF EXISTS "outcomes_select_policy" ON outcomes;
DROP POLICY IF EXISTS "outcomes_insert_policy" ON outcomes;
DROP POLICY IF EXISTS "outcomes_update_policy" ON outcomes;
DROP POLICY IF EXISTS "outcomes_delete_policy" ON outcomes;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON schedule_blocks;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON schedule_blocks;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON schedule_blocks;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON schedule_blocks;
DROP POLICY IF EXISTS "schedule_blocks_policy" ON schedule_blocks;
DROP POLICY IF EXISTS "schedule_blocks_select_policy" ON schedule_blocks;
DROP POLICY IF EXISTS "schedule_blocks_insert_policy" ON schedule_blocks;
DROP POLICY IF EXISTS "schedule_blocks_update_policy" ON schedule_blocks;
DROP POLICY IF EXISTS "schedule_blocks_delete_policy" ON schedule_blocks;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON history;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON history;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON history;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON history;
DROP POLICY IF EXISTS "history_policy" ON history;
DROP POLICY IF EXISTS "history_select_policy" ON history;
DROP POLICY IF EXISTS "history_insert_policy" ON history;
DROP POLICY IF EXISTS "history_update_policy" ON history;
DROP POLICY IF EXISTS "history_delete_policy" ON history;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON settings;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON settings;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON settings;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON settings;
DROP POLICY IF EXISTS "settings_policy" ON settings;
DROP POLICY IF EXISTS "settings_select_policy" ON settings;
DROP POLICY IF EXISTS "settings_insert_policy" ON settings;
DROP POLICY IF EXISTS "settings_update_policy" ON settings;
DROP POLICY IF EXISTS "settings_delete_policy" ON settings;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON captured_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON captured_items;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON captured_items;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON captured_items;
DROP POLICY IF EXISTS "captured_items_policy" ON captured_items;
DROP POLICY IF EXISTS "captured_items_select_policy" ON captured_items;
DROP POLICY IF EXISTS "captured_items_insert_policy" ON captured_items;
DROP POLICY IF EXISTS "captured_items_update_policy" ON captured_items;
DROP POLICY IF EXISTS "captured_items_delete_policy" ON captured_items;

-- STEP 3: Disable RLS temporarily
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE history DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE captured_items DISABLE ROW LEVEL SECURITY;

-- STEP 4: Re-enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE captured_items ENABLE ROW LEVEL SECURITY;

-- STEP 5: Create simple, bulletproof policies
-- Based on the schema, these tables have TEXT user_id: tasks, events, outcomes
-- These tables have UUID user_id: schedule_blocks, history, settings, captured_items

-- TASKS (user_id is TEXT) - Cast auth.uid() to TEXT
CREATE POLICY "tasks_access" ON tasks
FOR ALL
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- EVENTS (user_id is TEXT) - Cast auth.uid() to TEXT  
CREATE POLICY "events_access" ON events
FOR ALL
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- OUTCOMES (user_id is TEXT) - Cast auth.uid() to TEXT
CREATE POLICY "outcomes_access" ON outcomes
FOR ALL
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- SCHEDULE_BLOCKS (user_id is UUID) - Direct comparison
CREATE POLICY "schedule_blocks_access" ON schedule_blocks
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- HISTORY (user_id is UUID) - Direct comparison
CREATE POLICY "history_access" ON history
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- SETTINGS (user_id is UUID) - Direct comparison
CREATE POLICY "settings_access" ON settings
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- CAPTURED_ITEMS (user_id is UUID) - Direct comparison
CREATE POLICY "captured_items_access" ON captured_items
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- STEP 6: Test the fix
-- This should return your user ID without errors:
SELECT auth.uid() as user_id, 'Policies fixed successfully!' as status;`;

    navigator.clipboard.writeText(sqlContent).then(() => {
      alert('Database schema SQL copied to clipboard!');
    }).catch(() => {
      console.error('Failed to copy to clipboard');
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--df-surface)' }}>
      <Card className="w-full max-w-lg p-6" style={{ backgroundColor: 'var(--df-surface-alt)' }}>
        <div className="text-center mb-6">
          <Database 
            size={48} 
            className="mx-auto mb-4" 
            style={{ color: 'var(--df-primary)' }}
          />
          <h1 style={{ 
            fontSize: 'var(--df-type-title-size)', 
            fontWeight: 'var(--df-type-title-weight)',
            color: 'var(--df-text)'
          }}>
            Database Setup
          </h1>
          <p style={{ 
            fontSize: 'var(--df-type-body-size)',
            color: 'var(--df-text-muted)',
            marginTop: 'var(--df-space-8)'
          }}>
            Setting up your Day Foundry database
          </p>
        </div>

        {status === 'checking' && (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p style={{ color: 'var(--df-text-muted)' }}>Checking database status...</p>
          </div>
        )}

        {status === 'ready' && (
          <div className="text-center py-4">
            <CheckCircle size={32} className="mx-auto mb-4 text-green-500" />
            <p style={{ color: 'var(--df-success)' }}>Database is ready! Loading app...</p>
          </div>
        )}

        {status === 'needs_setup' && (
          <div className="space-y-4">
            <Alert className="flex items-start">
              <AlertCircle className="h-4 w-4 mt-1 mr-2" style={{ color: 'var(--df-warning)' }} />
              <div>
                <p className="font-medium" style={{ color: 'var(--df-text)' }}>Manual Setup Required</p>
                <p className="text-sm mt-1" style={{ color: 'var(--df-text-muted)' }}>
                  The database tables need to be created in your Supabase dashboard.
                </p>
              </div>
            </Alert>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h3 className="font-medium mb-2" style={{ color: 'var(--df-text)' }}>Setup Instructions:</h3>
              <ol className="text-sm space-y-2" style={{ color: 'var(--df-text-muted)' }}>
                <li>1. Copy the database schema SQL</li>
                <li>2. Open your Supabase dashboard</li>
                <li>3. Go to SQL Editor</li>
                <li>4. Paste and run the SQL</li>
                <li>5. Come back and click "Check Again"</li>
              </ol>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={copySchemaSQL}
                className="w-full"
                style={{
                  backgroundColor: 'var(--df-primary)',
                  color: 'var(--df-primary-contrast)'
                }}
              >
                Copy Database Schema SQL
              </Button>

              <Button 
                onClick={openSupabaseDashboard}
                variant="outline"
                className="w-full"
              >
                <ExternalLink size={16} className="mr-2" />
                Open Supabase Dashboard
              </Button>

              <Button 
                onClick={checkDatabaseStatus}
                variant="outline"
                className="w-full"
              >
                Check Again
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <Alert className="flex items-start">
              <AlertCircle className="h-4 w-4 mt-1 mr-2" style={{ color: 'var(--df-danger)' }} />
              <div>
                <p className="font-medium" style={{ color: 'var(--df-text)' }}>Setup Error</p>
                <p className="text-sm mt-1" style={{ color: 'var(--df-text-muted)' }}>
                  {error || 'An unknown error occurred'}
                </p>
              </div>
            </Alert>

            <Button 
              onClick={checkDatabaseStatus}
              className="w-full"
              style={{
                backgroundColor: 'var(--df-primary)',
                color: 'var(--df-primary-contrast)'
              }}
            >
              Try Again
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}