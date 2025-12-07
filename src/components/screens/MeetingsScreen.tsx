import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Plus, ChevronRight, Video, MapPin, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { MeetingDetail } from '../meetings/MeetingDetail';
import { useDataStore } from '../../hooks/useDataStore';

interface Meeting {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  location?: string;
  isVirtual: boolean;
  agenda?: string;
  linkedDocs: string[];
  priorNotes?: string;
  isCritical: boolean;
  hasPrep: boolean;
}

export function MeetingsScreen({ onBack }: { onBack?: () => void }) {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const { dataStore } = useDataStore();

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    try {
      // For now, load mock data - can be replaced with real data store calls
      console.log('Loading meetings...');
      
      // Add mock data for demo
      const mockMeetings: Meeting[] = [
        {
          id: 'meeting-1',
          title: 'Product Strategy Review',
          startTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
          attendees: ['Sarah Chen', 'Mike Johnson', 'Alex Rivera'],
          location: 'Conference Room A',
          isVirtual: false,
          agenda: 'Q4 roadmap review, resource allocation, competitive analysis',
          linkedDocs: ['https://docs.company.com/q4-roadmap'],
          isCritical: true,
          hasPrep: false
        },
        {
          id: 'meeting-2',
          title: 'Client Check-in: Acme Corp',
          startTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
          endTime: new Date(Date.now() + 4.5 * 60 * 60 * 1000),
          attendees: ['Jennifer Davis', 'Tom Wilson'],
          isVirtual: true,
          agenda: 'Project status update, timeline discussion, next steps',
          linkedDocs: ['https://drive.google.com/project-status'],
          priorNotes: 'Last meeting: Discussed budget concerns, need to address timeline flexibility',
          isCritical: false,
          hasPrep: true
        },
        {
          id: 'meeting-3',
          title: 'Team Standup',
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          endTime: new Date(Date.now() + 24.5 * 60 * 60 * 1000),
          attendees: ['Dev Team'],
          isVirtual: true,
          isCritical: false,
          hasPrep: false
        }
      ];

      const allMeetings = [...meetingData, ...mockMeetings];
      
      // Sort by start time
      allMeetings.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      
      setMeetings(allMeetings);
    } catch (error) {
      console.error('Failed to load meetings:', error);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleAddPrepBlock = async (meeting: Meeting) => {
    // Calculate prep block timing (30 mins before meeting)
    const prepStart = new Date(meeting.startTime.getTime() - 30 * 60 * 1000);
    const prepEnd = new Date(meeting.startTime.getTime());
    
    // Create prep block
    const prepBlock = {
      id: `prep-${meeting.id}`,
      title: `Prep: ${meeting.title}`,
      startTime: prepStart,
      endTime: prepEnd,
      type: 'prep',
      linkedMeetingId: meeting.id
    };
    
    try {
      await dataStore.set(`prep-block-${prepBlock.id}`, prepBlock);
      
      // Update meeting to show it has prep
      const updatedMeeting = { ...meeting, hasPrep: true };
      await dataStore.set(`meeting-${meeting.id}`, updatedMeeting);
      
      // Refresh meetings
      loadMeetings();
    } catch (error) {
      console.error('Failed to add prep block:', error);
    }
  };

  if (selectedMeeting) {
    return (
      <MeetingDetail
        meeting={selectedMeeting}
        onBack={() => setSelectedMeeting(null)}
        onUpdate={loadMeetings}
      />
    );
  }

  const upcomingMeetings = meetings.filter(m => new Date(m.startTime) > new Date());
  const todayMeetings = upcomingMeetings.filter(m => 
    new Date(m.startTime).toDateString() === new Date().toDateString()
  );
  const laterMeetings = upcomingMeetings.filter(m => 
    new Date(m.startTime).toDateString() !== new Date().toDateString()
  );

  return (
    <div 
      className="h-full flex flex-col"
      style={{ 
        backgroundColor: 'var(--df-surface)',
        color: 'var(--df-text)'
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 border-b"
        style={{ 
          borderBottomColor: 'var(--df-border)',
          paddingTop: 'max(var(--df-space-16), env(safe-area-inset-top))'
        }}
      >
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="h-9 w-9 p-0"
              style={{ color: 'var(--df-text)' }}
            >
              <ArrowLeft size={20} />
            </Button>
          )}
          
          <div>
            <h1 
              className="m-0"
              style={{
                fontSize: 'var(--df-type-title-size)',
                fontWeight: 'var(--df-type-title-weight)',
                color: 'var(--df-text)'
              }}
            >
              Meetings
            </h1>
            <p 
              className="m-0 mt-1"
              style={{
                fontSize: 'var(--df-type-caption-size)',
                fontWeight: 'var(--df-type-caption-weight)',
                color: 'var(--df-text-muted)'
              }}
            >
              {upcomingMeetings.length} upcoming
            </p>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          style={{
            borderColor: 'var(--df-border)',
            color: 'var(--df-text)',
            fontSize: 'var(--df-type-caption-size)',
            fontWeight: 'var(--df-type-caption-weight)'
          }}
        >
          <Plus size={16} className="mr-2" />
          Add Meeting
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {upcomingMeetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Calendar 
              size={48} 
              style={{ color: 'var(--df-text-muted)' }}
              className="mb-4"
            />
            <h3 
              className="m-0 mb-2"
              style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)'
              }}
            >
              No upcoming meetings
            </h3>
            <p 
              className="m-0 mb-6"
              style={{
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                color: 'var(--df-text-muted)'
              }}
            >
              Your calendar is clear. Time to focus on deep work!
            </p>
            <Button
              style={{
                backgroundColor: 'var(--df-primary)',
                color: 'var(--df-primary-contrast)',
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                minHeight: '44px'
              }}
            >
              Import Calendar
            </Button>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Today's Meetings */}
            {todayMeetings.length > 0 && (
              <div>
                <h2 
                  className="m-0 mb-3"
                  style={{
                    fontSize: 'var(--df-type-subtitle-size)',
                    fontWeight: 'var(--df-type-subtitle-weight)',
                    color: 'var(--df-text)'
                  }}
                >
                  Today
                </h2>
                <div className="space-y-3">
                  {todayMeetings.map((meeting) => (
                    <MeetingCard
                      key={meeting.id}
                      meeting={meeting}
                      onSelect={() => setSelectedMeeting(meeting)}
                      onAddPrep={() => handleAddPrepBlock(meeting)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Later Meetings */}
            {laterMeetings.length > 0 && (
              <div>
                <h2 
                  className="m-0 mb-3"
                  style={{
                    fontSize: 'var(--df-type-subtitle-size)',
                    fontWeight: 'var(--df-type-subtitle-weight)',
                    color: 'var(--df-text)'
                  }}
                >
                  Upcoming
                </h2>
                <div className="space-y-3">
                  {laterMeetings.map((meeting) => (
                    <MeetingCard
                      key={meeting.id}
                      meeting={meeting}
                      onSelect={() => setSelectedMeeting(meeting)}
                      onAddPrep={() => handleAddPrepBlock(meeting)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface MeetingCardProps {
  meeting: Meeting;
  onSelect: () => void;
  onAddPrep: () => void;
}

function MeetingCard({ meeting, onSelect, onAddPrep }: MeetingCardProps) {
  const isUpcoming = new Date(meeting.startTime) > new Date();
  const isStartingSoon = isUpcoming && 
    new Date(meeting.startTime).getTime() - new Date().getTime() < 60 * 60 * 1000; // Within 1 hour

  return (
    <Card 
      className="p-0 cursor-pointer transition-all duration-200 hover:shadow-md"
      style={{
        backgroundColor: 'var(--df-surface)',
        borderColor: 'var(--df-border)',
        borderRadius: 'var(--df-radius-md)',
        boxShadow: 'var(--df-shadow-sm)'
      }}
      onClick={onSelect}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 
                className="m-0 truncate"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                {meeting.title}
              </h3>
              {meeting.isCritical && (
                <Badge 
                  variant="destructive"
                  className="text-xs"
                  style={{
                    backgroundColor: 'var(--df-danger)',
                    color: 'var(--df-primary-contrast)',
                    fontSize: 'var(--df-type-caption-size)'
                  }}
                >
                  Critical
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-4 mb-2">
              <div className="flex items-center gap-1">
                <Clock size={14} style={{ color: 'var(--df-text-muted)' }} />
                <span 
                  style={{
                    fontSize: 'var(--df-type-caption-size)',
                    fontWeight: 'var(--df-type-caption-weight)',
                    color: 'var(--df-text-muted)'
                  }}
                >
                  {formatDate(meeting.startTime)} • {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                </span>
              </div>
              
              {isStartingSoon && (
                <Badge 
                  variant="secondary"
                  style={{
                    backgroundColor: 'var(--df-warning)',
                    color: 'var(--df-primary-contrast)',
                    fontSize: 'var(--df-type-caption-size)'
                  }}
                >
                  Starting soon
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4">
              {meeting.attendees.length > 0 && (
                <div className="flex items-center gap-1">
                  <Users size={14} style={{ color: 'var(--df-text-muted)' }} />
                  <span 
                    style={{
                      fontSize: 'var(--df-type-caption-size)',
                      fontWeight: 'var(--df-type-caption-weight)',
                      color: 'var(--df-text-muted)'
                    }}
                  >
                    {meeting.attendees.length === 1 ? meeting.attendees[0] : `${meeting.attendees.length} attendees`}
                  </span>
                </div>
              )}
              
              {meeting.location && !meeting.isVirtual && (
                <div className="flex items-center gap-1">
                  <MapPin size={14} style={{ color: 'var(--df-text-muted)' }} />
                  <span 
                    className="truncate"
                    style={{
                      fontSize: 'var(--df-type-caption-size)',
                      fontWeight: 'var(--df-type-caption-weight)',
                      color: 'var(--df-text-muted)'
                    }}
                  >
                    {meeting.location}
                  </span>
                </div>
              )}
              
              {meeting.isVirtual && (
                <div className="flex items-center gap-1">
                  <Video size={14} style={{ color: 'var(--df-text-muted)' }} />
                  <span 
                    style={{
                      fontSize: 'var(--df-type-caption-size)',
                      fontWeight: 'var(--df-type-caption-weight)',
                      color: 'var(--df-text-muted)'
                    }}
                  >
                    Virtual
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <ChevronRight size={16} style={{ color: 'var(--df-text-muted)' }} />
        </div>

        {/* Action Row */}
        {meeting.isCritical && !meeting.hasPrep && (
          <div className="pt-3 border-t" style={{ borderTopColor: 'var(--df-border)' }}>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              style={{
                borderColor: 'var(--df-primary)',
                color: 'var(--df-primary)',
                fontSize: 'var(--df-type-caption-size)',
                fontWeight: 'var(--df-type-caption-weight)'
              }}
              onClick={(e) => {
                e.stopPropagation();
                onAddPrep();
              }}
            >
              Add prep block
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}