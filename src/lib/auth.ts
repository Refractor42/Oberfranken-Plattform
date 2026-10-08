import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type UserProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type UserInterest = {
  id: string;
  tag: string;
};

export type SavedEvent = {
  id: string;
  event_id: string | null;
  custom_title: string | null;
  custom_date: string | null;
  custom_location: string | null;
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadProfile(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await loadProfile(newSession.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data as UserProfile | null);
  };

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return { session, user, profile, loading, signInWithGoogle, signOut, reloadProfile: () => user && loadProfile(user.id) };
}

export async function fetchInterests(userId: string): Promise<UserInterest[]> {
  const { data, error } = await supabase
    .from('user_interests')
    .select('id, tag')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data as UserInterest[];
}

export async function toggleInterest(userId: string, tag: string, currentlySelected: boolean): Promise<boolean> {
  if (currentlySelected) {
    const { error } = await supabase
      .from('user_interests')
      .delete()
      .eq('user_id', userId)
      .eq('tag', tag);
    return !error;
  }
  const { error } = await supabase
    .from('user_interests')
    .insert({ user_id: userId, tag });
  return !error;
}

export async function fetchSavedEvents(userId: string): Promise<SavedEvent[]> {
  const { data, error } = await supabase
    .from('user_saved_events')
    .select('id, event_id, custom_title, custom_date, custom_location')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data as SavedEvent[];
}

export async function saveEvent(userId: string, eventId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_saved_events')
    .insert({ user_id: userId, event_id: eventId });
  return !error;
}

export async function unsaveEvent(userId: string, eventId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_saved_events')
    .delete()
    .eq('user_id', userId)
    .eq('event_id', eventId);
  return !error;
}

export async function trackBehavior(userId: string, action: string, value: string): Promise<void> {
  await supabase
    .from('user_behavior')
    .insert({ user_id: userId, action, value });
}

export async function deleteAllUserData(): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('delete_user_data');
  if (error) return { success: false, error: error.message };
  return { success: !!data };
}
