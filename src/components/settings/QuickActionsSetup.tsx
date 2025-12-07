import React, { useState } from 'react';
import { Smartphone, Globe, Copy, ExternalLink, Zap, CheckCircle, Target, Edit3 } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { toast } from 'sonner@2.0.3';
import { 
  generateDeepLinks, 
  generateShortcutInstructions,
  copyDeepLinksToClipboard,
  testDeepLinks,
  QUICK_ACTIONS 
} from '../../utils/deeplinks';

export function QuickActionsSetup() {
  const [activeTab, setActiveTab] = useState('overview');
  const deepLinks = generateDeepLinks();
  const instructions = generateShortcutInstructions();

  const handleCopyLink = async (url: string, actionName: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${actionName} link copied to clipboard!`);
      
      // Haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleCopyAllInstructions = async () => {
    const result = await copyDeepLinksToClipboard();
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const handleTestDeepLinks = () => {
    const results = testDeepLinks();
    console.log('Deep links test results:', results);
    toast.success('Deep links tested - check console for details');
  };

  const getActionIcon = (actionId: string) => {
    switch (actionId) {
      case 'quick-capture': return <Edit3 size={16} />;
      case 'start-focus': return <Target size={16} />;
      case 'add-outcome': return <CheckCircle size={16} />;
      default: return <Zap size={16} />;
    }
  };

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 
            style={{
              fontSize: 'var(--df-type-subtitle-size)',
              fontWeight: 'var(--df-type-subtitle-weight)',
              color: 'var(--df-text)'
            }}
          >
            Quick Actions & Shortcuts
          </h2>
          <p 
            style={{
              fontSize: 'var(--df-type-caption-size)',
              color: 'var(--df-text-muted)'
            }}
          >
            Home screen widgets and deep links
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleTestDeepLinks}
          style={{
            borderColor: 'var(--df-border)',
            color: 'var(--df-text)',
            fontSize: 'var(--df-type-caption-size)',
            minHeight: '36px'
          }}
        >
          <Zap size={14} className="mr-2" />
          Test
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList 
          className="grid w-full grid-cols-3"
          style={{
            backgroundColor: 'var(--df-surface-alt)',
            borderColor: 'var(--df-border)'
          }}
        >
          <TabsTrigger 
            value="overview"
            style={{
              color: activeTab === 'overview' ? 'var(--df-primary)' : 'var(--df-text-muted)',
              fontSize: 'var(--df-type-caption-size)'
            }}
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="ios"
            style={{
              color: activeTab === 'ios' ? 'var(--df-primary)' : 'var(--df-text-muted)',
              fontSize: 'var(--df-type-caption-size)'
            }}
          >
            iOS
          </TabsTrigger>
          <TabsTrigger 
            value="android"
            style={{
              color: activeTab === 'android' ? 'var(--df-primary)' : 'var(--df-text-muted)',
              fontSize: 'var(--df-type-caption-size)'
            }}
          >
            Android/Web
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Alert 
            style={{ 
              borderColor: 'var(--df-primary)', 
              backgroundColor: 'rgba(37, 99, 235, 0.1)'
            }}
          >
            <Zap size={16} style={{ color: 'var(--df-primary)' }} />
            <AlertDescription style={{ color: 'var(--df-primary)' }}>
              Set up home screen shortcuts to instantly access key Day Foundry actions without opening the full app.
            </AlertDescription>
          </Alert>

          {/* Quick Actions Cards */}
          <div className="space-y-3">
            {QUICK_ACTIONS.map((action) => (
              <Card 
                key={action.id}
                className="p-4"
                style={{
                  backgroundColor: 'var(--df-surface)',
                  borderColor: 'var(--df-border)',
                  borderRadius: 'var(--df-radius-md)',
                  boxShadow: 'var(--df-shadow-sm)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: 'var(--df-primary)',
                        color: 'var(--df-primary-contrast)'
                      }}
                    >
                      {getActionIcon(action.id)}
                    </div>
                    <div>
                      <h4 
                        style={{
                          fontSize: 'var(--df-type-body-size)',
                          fontWeight: 'var(--df-type-body-weight)',
                          color: 'var(--df-text)'
                        }}
                      >
                        {action.title}
                      </h4>
                      <p 
                        style={{
                          fontSize: 'var(--df-type-caption-size)',
                          color: 'var(--df-text-muted)'
                        }}
                      >
                        {action.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(action.deepLinkUrl, action.title)}
                      style={{
                        borderColor: 'var(--df-border)',
                        color: 'var(--df-text)',
                        fontSize: 'var(--df-type-caption-size)',
                        minHeight: '36px'
                      }}
                    >
                      <Copy size={14} className="mr-1" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(action.deepLinkUrl, '_blank')}
                      style={{
                        borderColor: 'var(--df-border)',
                        color: 'var(--df-text)',
                        fontSize: 'var(--df-type-caption-size)',
                        minHeight: '36px'
                      }}
                    >
                      <ExternalLink size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleCopyAllInstructions}
              style={{
                backgroundColor: 'var(--df-primary)',
                color: 'var(--df-primary-contrast)',
                fontSize: 'var(--df-type-caption-size)',
                minHeight: '44px'
              }}
            >
              <Copy size={16} className="mr-2" />
              Copy Setup Instructions
            </Button>
          </div>
        </TabsContent>

        {/* iOS Tab */}
        <TabsContent value="ios" className="space-y-4">
          <Card 
            className="p-4"
            style={{
              backgroundColor: 'var(--df-surface)',
              borderColor: 'var(--df-border)',
              borderRadius: 'var(--df-radius-md)',
              boxShadow: 'var(--df-shadow-sm)'
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Smartphone size={20} style={{ color: 'var(--df-primary)' }} />
              <h3 
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                {instructions.ios.title}
              </h3>
            </div>

            <div className="space-y-3">
              {instructions.ios.instructions.map((instruction, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      backgroundColor: instruction.startsWith('   •') ? 'var(--df-surface-alt)' : 'var(--df-primary)',
                      color: instruction.startsWith('   •') ? 'var(--df-text-muted)' : 'var(--df-primary-contrast)',
                      fontSize: 'var(--df-type-caption-size)'
                    }}
                  >
                    {instruction.startsWith('   •') ? '•' : index + 1}
                  </div>
                  <p 
                    style={{
                      fontSize: 'var(--df-type-caption-size)',
                      color: 'var(--df-text)',
                      lineHeight: '1.4'
                    }}
                  >
                    {instruction.replace(/^\s*\d+\.\s*|^\s*•\s*/, '')}
                  </p>
                </div>
              ))}
            </div>

            <Separator className="my-4" style={{ backgroundColor: 'var(--df-border)' }} />

            <div className="space-y-2">
              <h4 
                style={{
                  fontSize: 'var(--df-type-caption-size)',
                  fontWeight: 'var(--df-type-caption-weight)',
                  color: 'var(--df-text)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Quick Copy URLs
              </h4>
              {instructions.ios.shortcuts.map((shortcut) => (
                <div key={shortcut.name} className="flex items-center justify-between p-2 rounded"
                  style={{ backgroundColor: 'var(--df-surface-alt)' }}
                >
                  <span 
                    style={{
                      fontSize: 'var(--df-type-caption-size)',
                      color: 'var(--df-text)'
                    }}
                  >
                    {shortcut.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyLink(shortcut.webUrl, shortcut.name)}
                    style={{
                      color: 'var(--df-primary)',
                      fontSize: 'var(--df-type-caption-size)',
                      minHeight: '28px'
                    }}
                  >
                    <Copy size={12} className="mr-1" />
                    Copy
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Android/Web Tab */}
        <TabsContent value="android" className="space-y-4">
          <Card 
            className="p-4"
            style={{
              backgroundColor: 'var(--df-surface)',
              borderColor: 'var(--df-border)',
              borderRadius: 'var(--df-radius-md)',
              boxShadow: 'var(--df-shadow-sm)'
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Globe size={20} style={{ color: 'var(--df-primary)' }} />
              <h3 
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Android & Web Setup
              </h3>
            </div>

            <div className="space-y-4">
              {/* Android Instructions */}
              <div>
                <h4 
                  className="mb-2"
                  style={{
                    fontSize: 'var(--df-type-caption-size)',
                    fontWeight: 'var(--df-type-caption-weight)',
                    color: 'var(--df-text)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  Android
                </h4>
                <div className="space-y-2">
                  {instructions.android.instructions.slice(0, 3).map((instruction, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          backgroundColor: instruction.startsWith('   •') ? 'var(--df-surface-alt)' : 'var(--df-success)',
                          color: instruction.startsWith('   •') ? 'var(--df-text-muted)' : 'white',
                          fontSize: 'var(--df-type-caption-size)'
                        }}
                      >
                        {instruction.startsWith('   •') ? '•' : index + 1}
                      </div>
                      <p 
                        style={{
                          fontSize: 'var(--df-type-caption-size)',
                          color: 'var(--df-text)',
                          lineHeight: '1.4'
                        }}
                      >
                        {instruction.replace(/^\s*\d+\.\s*|^\s*•\s*/, '')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator style={{ backgroundColor: 'var(--df-border)' }} />

              {/* Web Instructions */}
              <div>
                <h4 
                  className="mb-2"
                  style={{
                    fontSize: 'var(--df-type-caption-size)',
                    fontWeight: 'var(--df-type-caption-weight)',
                    color: 'var(--df-text)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  Web App
                </h4>
                <div className="space-y-2">
                  {instructions.web.instructions.slice(0, 3).map((instruction, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          backgroundColor: instruction.startsWith('   •') ? 'var(--df-surface-alt)' : 'var(--df-warning)',
                          color: instruction.startsWith('   •') ? 'var(--df-text-muted)' : 'white',
                          fontSize: 'var(--df-type-caption-size)'
                        }}
                      >
                        {instruction.startsWith('   •') ? '•' : index + 1}
                      </div>
                      <p 
                        style={{
                          fontSize: 'var(--df-type-caption-size)',
                          color: 'var(--df-text)',
                          lineHeight: '1.4'
                        }}
                      >
                        {instruction.replace(/^\s*\d+\.\s*|^\s*•\s*/, '')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Separator className="my-4" style={{ backgroundColor: 'var(--df-border)' }} />

            <div className="space-y-2">
              <h4 
                style={{
                  fontSize: 'var(--df-type-caption-size)',
                  fontWeight: 'var(--df-type-caption-weight)',
                  color: 'var(--df-text)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Bookmark URLs
              </h4>
              {Object.entries(deepLinks).map(([key, urls]) => {
                const action = QUICK_ACTIONS.find(a => a.id === key);
                return action ? (
                  <div key={key} className="flex items-center justify-between p-2 rounded"
                    style={{ backgroundColor: 'var(--df-surface-alt)' }}
                  >
                    <span 
                      style={{
                        fontSize: 'var(--df-type-caption-size)',
                        color: 'var(--df-text)'
                      }}
                    >
                      {action.title}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyLink(urls.web, action.title)}
                      style={{
                        color: 'var(--df-primary)',
                        fontSize: 'var(--df-type-caption-size)',
                        minHeight: '28px'
                      }}
                    >
                      <Copy size={12} className="mr-1" />
                      Copy
                    </Button>
                  </div>
                ) : null;
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}