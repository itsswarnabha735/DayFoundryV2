import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, X, Calendar, Zap, Clock, Link, Tag, Trash2, Edit3, Merge, Check, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../ui/sheet';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner@2.0.3';
import { TaskDraft } from '../../types/tasks';
import { CapturedItem } from '../../utils/data/store';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { ApiKeySetup } from '../settings/ApiKeySetup';
import { edgeFunctionService } from '../../utils/services/EdgeFunctionService';
import { useDataStore } from '../../hooks/useDataStore';

interface TaskDraftSheetProps {
  isOpen: boolean;
  onClose: () => void;
  item: CapturedItem;
  onSave: (draft: TaskDraft) => void;
  onDiscard: () => void;
}

interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
  invalidFields: string[];
}

// Helper to map numeric duration to dropdown options
function mapDurationToOption(range?: { min?: number; most?: number; max?: number }): string {
  if (!range) return '30-60 min';

  // Use max or most to determine the bucket
  const minutes = range.max || range.most || 60;

  if (minutes <= 30) return '15-30 min';
  if (minutes <= 60) return '30-60 min';
  if (minutes <= 120) return '1-2 hours';
  if (minutes <= 240) return '2-4 hours';
  return '4+ hours';
}

export function TaskDraftSheet({ isOpen, onClose, item, onSave, onDiscard }: TaskDraftSheetProps) {
  const { acceptTaskDraft } = useDataStore();
  const [draft, setDraft] = useState<TaskDraft>(() => {
    if (item.task_draft) {
      return item.task_draft;
    }

    // Fallback to simple extraction if server extraction fails
    return {
      title: extractTitle(item.content),
      steps: extractSteps(item.content),
      acceptance: extractAcceptance(item.content),
      est_range: '30-60 min',
      energy: 'Shallow',
      deps: [],
      deadline: undefined,
      tags: extractTags(item.content)
    };
  });

  const [newStep, setNewStep] = useState('');
  const [newDep, setNewDep] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isEditing, setIsEditing] = useState(!item.task_draft);
  const [isExtracting, setIsExtracting] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [originalContent] = useState(item.content); // Keep original content intact
  const [showApiKeySetup, setShowApiKeySetup] = useState(false);

  // Extract task using server function on mount if no draft exists
  useEffect(() => {
    if (!item.task_draft && isOpen) {
      extractTaskFromServer();
    }
  }, [isOpen, item.task_draft]);

  const extractTaskFromServer = async () => {
    setIsExtracting(true);

    try {
      const result = await edgeFunctionService.extractTask(item.content, {
        current_time: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      if (result.task) {
        // Update draft with extracted data, mapping to our format
        const extractedTask = result.task;
        setDraft({
          title: extractedTask.title,
          steps: extractedTask.steps,
          acceptance: extractedTask.acceptance || '',
          est_range: mapDurationToOption(extractedTask.est_range),
          energy: extractedTask.energy === 'deep' ? 'Deep' : 'Shallow',
          deps: extractedTask.deps || [],
          deadline: extractedTask.deadline || undefined,
          tags: extractedTask.tags || []
        });

        // Simple validation
        const validation = {
          isValid: !!(extractedTask.title && extractedTask.steps?.length),
          missingFields: [] as string[],
          invalidFields: [] as string[]
        };

        if (!extractedTask.title) validation.missingFields.push('title');
        if (!extractedTask.steps?.length) validation.missingFields.push('steps');

        setValidation(validation);

        if (!validation.isValid) {
          setIsEditing(true); // Force edit mode if validation failed
          toast.warning('Some fields need attention', {
            description: 'Please review and complete the highlighted fields.'
          });
        } else {
          toast.success('Task extracted successfully');
        }
      } else {
        throw new Error('No task data returned from extraction');
      }
    } catch (error) {
      console.error('Task extraction error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if it's an API key related error
      if (errorMessage.includes('API key') || errorMessage.includes('401')) {
        setShowApiKeySetup(true);
        toast.error('Gemini API key required', {
          description: 'Please set up your Gemini API key to enable task extraction.'
        });
      } else {
        toast.error('Failed to extract task', {
          description: errorMessage
        });
      }

      setIsEditing(true); // Enable editing on error
    } finally {
      setIsExtracting(false);
    }
  };

  const isFieldInvalid = (fieldName: string): boolean => {
    return validation ?
      validation.missingFields.includes(fieldName) || validation.invalidFields.includes(fieldName)
      : false;
  };

  const handleSave = async () => {
    try {
      // Convert draft to Task format
      const taskData = {
        title: draft.title,
        steps: draft.steps.map(text => ({ text, completed: false })),
        acceptance: draft.acceptance,
        est_min: parseInt(draft.est_range.split('-')[0]) || 30,
        est_most: parseInt(draft.est_range.split('-')[1]?.replace(' min', '')) || 60,
        est_max: parseInt(draft.est_range.split('-')[1]?.replace(' min', '')) * 1.5 || 90,
        energy: draft.energy.toLowerCase() as 'deep' | 'shallow',
        deadline: draft.deadline?.toISOString(),
        tags: draft.tags,
        context: '',
        location: '',
        source: 'inbox'
      };

      // Use direct client write for immediate task acceptance
      await acceptTaskDraft(taskData);

      toast.success('Task accepted and saved', {
        description: 'Your task has been added to your task list.'
      });

      // Call the original onSave for any UI updates
      onSave(draft);
    } catch (error) {
      console.error('Error accepting task draft:', error);
      toast.error('Failed to accept task', {
        description: 'Please try again or check your connection.'
      });
    }
  };

  const handleMerge = () => {
    // Mock merge functionality - would open merge dialog
    console.log('Merge with existing task');
  };

  const addStep = () => {
    if (newStep.trim()) {
      setDraft(prev => ({
        ...prev,
        steps: [...prev.steps, newStep.trim()]
      }));
      setNewStep('');
    }
  };

  const removeStep = (index: number) => {
    setDraft(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const addDep = () => {
    if (newDep.trim()) {
      setDraft(prev => ({
        ...prev,
        deps: [...prev.deps, newDep.trim()]
      }));
      setNewDep('');
    }
  };

  const removeDep = (index: number) => {
    setDraft(prev => ({
      ...prev,
      deps: prev.deps.filter((_, i) => i !== index)
    }));
  };

  const addTag = () => {
    if (newTag.trim()) {
      setDraft(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (index: number) => {
    setDraft(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-full p-0"
        style={{
          backgroundColor: 'var(--df-surface)',
          borderColor: 'var(--df-border)'
        }}
      >
        <SheetTitle className="sr-only">Task Draft</SheetTitle>
        <SheetDescription className="sr-only">
          Create and edit task from captured item
        </SheetDescription>

        {/* API Key Setup Modal */}
        {showApiKeySetup && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          >
            <div className="max-w-md w-full mx-4">
              <ApiKeySetup onDismiss={() => setShowApiKeySetup(false)} />
            </div>
          </div>
        )}

        <div className="flex flex-col h-full">
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 border-b"
            style={{
              borderBottomColor: 'var(--df-border)',
              minHeight: '64px'
            }}
          >
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                onClick={onClose}
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                <ArrowLeft size={20} />
              </Button>
              <h1
                style={{
                  fontSize: 'var(--df-type-title-size)',
                  fontWeight: 'var(--df-type-title-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Task Draft
              </h1>
            </div>

            <Button
              variant="ghost"
              onClick={() => setIsEditing(!isEditing)}
              style={{
                minHeight: '44px',
                minWidth: '44px',
                color: 'var(--df-primary)'
              }}
            >
              <Edit3 size={20} />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4 space-y-6">
            {/* Source Content */}
            <Card
              className="p-4"
              style={{
                backgroundColor: 'var(--df-surface-alt)',
                borderColor: 'var(--df-border)',
                borderRadius: 'var(--df-radius-md)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3
                  style={{
                    fontSize: 'var(--df-type-subtitle-size)',
                    fontWeight: 'var(--df-type-subtitle-weight)',
                    color: 'var(--df-text)'
                  }}
                >
                  Original Capture
                </h3>

                {isExtracting && (
                  <div className="flex items-center space-x-2">
                    <Loader2
                      size={16}
                      className="animate-spin"
                      style={{ color: 'var(--df-primary)' }}
                    />
                    <span
                      style={{
                        fontSize: 'var(--df-type-caption-size)',
                        color: 'var(--df-primary)'
                      }}
                    >
                      Extracting...
                    </span>
                  </div>
                )}

                {validation && !validation.isValid && !isExtracting && (
                  <div className="flex items-center space-x-1">
                    <AlertTriangle
                      size={16}
                      style={{ color: 'var(--df-warning)' }}
                    />
                    <span
                      style={{
                        fontSize: 'var(--df-type-caption-size)',
                        color: 'var(--df-warning)'
                      }}
                    >
                      Needs review
                    </span>
                  </div>
                )}

                {!isExtracting && !item.task_draft && (
                  <Button
                    variant="ghost"
                    onClick={extractTaskFromServer}
                    className="ml-2"
                    style={{
                      color: 'var(--df-primary)',
                      fontSize: 'var(--df-type-caption-size)'
                    }}
                  >
                    Re-extract
                  </Button>
                )}

                {showApiKeySetup && (
                  <Button
                    variant="ghost"
                    onClick={() => setShowApiKeySetup(true)}
                    className="ml-2"
                    style={{
                      color: 'var(--df-warning)',
                      fontSize: 'var(--df-type-caption-size)'
                    }}
                  >
                    Setup API Key
                  </Button>
                )}
              </div>

              <p
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  color: 'var(--df-text-muted)',
                  lineHeight: '1.5'
                }}
              >
                {originalContent}
              </p>
            </Card>

            {/* Title */}
            <div>
              <label
                className="flex items-center mb-2"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Title
                {isFieldInvalid('title') && (
                  <AlertTriangle
                    size={16}
                    className="ml-1"
                    style={{ color: 'var(--df-danger)' }}
                  />
                )}
              </label>
              {isEditing ? (
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Task title..."
                  style={{
                    backgroundColor: 'var(--df-surface)',
                    borderColor: isFieldInvalid('title') ? 'var(--df-danger)' : 'var(--df-border)',
                    color: 'var(--df-text)',
                    minHeight: '44px'
                  }}
                />
              ) : (
                <p
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    color: 'var(--df-text)',
                    padding: '12px',
                    backgroundColor: 'var(--df-surface-alt)',
                    borderRadius: 'var(--df-radius-sm)'
                  }}
                >
                  {draft.title}
                </p>
              )}
              {isFieldInvalid('title') && (
                <p
                  className="mt-1"
                  style={{
                    fontSize: 'var(--df-type-caption-size)',
                    color: 'var(--df-danger)'
                  }}
                >
                  Title is required
                </p>
              )}
            </div>

            {/* Steps */}
            <div>
              <label
                className="flex items-center mb-2"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Steps
                {isFieldInvalid('steps') && (
                  <AlertTriangle
                    size={16}
                    className="ml-1"
                    style={{ color: 'var(--df-danger)' }}
                  />
                )}
              </label>
              <div className="space-y-2 mb-3">
                {draft.steps.map((step, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <span
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs mt-2"
                      style={{
                        backgroundColor: 'var(--df-primary)',
                        color: 'var(--df-primary-contrast)'
                      }}
                    >
                      {index + 1}
                    </span>
                    <p
                      className="flex-1 pt-2"
                      style={{
                        fontSize: 'var(--df-type-body-size)',
                        color: 'var(--df-text)',
                        lineHeight: '1.4'
                      }}
                    >
                      {step}
                    </p>
                    {isEditing && (
                      <Button
                        variant="ghost"
                        onClick={() => removeStep(index)}
                        style={{
                          minHeight: '32px',
                          minWidth: '32px',
                          color: 'var(--df-danger)'
                        }}
                      >
                        <X size={16} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {isEditing && (
                <div className="flex space-x-2">
                  <Input
                    value={newStep}
                    onChange={(e) => setNewStep(e.target.value)}
                    placeholder="Add step..."
                    className="flex-1"
                    style={{
                      backgroundColor: 'var(--df-surface)',
                      borderColor: 'var(--df-border)',
                      color: 'var(--df-text)',
                      minHeight: '44px'
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && addStep()}
                  />
                  <Button
                    onClick={addStep}
                    disabled={!newStep.trim()}
                    style={{
                      backgroundColor: newStep.trim() ? 'var(--df-primary)' : 'var(--df-surface-alt)',
                      color: newStep.trim() ? 'var(--df-primary-contrast)' : 'var(--df-text-muted)',
                      minHeight: '44px',
                      minWidth: '44px'
                    }}
                  >
                    <Plus size={20} />
                  </Button>
                </div>
              )}

              {isFieldInvalid('steps') && (
                <p
                  className="mt-1"
                  style={{
                    fontSize: 'var(--df-type-caption-size)',
                    color: 'var(--df-danger)'
                  }}
                >
                  At least one step is required
                </p>
              )}
            </div>

            {/* Acceptance Criteria */}
            <div>
              <label
                className="flex items-center mb-2"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Acceptance Criteria
                {isFieldInvalid('acceptance') && (
                  <AlertTriangle
                    size={16}
                    className="ml-1"
                    style={{ color: 'var(--df-danger)' }}
                  />
                )}
              </label>
              {isEditing ? (
                <Textarea
                  value={draft.acceptance}
                  onChange={(e) => setDraft(prev => ({ ...prev, acceptance: e.target.value }))}
                  placeholder="When is this task complete?"
                  rows={3}
                  style={{
                    backgroundColor: 'var(--df-surface)',
                    borderColor: isFieldInvalid('acceptance') ? 'var(--df-danger)' : 'var(--df-border)',
                    color: 'var(--df-text)',
                    resize: 'vertical'
                  }}
                />
              ) : (
                <p
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    color: 'var(--df-text)',
                    padding: '12px',
                    backgroundColor: 'var(--df-surface-alt)',
                    borderRadius: 'var(--df-radius-sm)',
                    lineHeight: '1.5'
                  }}
                >
                  {draft.acceptance}
                </p>
              )}
              {isFieldInvalid('acceptance') && (
                <p
                  className="mt-1"
                  style={{
                    fontSize: 'var(--df-type-caption-size)',
                    color: 'var(--df-danger)'
                  }}
                >
                  Acceptance criteria is required
                </p>
              )}
            </div>

            {/* Estimate & Energy */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className="flex items-center mb-2"
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)',
                    color: 'var(--df-text)'
                  }}
                >
                  <Clock size={16} className="mr-1" />
                  Estimate
                  {isFieldInvalid('est_range') && (
                    <AlertTriangle
                      size={14}
                      className="ml-1"
                      style={{ color: 'var(--df-danger)' }}
                    />
                  )}
                </label>
                {isEditing ? (
                  <div>
                    <Select
                      value={draft.est_range}
                      onValueChange={(value) => setDraft(prev => ({ ...prev, est_range: value }))}
                    >
                      <SelectTrigger
                        style={{
                          backgroundColor: 'var(--df-surface)',
                          borderColor: isFieldInvalid('est_range') ? 'var(--df-danger)' : 'var(--df-border)',
                          color: 'var(--df-text)',
                          minHeight: '44px'
                        }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15-30 min">15-30 min</SelectItem>
                        <SelectItem value="30-60 min">30-60 min</SelectItem>
                        <SelectItem value="1-2 hours">1-2 hours</SelectItem>
                        <SelectItem value="2-4 hours">2-4 hours</SelectItem>
                        <SelectItem value="4+ hours">4+ hours</SelectItem>
                      </SelectContent>
                    </Select>
                    {isFieldInvalid('est_range') && (
                      <p
                        className="mt-1"
                        style={{
                          fontSize: 'var(--df-type-caption-size)',
                          color: 'var(--df-danger)'
                        }}
                      >
                        Please select a time estimate
                      </p>
                    )}
                  </div>
                ) : (
                  <p
                    style={{
                      fontSize: 'var(--df-type-body-size)',
                      color: 'var(--df-text)',
                      padding: '12px',
                      backgroundColor: 'var(--df-surface-alt)',
                      borderRadius: 'var(--df-radius-sm)'
                    }}
                  >
                    {draft.est_range}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="flex items-center mb-2"
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)',
                    color: 'var(--df-text)'
                  }}
                >
                  <Zap size={16} className="mr-1" />
                  Energy
                  {isFieldInvalid('energy') && (
                    <AlertTriangle
                      size={14}
                      className="ml-1"
                      style={{ color: 'var(--df-danger)' }}
                    />
                  )}
                </label>
                {isEditing ? (
                  <div>
                    <Select
                      value={draft.energy}
                      onValueChange={(value: 'Deep' | 'Shallow') => setDraft(prev => ({ ...prev, energy: value }))}
                    >
                      <SelectTrigger
                        style={{
                          backgroundColor: 'var(--df-surface)',
                          borderColor: isFieldInvalid('energy') ? 'var(--df-danger)' : 'var(--df-border)',
                          color: 'var(--df-text)',
                          minHeight: '44px'
                        }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Deep">Deep</SelectItem>
                        <SelectItem value="Shallow">Shallow</SelectItem>
                      </SelectContent>
                    </Select>
                    {isFieldInvalid('energy') && (
                      <p
                        className="mt-1"
                        style={{
                          fontSize: 'var(--df-type-caption-size)',
                          color: 'var(--df-danger)'
                        }}
                      >
                        Please select energy level
                      </p>
                    )}
                  </div>
                ) : (
                  <Badge
                    variant={draft.energy === 'Deep' ? 'default' : 'secondary'}
                    style={{
                      backgroundColor: draft.energy === 'Deep' ? 'var(--df-primary)' : 'var(--df-surface-alt)',
                      color: draft.energy === 'Deep' ? 'var(--df-primary-contrast)' : 'var(--df-text)',
                      fontSize: 'var(--df-type-caption-size)',
                      padding: '8px 12px',
                      borderRadius: 'var(--df-radius-pill)'
                    }}
                  >
                    {draft.energy}
                  </Badge>
                )}
              </div>
            </div>

            {/* Dependencies */}
            <div>
              <label
                className="block mb-2"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                <Link size={16} className="inline mr-1" />
                Dependencies
              </label>
              <div className="space-y-2 mb-3">
                {draft.deps.map((dep, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded border" style={{ borderColor: 'var(--df-border)' }}>
                    <span style={{
                      fontSize: 'var(--df-type-body-size)',
                      color: 'var(--df-text)'
                    }}>
                      {dep}
                    </span>
                    {isEditing && (
                      <Button
                        variant="ghost"
                        onClick={() => removeDep(index)}
                        style={{
                          minHeight: '32px',
                          minWidth: '32px',
                          color: 'var(--df-danger)'
                        }}
                      >
                        <X size={16} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {isEditing && (
                <div className="flex space-x-2">
                  <Input
                    value={newDep}
                    onChange={(e) => setNewDep(e.target.value)}
                    placeholder="Add dependency..."
                    className="flex-1"
                    style={{
                      backgroundColor: 'var(--df-surface)',
                      borderColor: 'var(--df-border)',
                      color: 'var(--df-text)',
                      minHeight: '44px'
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && addDep()}
                  />
                  <Button
                    onClick={addDep}
                    disabled={!newDep.trim()}
                    style={{
                      backgroundColor: newDep.trim() ? 'var(--df-primary)' : 'var(--df-surface-alt)',
                      color: newDep.trim() ? 'var(--df-primary-contrast)' : 'var(--df-text-muted)',
                      minHeight: '44px',
                      minWidth: '44px'
                    }}
                  >
                    <Plus size={20} />
                  </Button>
                </div>
              )}
            </div>

            {/* Tags */}
            <div>
              <label
                className="block mb-2"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                <Tag size={16} className="inline mr-1" />
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {draft.tags.map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center space-x-1"
                    style={{
                      backgroundColor: 'var(--df-surface-alt)',
                      color: 'var(--df-text)',
                      fontSize: 'var(--df-type-caption-size)',
                      padding: '4px 8px',
                      borderRadius: 'var(--df-radius-pill)'
                    }}
                  >
                    <span>{tag}</span>
                    {isEditing && (
                      <button
                        onClick={() => removeTag(index)}
                        style={{ color: 'var(--df-danger)' }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>

              {isEditing && (
                <div className="flex space-x-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag..."
                    className="flex-1"
                    style={{
                      backgroundColor: 'var(--df-surface)',
                      borderColor: 'var(--df-border)',
                      color: 'var(--df-text)',
                      minHeight: '44px'
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  />
                  <Button
                    onClick={addTag}
                    disabled={!newTag.trim()}
                    style={{
                      backgroundColor: newTag.trim() ? 'var(--df-primary)' : 'var(--df-surface-alt)',
                      color: newTag.trim() ? 'var(--df-primary-contrast)' : 'var(--df-text-muted)',
                      minHeight: '44px',
                      minWidth: '44px'
                    }}
                  >
                    <Plus size={20} />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Validation Summary */}
          {validation && !validation.isValid && (
            <div
              className="px-4 py-3 border-t"
              style={{
                borderTopColor: 'var(--df-border)',
                backgroundColor: 'var(--df-warning-light, rgba(251, 191, 36, 0.1))'
              }}
            >
              <div className="flex items-start space-x-2">
                <AlertTriangle
                  size={16}
                  className="mt-0.5"
                  style={{ color: 'var(--df-warning)' }}
                />
                <div>
                  <p
                    className="mb-1"
                    style={{
                      fontSize: 'var(--df-type-body-size)',
                      fontWeight: 'var(--df-type-body-weight)',
                      color: 'var(--df-text)'
                    }}
                  >
                    Please complete required fields
                  </p>
                  {validation.missingFields.length > 0 && (
                    <p
                      style={{
                        fontSize: 'var(--df-type-caption-size)',
                        color: 'var(--df-text-muted)'
                      }}
                    >
                      Missing: {validation.missingFields.join(', ')}
                    </p>
                  )}
                  {validation.invalidFields.length > 0 && (
                    <p
                      style={{
                        fontSize: 'var(--df-type-caption-size)',
                        color: 'var(--df-text-muted)'
                      }}
                    >
                      Invalid: {validation.invalidFields.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div
            className="p-4 border-t space-y-3"
            style={{ borderTopColor: 'var(--df-border)' }}
          >
            <div className="flex space-x-2">
              <Button
                onClick={handleSave}
                disabled={validation && !validation.isValid}
                className="flex-1 flex items-center justify-center space-x-2"
                style={{
                  backgroundColor: (validation && !validation.isValid) ? 'var(--df-surface-alt)' : 'var(--df-success)',
                  color: (validation && !validation.isValid) ? 'var(--df-text-muted)' : 'white',
                  minHeight: '48px'
                }}
              >
                <Check size={20} />
                <span>Accept</span>
              </Button>

              <Button
                onClick={handleMerge}
                variant="outline"
                className="flex items-center justify-center"
                style={{
                  borderColor: 'var(--df-border)',
                  color: 'var(--df-text)',
                  minHeight: '48px',
                  minWidth: '48px'
                }}
              >
                <Merge size={20} />
              </Button>
            </div>

            <Button
              onClick={onDiscard}
              variant="destructive"
              className="w-full flex items-center justify-center space-x-2"
              style={{
                backgroundColor: 'var(--df-danger)',
                color: 'white',
                minHeight: '48px'
              }}
            >
              <Trash2 size={20} />
              <span>Discard</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Mock AI extraction functions
function extractTitle(content: string): string {
  // Simple extraction - take first sentence or up to 50 chars
  const firstSentence = content.split('.')[0];
  return firstSentence.length > 50 ? firstSentence.substring(0, 47) + '...' : firstSentence;
}

function extractSteps(content: string): string[] {
  // Mock step extraction
  if (content.toLowerCase().includes('meeting') || content.toLowerCase().includes('presentation')) {
    return ['Gather materials', 'Prepare outline', 'Create deliverable'];
  }
  if (content.toLowerCase().includes('schedule') || content.toLowerCase().includes('appointment')) {
    return ['Check availability', 'Make contact', 'Confirm details'];
  }
  return ['Review requirements', 'Take action', 'Verify completion'];
}

function extractAcceptance(content: string): string {
  // Mock acceptance criteria extraction
  if (content.toLowerCase().includes('meeting') || content.toLowerCase().includes('presentation')) {
    return 'Presentation is complete and delivered to stakeholders';
  }
  if (content.toLowerCase().includes('schedule') || content.toLowerCase().includes('appointment')) {
    return 'Appointment is scheduled and confirmed with confirmation details';
  }
  return 'Task requirements are met and verified complete';
}

function extractTags(content: string): string[] {
  const tags: string[] = [];

  if (content.toLowerCase().includes('meeting') || content.toLowerCase().includes('presentation')) {
    tags.push('work');
  }
  if (content.toLowerCase().includes('dentist') || content.toLowerCase().includes('doctor') || content.toLowerCase().includes('health')) {
    tags.push('personal', 'health');
  }
  if (content.toLowerCase().includes('client') || content.toLowerCase().includes('project')) {
    tags.push('work', 'client');
  }

  return tags;
}