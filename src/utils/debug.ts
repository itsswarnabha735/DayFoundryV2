// Debug utilities for Day Foundry

export const debugAuth = async () => {
  const { supabase } = await import('./supabase/client');
  
  console.log('=== Auth Debug Info ===');
  
  try {
    // Check current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Current session:', {
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
      tokenLength: session?.access_token?.length,
      userId: session?.user?.id,
      expiresAt: session?.expires_at,
      error: sessionError?.message
    });
    
    // Check current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('Current user:', {
      hasUser: !!user,
      userId: user?.id,
      email: user?.email,
      error: userError?.message
    });
    
    // Test a simple query
    try {
      const { data, error } = await supabase
        .from('captured_items')
        .select('id')
        .limit(1);
      console.log('DB query test:', {
        success: !error,
        error: error?.message,
        hasData: !!data
      });
    } catch (dbError) {
      console.log('DB query test failed:', dbError);
    }
    
  } catch (error) {
    console.error('Auth debug failed:', error);
  }
  
  console.log('=== End Auth Debug ===');
};

// Add to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).debugAuth = debugAuth;
}