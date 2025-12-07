import { supabase } from './supabase/client';
import { projectId, publicAnonKey, edgeFunctionName } from './supabase/info';

export interface User {
  id: string;
  email?: string;
  name?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

class AuthManager {
  private currentUser: User | null = null;
  private currentSession: AuthSession | null = null;
  private initialized = false;
  private listeners: ((user: User | null) => void)[] = [];
  private authSubscription: any = null;

  async initialize() {
    if (this.initialized) return;

    try {
      console.log('AuthManager: Initializing auth state...');

      // Set up auth state change listener first to avoid missing events
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('AuthManager: Auth state changed:', event, session?.user?.id);

        if (session?.user) {
          this.currentUser = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name
          };
          this.currentSession = {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at
          };
          this.notifyListeners(this.currentUser);
        } else {
          this.currentUser = null;
          this.currentSession = null;
          this.notifyListeners(null);
        }
      });

      // Store subscription for cleanup
      this.authSubscription = subscription;

      // Check for existing session
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.warn('Auth session error:', error);
      }

      if (session?.user) {
        this.currentUser = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name
        };
        this.currentSession = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at
        };
        console.log('AuthManager: Existing user session found:', this.currentUser.id);
        this.notifyListeners(this.currentUser);
      } else {
        console.log('AuthManager: No existing session found');
        this.notifyListeners(null);
      }

      this.initialized = true;
      console.log('AuthManager: Initialization completed successfully');
    } catch (error) {
      console.error('Auth initialization failed:', error);
      this.initialized = true; // Set to true to prevent infinite retries
    }
  }

  private notifyListeners(user: User | null) {
    this.listeners.forEach(listener => {
      try {
        listener(user);
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }

  onAuthStateChange(callback: (user: User | null) => void) {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  async signUp(email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/${edgeFunctionName}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ email, password, name })
      });

      let result;
      try {
        const responseText = await response.text();
        console.log('Signup server response:', responseText);
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse signup server response:', parseError);
        return { success: false, error: 'Invalid response from server during signup' };
      }

      if (!response.ok) {
        return { success: false, error: result.error || 'Signup failed' };
      }

      // After successful signup, sign in the user
      return await this.signIn(email, password);
    } catch (error) {
      console.error('SignUp error:', error);
      return { success: false, error: 'Network error during signup' };
    }
  }

  async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('AuthManager: Signing in with Supabase Auth');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Supabase signin error:', error);
        return { success: false, error: error.message };
      }

      if (!data.user || !data.session) {
        return { success: false, error: 'Authentication failed - no session returned' };
      }

      // Store user and session
      this.currentUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name
      };

      this.currentSession = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      };

      // Store session in localStorage for persistence
      localStorage.setItem('df-auth-session', JSON.stringify(this.currentSession));
      localStorage.setItem('df-auth-user', JSON.stringify(this.currentUser));

      console.log('User signed in successfully:', this.currentUser.id);
      this.notifyListeners(this.currentUser);

      return { success: true };
    } catch (error) {
      console.error('SignIn error:', error);
      return { success: false, error: 'Network error during sign in' };
    }
  }

  async signOut() {
    try {
      console.log('AuthManager: Signing out user');

      // Clear Supabase client session
      await supabase.auth.signOut();

      // Clear local state
      this.currentUser = null;
      this.currentSession = null;

      // Clear stored data
      localStorage.removeItem('df-auth-session');
      localStorage.removeItem('df-auth-user');

      console.log('AuthManager: User signed out successfully');
      this.notifyListeners(null);
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if server signout fails, clear local state
      this.currentUser = null;
      this.currentSession = null;
      localStorage.removeItem('df-auth-session');
      localStorage.removeItem('df-auth-user');
      this.notifyListeners(null);
    }
  }

  // Cleanup method
  cleanup() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
      this.authSubscription = null;
    }
    this.listeners = [];
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // If no current user but we have stored session data, restore it
    if (!this.currentUser) {
      try {
        const storedUser = localStorage.getItem('df-auth-user');
        const storedSession = localStorage.getItem('df-auth-session');

        if (storedUser && storedSession) {
          const user = JSON.parse(storedUser);
          const session = JSON.parse(storedSession);

          // Verify session is still valid (basic check)
          if (session?.expires_at && session.expires_at < Date.now() / 1000) {
            // Session expired, clear it
            console.log('Stored session expired, clearing...');
            await this.signOut();
            return null;
          }

          // Validate JWT token format if present
          if (session?.access_token) {
            const tokenParts = session.access_token.split('.');
            if (tokenParts.length !== 3) {
              console.log('Stored session has invalid token format, clearing...');
              await this.signOut();
              return null;
            }

            try {
              const payload = JSON.parse(atob(tokenParts[1]));
              if (!payload.sub || (payload.exp && payload.exp < Date.now() / 1000)) {
                console.log('Stored session token is invalid or expired, clearing...');
                await this.signOut();
                return null;
              }
            } catch (decodeError) {
              console.log('Cannot decode stored session token, clearing...');
              await this.signOut();
              return null;
            }
          }

          this.currentUser = user;
          this.currentSession = session;
          console.log('Restored valid user session from storage:', this.currentUser.id);
        }
      } catch (error) {
        console.error('Error restoring stored session:', error);
        // Clear corrupted data
        localStorage.removeItem('df-auth-session');
        localStorage.removeItem('df-auth-user');
      }
    }

    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  getSession(): AuthSession | null {
    return this.currentSession;
  }

  getAccessToken(): string | null {
    return this.currentSession?.access_token || null;
  }
}

export const authManager = new AuthManager();