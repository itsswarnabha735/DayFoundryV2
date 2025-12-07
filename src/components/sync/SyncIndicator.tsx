import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RotateCcw, Check, WifiOff } from 'lucide-react';
import { getDataStore, SyncStatus } from '../../utils/data/store';

interface SyncIndicatorProps {
  className?: string;
}

export function SyncIndicator({ className = '' }: SyncIndicatorProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('up-to-date');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    const dataStore = getDataStore();
    
    // Set initial status
    setSyncStatus(dataStore.getSyncStatus());
    
    // Listen for sync status changes
    const unsubscribe = dataStore.onStatusChange((status) => {
      setSyncStatus(status);
      
      if (status === 'up-to-date') {
        setLastSyncTime(new Date());
      }
    });

    return unsubscribe;
  }, []);

  const getIndicatorConfig = () => {
    switch (syncStatus) {
      case 'up-to-date':
        return {
          icon: Check,
          color: 'var(--df-success)',
          bgColor: 'var(--df-success)',
          text: 'Up to date',
          description: lastSyncTime 
            ? `Last synced ${formatTime(lastSyncTime)}`
            : 'All changes synced'
        };
      
      case 'syncing':
        return {
          icon: RotateCcw,
          color: 'var(--df-warning)',
          bgColor: 'var(--df-warning)',
          text: 'Syncing',
          description: 'Saving changes...',
          animated: true
        };
      
      case 'offline':
        return {
          icon: WifiOff,
          color: 'var(--df-danger)',
          bgColor: 'var(--df-danger)',
          text: 'Offline',
          description: 'Changes saved locally'
        };
    }
  };

  const config = getIndicatorConfig();
  const Icon = config.icon;

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Status Icon */}
      <div 
        className={`w-6 h-6 rounded-full flex items-center justify-center ${config.animated ? 'animate-spin' : ''}`}
        style={{
          backgroundColor: `${config.bgColor}20`, // 20% opacity
          border: `1px solid ${config.color}40` // 40% opacity
        }}
      >
        <Icon 
          size={12} 
          style={{ color: config.color }}
        />
      </div>

      {/* Status Text (hidden on very small screens) */}
      <div className="hidden sm:block">
        <div 
          className="text-xs font-medium"
          style={{ color: 'var(--df-text)' }}
        >
          {config.text}
        </div>
        
        {config.description && (
          <div 
            className="text-xs"
            style={{ 
              color: 'var(--df-text-muted)',
              fontSize: '10px',
              lineHeight: '1.2'
            }}
          >
            {config.description}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  
  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
}