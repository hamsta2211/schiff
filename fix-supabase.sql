-- Supabase SQL to fix table, policies, and foreign keys

-- 1. Make sure high_scores exists
CREATE TABLE IF NOT EXISTS public.high_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- 2. Turn on RLS
ALTER TABLE public.high_scores ENABLE ROW LEVEL SECURITY;

-- 3. Provide SELECT policy (everyone can read)
DROP POLICY IF EXISTS "Public can read high_scores" ON public.high_scores;
CREATE POLICY "Public can read high_scores"
ON public.high_scores FOR SELECT 
USING (true);

-- 4. Provide INSERT policy (users can insert their own scores)
DROP POLICY IF EXISTS "Users can insert their own scores" ON public.high_scores;
CREATE POLICY "Users can insert their own scores"
ON public.high_scores FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 5. Provide UPDATE policy (users can update their own scores)
DROP POLICY IF EXISTS "Users can update their own scores" ON public.high_scores;
CREATE POLICY "Users can update their own scores"
ON public.high_scores FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 6. Provide DELETE policy (users can delete their own scores)
DROP POLICY IF EXISTS "Users can delete their own scores" ON public.high_scores;
CREATE POLICY "Users can delete their own scores"
ON public.high_scores FOR DELETE 
USING (auth.uid() = user_id);

-- 7. Deletion requests table
CREATE TABLE IF NOT EXISTS public.deletion_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    username TEXT,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can request deletion" ON public.deletion_requests;
CREATE POLICY "Users can request deletion"
ON public.deletion_requests FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own requests" ON public.deletion_requests;
CREATE POLICY "Users can view their own requests"
ON public.deletion_requests FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view and delete requests" ON public.deletion_requests;
CREATE POLICY "Admins can view and delete requests"
ON public.deletion_requests USING (auth.jwt() ->> 'email' = 'david.helmel@outlook.com');

