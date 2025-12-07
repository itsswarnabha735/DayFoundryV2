import React, { useState } from 'react';
import { WelcomeStep } from './WelcomeStep';
import { WorkHoursStep } from './WorkHoursStep';
import { BreakPreferencesStep } from './BreakPreferencesStep';
import { CalendarNotificationsStep } from './CalendarNotificationsStep';
import { supabase } from '../../utils/supabase/client';
import { authManager } from '../../utils/auth';

export interface OnboardingData {
  privacyMode: 'local' | 'cloud';
  workStart: string;
  workEnd: string;
  noMeetingWindows: { start: string; end: string; label: string }[];
  breakDuration: number;
  breakFrequency: number;
  interruptionBudget: number;
  calendarUrl?: string;
  notificationsEnabled: boolean;
}

interface OnboardingFlowProps {
  onComplete: () => void;
  isDark: boolean;
}

export function OnboardingFlow({ onComplete, isDark }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState<Partial<OnboardingData>>({});

  const steps = [
    WelcomeStep,
    WorkHoursStep,
    BreakPreferencesStep,
    CalendarNotificationsStep
  ];

  const handleNext = async (stepData: Partial<OnboardingData>) => {
    const updatedData = { ...onboardingData, ...stepData };
    setOnboardingData(updatedData);

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Save to localStorage for offline fallback
      localStorage.setItem('df-onboarding-data', JSON.stringify(updatedData));

      // Save to database for persistence
      try {
        const user = await authManager.getCurrentUser();
        if (user?.id) {
          await supabase.from('user_preferences').upsert({
            user_id: user.id,
            privacy_mode: updatedData.privacyMode || 'cloud',
            working_hours_start: updatedData.workStart || '09:00',
            working_hours_end: updatedData.workEnd || '17:00',
            break_duration: updatedData.breakDuration || 15,
            break_frequency: updatedData.breakFrequency || 90,
            interruption_budget: updatedData.interruptionBudget || 3,
            no_meeting_windows: updatedData.noMeetingWindows || [],
            notifications_enabled: updatedData.notificationsEnabled || false,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

          console.log('Saved onboarding preferences to database');
        }
      } catch (error) {
        console.error('Failed to save preferences to database:', error);
        // Continue anyway - localStorage has the data
      }

      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const CurrentStepComponent = steps[currentStep];

  return (
    <div
      className="h-screen flex flex-col"
      style={{
        backgroundColor: 'var(--df-surface)',
        color: 'var(--df-text)'
      }}
    >
      {/* Progress Indicator */}
      <div
        className="flex justify-center pt-6"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0) + 24px)'
        }}
      >
        <div className="flex space-x-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className="w-2 h-2 rounded-full transition-colors"
              style={{
                backgroundColor: index <= currentStep ? 'var(--df-primary)' : 'var(--df-border)',
                transitionDuration: 'var(--df-anim-med)'
              }}
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1">
        <CurrentStepComponent
          onNext={handleNext}
          onBack={currentStep > 0 ? handleBack : undefined}
          data={onboardingData}
          isDark={isDark}
        />
      </div>
    </div>
  );
}