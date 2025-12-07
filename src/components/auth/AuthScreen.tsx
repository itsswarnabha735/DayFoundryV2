import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';

interface AuthScreenProps {
  onAuthSuccess: () => void;
  isDark: boolean;
}

type AuthMode = 'signin' | 'signup';

interface FormData {
  email: string;
  password: string;
  name: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  name?: string;
  general?: string;
}

export function AuthScreen({ onAuthSuccess, isDark }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    name: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    // Name validation for signup
    if (mode === 'signup' && !formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const { authManager } = await import('../../utils/auth');
      
      if (mode === 'signup') {
        const result = await authManager.signUp(
          formData.email,
          formData.password,
          formData.name
        );

        if (!result.success) {
          throw new Error(result.error || 'Signup failed');
        }

        console.log('Signup successful');
      } else {
        const result = await authManager.signIn(
          formData.email,
          formData.password
        );

        if (!result.success) {
          throw new Error(result.error || 'Sign in failed');
        }

        console.log('Sign in successful');
      }

      // Authentication successful
      onAuthSuccess();
    } catch (error) {
      console.error('Authentication error:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'Authentication failed. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    
    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setErrors({});
  };

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ 
        backgroundColor: 'var(--df-surface)',
        color: 'var(--df-text)'
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-center py-6"
        style={{ paddingTop: 'env(safe-area-inset-top, 24px)' }}
      >
        <div className="flex items-center space-x-3">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--df-primary)' }}
          >
            <span 
              className="font-semibold"
              style={{ 
                color: 'var(--df-primary-contrast)',
                fontSize: 'var(--df-type-body-size)'
              }}
            >
              DF
            </span>
          </div>
          <h1 
            className="font-semibold"
            style={{
              fontSize: 'var(--df-type-title-size)',
              fontWeight: 'var(--df-type-title-weight)',
              color: 'var(--df-text)'
            }}
          >
            Day Foundry
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {/* Welcome Section */}
          <div className="text-center mb-8">
            <h2 
              className="mb-2"
              style={{
                fontSize: 'var(--df-type-display-size)',
                fontWeight: 'var(--df-type-display-weight)',
                color: 'var(--df-text)'
              }}
            >
              {mode === 'signin' ? 'Welcome back' : 'Get started'}
            </h2>
            <p 
              style={{
                fontSize: 'var(--df-type-body-size)',
                color: 'var(--df-text-muted)'
              }}
            >
              {mode === 'signin' 
                ? 'Sign in to access your productivity workspace'
                : 'Create your account to start organizing your day'
              }
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* General Error */}
            {errors.general && (
              <Alert style={{ borderColor: 'var(--df-danger)' }}>
                <AlertCircle size={16} style={{ color: 'var(--df-danger)' }} />
                <AlertDescription style={{ color: 'var(--df-danger)' }}>
                  {errors.general}
                </AlertDescription>
              </Alert>
            )}

            {/* Name Field (Signup only) */}
            {mode === 'signup' && (
              <div>
                <label 
                  htmlFor="name" 
                  className="block mb-2"
                  style={{
                    fontSize: 'var(--df-type-body-size)',
                    fontWeight: 'var(--df-type-body-weight)',
                    color: 'var(--df-text)'
                  }}
                >
                  Full name
                </label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange('name')}
                  placeholder="Enter your full name"
                  disabled={isLoading}
                  style={{
                    minHeight: '44px',
                    borderColor: errors.name ? 'var(--df-danger)' : 'var(--df-border)',
                    borderRadius: 'var(--df-radius-sm)'
                  }}
                />
                {errors.name && (
                  <p 
                    className="mt-1 text-sm"
                    style={{ color: 'var(--df-danger)' }}
                  >
                    {errors.name}
                  </p>
                )}
              </div>
            )}

            {/* Email Field */}
            <div>
              <label 
                htmlFor="email" 
                className="block mb-2"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Email address
              </label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange('email')}
                placeholder="Enter your email"
                disabled={isLoading}
                style={{
                  minHeight: '44px',
                  borderColor: errors.email ? 'var(--df-danger)' : 'var(--df-border)',
                  borderRadius: 'var(--df-radius-sm)'
                }}
              />
              {errors.email && (
                <p 
                  className="mt-1 text-sm"
                  style={{ color: 'var(--df-danger)' }}
                >
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label 
                htmlFor="password" 
                className="block mb-2"
                style={{
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)',
                  color: 'var(--df-text)'
                }}
              >
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange('password')}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  style={{
                    minHeight: '44px',
                    borderColor: errors.password ? 'var(--df-danger)' : 'var(--df-border)',
                    borderRadius: 'var(--df-radius-sm)',
                    paddingRight: '44px'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  style={{
                    color: 'var(--df-text-muted)',
                    minHeight: '24px',
                    minWidth: '24px'
                  }}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p 
                  className="mt-1 text-sm"
                  style={{ color: 'var(--df-danger)' }}
                >
                  {errors.password}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
              style={{
                minHeight: '48px',
                backgroundColor: 'var(--df-primary)',
                color: 'var(--df-primary-contrast)',
                borderRadius: 'var(--df-radius-sm)',
                fontSize: 'var(--df-type-body-size)',
                fontWeight: 'var(--df-type-body-weight)',
                marginTop: 'var(--df-space-24)'
              }}
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                mode === 'signin' ? 'Sign in' : 'Create account'
              )}
            </Button>
          </form>

          {/* Mode Switch */}
          <div className="mt-6 text-center">
            <p 
              style={{
                fontSize: 'var(--df-type-body-size)',
                color: 'var(--df-text-muted)'
              }}
            >
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={switchMode}
                disabled={isLoading}
                className="underline hover:no-underline transition-all"
                style={{
                  color: 'var(--df-primary)',
                  fontSize: 'var(--df-type-body-size)',
                  fontWeight: 'var(--df-type-body-weight)'
                }}
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div 
        className="text-center py-6"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 24px)' }}
      >
        <p 
          className="text-sm"
          style={{
            fontSize: 'var(--df-type-caption-size)',
            color: 'var(--df-text-muted)'
          }}
        >
          By continuing, you agree to our privacy policy
        </p>
      </div>
    </div>
  );
}