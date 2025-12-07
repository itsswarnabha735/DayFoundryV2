import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Square, Clock, Users, Mic, MicOff, Save } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { useEdgeFunctions } from '../../hooks/useEdgeFunctions';

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

interface MeetingNotesEditorProps {
  meeting: Meeting;
  initialNotes: string;
  onEnd: (notes: string) => void;
  onBack: () => void;
}

export function MeetingNotesEditor({ meeting, initialNotes, onEnd, onBack }: MeetingNotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [startTime] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRecording, setIsRecording] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { callEdgeFunction } = useEdgeFunctions();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Focus the textarea when component mounts
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const formatDuration = (start: Date, current: Date) => {
    const diff = Math.floor((current.getTime() - start.getTime()) / 1000);
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const handleEndMeeting = async () => {
    if (!notes.trim()) {
      onEnd('');
      return;
    }

    setIsExtracting(true);
    
    try {
      // Extract actions from notes using LLM
      const response = await callEdgeFunction('extract-actions-from-notes', {
        notes,
        meetingTitle: meeting.title,
        attendees: meeting.attendees
      });

      if (response.success && response.data.tasks) {
        // Tasks will be handled by the edge function
        console.log('Extracted tasks:', response.data.tasks);
      }
    } catch (error) {
      console.error('Failed to extract actions from notes:', error);
    } finally {
      setIsExtracting(false);
      onEnd(notes);
    }
  };

  const toggleRecording = () => {
    // This is a placeholder for voice recording functionality
    setIsRecording(!isRecording);
    
    if (!isRecording) {
      // Start recording
      console.log('Starting voice recording...');
    } else {
      // Stop recording
      console.log('Stopping voice recording...');
    }
  };

  const insertTimestamp = () => {
    const timestamp = `[${formatTime(currentTime)}] `;
    const textarea = textareaRef.current;
    
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = notes.substring(0, start) + timestamp + notes.substring(end);
      setNotes(newText);
      
      // Move cursor after timestamp
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + timestamp.length;
        textarea.focus();
      }, 0);
    }
  };

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
          backgroundColor: 'var(--df-surface)',
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
            <div className="flex items-center gap-2 mt-1">
              <Badge 
                variant="secondary"
                style={{
                  backgroundColor: 'var(--df-success)',
                  color: 'var(--df-primary-contrast)',
                  fontSize: 'var(--df-type-caption-size)'
                }}
              >
                In Progress
              </Badge>
              <span 
                style={{
                  fontSize: 'var(--df-type-caption-size)',
                  fontWeight: 'var(--df-type-caption-weight)',
                  color: 'var(--df-text-muted)'
                }}
              >
                {formatDuration(startTime, currentTime)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleRecording}
            className="h-9 w-9 p-0"
            style={{ 
              color: isRecording ? 'var(--df-danger)' : 'var(--df-text)'
            }}
          >
            {isRecording ? <Mic size={16} /> : <MicOff size={16} />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={insertTimestamp}
            className="h-9"
            style={{ color: 'var(--df-text)' }}
          >
            <Clock size={16} />
          </Button>
        </div>
      </div>

      {/* Meeting Info Bar */}
      <Card 
        className="m-4 p-3"
        style={{
          backgroundColor: 'var(--df-surface-alt)',
          borderColor: 'var(--df-border)',
          borderRadius: 'var(--df-radius-md)',
          boxShadow: 'none'
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Clock size={14} style={{ color: 'var(--df-text-muted)' }} />
              <span 
                style={{
                  fontSize: 'var(--df-type-caption-size)',
                  fontWeight: 'var(--df-type-caption-weight)',
                  color: 'var(--df-text-muted)'
                }}
              >
                {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
              </span>
            </div>
            
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
          </div>
          
          {meeting.agenda && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              style={{
                color: 'var(--df-primary)',
                fontSize: 'var(--df-type-caption-size)',
                fontWeight: 'var(--df-type-caption-weight)'
              }}
            >
              View Agenda
            </Button>
          )}
        </div>
      </Card>

      {/* Notes Editor */}
      <div className="flex-1 px-4 pb-4">
        <Textarea
          ref={textareaRef}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Start taking notes...

Tips:
• Use [timestamp] for key moments
• Note action items and decisions
• Capture follow-up questions"
          className="h-full resize-none border-0 focus:ring-0 focus:outline-none"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--df-text)',
            fontSize: 'var(--df-type-body-size)',
            fontWeight: 'var(--df-type-body-weight)',
            lineHeight: '1.6'
          }}
        />
      </div>

      {/* Action Buttons */}
      <div 
        className="flex gap-3 p-4 border-t"
        style={{ 
          borderTopColor: 'var(--df-border)',
          backgroundColor: 'var(--df-surface)',
          paddingBottom: 'max(var(--df-space-16), env(safe-area-inset-bottom))'
        }}
      >
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => onEnd(notes)}
          style={{
            borderColor: 'var(--df-border)',
            color: 'var(--df-text)',
            fontSize: 'var(--df-type-body-size)',
            fontWeight: 'var(--df-type-body-weight)',
            minHeight: '44px'
          }}
        >
          <Save size={16} className="mr-2" />
          Save & Continue
        </Button>
        
        <Button
          className="flex-1"
          onClick={handleEndMeeting}
          disabled={isExtracting}
          style={{
            backgroundColor: 'var(--df-primary)',
            color: 'var(--df-primary-contrast)',
            fontSize: 'var(--df-type-body-size)',
            fontWeight: 'var(--df-type-body-weight)',
            minHeight: '44px'
          }}
        >
          {isExtracting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              Extracting Actions...
            </>
          ) : (
            <>
              <Square size={16} className="mr-2" />
              End Meeting
            </>
          )}
        </Button>
      </div>
    </div>
  );
}