import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Clock,
  Car,
  CheckCircle2,
  X,
  ArrowRight,
  Navigation,
  Plus,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { useDataStore } from '../../hooks/useDataStore';
import { formatTime12Hour } from '../../utils/timeFormat';
import { supabase } from '../../utils/supabase/client';
import { AddErrandForm } from './AddErrandForm';

interface Errand {
  id: string;
  title: string;
  location?: string;
  startTime?: Date;
  endTime?: Date;
  duration: number; // minutes
  coordinates?: { lat: number; lng: number };
  category: 'shopping' | 'appointment' | 'pickup' | 'dropoff' | 'other';
}

interface Meeting {
  id: string;
  title: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  coordinates?: { lat: number; lng: number };
}

interface ErrandBundle {
  id: string;
  anchorMeeting: Meeting;
  errands: Errand[];
  totalTravelTime: number; // minutes
  suggestedStartTime: Date;
  suggestedEndTime: Date;
  estimatedRoute: string[];
  reasoning?: string;
  confidence_score?: number;
}

interface ErrandsPlannerProps {
  onErrandBundleCreated: (bundle: ErrandBundle) => void;
  selectedDate: Date;
}

export function ErrandsPlanner({ onErrandBundleCreated, selectedDate }: ErrandsPlannerProps) {
  const { data } = useDataStore();
  const [errands, setErrands] = useState<Errand[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [suggestions, setSuggestions] = useState<ErrandBundle[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    loadErrandsAndMeetings();
  }, [selectedDate]);

  // Helper: Extract location from task context
  const extractLocationFromContext = (context?: string): string | undefined => {
    if (!context) return undefined;
    const locationMatch = context.match(/location:\s*(.+?)(?:\n|$)/i);
    return locationMatch ? locationMatch[1].trim() : undefined;
  };

  // Helper: Load errand tasks from tasks table
  const loadErrandTasks = async (): Promise<Errand[]> => {
    try {
      // Get start and end of the selected date for filtering
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .filter('tags', 'cs', '["errand"]')  // JSON array format for contains
        .is('deleted_at', null);
      // Removed scheduled_at filter to show ALL errands (scheduled and unscheduled)

      if (error) {
        console.error('Error fetching errand tasks:', error);
        return [];
      }

      // Filter tasks to only include:
      // 1. Unscheduled errands (scheduled_at is null)
      // 2. Errands scheduled for the selected date
      const filteredTasks = tasks?.filter(task => {
        if (!task.scheduled_at) return true; // Include unscheduled

        const scheduledDate = new Date(task.scheduled_at);
        return scheduledDate >= startOfDay && scheduledDate <= endOfDay;
      }) || [];

      return filteredTasks.map(task => {
        const location = extractLocationFromContext(task.context);
        const category = classifyErrandFromTags(task.tags) || 'other';
        const scheduledTime = task.scheduled_at ? new Date(task.scheduled_at) : undefined;

        return {
          id: task.id,
          title: task.title,
          location,
          startTime: scheduledTime,
          endTime: scheduledTime ? new Date(scheduledTime.getTime() + (task.est_most || 30) * 60000) : undefined,
          duration: task.est_most || 30, // Use task estimate or default 30 min
          coordinates: undefined, // Will be resolved by smart-bundler
          category
        };
      });
    } catch (error) {
      console.error('Error loading errand tasks:', error);
      return [];
    }
  };

  // Helper: Classify errand category from tags
  const classifyErrandFromTags = (tags: string[]): Errand['category'] | undefined => {
    if (tags.includes('shopping')) return 'shopping';
    if (tags.includes('appointment')) return 'appointment';
    if (tags.includes('pickup')) return 'pickup';
    if (tags.includes('dropoff')) return 'dropoff';
    return undefined;
  };

  const loadErrandsAndMeetings = async () => {
    setIsLoadingData(true);

    try {
      // Get calendar events for the selected date
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Load calendar events
      let calendarEvents = data.events || [];

      // Filter events for the selected date
      const dayEvents = calendarEvents.filter(event => {
        const eventDate = new Date(event.startTime || event.start_time);
        return eventDate >= startOfDay && eventDate <= endOfDay;
      });

      // Separate errands (personal calendar events) from meetings (work events)
      const calendarBasedErrands: Errand[] = [];
      const extractedMeetings: Meeting[] = [];

      for (const event of dayEvents) {
        const startTime = new Date(event.startTime || event.start_time);
        const endTime = new Date(event.endTime || event.end_time);
        const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

        // Check if this is a personal calendar event or has errand-like characteristics
        const errandCategory = classifyErrand(event.title, event.location);
        const isPersonalEvent = event.calendar_category === 'personal' ||
          event.category === 'personal';
        const isWorkEvent = event.calendar_category === 'work' ||
          event.category === 'work';

        if ((isPersonalEvent && errandCategory !== 'other') ||
          (!isWorkEvent && errandCategory !== 'other')) {
          // Classify as errand if it's personal and has errand characteristics
          calendarBasedErrands.push({
            id: event.id,
            title: event.title,
            location: event.location,
            startTime,
            endTime,
            duration,
            coordinates: await geocodeLocation(event.location),
            category: errandCategory
          });
        } else if (isWorkEvent || (!isPersonalEvent && errandCategory === 'other')) {
          // Classify as meeting if it's work-related or doesn't match errand patterns
          extractedMeetings.push({
            id: event.id,
            title: event.title,
            location: event.location,
            startTime,
            endTime,
            coordinates: await geocodeLocation(event.location)
          });
        }
      }

      // Load errands from tasks table
      const taskBasedErrands = await loadErrandTasks();
      console.log(`Loaded ${taskBasedErrands.length} task-based errands`);

      // Merge calendar-based and task-based errands
      const allErrands = [...calendarBasedErrands, ...taskBasedErrands];
      console.log(`Total errands: ${allErrands.length} (${calendarBasedErrands.length} from calendar, ${taskBasedErrands.length} from tasks)`);

      setErrands(allErrands);
      setMeetings(extractedMeetings);

      // Auto-analyze for bundling opportunities if we have errands
      if (allErrands.length > 0) {
        console.log('Analyzing bundling opportunities...');
        await analyzeBundlingOpportunities(allErrands, extractedMeetings);
      } else {
        setSuggestions([]);
      }

    } catch (error) {
      console.error('Error loading errands and meetings:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const classifyErrand = (title: string, location?: string): Errand['category'] => {
    const titleLower = title.toLowerCase();
    const locationLower = location?.toLowerCase() || '';

    // Shopping patterns
    if (titleLower.includes('grocery') || titleLower.includes('shopping') ||
      titleLower.includes('store') || titleLower.includes('market') ||
      locationLower.includes('mall') || locationLower.includes('store')) {
      return 'shopping';
    }

    // Appointment patterns
    if (titleLower.includes('doctor') || titleLower.includes('dentist') ||
      titleLower.includes('appointment') || titleLower.includes('visit') ||
      titleLower.includes('checkup')) {
      return 'appointment';
    }

    // Pickup patterns
    if (titleLower.includes('pickup') || titleLower.includes('collect') ||
      titleLower.includes('get ') || titleLower.includes('fetch')) {
      return 'pickup';
    }

    // Dropoff patterns
    if (titleLower.includes('drop') || titleLower.includes('deliver') ||
      titleLower.includes('take to')) {
      return 'dropoff';
    }

    return 'other';
  };

  const geocodeLocation = async (location?: string): Promise<{ lat: number; lng: number } | undefined> => {
    if (!location) return undefined;

    // This is a mock implementation. In a real app, you'd use a geocoding service
    // For demo purposes, we'll return mock coordinates based on location keywords
    const mockCoordinates: Record<string, { lat: number; lng: number }> = {
      'whole foods': { lat: 40.7128, lng: -74.0060 },
      'grocery': { lat: 40.7128, lng: -74.0060 },
      'cvs': { lat: 40.7200, lng: -74.0100 },
      'pharmacy': { lat: 40.7200, lng: -74.0100 },
      'mall': { lat: 40.7589, lng: -73.9851 },
      'doctor': { lat: 40.7505, lng: -73.9934 },
      'bank': { lat: 40.7614, lng: -73.9776 },
      'post office': { lat: 40.7527, lng: -73.9772 },
      'downtown office': { lat: 40.7589, lng: -73.9851 },
      'conference room': { lat: 40.7589, lng: -73.9851 },
      'office': { lat: 40.7589, lng: -73.9851 }
    };

    const locationLower = location.toLowerCase();
    for (const [keyword, coords] of Object.entries(mockCoordinates)) {
      if (locationLower.includes(keyword)) {
        return coords;
      }
    }

    // Return a default coordinate with some randomness
    return {
      lat: 40.7128 + (Math.random() - 0.5) * 0.1,
      lng: -74.0060 + (Math.random() - 0.5) * 0.1
    };
  };

  const calculateDistance = (coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): number => {
    // Haversine formula for distance calculation
    const R = 3959; // Earth's radius in miles
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const estimateTravelTime = (distance: number): number => {
    // Estimate travel time based on distance (assumes 25 mph average city driving)
    return Math.ceil(distance * 2.4); // 60 minutes / 25 mph = 2.4 minutes per mile
  };

  const analyzeBundlingOpportunities = async (errandList: Errand[], meetingList: Meeting[]) => {
    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke('smart-bundler', {
        body: {
          date: selectedDate.toISOString(),
          user_location: { lat: 40.7128, lng: -74.0060 }, // Default/Current location
          preferences: {
            transport_mode: 'driving',
            max_stops: 3
          }
        }
      });

      if (error) throw error;

      if (data && data.bundles) {
        // Map backend bundles to frontend ErrandBundle structure
        const mappedBundles: ErrandBundle[] = data.bundles.map((b: any) => ({
          id: b.id || `bundle-${Date.now()}-${Math.random()}`,
          anchorMeeting: b.anchor || {
            id: b.anchor_event_id || 'unknown',
            title: 'Anchor Event',
            startTime: new Date(b.suggested_start_at), // Fallback
            endTime: new Date(b.suggested_end_at) // Fallback
          },
          errands: b.items.map((item: any) => ({
            id: item.id,
            title: item.title,
            location: item.location || item.resolvedLocation?.address,
            startTime: new Date(), // Placeholder
            endTime: new Date(), // Placeholder
            duration: 15, // Default
            category: 'other'
          })),
          totalTravelTime: b.total_duration_min,
          suggestedStartTime: new Date(b.suggested_start_at),
          suggestedEndTime: new Date(b.suggested_end_at),
          estimatedRoute: b.route_sequence,
          reasoning: b.reasoning,
          confidence_score: b.confidence_score
        }));
        setSuggestions(mappedBundles);
      }
    } catch (error) {
      console.error('Error analyzing bundling opportunities:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAcceptBundle = async (bundle: ErrandBundle) => {
    try {
      // Update bundle status to 'accepted'
      const { error: bundleError } = await supabase
        .from('bundle_suggestions')
        .update({ status: 'accepted' })
        .eq('id', bundle.id);

      if (bundleError) {
        console.error('Error updating bundle status:', bundleError);
      }

      // Mark tasks as scheduled
      const taskIds = bundle.errands.map(e => e.id);
      if (taskIds.length > 0) {
        const { error: tasksError } = await supabase
          .from('tasks')
          .update({
            scheduled_at: bundle.suggestedStartTime.toISOString()
          })
          .in('id', taskIds);

        if (tasksError) {
          console.error('Error updating tasks:', tasksError);
        }
      }

      // Call parent callback
      onErrandBundleCreated(bundle);

      // Remove this suggestion from the list
      setSuggestions(prev => prev.filter(s => s.id !== bundle.id));
    } catch (error) {
      console.error('Error accepting bundle:', error);
    }
  };

  const handleRejectBundle = async (bundleId: string) => {
    try {
      // Update bundle status to 'rejected'
      await supabase
        .from('bundle_suggestions')
        .update({ status: 'rejected' })
        .eq('id', bundleId);
    } catch (error) {
      console.error('Error rejecting bundle:', error);
    }

    setSuggestions(prev => prev.filter(s => s.id !== bundleId));
  };

  const getCategoryIcon = (category: Errand['category']) => {
    switch (category) {
      case 'shopping':
        return '🛒';
      case 'appointment':
        return '🏥';
      case 'pickup':
        return '📦';
      case 'dropoff':
        return '📤';
      default:
        return '📍';
    }
  };

  // Using formatTime12Hour from utils/timeFormat
  const formatTime = formatTime12Hour;

  if (isLoadingData) {
    return (
      <Card
        className="p-4"
        style={{
          backgroundColor: 'var(--df-surface)',
          borderColor: 'var(--df-border)',
          borderRadius: 'var(--df-radius-md)'
        }}
      >
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin mr-2">⏳</div>
          <span style={{ color: 'var(--df-text-muted)' }}>Analyzing errands...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Actions Bar */}
      <div className="flex items-center justify-end gap-2">
        <AddErrandForm onErrandAdded={loadErrandsAndMeetings} />

        <Button
          variant="ghost"
          size="sm"
          onClick={loadErrandsAndMeetings}
          disabled={isLoadingData}
          style={{
            color: 'var(--df-text-muted)',
            minHeight: '36px',
            minWidth: '36px'
          }}
        >
          <RefreshCw size={16} className={isLoadingData ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Empty State or Content */}
      {errands.length === 0 ? (
        <Alert style={{ borderColor: 'var(--df-border)', backgroundColor: 'var(--df-surface-alt)' }}>
          <MapPin size={16} style={{ color: 'var(--df-text-muted)' }} />
          <AlertDescription style={{ color: 'var(--df-text-muted)' }}>
            No errands found for today. Add personal calendar events with locations to see bundling suggestions.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Current Errands */}
          <Card
            className="p-4"
            style={{
              backgroundColor: 'var(--df-surface)',
              borderColor: 'var(--df-border)',
              borderRadius: 'var(--df-radius-md)'
            }}
          >
            <h4
              className="mb-3"
              style={{
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                color: 'var(--df-text)'
              }}
            >
              Today's Errands ({errands.length})
            </h4>

            <div className="space-y-2">
              {errands.map((errand) => (
                <div key={errand.id} className="flex items-center gap-3 p-2 rounded"
                  style={{ backgroundColor: 'var(--df-surface-alt)' }}>
                  <span className="text-lg">{getCategoryIcon(errand.category)}</span>
                  <div className="flex-1">
                    <div
                      style={{
                        fontSize: 'var(--df-type-body-size)',
                        color: 'var(--df-text)'
                      }}
                    >
                      {errand.title}
                    </div>
                    {errand.location && (
                      <div
                        className="flex items-center gap-1"
                        style={{
                          fontSize: 'var(--df-type-caption-size)',
                          color: 'var(--df-text-muted)'
                        }}
                      >
                        <MapPin size={12} />
                        {errand.location}
                      </div>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    style={{
                      fontSize: 'var(--df-type-caption-size)',
                      color: 'var(--df-text-muted)'
                    }}
                  >
                    {errand.startTime ? formatTime(errand.startTime) : 'Unscheduled'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Bundling Suggestions */}
          {isAnalyzing ? (
            <Card
              className="p-4"
              style={{
                backgroundColor: 'var(--df-surface)',
                borderColor: 'var(--df-border)',
                borderRadius: 'var(--df-radius-md)'
              }}
            >
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin mr-2">🔄</div>
                <span style={{ color: 'var(--df-text-muted)' }}>Finding bundling opportunities...</span>
              </div>
            </Card>
          ) : suggestions.length > 0 ? (
            <div className="space-y-3">
              <h4
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Smart Bundling Suggestions
              </h4>

              {suggestions.map((bundle) => (
                <ErrandBundleCard
                  key={bundle.id}
                  bundle={bundle}
                  onAccept={() => handleAcceptBundle(bundle)}
                  onReject={() => handleRejectBundle(bundle.id)}
                  formatTime={formatTime}
                />
              ))}
            </div>
          ) : meetings.length > 0 ? (
            <Alert style={{ borderColor: 'var(--df-warning)', backgroundColor: 'rgba(217, 119, 6, 0.1)' }}>
              <AlertCircle size={16} style={{ color: 'var(--df-warning)' }} />
              <AlertDescription style={{ color: 'var(--df-warning)' }}>
                No bundling opportunities found. Errands are too far from your meetings or already optimally scheduled.
              </AlertDescription>
            </Alert>
          ) : null}
        </>
      )}
    </div>
  );
}

// Errand Bundle Card Component
interface ErrandBundleCardProps {
  bundle: ErrandBundle;
  onAccept: () => void;
  onReject: () => void;
  formatTime: (date: Date) => string;
}

function ErrandBundleCard({ bundle, onAccept, onReject, formatTime }: ErrandBundleCardProps) {
  return (
    <Card
      className="p-4"
      style={{
        backgroundColor: 'var(--df-surface)',
        borderColor: 'var(--df-primary)',
        borderRadius: 'var(--df-radius-md)',
        borderWidth: '2px'
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h5
            style={{
              fontSize: 'var(--df-type-body-size)',
              fontWeight: 'var(--df-type-body-weight)',
              color: 'var(--df-text)',
              marginBottom: 'var(--df-space-4)'
            }}
          >
            Bundle {bundle.errands.length} errands after "{bundle.anchorMeeting.title}"
          </h5>
          <div
            className="flex items-center gap-2 mb-2"
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)'
            }}
          >
            <Clock size={12} />
            {formatTime(bundle.suggestedStartTime)} - {formatTime(bundle.suggestedEndTime)}
            <span className="mx-2">•</span>
            <Car size={12} />
            {bundle.totalTravelTime} min travel
          </div>
          {bundle.reasoning && (
            <div
              className="mt-2 p-2 rounded text-sm italic"
              style={{
                backgroundColor: 'var(--df-surface-alt)',
                color: 'var(--df-text-muted)',
                borderLeft: '2px solid var(--df-primary)'
              }}
            >
              "💡 {bundle.reasoning}"
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReject}
            style={{
              minHeight: '36px',
              minWidth: '36px',
              color: 'var(--df-text-muted)'
            }}
          >
            <X size={14} />
          </Button>

          <Button
            size="sm"
            onClick={onAccept}
            style={{
              backgroundColor: 'var(--df-primary)',
              color: 'var(--df-primary-contrast)',
              minHeight: '36px'
            }}
          >
            <Plus size={14} className="mr-1" />
            Add to Schedule
          </Button>
        </div>
      </div>

      {/* Route Preview */}
      <div className="space-y-2">
        <div
          style={{
            fontSize: 'var(--df-type-caption-size)',
            color: 'var(--df-text-muted)',
            marginBottom: 'var(--df-space-8)'
          }}
        >
          Suggested route:
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {bundle.estimatedRoute.map((location, index) => (
            <React.Fragment key={index}>
              <Badge
                variant="outline"
                style={{
                  fontSize: 'var(--df-type-caption-size)',
                  color: 'var(--df-text)',
                  backgroundColor: index === 0 ? 'var(--df-primary)' : 'var(--df-surface-alt)',
                  borderColor: index === 0 ? 'var(--df-primary)' : 'var(--df-border)'
                }}
              >
                {index === 0 ? '📍' : '🎯'} {location}
              </Badge>
              {index < bundle.estimatedRoute.length - 1 && (
                <ArrowRight size={12} style={{ color: 'var(--df-text-muted)' }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </Card>
  );
}