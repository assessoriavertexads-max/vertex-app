import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface TrackingLink {
  id: string;
  token: string;
  campaign_id: string;
  campaign_name: string | null;
  platform: string;
  company_id: string | null;
  whatsapp_url: string;
  link_clicks: number;
  last_click_at: string | null;
  confirmed_contacts: number;
  notes: string | null;
  created_at: string;
}

export function useCampaignTracking(companyId?: string | null) {
  const qc = useQueryClient();

  const query = useQuery<TrackingLink[]>({
    queryKey: ['campaign-tracking', companyId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('campaign_tracking_links')
        .select('*')
        .order('created_at', { ascending: false });
      if (companyId) q = q.eq('company_id', companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const createLink = useMutation({
    mutationFn: async (params: {
      campaign_id: string;
      campaign_name: string;
      platform: string;
      company_id: string;
      whatsapp_url: string;
    }) => {
      const { data, error } = await supabase
        .from('campaign_tracking_links')
        .insert(params)
        .select()
        .single();
      if (error) throw error;
      return data as TrackingLink;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-tracking'] }),
  });

  const updateLink = useMutation({
    mutationFn: async ({
      id,
      confirmed_contacts,
      notes,
    }: {
      id: string;
      confirmed_contacts: number;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('campaign_tracking_links')
        .update({
          confirmed_contacts,
          ...(notes !== undefined ? { notes } : {}),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-tracking'] }),
  });

  return { ...query, createLink, updateLink };
}
