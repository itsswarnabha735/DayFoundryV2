import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card } from '../ui/card';
import { useDataStore } from '../../hooks/useSimpleDataStore';

interface TaskFormProps {
  onClose?: () => void;
  isOpen?: boolean;
}

export function TaskForm({ onClose, isOpen = false }: TaskFormProps) {
  const [isFormOpen, setIsFormOpen] = useState(isOpen);
  const [title, setTitle] = useState('');
  const [acceptance, setAcceptance] = useState('');
  const [energy, setEnergy] = useState<'deep' | 'shallow'>('shallow');
  const [estMin, setEstMin] = useState('');
  const [tags, setTags] = useState('');
  const [context, setContext] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createTask } = useDataStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await createTask({
        title: title.trim(),
        steps: [{ text: title.trim(), completed: false }],
        acceptance: acceptance.trim() || undefined,
        est_min: estMin ? parseInt(estMin) : undefined,
        est_most: estMin ? parseInt(estMin) * 1.5 : undefined,
        est_max: estMin ? parseInt(estMin) * 2 : undefined,
        energy,
        tags: tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
        context: context.trim() || undefined,
        source: 'manual'
      });

      // Reset form
      setTitle('');
      setAcceptance('');
      setEnergy('shallow');
      setEstMin('');
      setTags('');
      setContext('');
      setIsFormOpen(false);
      onClose?.();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    onClose?.();
  };

  if (!isFormOpen) {
    return (
      <Button
        onClick={() => setIsFormOpen(true)}
        className="w-full"
        style={{
          backgroundColor: 'var(--df-primary)',
          color: 'var(--df-primary-contrast)',
          borderRadius: 'var(--df-radius-sm)',
          minHeight: '48px'
        }}
      >
        <Plus size={20} className="mr-2" />
        Add Task
      </Button>
    );
  }

  return (
    <Card 
      className="p-6"
      style={{
        backgroundColor: 'var(--df-surface)',
        borderColor: 'var(--df-border)',
        borderRadius: 'var(--df-radius-md)',
        boxShadow: 'var(--df-shadow-md)'
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 
          style={{
            fontSize: 'var(--df-type-subtitle-size)',
            fontWeight: 'var(--df-type-subtitle-weight)',
            color: 'var(--df-text)'
          }}
        >
          Create New Task
        </h3>
        
        <Button
          onClick={handleCancel}
          variant="ghost"
          size="sm"
          style={{ 
            color: 'var(--df-text-muted)',
            minHeight: '32px',
            minWidth: '32px'
          }}
        >
          <X size={16} />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            className="block mb-2"
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text)',
              fontWeight: 'var(--df-type-body-weight)'
            }}
          >
            Task Title *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you need to do?"
            required
            style={{
              minHeight: '44px',
              borderColor: 'var(--df-border)',
              backgroundColor: 'var(--df-surface)',
              color: 'var(--df-text)'
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label 
              className="block mb-2"
              style={{
                fontSize: 'var(--df-type-caption-size)',
                color: 'var(--df-text)',
                fontWeight: 'var(--df-type-body-weight)'
              }}
            >
              Energy Level
            </label>
            <Select value={energy} onValueChange={(value: 'deep' | 'shallow') => setEnergy(value)}>
              <SelectTrigger 
                style={{
                  minHeight: '44px',
                  borderColor: 'var(--df-border)',
                  backgroundColor: 'var(--df-surface)',
                  color: 'var(--df-text)'
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shallow">Shallow (Low focus)</SelectItem>
                <SelectItem value="deep">Deep (High focus)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label 
              className="block mb-2"
              style={{
                fontSize: 'var(--df-type-caption-size)',
                color: 'var(--df-text)',
                fontWeight: 'var(--df-type-body-weight)'
              }}
            >
              Estimate (minutes)
            </label>
            <Input
              type="number"
              value={estMin}
              onChange={(e) => setEstMin(e.target.value)}
              placeholder="30"
              min="1"
              style={{
                minHeight: '44px',
                borderColor: 'var(--df-border)',
                backgroundColor: 'var(--df-surface)',
                color: 'var(--df-text)'
              }}
            />
          </div>
        </div>

        <div>
          <label 
            className="block mb-2"
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text)',
              fontWeight: 'var(--df-type-body-weight)'
            }}
          >
            Done Criteria (optional)
          </label>
          <Textarea
            value={acceptance}
            onChange={(e) => setAcceptance(e.target.value)}
            placeholder="How will you know this task is complete?"
            rows={2}
            style={{
              borderColor: 'var(--df-border)',
              backgroundColor: 'var(--df-surface)',
              color: 'var(--df-text)'
            }}
          />
        </div>

        <div>
          <label 
            className="block mb-2"
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text)',
              fontWeight: 'var(--df-type-body-weight)'
            }}
          >
            Tags (optional)
          </label>
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="work, urgent, review (comma separated)"
            style={{
              minHeight: '44px',
              borderColor: 'var(--df-border)',
              backgroundColor: 'var(--df-surface)',
              color: 'var(--df-text)'
            }}
          />
        </div>

        <div>
          <label 
            className="block mb-2"
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text)',
              fontWeight: 'var(--df-type-body-weight)'
            }}
          >
            Context (optional)
          </label>
          <Input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Where or when should this be done?"
            style={{
              minHeight: '44px',
              borderColor: 'var(--df-border)',
              backgroundColor: 'var(--df-surface)',
              color: 'var(--df-text)'
            }}
          />
        </div>

        <div className="flex space-x-3 pt-4">
          <Button
            type="button"
            onClick={handleCancel}
            variant="outline"
            className="flex-1"
            style={{
              borderColor: 'var(--df-border)',
              color: 'var(--df-text)',
              backgroundColor: 'transparent',
              minHeight: '44px'
            }}
          >
            Cancel
          </Button>
          
          <Button
            type="submit"
            disabled={!title.trim() || isSubmitting}
            className="flex-1"
            style={{
              backgroundColor: title.trim() ? 'var(--df-primary)' : 'var(--df-border)',
              color: title.trim() ? 'var(--df-primary-contrast)' : 'var(--df-text-muted)',
              minHeight: '44px'
            }}
          >
            {isSubmitting ? 'Creating...' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Card>
  );
}