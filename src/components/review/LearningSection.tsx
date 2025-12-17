import React, { useState, useEffect } from 'react';
import { Brain, Info, Check, TrendingUp, Target, AlertCircle } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { useEstimateMultipliers } from '../../hooks/useEstimateMultipliers';

interface CategoryMultiplier {
  category: string;
  multiplier: number;
  confidence: 'low' | 'medium' | 'high';
  confidenceBand: {
    lower: number;
    upper: number;
  };
  sampleSize: number;
  isDefault: boolean;
  recentTrend: 'up' | 'down' | 'stable';
}

interface LearningSectionProps {
  onApplyDefaults?: (category: string, multiplier: number) => void;
}

export function LearningSection({ onApplyDefaults }: LearningSectionProps) {
  const [showExplainer, setShowExplainer] = useState(false);
  const { multipliers: dbMultipliers, toggleDefault: dbToggleDefault, loading: multipliersLoading } = useEstimateMultipliers();

  // Mock data for category multipliers (merged with database data when available)
  const [categoryMultipliers, setCategoryMultipliers] = useState<CategoryMultiplier[]>([
    {
      category: 'Deep Work',
      multiplier: 1.35,
      confidence: 'high',
      confidenceBand: { lower: 1.28, upper: 1.42 },
      sampleSize: 47,
      isDefault: true,
      recentTrend: 'stable'
    },
    {
      category: 'Admin Tasks',
      multiplier: 0.92,
      confidence: 'medium',
      confidenceBand: { lower: 0.85, upper: 0.99 },
      sampleSize: 23,
      isDefault: false,
      recentTrend: 'down'
    },
    {
      category: 'Meetings',
      multiplier: 1.08,
      confidence: 'high',
      confidenceBand: { lower: 1.03, upper: 1.13 },
      sampleSize: 38,
      isDefault: true,
      recentTrend: 'up'
    },
    {
      category: 'Creative Work',
      multiplier: 1.67,
      confidence: 'low',
      confidenceBand: { lower: 1.42, upper: 1.92 },
      sampleSize: 12,
      isDefault: false,
      recentTrend: 'up'
    },
    {
      category: 'Research',
      multiplier: 1.89,
      confidence: 'medium',
      confidenceBand: { lower: 1.71, upper: 2.07 },
      sampleSize: 19,
      isDefault: false,
      recentTrend: 'stable'
    }
  ]);

  // Merge database multipliers with local state when available
  useEffect(() => {
    if (dbMultipliers.length > 0) {
      setCategoryMultipliers(prev =>
        prev.map(cat => {
          const dbCat = dbMultipliers.find(m => m.category === cat.category);
          if (dbCat) {
            return {
              ...cat,
              multiplier: dbCat.multiplier,
              confidence: dbCat.confidence,
              sampleSize: dbCat.sample_size,
              isDefault: dbCat.is_default,
            };
          }
          return cat;
        })
      );
    }
  }, [dbMultipliers]);

  const handleToggleDefault = async (category: string) => {
    const currentMultiplier = categoryMultipliers.find(cat => cat.category === category);
    if (!currentMultiplier) return;

    const newIsDefault = !currentMultiplier.isDefault;

    // Optimistically update local state
    setCategoryMultipliers(prev =>
      prev.map(cat =>
        cat.category === category
          ? { ...cat, isDefault: newIsDefault }
          : cat
      )
    );

    // Persist to database
    try {
      await dbToggleDefault(category, newIsDefault);
    } catch (err) {
      console.error('Failed to persist multiplier default:', err);
    }

    // Notify parent component
    if (onApplyDefaults) {
      onApplyDefaults(category, currentMultiplier.multiplier);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'var(--df-success)';
      case 'medium': return 'var(--df-warning)';
      case 'low': return 'var(--df-danger)';
      default: return 'var(--df-text-muted)';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp size={12} style={{ color: 'var(--df-warning)' }} />;
      case 'down':
        return <TrendingUp size={12} style={{ color: 'var(--df-success)', transform: 'rotate(180deg)' }} />;
      default:
        return <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--df-text-muted)' }} />;
    }
  };

  const formatMultiplier = (value: number) => {
    return value.toFixed(2) + '×';
  };

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2
          style={{
            fontSize: 'var(--df-type-subtitle-size)',
            fontWeight: 'var(--df-type-subtitle-weight)',
            color: 'var(--df-text)'
          }}
        >
          Learning
        </h2>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowExplainer(!showExplainer)}
          style={{
            color: 'var(--df-text-muted)',
            fontSize: 'var(--df-type-caption-size)',
            minHeight: '32px'
          }}
        >
          <Info size={14} className="mr-1" />
          {showExplainer ? 'Hide' : 'About'}
        </Button>
      </div>

      {/* Explainer */}
      {showExplainer && (
        <Alert
          className="mb-4"
          style={{
            borderColor: 'var(--df-primary)',
            backgroundColor: 'rgba(37, 99, 235, 0.1)'
          }}
        >
          <Brain size={16} style={{ color: 'var(--df-primary)' }} />
          <AlertDescription style={{ color: 'var(--df-primary)' }}>
            <strong>Outside-view approach:</strong> These multipliers are based on your actual completion times vs. estimates.
            Higher confidence bands indicate more consistent patterns. Apply as defaults to automatically adjust future estimates.
          </AlertDescription>
        </Alert>
      )}

      {/* Category Multipliers */}
      <div className="space-y-3">
        {categoryMultipliers.map((category) => (
          <Card
            key={category.category}
            className="p-4"
            style={{
              backgroundColor: 'var(--df-surface)',
              borderColor: category.isDefault ? 'var(--df-primary)' : 'var(--df-border)',
              borderWidth: category.isDefault ? '2px' : '1px',
              borderRadius: 'var(--df-radius-md)',
              boxShadow: 'var(--df-shadow-sm)'
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4
                    style={{
                      fontSize: 'var(--df-type-body-size)',
                      fontWeight: 'var(--df-type-body-weight)',
                      color: 'var(--df-text)'
                    }}
                  >
                    {category.category}
                  </h4>
                  {getTrendIcon(category.recentTrend)}
                  {category.isDefault && (
                    <Badge
                      variant="secondary"
                      style={{
                        backgroundColor: 'var(--df-primary)',
                        color: 'var(--df-primary-contrast)',
                        fontSize: 'var(--df-type-caption-size)',
                        padding: '2px 6px'
                      }}
                    >
                      Default
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {/* Main Multiplier */}
                  <div>
                    <div
                      style={{
                        fontSize: 'var(--df-type-title-size)',
                        fontWeight: 'var(--df-type-title-weight)',
                        color: category.multiplier > 1.2 ? 'var(--df-warning)' :
                          category.multiplier < 0.9 ? 'var(--df-success)' : 'var(--df-text)'
                      }}
                    >
                      {formatMultiplier(category.multiplier)}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--df-type-caption-size)',
                        color: 'var(--df-text-muted)'
                      }}
                    >
                      Multiplier
                    </div>
                  </div>

                  {/* Confidence Band */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: getConfidenceColor(category.confidence),
                          color: getConfidenceColor(category.confidence),
                          fontSize: 'var(--df-type-caption-size)',
                          textTransform: 'capitalize'
                        }}
                      >
                        {category.confidence} confidence
                      </Badge>
                      <span
                        style={{
                          fontSize: 'var(--df-type-caption-size)',
                          color: 'var(--df-text-muted)'
                        }}
                      >
                        ({category.sampleSize} samples)
                      </span>
                    </div>

                    {/* Confidence Band Visualization */}
                    <div className="relative">
                      <div
                        className="h-2 rounded-full"
                        style={{ backgroundColor: 'var(--df-border)' }}
                      />
                      <div
                        className="absolute top-0 h-2 rounded-full"
                        style={{
                          backgroundColor: getConfidenceColor(category.confidence),
                          opacity: 0.3,
                          left: `${Math.max(0, (category.confidenceBand.lower - 0.5) * 50)}%`,
                          width: `${Math.min(100, (category.confidenceBand.upper - category.confidenceBand.lower) * 50)}%`
                        }}
                      />
                      <div
                        className="absolute top-0.5 w-1 h-1 rounded-full"
                        style={{
                          backgroundColor: getConfidenceColor(category.confidence),
                          left: `${Math.max(0, (category.multiplier - 0.5) * 50)}%`
                        }}
                      />
                    </div>

                    <div
                      className="flex justify-between mt-1"
                      style={{
                        fontSize: 'var(--df-type-caption-size)',
                        color: 'var(--df-text-muted)'
                      }}
                    >
                      <span>{formatMultiplier(category.confidenceBand.lower)}</span>
                      <span>{formatMultiplier(category.confidenceBand.upper)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Apply Default Toggle */}
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor={`default-${category.category}`}
                    style={{
                      fontSize: 'var(--df-type-caption-size)',
                      color: 'var(--df-text-muted)'
                    }}
                  >
                    Apply as default
                  </label>
                  <Switch
                    id={`default-${category.category}`}
                    checked={category.isDefault}
                    onCheckedChange={() => handleToggleDefault(category.category)}
                  />
                </div>

                {category.confidence === 'low' && (
                  <div className="flex items-center gap-1">
                    <AlertCircle size={12} style={{ color: 'var(--df-warning)' }} />
                    <span
                      style={{
                        fontSize: 'var(--df-type-caption-size)',
                        color: 'var(--df-warning)'
                      }}
                    >
                      More data needed
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Description based on multiplier */}
            <div
              style={{
                fontSize: 'var(--df-type-caption-size)',
                color: 'var(--df-text-muted)',
                fontStyle: 'italic'
              }}
            >
              {category.multiplier > 1.5
                ? "Tasks typically take much longer than estimated"
                : category.multiplier > 1.2
                  ? "Tasks tend to overrun estimates"
                  : category.multiplier > 0.9
                    ? "Estimates are generally accurate"
                    : "Tasks often finish faster than estimated"
              }
            </div>
          </Card>
        ))}
      </div>

      {/* Summary Stats */}
      <Card
        className="p-4 mt-4"
        style={{
          backgroundColor: 'var(--df-surface-alt)',
          borderColor: 'var(--df-border)',
          borderRadius: 'var(--df-radius-md)',
          boxShadow: 'var(--df-shadow-sm)'
        }}
      >
        <h4
          className="mb-3"
          style={{
            fontSize: 'var(--df-type-body-size)',
            fontWeight: 'var(--df-type-body-weight)',
            color: 'var(--df-text)'
          }}
        >
          Learning Summary
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div
              style={{
                fontSize: 'var(--df-type-title-size)',
                fontWeight: 'var(--df-type-title-weight)',
                color: 'var(--df-text)'
              }}
            >
              {categoryMultipliers.filter(cat => cat.isDefault).length}/{categoryMultipliers.length}
            </div>
            <div
              style={{
                fontSize: 'var(--df-type-caption-size)',
                color: 'var(--df-text-muted)'
              }}
            >
              Applied as defaults
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 'var(--df-type-title-size)',
                fontWeight: 'var(--df-type-title-weight)',
                color: 'var(--df-text)'
              }}
            >
              {categoryMultipliers.filter(cat => cat.confidence === 'high').length}
            </div>
            <div
              style={{
                fontSize: 'var(--df-type-caption-size)',
                color: 'var(--df-text-muted)'
              }}
            >
              High confidence
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}