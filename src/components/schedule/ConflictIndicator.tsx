import React from 'react';
import { AlertTriangle, Clock, Zap, Calendar } from 'lucide-react';
import { Badge } from '../ui/badge';

interface ConflictIndicatorProps {
  conflictType: 'overrun' | 'overlap' | 'deadline_miss' | 'energy_mismatch' | 'buffer_insufficient';
  severity: 'low' | 'medium' | 'high';
  className?: string;
}

export function ConflictIndicator({ conflictType, severity, className }: ConflictIndicatorProps) {
  const getIcon = () => {
    switch (conflictType) {
      case 'overlap':
        return <Calendar size={12} />;
      case 'overrun':
        return <Clock size={12} />;
      case 'energy_mismatch':
        return <Zap size={12} />;
      case 'buffer_insufficient':
        return <Clock size={12} />;
      default:
        return <AlertTriangle size={12} />;
    }
  };

  const getSeverityColor = () => {
    switch (severity) {
      case 'high':
        return 'var(--df-danger)';
      case 'medium':
        return 'var(--df-warning)';
      case 'low':
        return 'var(--df-success)';
      default:
        return 'var(--df-text-muted)';
    }
  };

  const getSeverityLabel = () => {
    switch (severity) {
      case 'high':
        return '!';
      case 'medium':
        return '⚠';
      case 'low':
        return 'i';
      default:
        return '?';
    }
  };

  return (
    <Badge
      variant="outline"
      className={`flex items-center gap-1 ${className}`}
      style={{
        borderColor: getSeverityColor(),
        color: getSeverityColor(),
        backgroundColor: 'transparent',
        fontSize: '10px',
        height: '18px',
        padding: '2px 6px'
      }}
    >
      {getIcon()}
      <span>{getSeverityLabel()}</span>
    </Badge>
  );
}