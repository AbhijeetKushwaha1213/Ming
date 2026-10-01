import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://cmcbkatdyhunlvlktwlv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtY2JrYXRkeWh1bmx2bGt0d2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzOTc2MjIsImV4cCI6MjA1OTk3MzYyMn0.Q45bsnjT3BLNPeuth7CKXZ8O4Z3YLJJ55ez_bVCUYvk';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export async function verifySupabaseToken(authHeader?: string): Promise<AuthenticatedUser> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing bearer token');
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new Error('Missing bearer token');
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error('Invalid or expired session');
  }

  return {
    id: data.user.id,
    email: data.user.email,
  };
}
