import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Upload,
  Link2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Trash2,
  Home,
  Car
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useDataStore } from '../../hooks/useSimpleDataStore';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { useEdgeFunctions } from '../../hooks/useEdgeFunctions';

interface CalendarSource {
  id: string;
  name: string;
  type: 'url' | 'file';
  category: 'work' | 'personal' | 'other'; // Add category
  source: string; // URL or filename
  lastRefreshed: Date | null;
  status: 'active' | 'error' | 'syncing';
  eventCount: number;
  errorMessage?: string;
  resourceId?: string;
  channelId?: string;
}

interface CalendarImportProps {
  onClose: () => void;
}

import { supabase } from '../../utils/supabase/client';

export function CalendarImport({ onClose }: CalendarImportProps) {
  const { authManager } = useDataStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importICS } = useEdgeFunctions();

  // Form state
  const [urlInput, setUrlInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<'work' | 'personal' | 'other'>('work');
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Calendar sources state
  const [sources, setSources] = useState<CalendarSource[]>([]);

  // Load calendars on component mount
  useEffect(() => {
    loadCalendars();
  }, []);

  const loadCalendars = async () => {
    setIsLoadingCalendars(true);

    try {
      // Try fetching with event count first
      const { data: calendars, error } = await supabase
        .from('calendar_connections')
        .select('*, calendar_events(count)')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Failed to fetch with count, trying simple fetch:', error);
        throw error; // Throw to trigger fallback in catch block
      }

      // Transform to CalendarSource format
      const transformedSources = (calendars || []).map((cal: any) => ({
        id: cal.id,
        name: cal.name || 'Calendar',
        type: cal.type || 'url',
        category: cal.category || 'work',
        source: cal.ics_url || cal.source || '',
        lastRefreshed: cal.last_synced_at ? new Date(cal.last_synced_at) : null,
        status: cal.status || 'active',
        eventCount: cal.calendar_events?.[0]?.count || 0,
        errorMessage: cal.error_message || undefined,
        resourceId: cal.resource_id,
        channelId: cal.channel_id
      }));

      setSources(transformedSources);
    } catch (error) {
      console.error('Error loading calendars with count:', error);

      // Fallback: Fetch without count
      try {
        const { data: calendars, error: retryError } = await supabase
          .from('calendar_connections')
          .select('*')
          .order('created_at', { ascending: false });

        if (retryError) throw retryError;

        const transformedSources = (calendars || []).map((cal: any) => ({
          id: cal.id,
          name: cal.name || 'Calendar',
          type: cal.type || 'url',
          category: cal.category || 'work',
          source: cal.ics_url || cal.source || '',
          lastRefreshed: cal.last_synced_at ? new Date(cal.last_synced_at) : null,
          status: cal.status || 'active',
          eventCount: 0, // Default to 0 if count fetch fails
          errorMessage: cal.error_message || undefined,
          resourceId: cal.resource_id,
          channelId: cal.channel_id
        }));

        setSources(transformedSources);
      } catch (finalError) {
        console.error('Fatal error loading calendars:', finalError);
      }
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  const handleAddUrl = async () => {
    if (!urlInput.trim() || !nameInput.trim()) return;

    setIsAddingUrl(true);

    try {
      const user = await authManager.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      // First create calendar entry
      const { data: calendar, error } = await supabase
        .from('calendar_connections')
        .insert({
          user_id: user.id,
          name: nameInput.trim(),
          type: 'url',
          category: categoryInput,
          ics_url: urlInput.trim(),
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      // Then import ICS data using the edge function
      // Note: importICS uses the edge function service which handles auth
      const result = await importICS(urlInput.trim(), calendar.id);

      // Add to local state
      const newSource: CalendarSource = {
        id: calendar.id,
        name: nameInput.trim(),
        type: 'url',
        category: categoryInput,
        source: urlInput.trim(),
        lastRefreshed: new Date(),
        status: 'active',
        eventCount: result.imported || 0
      };

      setSources(prev => [newSource, ...prev]);
      setUrlInput('');
      setNameInput('');
      setCategoryInput('work');

    } catch (error) {
      console.error('Error adding calendar URL:', error);

      // Add to local state with error status
      const errorSource: CalendarSource = {
        id: `error-${Date.now()}`,
        name: nameInput.trim(),
        type: 'url',
        category: categoryInput,
        source: urlInput.trim(),
        lastRefreshed: null,
        status: 'error',
        eventCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Import failed'
      };

      setSources(prev => [errorSource, ...prev]);
    } finally {
      setIsAddingUrl(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.name.endsWith('.ics')) {
      return;
    }

    setIsProcessingFile(true);

    try {
      // For file uploads, we'll just use the import-ics function directly if possible
      // But since we need to upload the file content, we might need a different approach
      // For now, let's just log that file upload is not fully implemented without a storage bucket
      console.warn('File upload requires storage bucket setup. Please use URL import for now.');
      alert('Please use URL import for now. File upload requires additional setup.');

    } catch (error) {
      console.error('Error importing calendar file:', error);
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRefreshSource = async (sourceId: string) => {
    setSources(prev => prev.map(source =>
      source.id === sourceId
        ? { ...source, status: 'syncing' as const }
        : source
    ));

    try {
      // Get calendar connection from database to check provider
      const { data: calendarConn, error: connError } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('id', sourceId)
        .single();

      if (connError || !calendarConn) throw new Error('Calendar not found');

      let result;

      // Check if it's a Google OAuth calendar or ICS URL
      if (calendarConn.provider === 'google') {
        // Call calendar-webhook for Google OAuth calendars (manual trigger)
        console.log('Syncing Google Calendar via webhook function...');
        const session = await authManager.getSession();

        // We can manually trigger the webhook function to perform a sync
        // We'll pass a special flag or just let it run. 
        // Actually, calendar-webhook expects Google headers. 
        // But we can modify calendar-webhook to also accept a direct POST with connection_id for manual sync.
        // OR, we can just use the existing logic if we send the right body/headers?
        // No, calendar-webhook is designed for Google.

        // Let's try calling it with a custom body that triggers the sync logic.
        // Wait, I should probably update calendar-webhook to handle manual sync requests too.
        // For now, let's point to calendar-webhook and see if we can make it work.

        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/calendar-webhook`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            manual_sync: true,
            calendar_connection_id: sourceId
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Google Calendar sync failed:', response.status, errorText);
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { error: errorText };
          }
          result = errorData;
          console.log('Manual sync result:', result);

          if (result.error) {
            console.error("Sync Error Details:", result.details);
          }

          if (result.eventsSynced !== undefined) {
            console.log(`Synced ${result.eventsSynced} events from Google.`);
          }
        }
      } else {
        // Call import-ics for ICS URL calendars
        const source = sources.find(s => s.id === sourceId);
        if (!source) throw new Error('Calendar not found');
        result = await importICS(source.source, sourceId);
      }

      // Reload calendars from database to get updated counts
      await loadCalendars();

    } catch (error) {
      console.error('Error refreshing calendar:', error);
      setSources(prev => prev.map(source =>
        source.id === sourceId
          ? {
            ...source,
            status: 'error' as const,
            errorMessage: error instanceof Error ? error.message : 'Refresh failed'
          }
          : source
      ));
    }
  };

  const handleRemoveSource = async (sourceId: string) => {
    try {
      const { error } = await supabase
        .from('calendar_connections')
        .delete()
        .eq('id', sourceId);

      if (error) throw error;

      setSources(prev => prev.filter(source => source.id !== sourceId));

    } catch (error) {
      console.error('Error removing calendar source:', error);
      // Show error but don't remove from UI if deletion failed
    }
  };

  const formatLastRefreshed = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusIcon = (status: CalendarSource['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 size={16} style={{ color: 'var(--df-success)' }} />;
      case 'error':
        return <AlertCircle size={16} style={{ color: 'var(--df-danger)' }} />;
      case 'syncing':
        return <RefreshCw size={16} style={{ color: 'var(--df-primary)' }} className="animate-spin" />;
    }
  };

  const getStatusColor = (status: CalendarSource['status']) => {
    switch (status) {
      case 'active':
        return 'var(--df-success)';
      case 'error':
        return 'var(--df-danger)';
      case 'syncing':
        return 'var(--df-primary)';
    }
  };

  const getCategoryIcon = (category: CalendarSource['category']) => {
    switch (category) {
      case 'work':
        return <Calendar size={14} style={{ color: 'var(--df-primary)' }} />;
      case 'personal':
        return <Home size={14} style={{ color: 'var(--df-warning)' }} />;
      case 'other':
        return <Calendar size={14} style={{ color: 'var(--df-text-muted)' }} />;
    }
  };

  const getCategoryLabel = (category: CalendarSource['category']) => {
    switch (category) {
      case 'work':
        return 'Work';
      case 'personal':
        return 'Personal';
      case 'other':
        return 'Other';
    }
  };

  useEffect(() => {
    // Check for OAuth code in URL
    // const params = new URLSearchParams(window.location.search);
    // const code = params.get('code');
    // const provider = params.get('provider');

    // if (code && provider === 'google') {
    //   handleAuthCallback(code);
    // }
  }, []);

  const handleAuthCallback = async (code: string) => {
    try {
      setLoading(true);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/calendar-auth/callback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });

      if (!response.ok) throw new Error('Failed to exchange token');

      await loadCalendars();
    } catch (error) {
      console.error('Auth callback error:', error);
      setError('Failed to connect Google Calendar');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    setError(null);
    setLoading(true);

    try {
      console.log('handleConnectGoogle: Starting Google Calendar connect flow...');

      // First, check current session
      const { data: currentSessionData } = await supabase.auth.getSession();
      console.log('Current session exists:', !!currentSessionData.session);
      console.log('Current session user:', currentSessionData.session?.user?.id);

      // Refresh session to ensure we have a valid, up-to-date token
      console.log('Attempting to refresh session...');
      const { data: { session }, error } = await supabase.auth.refreshSession();

      console.log('Session refresh result:', {
        hasSession: !!session,
        hasError: !!error,
        errorMessage: error?.message,
        userId: session?.user?.id
      });

      if (error || !session) {
        console.error('No active session for Google Auth', error);
        setError('Please sign in again to connect Google Calendar');
        // Force sign out if session is invalid
        await authManager.signOut();
        return;
      }

      console.log('Session refreshed successfully');
      console.log('Access token (first 30 chars):', session.access_token.substring(0, 30) + '...');
      console.log('Token type:', session.token_type);
      console.log('Expires at:', session.expires_at);

      const returnUrl = window.location.href;
      console.log('Making request to calendar-auth with return URL:', returnUrl);

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/calendar-auth/url?return_url=${encodeURIComponent(returnUrl)}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      console.log('calendar-auth response status:', response.status);

      if (response.ok) {
        const { url } = await response.json();
        console.log('Got OAuth URL, redirecting...');
        window.location.href = url;
      } else {
        const errorText = await response.text();
        console.error('Failed to get auth URL', response.status, errorText);
        setError(`Failed to connect: ${errorText}`);
      }
    } catch (error) {
      console.error('Error connecting Google Calendar:', error);
      setError('Network error while connecting to Google Calendar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 border-b"
        style={{
          borderBottomColor: 'var(--df-border)',
          minHeight: '64px'
        }}
      >
        <Button
          variant="ghost"
          onClick={onClose}
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          <ArrowLeft size={20} />
        </Button>
        <div className="flex items-center gap-3">
          <Calendar size={20} style={{ color: 'var(--df-primary)' }} />
          <h1
            style={{
              fontSize: 'var(--df-type-title-size)',
              fontWeight: 'var(--df-type-title-weight)',
              color: 'var(--df-text)'
            }}
          >
            Calendar Import
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Info */}
        <Alert style={{ borderColor: 'var(--df-primary)', backgroundColor: 'rgba(37, 99, 235, 0.1)' }}>
          <Calendar size={16} style={{ color: 'var(--df-primary)' }} />
          <AlertDescription style={{ color: 'var(--df-primary)' }}>
            Import external calendars to show read-only events on your schedule. Personal calendars can include errands that will be intelligently bundled by location.
          </AlertDescription>
        </Alert>

        {/* Connect Google Calendar */}
        <Card
          className="p-4"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)'
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Calendar size={20} style={{ color: 'var(--df-primary)' }} />
            <h3
              style={{
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                color: 'var(--df-text)'
              }}
            >
              Google Calendar
            </h3>
          </div>

          {error && (
            <Alert style={{ borderColor: 'var(--df-danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)', marginBottom: '1rem' }}>
              <AlertCircle size={16} style={{ color: 'var(--df-danger)' }} />
              <AlertDescription style={{ color: 'var(--df-danger)' }}>
                {error}
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleConnectGoogle}
            disabled={loading}
            className="w-full"
            style={{
              backgroundColor: '#4285F4', // Google Blue
              color: 'white',
              minHeight: '44px',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect Google Calendar'
            )}
          </Button>
        </Card>

        {/* Add Calendar URL */}
        <Card
          className="p-4"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)'
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Link2 size={20} style={{ color: 'var(--df-primary)' }} />
            <h3
              style={{
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                color: 'var(--df-text)'
              }}
            >
              Add Calendar URL
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label
                htmlFor="calendar-name"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  color: 'var(--df-text)',
                  marginBottom: 'var(--df-space-8)'
                }}
              >
                Calendar Name
              </Label>
              <Input
                id="calendar-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g., Work Calendar"
                style={{
                  backgroundColor: 'var(--df-surface)',
                  borderColor: 'var(--df-border)',
                  color: 'var(--df-text)',
                  minHeight: '44px'
                }}
              />
            </div>

            <div>
              <Label
                htmlFor="calendar-category"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  color: 'var(--df-text)',
                  marginBottom: 'var(--df-space-8)'
                }}
              >
                Calendar Type
              </Label>
              <Select value={categoryInput} onValueChange={(value: 'work' | 'personal' | 'other') => setCategoryInput(value)}>
                <SelectTrigger
                  style={{
                    backgroundColor: 'var(--df-surface)',
                    borderColor: 'var(--df-border)',
                    color: 'var(--df-text)',
                    minHeight: '44px'
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      Work Calendar
                    </div>
                  </SelectItem>
                  <SelectItem value="personal">
                    <div className="flex items-center gap-2">
                      <Home size={16} />
                      Personal/Household
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      Other
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {categoryInput === 'personal' && (
                <p
                  style={{
                    fontSize: 'var(--df-type-caption-size)',
                    color: 'var(--df-text-muted)',
                    marginTop: 'var(--df-space-4)'
                  }}
                >
                  Personal calendars enable smart errand bundling by location
                </p>
              )}
            </div>

            <div>
              <Label
                htmlFor="calendar-url"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  color: 'var(--df-text)',
                  marginBottom: 'var(--df-space-8)'
                }}
              >
                ICS URL
              </Label>
              <Input
                id="calendar-url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/..."
                style={{
                  backgroundColor: 'var(--df-surface)',
                  borderColor: 'var(--df-border)',
                  color: 'var(--df-text)',
                  minHeight: '44px'
                }}
              />
            </div>

            <Button
              onClick={handleAddUrl}
              disabled={isAddingUrl || !urlInput.trim() || !nameInput.trim()}
              className="w-full"
              style={{
                backgroundColor: 'var(--df-primary)',
                color: 'var(--df-primary-contrast)',
                minHeight: '44px'
              }}
            >
              {isAddingUrl ? (
                <>
                  <RefreshCw size={16} className="mr-2 animate-spin" />
                  Adding Calendar...
                </>
              ) : (
                <>
                  <Link2 size={16} className="mr-2" />
                  Add Calendar URL
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Upload Calendar File */}
        <Card
          className="p-4"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)'
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Upload size={20} style={{ color: 'var(--df-primary)' }} />
            <h3
              style={{
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                color: 'var(--df-text)'
              }}
            >
              Upload Calendar File
            </h3>
          </div>

          <div className="space-y-4">
            <p
              style={{
                fontSize: 'var(--df-type-caption-size)',
                color: 'var(--df-text-muted)',
                lineHeight: '1.4'
              }}
            >
              Upload an .ics file exported from your calendar application
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".ics"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              variant="outline"
              className="w-full"
              style={{
                borderColor: 'var(--df-border)',
                color: 'var(--df-text)',
                minHeight: '44px'
              }}
            >
              {isProcessingFile ? (
                <>
                  <RefreshCw size={16} className="mr-2 animate-spin" />
                  Processing File...
                </>
              ) : (
                <>
                  <Upload size={16} className="mr-2" />
                  Choose .ics File
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Calendar Sources */}
        {(sources.length > 0 || isLoadingCalendars) && (
          <>
            <Separator style={{ backgroundColor: 'var(--df-border)' }} />

            <div>
              <h3
                className="mb-4"
                style={{
                  fontSize: 'var(--df-type-subtitle-size)',
                  fontWeight: 'var(--df-type-subtitle-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Imported Calendars
              </h3>

              {isLoadingCalendars ? (
                <Card
                  className="p-4"
                  style={{
                    backgroundColor: 'var(--df-surface)',
                    borderColor: 'var(--df-border)',
                    borderRadius: 'var(--df-radius-md)'
                  }}
                >
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw size={20} className="animate-spin mr-2" style={{ color: 'var(--df-primary)' }} />
                    <span style={{ color: 'var(--df-text-muted)' }}>Loading calendars...</span>
                  </div>
                </Card>
              ) : sources.length === 0 ? (
                <Card
                  className="p-4"
                  style={{
                    backgroundColor: 'var(--df-surface-alt)',
                    borderColor: 'var(--df-border)',
                    borderRadius: 'var(--df-radius-md)'
                  }}
                >
                  <div className="flex items-center justify-center py-8">
                    <Calendar size={20} className="mr-2" style={{ color: 'var(--df-text-muted)' }} />
                    <span style={{ color: 'var(--df-text-muted)' }}>No calendars imported yet</span>
                  </div>
                </Card>
              ) : (
                <div className="space-y-3">
                  {sources.map((source) => (
                    <CalendarSourceCard
                      key={source.id}
                      source={source}
                      onRefresh={() => handleRefreshSource(source.id)}
                      onRemove={() => handleRemoveSource(source.id)}
                      formatLastRefreshed={formatLastRefreshed}
                      getStatusIcon={getStatusIcon}
                      getStatusColor={getStatusColor}
                      getCategoryIcon={getCategoryIcon}
                      getCategoryLabel={getCategoryLabel}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// Calendar Source Card Component
interface CalendarSourceCardProps {
  source: CalendarSource;
  onRefresh: () => void;
  onRemove: () => void;
  formatLastRefreshed: (date: Date) => string;
  getStatusIcon: (status: CalendarSource['status']) => React.ReactNode;
  getStatusColor: (status: CalendarSource['status']) => string;
  getCategoryIcon: (category: CalendarSource['category']) => React.ReactNode;
  getCategoryLabel: (category: CalendarSource['category']) => string;
}

function CalendarSourceCard({
  source,
  onRefresh,
  onRemove,
  formatLastRefreshed,
  getStatusIcon,
  getStatusColor,
  getCategoryIcon,
  getCategoryLabel
}: CalendarSourceCardProps) {
  return (
    <Card
      className="p-4"
      style={{
        backgroundColor: 'var(--df-surface)',
        borderColor: 'var(--df-border)',
        borderRadius: 'var(--df-radius-md)'
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4
              style={{
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                color: 'var(--df-text)'
              }}
            >
              {source.name}
            </h4>
            {getStatusIcon(source.status)}
          </div>

          <p
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)',
              marginBottom: 'var(--df-space-8)'
            }}
          >
            {source.type === 'url' ? source.source : `File: ${source.source}`}
          </p>

          {source.errorMessage && (
            <p
              style={{
                fontSize: 'var(--df-type-caption-size)',
                color: 'var(--df-danger)',
                marginBottom: 'var(--df-space-8)'
              }}
            >
              {source.errorMessage}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={source.status === 'syncing'}
            style={{
              minHeight: '36px',
              minWidth: '36px',
              color: 'var(--df-text-muted)'
            }}
          >
            <RefreshCw size={14} className={source.status === 'syncing' ? 'animate-spin' : ''} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            style={{
              minHeight: '36px',
              minWidth: '36px',
              color: 'var(--df-danger)'
            }}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge
            variant="outline"
            style={{
              borderColor: 'var(--df-border)',
              color: 'var(--df-text-muted)',
              fontSize: 'var(--df-type-caption-size)'
            }}
          >
            <div className="flex items-center gap-1">
              {getCategoryIcon(source.category)}
              {getCategoryLabel(source.category)}
            </div>
          </Badge>

          <Badge
            variant="outline"
            style={{
              borderColor: getStatusColor(source.status),
              color: getStatusColor(source.status),
              fontSize: 'var(--df-type-caption-size)'
            }}
          >
            {source.eventCount} events
          </Badge>

          <div className="flex items-center gap-1">
            <Clock size={12} style={{ color: 'var(--df-text-muted)' }} />
            <span
              style={{
                fontSize: 'var(--df-type-caption-size)',
                color: 'var(--df-text-muted)'
              }}
            >
              {source.lastRefreshed ? formatLastRefreshed(source.lastRefreshed) : 'Never synced'}
            </span>
          </div>
        </div>
      </div>


      {/* Debug Info */}
      <div className="mt-3 p-2 bg-gray-50 rounded text-xs font-mono text-gray-500">
        <div className="flex justify-between">
          <span>Res: {source.resourceId ? source.resourceId.slice(0, 10) + '...' : 'N/A'}</span>
          <span>Chan: {source.channelId ? source.channelId.slice(0, 10) + '...' : 'N/A'}</span>
        </div>
        <div className="mt-1 text-[10px] text-gray-400">ID: {source.id}</div>
      </div>
    </Card >
  );
}