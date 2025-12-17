import React, { useEffect, useState } from 'react';
import { useDataStore } from '../../hooks/useSimpleDataStore';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { supabase } from '../../utils/supabase/client';
import { toast } from 'sonner';

export function OAuthCallback() {
    const { authManager } = useDataStore();
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const handleCallback = async () => {
            console.log('OAuthCallback: Component mounted, checking for code...');
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            const error = params.get('error');

            console.log('OAuthCallback: URL params', { hasCode: !!code, hasError: !!error });

            if (error) {
                console.error('OAuthCallback: OAuth error from Google:', error);
                toast.error('Google Calendar connection failed');
                // Clear params
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }

            if (!code) {
                console.log('OAuthCallback: No code in URL, skipping');
                return;
            }

            if (isProcessing) {
                console.log('OAuthCallback: Already processing, skipping');
                return;
            }

            setIsProcessing(true);
            console.log('OAuthCallback: Starting token exchange...');
            const toastId = toast.loading('Connecting Google Calendar...');

            try {
                // Ensure session is fresh
                const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
                if (sessionError || !session) {
                    console.error('OAuthCallback: Failed to refresh session:', sessionError);
                    throw new Error('User not authenticated (session refresh failed)');
                }

                console.log('--- DEBUG: OAuth Callback Connection ---');
                console.log('Project ID:', projectId);
                console.log('Anon Key:', publicAnonKey ? `${publicAnonKey.substring(0, 10)}...` : 'UNDEFINED');
                console.log('Token:', session.access_token ? `${session.access_token.substring(0, 10)}...` : 'UNDEFINED');
                console.log('User ID:', session.user.id);

                console.log('OAuthCallback: Making POST request to Edge Function...');
                const response = await fetch(`https://${projectId}.supabase.co/functions/v1/calendar-auth/callback`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': publicAnonKey
                    },
                    body: JSON.stringify({
                        code,
                        user_id: session.user.id
                    })
                });

                console.log('OAuthCallback: Response status:', response.status, response.statusText);

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('OAuthCallback: Error response:', errorData);
                    throw new Error(errorData.error || 'Failed to exchange token');
                }

                const data = await response.json();
                console.log('OAuthCallback: Token exchange successful!', data);

                if (data.webhook && !data.webhook.success) {
                    console.error('Webhook registration failed:', data.webhook.error);
                    alert(`⚠️ Calendar connected, but real-time sync failed: ${data.webhook.error}`);
                } else {
                    alert('✅ Google Calendar connected successfully!');
                }

                // Reload the page to show the connected calendar
                setTimeout(() => {
                    window.location.href = window.location.pathname;
                }, 500);
            } catch (err) {
                console.error('OAuth callback error:', err);
                alert('❌ Failed to connect Google Calendar: ' + (err instanceof Error ? err.message : 'Unknown error'));
            } finally {
                setIsProcessing(false);
                // Clear code from URL so we don't process it again
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        };

        handleCallback();
    }, [authManager]);

    return null; // This component doesn't render anything visible
}
