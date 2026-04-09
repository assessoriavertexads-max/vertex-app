import { createClient } from '@supabase/supabase-js';

const EXTERNAL_SUPABASE_URL = 'https://zfufkschpimuiedstxyl.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmdWZrc2NocGltdWllZHN0eHlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODcxODMsImV4cCI6MjA5MTA2MzE4M30.DtxT9AXtGW2yWdpX6jF6bvggFRkzwbbPwWBNfRWsYK4';

export const supabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);
