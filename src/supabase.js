import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sfyppbhgmnxpmlcvlhff.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmeXBwYmhnbW54cG1sY3ZsaGZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTEzODgsImV4cCI6MjA5NDk2NzM4OH0.P40U1kt5queRswU-9T2laXkk-Jh4kWHFEOb9yfZtQV8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
