import React, { useState } from 'react';
import { Shield, Cloud, HardDrive } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { OnboardingData } from './OnboardingFlow';

interface WelcomeStepProps {
  onNext: (data: Partial<OnboardingData>) => void;
  onBack?: () => void;
  data: Partial<OnboardingData>;
  isDark: boolean;
}

export function WelcomeStep({ onNext, data, isDark }: WelcomeStepProps) {
  const [selectedMode, setSelectedMode] = useState<'local' | 'cloud' | null>(
    data.privacyMode || null
  );

  const handleContinue = () => {
    if (selectedMode) {
      onNext({ privacyMode: selectedMode });
    }
  };

  return (
    <div className="flex flex-col h-full px-6 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div 
          className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: 'var(--df-primary)',
            color: 'var(--df-primary-contrast)'
          }}
        >
          <Shield size={32} />
        </div>
        
        <h1 
          className="mb-4"
          style={{
            fontSize: 'var(--df-type-display-size)',
            fontWeight: 'var(--df-type-display-weight)',
            color: 'var(--df-text)'
          }}
        >
          Welcome to Day Foundry
        </h1>
        
        <p 
          className="max-w-sm mx-auto"
          style={{
            fontSize: 'var(--df-type-body-size)',
            color: 'var(--df-text-muted)',
            lineHeight: '1.5'
          }}
        >
          Your personal productivity system that helps you compose, schedule, and focus on what matters most.
        </p>
      </div>

      {/* Privacy Mode Selection */}
      <div className="flex-1 max-w-md mx-auto w-full">
        <h2 
          className="mb-6 text-center"
          style={{
            fontSize: 'var(--df-type-title-size)',
            fontWeight: 'var(--df-type-title-weight)',
            color: 'var(--df-text)'
          }}
        >
          Choose your privacy mode
        </h2>

        <div className="space-y-4 mb-8">
          <PrivacyModeCard
            icon={HardDrive}
            title="Local-only"
            description="All data stays on your device. Perfect for sensitive work or when offline."
            features={['Complete privacy', 'Works offline', 'No cloud sync']}
            isSelected={selectedMode === 'local'}
            onClick={() => setSelectedMode('local')}
          />
          
          <PrivacyModeCard
            icon={Cloud}
            title="Cloud-assist"
            description="Enhanced with AI features while keeping your data secure."
            features={['AI task extraction', 'Smart scheduling', 'Cross-device sync']}
            isSelected={selectedMode === 'cloud'}
            onClick={() => setSelectedMode('cloud')}
          />
        </div>

        <div className="text-center mb-6">
          <p 
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)',
              lineHeight: '1.4'
            }}
          >
            You can change this anytime in Settings. Day Foundry never shares your personal data with third parties.
          </p>
        </div>
      </div>

      {/* Continue Button */}
      <div className="pb-6">
        <Button
          onClick={handleContinue}
          disabled={!selectedMode}
          className="w-full"
          style={{
            backgroundColor: selectedMode ? 'var(--df-primary)' : 'var(--df-border)',
            color: selectedMode ? 'var(--df-primary-contrast)' : 'var(--df-text-muted)',
            borderRadius: 'var(--df-radius-sm)',
            minHeight: '48px',
            fontSize: 'var(--df-type-body-size)',
            fontWeight: 'var(--df-type-body-weight)'
          }}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

interface PrivacyModeCardProps {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  description: string;
  features: string[];
  isSelected: boolean;
  onClick: () => void;
}

function PrivacyModeCard({ 
  icon: Icon, 
  title, 
  description, 
  features, 
  isSelected, 
  onClick 
}: PrivacyModeCardProps) {
  return (
    <Card
      className="p-4 cursor-pointer transition-all duration-200"
      onClick={onClick}
      style={{
        backgroundColor: 'var(--df-surface)',
        borderColor: isSelected ? 'var(--df-primary)' : 'var(--df-border)',
        borderWidth: isSelected ? '2px' : '1px',
        borderRadius: 'var(--df-radius-md)',
        boxShadow: isSelected ? 'var(--df-shadow-md)' : 'var(--df-shadow-sm)',
        minHeight: '120px'
      }}
    >
      <div className="flex items-start space-x-3">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: isSelected ? 'var(--df-primary)' : 'var(--df-surface-alt)',
            color: isSelected ? 'var(--df-primary-contrast)' : 'var(--df-text-muted)'
          }}
        >
          <Icon size={20} />
        </div>
        
        <div className="flex-1">
          <h3 
            className="mb-2"
            style={{
              fontSize: 'var(--df-type-subtitle-size)',
              fontWeight: 'var(--df-type-subtitle-weight)',
              color: 'var(--df-text)'
            }}
          >
            {title}
          </h3>
          
          <p 
            className="mb-3"
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)',
              lineHeight: '1.4'
            }}
          >
            {description}
          </p>
          
          <ul className="space-y-1">
            {features.map((feature, index) => (
              <li 
                key={index}
                className="flex items-center space-x-2"
                style={{
                  fontSize: 'var(--df-type-caption-size)',
                  color: 'var(--df-text-muted)'
                }}
              >
                <div 
                  className="w-1 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--df-text-muted)' }}
                />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}