import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://ssjdirzophcveisnubwj.supabase.co';
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_JoKwCGmQw0GKHh1cZ1SByQ_Fn6OekSR';

export const supabase = createClient(supabaseUrl, supabaseKey);
