import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Search, Filter, Type, Mic, Camera, FileText, Zap, Clock, Tag } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { TaskDraftSheet } from '../tasks/TaskDraftSheet';
import { VoiceRecorder, CameraCapture, CaptureOptionsSheet } from '../capture';
import { useDataStore } from '../../hooks/useDataStore';
import { CapturedItem } from '../../utils/data/store';
import { TaskDraft } from '../../types/tasks';

// Re-export for backward compatibility
export type { TaskDraft };

export interface InboxScreenRef {
  focusCapture: () => void;
}

export const InboxScreen = forwardRef<InboxScreenRef>((props, ref) => {
  const [captureText, setCaptureText] = useState('');
  const captureInputRef = useRef<HTMLInputElement>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'captured' | 'processing' | 'waiting'>('all');
  const [showTaskDraft, setShowTaskDraft] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CapturedItem | null>(null);

  const { data, loading, createCapturedItem, deleteCapturedItem } = useDataStore();
  const capturedItems = data.capturedItems;

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    focusCapture: () => {
      captureInputRef.current?.focus();
    }
  }));

  // Data is loaded via the useDataStore hook

  const handleCapture = async (content: string, source: CapturedItem['source'], imageData?: string) => {
    try {
      console.log('InboxScreen: Creating captured item...');

      createCapturedItem({
        content,
        source,
        processed: false,
        ...(imageData && { image_data: imageData }),
      });

      console.log('InboxScreen: Successfully created captured item');
      setCaptureText(''); // Clear the input
    } catch (error) {
      console.error('Failed to create captured item:', error);
      alert('Failed to save captured item. Please try again.');
    }
  };

  const handleItemTap = (item: CapturedItem) => {
    setSelectedItem(item);
    setShowTaskDraft(true);
  };

  const handleTaskDraftSave = async (draft: TaskDraft) => {
    if (selectedItem) {
      try {
        // For now, just log the draft - we can implement updating later
        console.log('Task draft saved:', draft);

        // Close the task draft sheet
        setShowTaskDraft(false);
        setSelectedItem(null);
      } catch (error) {
        console.error('Failed to save task draft:', error);
        alert('Failed to save task draft. Please try again.');
      }
    }
    setShowTaskDraft(false);
    setSelectedItem(null);
  };

  const handleTaskDraftDiscard = async () => {
    if (selectedItem) {
      try {
        await deleteCapturedItem(selectedItem.id);
      } catch (error) {
        console.error('Failed to discard captured item:', error);
        alert('Failed to discard item. Please try again.');
      }
    }
    setShowTaskDraft(false);
    setSelectedItem(null);
  };

  const filteredItems = capturedItems.filter(item => {
    switch (activeFilter) {
      case 'captured': return !item.processed;
      case 'processing': return item.processed && !item.task_draft;
      case 'waiting': return item.processed && item.task_draft;
      default: return true;
    }
  });

  const getCounts = () => ({
    all: capturedItems.length,
    captured: capturedItems.filter(item => !item.processed).length,
    processing: capturedItems.filter(item => item.processed && !item.task_draft).length,
    waiting: capturedItems.filter(item => item.processed && item.task_draft).length
  });

  const counts = getCounts();

  return (
    <div className="flex flex-col h-full">
      {/* Top App Bar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          backgroundColor: 'var(--df-surface)',
          borderBottomColor: 'var(--df-border)',
          paddingTop: 'calc(env(safe-area-inset-top, 0) + 12px)',
          minHeight: '56px'
        }}
      >
        <h1
          style={{
            fontSize: 'var(--df-type-title-size)',
            fontWeight: 'var(--df-type-title-weight)',
            color: 'var(--df-text)'
          }}
        >
          Inbox
        </h1>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            style={{
              color: 'var(--df-text-muted)',
              minHeight: '44px',
              minWidth: '44px'
            }}
          >
            <Search size={20} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            style={{
              color: 'var(--df-text-muted)',
              minHeight: '44px',
              minWidth: '44px'
            }}
          >
            <Filter size={20} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-auto"
        style={{ paddingBottom: 'var(--df-space-24)' }}
      >
        {/* Capture Inputs */}
        <div className="p-4 space-y-3">
          <CaptureInputs onCapture={handleCapture} inputRef={captureInputRef} />
        </div>

        {/* Filter Tabs - Horizontally scrollable on mobile */}
        <div
          className="flex gap-2 px-4 mb-4 overflow-x-auto"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <FilterTab
            label="All"
            isActive={activeFilter === 'all'}
            count={counts.all}
            onClick={() => setActiveFilter('all')}
          />
          <FilterTab
            label="Captured"
            isActive={activeFilter === 'captured'}
            count={counts.captured}
            onClick={() => setActiveFilter('captured')}
          />
          <FilterTab
            label="Processing"
            isActive={activeFilter === 'processing'}
            count={counts.processing}
            onClick={() => setActiveFilter('processing')}
          />
          <FilterTab
            label="Waiting"
            isActive={activeFilter === 'waiting'}
            count={counts.waiting}
            onClick={() => setActiveFilter('waiting')}
          />
        </div>

        {/* Inbox Items */}
        <div className="px-4 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: 'var(--df-surface)',
                    borderColor: 'var(--df-border)',
                    borderRadius: 'var(--df-radius-md)',
                    boxShadow: 'var(--df-shadow-sm)',
                    minHeight: '72px'
                  }}
                >
                  <div className="flex items-start space-x-3">
                    <div
                      className="w-10 h-10 rounded-full animate-pulse"
                      style={{ backgroundColor: 'var(--df-surface-alt)' }}
                    />
                    <div className="flex-1 space-y-2">
                      <div
                        className="h-4 rounded animate-pulse"
                        style={{ backgroundColor: 'var(--df-surface-alt)', width: '80%' }}
                      />
                      <div
                        className="h-3 rounded animate-pulse"
                        style={{ backgroundColor: 'var(--df-surface-alt)', width: '40%' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredItems.length > 0 ? (
            filteredItems.map(item => (
              <InboxItem
                key={item.id}
                item={item}
                onTap={() => handleItemTap(item)}
              />
            ))
          ) : (
            <EmptyState filter={activeFilter} />
          )}
        </div>
      </div>

      {/* Task Draft Sheet */}
      {showTaskDraft && selectedItem && (
        <TaskDraftSheet
          isOpen={showTaskDraft}
          onClose={() => setShowTaskDraft(false)}
          item={selectedItem}
          onSave={handleTaskDraftSave}
          onDiscard={handleTaskDraftDiscard}
        />
      )}
    </div>
  );
});

interface CaptureInputsProps {
  onCapture: (content: string, source: CapturedItem['source'], imageData?: string) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

function CaptureInputs({ onCapture, inputRef }: CaptureInputsProps) {
  const [textInput, setTextInput] = useState('');
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showCaptureOptions, setShowCaptureOptions] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextCapture = () => {
    if (textInput.trim()) {
      onCapture(textInput.trim(), 'text');
      setTextInput('');
    }
  };

  const handleVoiceCapture = (transcript: string) => {
    if (transcript.trim()) {
      onCapture(transcript.trim(), 'voice');
    }
  };

  const openVoiceRecorder = () => {
    setShowVoiceRecorder(true);
  };

  const openCaptureOptions = () => {
    setShowCaptureOptions(true);
  };

  const handleTakePhoto = () => {
    setShowCamera(true);
  };

  const handleChooseFromGallery = () => {
    fileInputRef.current?.click();
  };

  const handleCameraCapture = (imageDataUrl: string) => {
    // Store the actual image data for AI processing
    onCapture('📷 Image captured', 'camera', imageDataUrl);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          // Store the actual image data for AI processing
          onCapture('🖼️ Image from gallery', 'camera', result);
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (event.target) {
      event.target.value = '';
    }
  };

  return (
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
        className="mb-3"
        style={{
          fontSize: 'var(--df-type-subtitle-size)',
          fontWeight: 'var(--df-type-subtitle-weight)',
          color: 'var(--df-text)'
        }}
      >
        Quick Capture
      </h3>

      {/* Text Composer */}
      <div className="mb-4">
        <div className="flex space-x-2">
          <Input
            ref={inputRef}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type to capture..."
            className="flex-1"
            style={{
              backgroundColor: 'var(--df-surface-alt)',
              borderColor: 'var(--df-border)',
              color: 'var(--df-text)',
              minHeight: '44px'
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleTextCapture()}
          />
          <Button
            onClick={handleTextCapture}
            disabled={!textInput.trim()}
            style={{
              backgroundColor: textInput.trim() ? 'var(--df-primary)' : 'var(--df-surface-alt)',
              color: textInput.trim() ? 'var(--df-primary-contrast)' : 'var(--df-text-muted)',
              minHeight: '44px',
              minWidth: '44px'
            }}
          >
            <Type size={20} />
          </Button>
        </div>
      </div>

      {/* Voice & Camera Capture */}
      <div className="flex space-x-3">
        <Button
          onClick={openVoiceRecorder}
          variant="outline"
          className="flex-1 flex items-center justify-center space-x-2"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            color: 'var(--df-text)',
            minHeight: '44px'
          }}
        >
          <Mic size={20} />
          <span style={{
            fontSize: 'var(--df-type-body-size)',
            fontWeight: 'var(--df-type-body-weight)'
          }}>
            Voice
          </span>
        </Button>

        <Button
          onClick={openCaptureOptions}
          variant="outline"
          className="flex-1 flex items-center justify-center space-x-2"
          style={{
            backgroundColor: 'var(--df-surface)',
            borderColor: 'var(--df-border)',
            color: 'var(--df-text)',
            minHeight: '44px'
          }}
        >
          <Camera size={20} />
          <span style={{
            fontSize: 'var(--df-type-body-size)',
            fontWeight: 'var(--df-type-body-weight)'
          }}>
            Camera
          </span>
        </Button>
      </div>

      {/* Hidden file input for gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Voice Recorder Modal */}
      {showVoiceRecorder && (
        <VoiceRecorder
          onCapture={handleVoiceCapture}
          onClose={() => setShowVoiceRecorder(false)}
          maxDuration={60}
        />
      )}

      {/* Capture Options Sheet */}
      <CaptureOptionsSheet
        isOpen={showCaptureOptions}
        onClose={() => setShowCaptureOptions(false)}
        onTakePhoto={handleTakePhoto}
        onChooseFromGallery={handleChooseFromGallery}
      />

      {/* Camera Capture Full Screen */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </Card>
  );
}

interface FilterTabProps {
  label: string;
  isActive: boolean;
  count: number;
  onClick: () => void;
}

function FilterTab({ label, isActive, count, onClick }: FilterTabProps) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 rounded-full border flex items-center space-x-2"
      style={{
        backgroundColor: isActive ? 'var(--df-primary)' : 'transparent',
        borderColor: isActive ? 'var(--df-primary)' : 'var(--df-border)',
        color: isActive ? 'var(--df-primary-contrast)' : 'var(--df-text)',
        fontSize: 'var(--df-type-caption-size)',
        fontWeight: 'var(--df-type-caption-weight)',
        minHeight: '44px'
      }}
    >
      <span>{label}</span>
      <span
        className="px-1.5 py-0.5 rounded-full text-xs"
        style={{
          backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'var(--df-surface-alt)',
          color: isActive ? 'var(--df-primary-contrast)' : 'var(--df-text-muted)'
        }}
      >
        {count}
      </span>
    </button>
  );
}

interface InboxItemProps {
  item: CapturedItem;
  onTap: () => void;
}

function InboxItem({ item, onTap }: InboxItemProps) {
  const getSourceIcon = () => {
    switch (item.source) {
      case 'text': return <Type size={16} />;
      case 'voice': return <Mic size={16} />;
      case 'camera': return <Camera size={16} />;
    }
  };

  const getTimeAgo = () => {
    const now = new Date();
    const createdAt = new Date(item.created_at);
    const diff = now.getTime() - createdAt.getTime();
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Check if this is an image capture with actual image data
  const hasImageData = item.source === 'camera' && item.image_data;

  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md transition-all duration-200"
      style={{
        backgroundColor: 'var(--df-surface)',
        borderColor: 'var(--df-border)',
        borderRadius: 'var(--df-radius-md)',
        boxShadow: 'var(--df-shadow-sm)',
        minHeight: '72px'
      }}
      onClick={onTap}
    >
      <div className="flex items-start space-x-3">
        {/* Image thumbnail for camera captures */}
        {hasImageData ? (
          <div
            className="flex-shrink-0 rounded-lg overflow-hidden"
            style={{
              width: '60px',
              height: '60px',
              backgroundColor: 'var(--df-surface-alt)'
            }}
          >
            <img
              src={item.image_data}
              alt="Captured"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </div>
        ) : (
          <div
            className="flex-shrink-0 p-2 rounded-full mt-1"
            style={{ backgroundColor: 'var(--df-surface-alt)' }}
          >
            <div style={{ color: 'var(--df-primary)' }}>
              {getSourceIcon()}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p
            className="mb-1 line-clamp-2"
            style={{
              fontSize: 'var(--df-type-body-size)',
              fontWeight: 'var(--df-type-body-weight)',
              color: 'var(--df-text)',
              lineHeight: '1.4'
            }}
          >
            {item.content}
          </p>

          <div className="flex items-center space-x-3">
            <span
              style={{
                fontSize: 'var(--df-type-caption-size)',
                color: 'var(--df-text-muted)'
              }}
            >
              {getTimeAgo()}
            </span>

            {item.processed && (
              <div className="flex items-center space-x-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: 'var(--df-success)' }}
                />
                <span
                  style={{
                    fontSize: 'var(--df-type-caption-size)',
                    color: 'var(--df-success)'
                  }}
                >
                  Processed
                </span>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            color: 'var(--df-text-muted)',
            fontSize: '18px'
          }}
        >
          ›
        </div>
      </div>
    </Card>
  );
}

interface EmptyStateProps {
  filter: string;
}

function EmptyState({ filter }: EmptyStateProps) {
  const getEmptyMessage = () => {
    switch (filter) {
      case 'captured': return 'No captured items yet';
      case 'processing': return 'No items being processed';
      case 'waiting': return 'No tasks waiting for action';
      default: return 'Your inbox is empty';
    }
  };

  const getEmptyDescription = () => {
    switch (filter) {
      case 'captured': return 'Use the capture tools above to add items';
      case 'processing': return 'Items appear here while being processed';
      case 'waiting': return 'Processed tasks will appear here';
      default: return 'Start capturing tasks, ideas, and notes';
    }
  };

  return (
    <div className="text-center py-12">
      <div
        className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--df-surface-alt)' }}
      >
        <FileText size={32} style={{ color: 'var(--df-text-muted)' }} />
      </div>

      <h3
        className="mb-2"
        style={{
          fontSize: 'var(--df-type-subtitle-size)',
          fontWeight: 'var(--df-type-subtitle-weight)',
          color: 'var(--df-text)'
        }}
      >
        {getEmptyMessage()}
      </h3>

      <p
        style={{
          fontSize: 'var(--df-type-body-size)',
          color: 'var(--df-text-muted)',
          maxWidth: '240px',
          margin: '0 auto'
        }}
      >
        {getEmptyDescription()}
      </p>
    </div>
  );
}

export type { CapturedItem, TaskDraft };