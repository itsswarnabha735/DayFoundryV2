import React from 'react';
import { ExternalLink, Key, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';

interface ApiKeySetupProps {
  onDismiss?: () => void;
}

export function ApiKeySetup({ onDismiss }: ApiKeySetupProps) {
  return (
    <Card 
      className="p-6 m-4"
      style={{
        backgroundColor: 'var(--df-surface)',
        borderColor: 'var(--df-border)',
        borderRadius: 'var(--df-radius-md)'
      }}
    >
      <div className="flex items-start space-x-3 mb-4">
        <Key 
          size={24} 
          style={{ color: 'var(--df-primary)' }}
        />
        <div>
          <h3 
            className="mb-2"
            style={{
              fontSize: 'var(--df-type-title-size)',
              fontWeight: 'var(--df-type-title-weight)',
              color: 'var(--df-text)'
            }}
          >
            Gemini API Key Required
          </h3>
          <p 
            className="mb-4"
            style={{
              fontSize: 'var(--df-type-body-size)',
              color: 'var(--df-text-muted)',
              lineHeight: '1.5'
            }}
          >
            To enable intelligent task extraction from your captures, you'll need to provide a Google Gemini API key.
          </p>
        </div>
      </div>

      <Alert className="mb-4">
        <AlertCircle size={16} />
        <AlertDescription>
          Your API key is stored securely and only used for task extraction. It never leaves your secure environment.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div>
          <h4 
            className="mb-2"
            style={{
              fontSize: 'var(--df-type-subtitle-size)',
              fontWeight: 'var(--df-type-subtitle-weight)',
              color: 'var(--df-text)'
            }}
          >
            Steps to set up:
          </h4>
          <ol 
            className="space-y-2 ml-4"
            style={{
              fontSize: 'var(--df-type-body-size)',
              color: 'var(--df-text-muted)',
              lineHeight: '1.5'
            }}
          >
            <li>1. Visit Google AI Studio and create a Gemini API key</li>
            <li>2. Upload your API key using the environment variable modal</li>
            <li>3. Try capturing and extracting a task</li>
          </ol>
        </div>

        <div className="flex space-x-3">
          <Button
            asChild
            style={{
              backgroundColor: 'var(--df-primary)',
              color: 'var(--df-primary-contrast)',
              minHeight: '44px'
            }}
          >
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-2"
            >
              <span>Get API Key</span>
              <ExternalLink size={16} />
            </a>
          </Button>
          
          {onDismiss && (
            <Button
              variant="outline"
              onClick={onDismiss}
              style={{
                borderColor: 'var(--df-border)',
                color: 'var(--df-text)',
                minHeight: '44px'
              }}
            >
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}