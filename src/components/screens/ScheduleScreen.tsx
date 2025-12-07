import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal, Lightbulb, Pin, Calendar, MapPin, Clock, RefreshCw, Users, AlertTriangle, Car, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { MeetingsScreen } from './MeetingsScreen';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { TimelineGrid } from '../timeline/TimelineGrid';
import { TimelineBlock } from '../timeline/TimelineBlock';
import { ResizeConfirmationSheet } from '../timeline/ResizeConfirmationSheet';
import { ExplainPanel } from '../timeline/ExplainPanel';
import { ConflictResolutionModal } from '../schedule/ConflictResolutionModal';
import { useDataStore } from '../../hooks/useDataStore';
import { authManager } from '../../utils/auth';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { supabase } from '../../utils/supabase/client';
import { useEdgeFunctions } from '../../hooks/useEdgeFunctions';
import { createConflictDetector, ConflictDetection } from '../../utils/schedule/conflictDetection';
import { ErrandsPlanner } from '../errands/ErrandsPlanner';
import { AddErrandForm } from '../errands/AddErrandForm';
import { formatTimeFromDate, timeToMinutes, formatRelativeTime } from '../../utils/timeFormat';
import { getDataStore } from '../../utils/data/store';
import { generateId } from '../../utils/uuid';

// Import ErrandBundle type - we need to add this after the ErrandsPlanner component
interface ErrandBundle {
  id: string;
  anchorMeeting: {
    id: string;
    title: string;
    location?: string;
    startTime: Date;
    endTime: Date;
    coordinates?: { lat: number; lng: number };
  };
  errands: Array<{
    id: string;
    title: string;
    location?: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    coordinates?: { lat: number; lng: number };
    category: 'shopping' | 'appointment' | 'pickup' | 'dropoff' | 'other';
  }>;
  totalTravelTime: number;
  suggestedStartTime: Date;
  suggestedEndTime: Date;
  estimatedRoute: string[];
}

export interface ScheduleBlock {
  id: string;
  title: string;
  type: 'deep' | 'meeting' | 'admin' | 'errand' | 'buffer' | 'micro-break' | 'calendar' | 'travel';
  startTime: string; // Format: "HH:MM"
  endTime: string;   // Format: "HH:MM"
  isPinned: boolean;
  location?: string;
  description?: string;
  energy?: 'high' | 'medium' | 'low';
  isReadOnly?: boolean;
  sourceId?: string;
  isAllDay?: boolean;
  isTravel?: boolean;
  travelTime?: number;
  taskId?: string;
  eventId?: string;
  priority?: 'high' | 'medium' | 'low';
}

interface CalendarEvent {
  id: string;
  sourceId: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
  isAllDay: boolean;
  isTravel?: boolean;
  travelTime?: number;
}

interface ScheduleChange {
  type: 'moved' | 'resized' | 'created' | 'removed';
  blockTitle: string;
  oldTime?: string;
  newTime?: string;
  reason: string;
}

export function ScheduleScreen() {
  const { data, refresh } = useDataStore();
  const [user, setUser] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [calendarLastRefreshed, setCalendarLastRefreshed] = useState<Date | null>(null);
  const [showMeetings, setShowMeetings] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);

  const [isComposing, setIsComposing] = useState(false);
  const [showExplainPanel, setShowExplainPanel] = useState(false);
  const [scheduleChanges, setScheduleChanges] = useState<ScheduleChange[]>([]);
  const [resizeData, setResizeData] = useState<{
    blockId: string;
    newStartTime: string;
    newEndTime: string;
  } | null>(null);
  const [conflicts, setConflicts] = useState<ConflictDetection[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [showErrandsSheet, setShowErrandsSheet] = useState(false);
  const [errandsPlannerKey, setErrandsPlannerKey] = useState(0);

  const formattedDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  // Load calendar events and schedule blocks when date changes
  useEffect(() => {
    loadCalendarEvents();
    loadScheduleBlocks();
  }, [selectedDate]);

  // Listen for realtime updates to schedule blocks
  useEffect(() => {
    const handleDataUpdate = (event: CustomEvent) => {
      const { table } = event.detail;

      // Refresh schedule data when schedule_blocks are updated via realtime
      if (table === 'schedule_blocks') {
        loadScheduleBlocks();
      }
    };

    window.addEventListener('data-updated', handleDataUpdate as EventListener);

    return () => {
      window.removeEventListener('data-updated', handleDataUpdate as EventListener);
    };
  }, []);

  const loadCalendarEvents = async () => {
    setIsLoadingCalendar(true);

    try {
      const dataStore = getDataStore();
      const fetchedEvents = await dataStore.getCalendarEvents();

      // Filter for selected date
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const daysEvents = fetchedEvents.filter(event => {
        const eventStart = new Date(event.start_at);
        const eventEnd = new Date(event.end_at);
        return eventStart < endOfDay && eventEnd > startOfDay;
      });

      // Map to CalendarEvent format
      const mappedEvents: CalendarEvent[] = daysEvents.map(event => ({
        id: event.id,
        sourceId: event.calendar_connection_id || 'primary',
        title: event.title,
        start: new Date(event.start_at),
        end: new Date(event.end_at),
        location: event.location,
        description: event.description,
        isAllDay: event.all_day,
        isTravel: false
      }));

      setCalendarEvents(mappedEvents);
      setCalendarLastRefreshed(new Date());

    } catch (error) {
      console.error('Error loading calendar events:', error);
      setCalendarEvents([]);
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  // Convert calendar events to schedule blocks
  const getCalendarBlocks = (): ScheduleBlock[] => {
    return calendarEvents.map(event => ({
      id: `calendar-${event.id}`,
      title: event.title,
      type: event.isTravel ? 'travel' : 'calendar',
      startTime: formatTimeFromDate(new Date(event.start)),
      endTime: formatTimeFromDate(new Date(event.end)),
      isPinned: true, // Calendar events are read-only
      isReadOnly: true,
      location: event.location,
      description: event.description,
      sourceId: event.sourceId,
      isAllDay: event.isAllDay,
      isTravel: event.isTravel,
      travelTime: event.travelTime
    }));
  };

  // Time formatting functions are now imported from utils/timeFormat

  // Combine user blocks with calendar events
  const allBlocks = [...blocks, ...getCalendarBlocks()]
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const checkForConflicts = () => {
    const detector = createConflictDetector({
      workingHours: { start: '09:00', end: '17:00' },
      minimumBufferBetweenMeetings: 15,
      maxDeepWorkDuration: 120,
      considerEnergyLevels: true
    });

    const detectedConflicts = detector.detectConflicts(allBlocks);

    // Only show modal for medium to high severity conflicts
    const significantConflicts = detectedConflicts.filter(
      c => c.severity === 'medium' || c.severity === 'high'
    );

    if (significantConflicts.length > 0) {
      setConflicts(significantConflicts);
      setShowConflictModal(true);
    } else {
      setConflicts([]);
    }
  };



  const addTestEvent = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in first');
        return;
      }

      // Check for existing connection
      const { data: connections } = await supabase
        .from('calendar_connections')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      let connectionId = connections?.[0]?.id;

      if (!connectionId) {
        // Create dummy connection
        const { data: newConn, error } = await supabase
          .from('calendar_connections')
          .insert({
            user_id: user.id,
            provider: 'google',
            external_id: 'test@example.com',
            status: 'active'
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating test connection:', error);
          toast.error('Failed to create test connection');
          return;
        }
        connectionId = newConn.id;
      }

      const now = new Date(selectedDate);
      now.setHours(13, 0, 0, 0); // 1 PM
      const end = new Date(now);
      end.setHours(14, 0, 0, 0); // 2 PM

      const { error: eventError } = await supabase
        .from('calendar_events')
        .insert({
          calendar_connection_id: connectionId,
          user_id: user.id,
          external_id: 'test-event-' + Date.now(),
          title: 'Synced Test Event',
          start_at: now.toISOString(),
          end_at: end.toISOString(),
          all_day: false,
          location: 'Test Location',
          description: 'This is a test event inserted via debug button'
        });

      if (eventError) {
        console.error('Error creating test event:', eventError);
        toast.error('Failed to create test event');
        return;
      }

      toast.success('Test event added! Refreshing...');
      await loadCalendarEvents();
    } catch (error) {
      console.error('Error creating test event:', error);
    }
  };

  // Using formatRelativeTime from utils/timeFormat
  const formatLastRefreshed = formatRelativeTime;



  const loadScheduleBlocks = async () => {
    try {
      const dataStore = getDataStore();
      const fetchedBlocks = await dataStore.getScheduleBlocks();
      console.log('Debug: Fetched blocks:', fetchedBlocks);

      // Filter for selected date using start_time (live DB column name)
      const dateStr = selectedDate.toISOString().split('T')[0];
      const daysBlocks = (fetchedBlocks as any[]).filter(b => {
        // Use start_time (live DB column) or date if available
        const startTime = b.start_time || b.start_at;
        if (!startTime) return false;
        return startTime.startsWith(dateStr);
      });
      console.log('Debug: Blocks for date', dateStr, ':', daysBlocks);

      if (daysBlocks.length > 0) {
        // Map DataStore blocks (ISO strings) to UI blocks (HH:MM)
        const mappedBlocks: ScheduleBlock[] = daysBlocks.map(b => {
          // Use live DB column names with fallback to new column names
          const start = new Date(b.start_time || b.start_at);
          const end = new Date(b.end_time || b.end_at);
          return {
            id: b.id,
            type: b.block_type as BlockType,
            startTime: `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`,
            endTime: `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`,
            isPinned: b.is_pinned ?? b.pinned ?? false,
            title: b.title || b.rationale || '',
            taskId: b.task_id,
            eventId: b.event_id,
            isSynced: true,
            priority: b.task_id ? (data.tasks.find(t => t.id === b.task_id)?.priority as any) : undefined
          };
        });
        setBlocks(mappedBlocks);
      } else {
        // Fallback or empty state
      }
    } catch (error) {
      console.error('Error loading schedule blocks:', error);
    }
  };

  const saveScheduleToDatabase = async (blocksToSave: ScheduleBlock[]) => {
    try {
      const dataStore = getDataStore();
      const dateStr = selectedDate.toISOString().split('T')[0];

      // First, delete existing non-pinned schedule blocks for this date
      // to prevent duplicates when Compose Day is clicked multiple times
      const existingBlocks = await dataStore.getScheduleBlocks();
      const blocksForDate = (existingBlocks as any[]).filter(b => {
        const startTime = b.start_time || b.start_at;
        if (!startTime) return false;
        const isPinned = b.is_pinned ?? b.pinned ?? false;
        // Only delete blocks for this date that are NOT pinned
        return startTime.startsWith(dateStr) && !isPinned;
      });

      // Delete existing non-pinned blocks for this date
      for (const block of blocksForDate) {
        await dataStore.deleteScheduleBlock(block.id);
      }
      console.log(`Deleted ${blocksForDate.length} existing blocks for ${dateStr}`);

      // Map LLM block types to valid database block types
      // Valid types per CHECK constraint: task, meeting, deep_work, admin, buffer, break, errand, travel, focus_session
      const mapBlockType = (uiType: string): string => {
        const typeMap: Record<string, string> = {
          'deep': 'deep_work',
          'deep_work': 'deep_work',
          'meeting': 'meeting',
          'admin': 'admin',
          'buffer': 'buffer',
          'break': 'break',
          'micro_break': 'break',  // Map to valid 'break'
          'errand': 'errand',
          'travel': 'travel',
          'prep': 'task',          // Map to valid 'task'
          'debrief': 'task',       // Map to valid 'task'
          'task': 'task',
          'focus_session': 'focus_session',
        };
        return typeMap[uiType] || 'task'; // Default to task if unknown
      };

      // Map UI blocks to DataStore blocks - using LIVE DATABASE column names
      const mappedBlocks = blocksToSave.map(b => {
        const [startHour, startMin] = b.startTime.split(':').map(Number);
        const [endHour, endMin] = b.endTime.split(':').map(Number);

        const startDate = new Date(selectedDate);
        startDate.setHours(startHour, startMin, 0, 0);

        const endDate = new Date(selectedDate);
        endDate.setHours(endHour, endMin, 0, 0);

        return {
          id: (b.id && b.id.startsWith('temp-')) ? generateId() : b.id,
          date: dateStr,
          block_type: mapBlockType(b.type),
          // Use live database column names (NOT NULL columns)
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          title: b.title,  // NOT NULL in DB
          is_pinned: b.isPinned ?? false,
          task_id: b.taskId || null
        };
      });

      // @ts-ignore - DataStore expects full ScheduleBlock but we are passing partial for creation/upsert
      await dataStore.saveScheduleBlocks(mappedBlocks);
      console.log(`Successfully saved ${blocksToSave.length} schedule blocks`);
    } catch (error) {
      console.error('Error saving schedule:', error);
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const [activeAlertId, setActiveAlertId] = useState<string | undefined>(undefined);

  // Listen for Agentic Alerts (Guardian)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('schedule_alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'schedule_alerts',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New Alert received:', payload);
          const alert = payload.new;
          if (alert.status === 'pending') {
            // Show toast or banner
            // For now, using a simple alert, but ideally use a Toast component
            const shouldHeal = window.confirm(`⚠️ ${alert.type.toUpperCase()}: ${alert.message}\n\nDo you want to negotiate a solution?`);
            if (shouldHeal) {
              setActiveAlertId(alert.id);
              setShowConflictModal(true);
              // Mark alert as viewed/processing?
            } else {
              supabase.from('schedule_alerts').update({ status: 'dismissed' }).eq('id', alert.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleDateSelect = (newDate: Date) => {
    setSelectedDate(newDate);
  };

  const [agentReasoning, setAgentReasoning] = useState<string | undefined>(undefined);

  const handleComposeDay = async (additionalConstraints?: string) => {
    setIsComposing(true);
    setAgentReasoning(undefined);

    try {
      // Check if project ID is configured
      if (!projectId || projectId.trim() === '') {
        console.warn('Project ID not configured, cannot compose schedule');
        alert('Schedule composition requires proper Supabase configuration. Please check your environment setup.');
        return;
      }

      // Call Agentic Scheduler (LLM)
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/compose-day-llm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          date: selectedDate.toISOString(),
          constraints: {
            workingHours: { start: '09:00', end: '17:00' },
            energyProfile: 'morning_person',
            additional: additionalConstraints,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Schedule solve failed:', response.status, errorText);

        if (response.status === 404) {
          alert('Agentic Scheduler service is not available. Please ensure the backend is properly deployed.');
        } else if (response.status >= 500) {
          alert('Server error occurred while composing schedule. Please try again later.');
        } else {
          alert('Failed to compose schedule. Please check your network connection and try again.');
        }
        return;
      }

      const result = await response.json();

      if (result.success && result.optimizedBlocks) {
        // Assign temp IDs to new blocks if missing
        const blocksWithIds = result.optimizedBlocks.map((b: any) => ({
          ...b,
          id: b.id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }));

        // Update blocks with optimized schedule
        setBlocks(blocksWithIds);

        // Check for conflicts in the new schedule
        setTimeout(() => checkForConflicts(), 1000);

        // Save the new schedule to Supabase
        await saveScheduleToDatabase(blocksWithIds);

        // Update UI with reasoning
        setScheduleChanges([]); // Clear old changes format as we use reasoning now
        setAgentReasoning(result.reasoning);
        setShowExplainPanel(true);
      } else {
        console.error('Schedule solve returned error:', result.error);
        alert(`Failed to compose schedule: ${result.error || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('Error composing schedule:', error);
      alert('Network error occurred while composing schedule. Please check your internet connection and try again.');
    } finally {
      setIsComposing(false);
    }
  };

  const handleApplyStrategy = (strategy: any) => {
    if (strategy.newBlocks && strategy.newBlocks.length > 0) {
      // Local strategy (legacy)
      setBlocks(strategy.newBlocks);
      setConflicts([]);
      setScheduleChanges([]);
    } else {
      // Agentic strategy (Phase 3)
      console.log("Applying agent strategy:", strategy);
      handleComposeDay(`Implement strategy: ${strategy.title}. ${strategy.description}`);

      // Mark alert as accepted if we have one
      if (activeAlertId) {
        supabase.from('schedule_alerts').update({ status: 'accepted' }).eq('id', activeAlertId);
        setActiveAlertId(undefined);
      }
    }
  };

  const handleBlockResize = (blockId: string, newStartTime: string, newEndTime: string) => {
    // Show confirmation sheet before applying resize
    setResizeData({ blockId, newStartTime, newEndTime });
  };

  const confirmResize = () => {
    if (!resizeData) return;

    setBlocks(prev => prev.map(block =>
      block.id === resizeData.blockId
        ? { ...block, startTime: resizeData.newStartTime, endTime: resizeData.newEndTime }
        : block
    ));

    setResizeData(null);
  };

  const cancelResize = () => {
    setResizeData(null);
  };

  const togglePin = (blockId: string) => {
    setBlocks(prev => prev.map(block =>
      block.id === blockId
        ? { ...block, isPinned: !block.isPinned }
        : block
    ));
  };

  const getUnscheduledTasks = () => {
    const scheduledTaskIds = blocks
      .filter(b => b.type === 'deep' || b.type === 'admin')
      .map(b => b.id);

    return data.tasks.filter(task =>
      !task.steps.every(step => step.completed) &&
      !scheduledTaskIds.includes(task.id)
    );
  };

  const createTestConflict = () => {
    // Create sample conflicts for testing
    const testConflicts: ConflictDetection[] = [
      {
        conflictType: 'overlap',
        severity: 'high',
        affectedBlocks: [blocks[0], blocks[1]], // Use existing blocks
        description: 'Deep work session overlaps with team standup by 30 minutes',
        estimatedDelay: 30
      },
      {
        conflictType: 'overrun',
        severity: 'medium',
        affectedBlocks: [blocks[4]], // Focused development
        description: 'Extended work session exceeds recommended 2-hour limit',
        estimatedDelay: 0
      }
    ];

    setConflicts(testConflicts);
    setShowConflictModal(true);
  };

  const handleErrandBundleCreated = (bundle: ErrandBundle) => {
    // Create errand blocks from the bundle
    const errandBlocks: ScheduleBlock[] = [];

    // Add travel time before first errand
    if (bundle.totalTravelTime > 0) {
      const travelStartTime = formatTimeFromDate(bundle.suggestedStartTime);
      const firstErrandStartTime = formatTimeFromDate(
        new Date(bundle.suggestedStartTime.getTime() + bundle.totalTravelTime * 60 * 1000)
      );

      errandBlocks.push({
        id: `travel-${bundle.id}`,
        title: `Travel to ${bundle.errands[0]?.location || 'first errand'}`,
        type: 'travel',
        startTime: travelStartTime,
        endTime: firstErrandStartTime,
        isPinned: false,
        location: bundle.anchorMeeting.location,
        description: `Travel from ${bundle.anchorMeeting.title}`
      });
    }

    // Add errand blocks
    let currentTime = new Date(bundle.suggestedStartTime.getTime() + bundle.totalTravelTime * 60 * 1000);

    for (const errand of bundle.errands) {
      const startTime = formatTimeFromDate(currentTime);
      const endTime = formatTimeFromDate(
        new Date(currentTime.getTime() + errand.duration * 60 * 1000)
      );

      errandBlocks.push({
        id: `errand-${errand.id}-${bundle.id}`,
        title: errand.title,
        type: 'errand',
        startTime,
        endTime,
        isPinned: false,
        location: errand.location,
        description: `Bundled with ${bundle.anchorMeeting.title}`
      });

      // Move to next errand time
      currentTime = new Date(currentTime.getTime() + errand.duration * 60 * 1000);
    }

    // Add the new blocks to the schedule
    setBlocks(prev => [...prev, ...errandBlocks]);

    // Save the updated schedule
    saveScheduleToDatabase([...blocks, ...errandBlocks]);
  };

  if (showMeetings) {
    return <MeetingsScreen onBack={() => setShowMeetings(false)} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top App Bar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b gap-4"
        style={{
          backgroundColor: 'var(--df-surface)',
          borderBottomColor: 'var(--df-border)',
          paddingTop: 'calc(env(safe-area-inset-top, 0) + 12px)',
          minHeight: '56px'
        }}
      >
        {/* Left: Title */}
        <div className="flex items-center gap-2 shrink-0">
          <h1 className="text-xl font-bold" style={{ color: 'var(--df-text)' }}>Schedule</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => checkForConflicts()}
            className="h-8 w-8"
            style={{ color: 'var(--df-text-muted)' }}
          >
            <AlertTriangle className="w-4 h-4" />
          </Button>
        </div>

        {/* Center: Date Navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate('prev')}
            className="h-9 w-9"
            style={{ color: 'var(--df-text-muted)' }}
          >
            <ChevronLeft size={18} />
          </Button>

          <span
            className="text-sm font-medium min-w-[120px] text-center"
            style={{ color: 'var(--df-text)' }}
          >
            {formattedDate}
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate('next')}
            className="h-9 w-9"
            style={{ color: 'var(--df-text-muted)' }}
          >
            <ChevronRight size={18} />
          </Button>
        </div>

        {/* Right: Status & Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Calendar Status Chip */}
          <Badge
            variant="outline"
            className="flex items-center gap-1 text-xs px-2 py-1"
            style={{
              borderColor: isLoadingCalendar
                ? 'var(--df-primary)'
                : calendarLastRefreshed
                  ? 'var(--df-success)'
                  : 'var(--df-text-muted)',
              color: isLoadingCalendar
                ? 'var(--df-primary)'
                : calendarLastRefreshed
                  ? 'var(--df-success)'
                  : 'var(--df-text-muted)',
            }}
          >
            {isLoadingCalendar ? (
              <RefreshCw size={10} className="animate-spin" />
            ) : (
              <Calendar size={10} />
            )}
            {isLoadingCalendar
              ? 'Syncing...'
              : calendarLastRefreshed
                ? formatLastRefreshed(calendarLastRefreshed)
                : 'No calendar'
            }
          </Badge>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMeetings(true)}
            className="h-8 w-8"
            style={{ color: 'var(--df-text-muted)' }}
          >
            <Users size={16} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowErrandsSheet(true)}
            className="h-8 w-8"
            style={{ color: showErrandsSheet ? 'var(--df-primary)' : 'var(--df-text-muted)' }}
            title="Errands Planner"
          >
            <Car size={16} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={createTestConflict}
            className="h-8 w-8"
            style={{ color: 'var(--df-warning)' }}
            title="Test Conflict Detection"
          >
            <AlertTriangle size={14} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={addTestEvent}
            className="h-8 w-8"
            style={{ color: 'var(--df-primary)' }}
            title="Add Test Calendar Event"
          >
            <Calendar size={16} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={loadCalendarEvents}
            disabled={isLoadingCalendar}
            className="h-8 w-8"
            style={{ color: 'var(--df-text-muted)' }}
          >
            <MoreHorizontal size={16} />
          </Button>
        </div>
      </div>

      {/* Compose Day Button */}
      <div
        className="px-4 py-3 border-b"
        style={{
          backgroundColor: 'var(--df-surface)',
          borderBottomColor: 'var(--df-border)'
        }}
      >
        <Button
          onClick={() => handleComposeDay()}
          disabled={isComposing}
          className="w-full"
          style={{
            backgroundColor: 'var(--df-primary)',
            color: 'var(--df-primary-contrast)',
            minHeight: '48px',
            fontSize: 'var(--df-type-body-size)',
            fontWeight: 'var(--df-type-body-weight)'
          }}
        >
          {isComposing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Composing Day...
            </>
          ) : (
            <>
              <Calendar size={20} className="mr-2" />
              Compose Day
            </>
          )}
        </Button>

        {getUnscheduledTasks().length > 0 && (
          <Alert className="mt-3" style={{ backgroundColor: 'var(--df-surface-alt)', borderColor: 'var(--df-border)' }}>
            <Lightbulb size={16} />
            <AlertDescription style={{ color: 'var(--df-text-muted)', fontSize: 'var(--df-type-caption-size)' }}>
              {getUnscheduledTasks().length} unscheduled tasks available for planning
            </AlertDescription>
          </Alert>
        )}
      </div>


      {/* Timeline */}
      <div className="flex-1 relative">
        <TimelineGrid
          blocks={allBlocks}
          onBlockResize={handleBlockResize}
          onTogglePin={togglePin}
          conflicts={conflicts}
          startHour={6}
          endHour={22}
        />
      </div>

      {/* Explain Panel */}
      <Sheet open={showExplainPanel} onOpenChange={setShowExplainPanel}>
        <SheetContent side="bottom" className="h-1/2">
          <SheetHeader>
            <SheetTitle style={{ color: 'var(--df-text)', fontSize: 'var(--df-type-title-size)' }}>
              Schedule Changes
            </SheetTitle>
            <SheetDescription style={{ color: 'var(--df-text-muted)' }}>
              Review the optimizations made to your schedule
            </SheetDescription>
          </SheetHeader>
          <ExplainPanel changes={scheduleChanges} reasoning={agentReasoning} />
        </SheetContent>
      </Sheet>

      {/* Resize Confirmation */}
      {resizeData && (
        <ResizeConfirmationSheet
          blockId={resizeData.blockId}
          blockTitle={blocks.find(b => b.id === resizeData.blockId)?.title || ''}
          newStartTime={resizeData.newStartTime}
          newEndTime={resizeData.newEndTime}
          onConfirm={confirmResize}
          onCancel={cancelResize}
        />
      )}

      {/* Conflict Resolution Modal */}
      <ConflictResolutionModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        conflicts={conflicts}
        currentBlocks={allBlocks}
        onApplyStrategy={handleApplyStrategy}
      />

      {/* Errands Planner Sheet */}
      <Sheet open={showErrandsSheet} onOpenChange={setShowErrandsSheet}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Errands Planner</SheetTitle>
            <SheetDescription>
              Bundle your errands with meetings to save time.
            </SheetDescription>
          </SheetHeader>
          <ErrandsPlanner
            key={errandsPlannerKey}
            selectedDate={selectedDate}
            onErrandBundleCreated={(bundle) => {
              handleErrandBundleCreated(bundle);
              setShowErrandsSheet(false);
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}