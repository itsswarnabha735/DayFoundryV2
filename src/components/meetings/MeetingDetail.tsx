import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Users, MapPin, Video, Link, FileText, Play, Square, Edit3 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { MeetingNotesEditor } from './MeetingNotesEditor';
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

interface MeetingDetailProps {
  meeting: Meeting;
  onBack: () => void;
  onUpdate: () => void;
}

export function MeetingDetail({ meeting, onBack, onUpdate }: MeetingDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMeeting, setEditedMeeting] = useState(meeting);
  const [newDocUrl, setNewDocUrl] = useState('');
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [meetingNotes, setMeetingNotes] = useState('');
  const { dataStore } = useDataStore();

  useEffect(() => {
    // Load any existing meeting notes
    loadMeetingNotes();
  }, [meeting.id]);

  const loadMeetingNotes = async () => {
    try {
      const notes = await dataStore.get(`meeting-notes-${meeting.id}`);
      if (notes) {
        setMeetingNotes(notes);
      }
    } catch (error) {
      console.error('Failed to load meeting notes:', error);
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
      return date.toLocaleDateString([], { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric'
      });
    }
  };

  const handleSave = async () => {
    try {
      await dataStore.set(`meeting-${meeting.id}`, editedMeeting);
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to save meeting:', error);
    }
  };

  const handleAddLinkedDoc = async () => {
    if (!newDocUrl.trim()) return;
    
    const updatedMeeting = {
      ...editedMeeting,
      linkedDocs: [...editedMeeting.linkedDocs, newDocUrl.trim()]
    };
    
    setEditedMeeting(updatedMeeting);
    setNewDocUrl('');
    
    if (!isEditing) {
      await dataStore.set(`meeting-${meeting.id}`, updatedMeeting);
      onUpdate();
    }
  };

  const handleStartMeeting = () => {
    setIsInMeeting(true);
  };

  const handleEndMeeting = async (finalNotes: string) => {
    setIsInMeeting(false);
    setMeetingNotes(finalNotes);
    
    // Save meeting notes
    await dataStore.set(`meeting-notes-${meeting.id}`, finalNotes);
    
    // TODO: Extract actions from notes using LLM
    // This will be implemented when the LLM integration is added
    console.log('Meeting ended, notes saved:', finalNotes);
  };

  const isUpcoming = new Date(meeting.startTime) > new Date();
  const canStartMeeting = new Date().getTime() >= new Date(meeting.startTime).getTime() - 15 * 60 * 1000; // 15 mins before

  if (isInMeeting) {
    return (
      <MeetingNotesEditor
        meeting={meeting}
        initialNotes={meetingNotes}
        onEnd={handleEndMeeting}
        onBack={() => setIsInMeeting(false)}
      />
    );
  }

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
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-9 w-9 p-0"
            style={{ color: 'var(--df-text)' }}
          >
            <ArrowLeft size={20} />
          </Button>
          
          <div>
            <h1 
              className="m-0 truncate"
              style={{
                fontSize: 'var(--df-type-title-size)',
                fontWeight: 'var(--df-type-title-weight)',
                color: 'var(--df-text)',
                maxWidth: '200px'
              }}
            >
              {meeting.title}
            </h1>
            {meeting.isCritical && (
              <Badge 
                variant="destructive"
                className="mt-1"
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
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(!isEditing)}
          className="h-9 w-9 p-0"
          style={{ color: 'var(--df-text)' }}
        >
          <Edit3 size={16} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Time and Location */}
        <Card 
          className="p-4"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)',
            boxShadow: 'var(--df-shadow-sm)'
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock size={16} style={{ color: 'var(--df-text-muted)' }} />
              <span 
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                {formatDate(meeting.startTime)} • {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
              </span>
            </div>
            
            {meeting.attendees.length > 0 && (
              <div className="flex items-center gap-2">
                <Users size={16} style={{ color: 'var(--df-text-muted)' }} />
                <span 
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)',
                    color: 'var(--df-text)'
                  }}
                >
                  {meeting.attendees.join(', ')}
                </span>
              </div>
            )}
            
            {meeting.location && !meeting.isVirtual && (
              <div className="flex items-center gap-2">
                <MapPin size={16} style={{ color: 'var(--df-text-muted)' }} />
                <span 
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)',
                    color: 'var(--df-text)'
                  }}
                >
                  {meeting.location}
                </span>
              </div>
            )}
            
            {meeting.isVirtual && (
              <div className="flex items-center gap-2">
                <Video size={16} style={{ color: 'var(--df-text-muted)' }} />
                <span 
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)',
                    color: 'var(--df-text)'
                  }}
                >
                  Virtual Meeting
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Agenda */}
        <Card 
          className="p-4"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)',
            boxShadow: 'var(--df-shadow-sm)'
          }}
        >
          <h3 
            className="m-0 mb-3"
            style={{
              fontSize: 'var(--df-type-subtitle-size)',
              fontWeight: 'var(--df-type-subtitle-weight)',
              color: 'var(--df-text)'
            }}
          >
            Agenda
          </h3>
          
          {isEditing ? (
            <Textarea
              value={editedMeeting.agenda || ''}
              onChange={(e) => setEditedMeeting({
                ...editedMeeting,
                agenda: e.target.value
              })}
              placeholder="Add meeting agenda..."
              className="min-h-20"
              style={{
                backgroundColor: 'var(--df-surface)',
                borderColor: 'var(--df-border)',
                color: 'var(--df-text)',
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)'
              }}
            />
          ) : (
            <p 
              className="m-0"
              style={{
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                color: meeting.agenda ? 'var(--df-text)' : 'var(--df-text-muted)',
                lineHeight: '1.5'
              }}
            >
              {meeting.agenda || 'No agenda set'}
            </p>
          )}
        </Card>

        {/* Linked Documents */}
        <Card 
          className="p-4"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)',
            boxShadow: 'var(--df-shadow-sm)'
          }}
        >
          <h3 
            className="m-0 mb-3"
            style={{
              fontSize: 'var(--df-type-subtitle-size)',
              fontWeight: 'var(--df-type-subtitle-weight)',
              color: 'var(--df-text)'
            }}
          >
            Linked Documents
          </h3>
          
          <div className="space-y-3">
            {editedMeeting.linkedDocs.map((url, index) => (
              <div key={index} className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: 'var(--df-surface-alt)' }}>
                <Link size={14} style={{ color: 'var(--df-text-muted)' }} />
                <a 
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 truncate hover:underline"
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)',
                    color: 'var(--df-primary)'
                  }}
                >
                  {url}
                </a>
              </div>
            ))}
            
            <div className="flex gap-2">
              <Input
                value={newDocUrl}
                onChange={(e) => setNewDocUrl(e.target.value)}
                placeholder="Paste document URL..."
                className="flex-1"
                style={{
                  backgroundColor: 'var(--df-surface)',
                  borderColor: 'var(--df-border)',
                  color: 'var(--df-text)',
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)'
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddLinkedDoc}
                disabled={!newDocUrl.trim()}
                style={{
                  borderColor: 'var(--df-border)',
                  color: 'var(--df-text)',
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)'
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </Card>

        {/* Prior Notes */}
        <Card 
          className="p-4"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            borderRadius: 'var(--df-radius-md)',
            boxShadow: 'var(--df-shadow-sm)'
          }}
        >
          <h3 
            className="m-0 mb-3"
            style={{
              fontSize: 'var(--df-type-subtitle-size)',
              fontWeight: 'var(--df-type-subtitle-weight)',
              color: 'var(--df-text)'
            }}
          >
            Prior Notes
          </h3>
          
          {isEditing ? (
            <Textarea
              value={editedMeeting.priorNotes || ''}
              onChange={(e) => setEditedMeeting({
                ...editedMeeting,
                priorNotes: e.target.value
              })}
              placeholder="Add notes from previous meetings..."
              className="min-h-20"
              style={{
                backgroundColor: 'var(--df-surface)',
                borderColor: 'var(--df-border)',
                color: 'var(--df-text)',
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)'
              }}
            />
          ) : (
            <p 
              className="m-0"
              style={{
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                color: meeting.priorNotes ? 'var(--df-text)' : 'var(--df-text-muted)',
                lineHeight: '1.5'
              }}
            >
              {meeting.priorNotes || 'No prior notes'}
            </p>
          )}
        </Card>

        {/* Meeting Notes (if meeting has happened) */}
        {meetingNotes && (
          <Card 
            className="p-4"
            style={{
              backgroundColor: 'var(--df-surface)',
              borderColor: 'var(--df-border)',
              borderRadius: 'var(--df-radius-md)',
              boxShadow: 'var(--df-shadow-sm)'
            }}
          >
            <h3 
              className="m-0 mb-3"
              style={{
                fontSize: 'var(--df-type-subtitle-size)',
                fontWeight: 'var(--df-type-subtitle-weight)',
                color: 'var(--df-text)'
              }}
            >
              Meeting Notes
            </h3>
            
            <p 
              className="m-0"
              style={{
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                color: 'var(--df-text)',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap'
              }}
            >
              {meetingNotes}
            </p>
          </Card>
        )}
      </div>

      {/* Action Buttons */}
      <div 
        className="p-4 border-t"
        style={{ 
          borderTopColor: 'var(--df-border)',
          backgroundColor: 'var(--df-surface)',
          paddingBottom: 'max(var(--df-space-16), env(safe-area-inset-bottom))'
        }}
      >
        {isEditing ? (
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setEditedMeeting(meeting);
                setIsEditing(false);
              }}
              style={{
                borderColor: 'var(--df-border)',
                color: 'var(--df-text)',
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                minHeight: '44px'
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              style={{
                backgroundColor: 'var(--df-primary)',
                color: 'var(--df-primary-contrast)',
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                minHeight: '44px'
              }}
            >
              Save Changes
            </Button>
          </div>
        ) : (
          <Button
            className="w-full"
            onClick={handleStartMeeting}
            disabled={!canStartMeeting}
            style={{
              backgroundColor: canStartMeeting ? 'var(--df-primary)' : 'var(--df-text-muted)',
              color: 'var(--df-primary-contrast)',
              fontSize: 'var(--df-type-body-size)',
              fontWeight: 'var(--df-type-body-weight)',
              minHeight: '44px'
            }}
          >
            <Play size={16} className="mr-2" />
            {isUpcoming ? 'Start Meeting' : 'View Meeting Notes'}
          </Button>
        )}
      </div>
    </div>
  );
}