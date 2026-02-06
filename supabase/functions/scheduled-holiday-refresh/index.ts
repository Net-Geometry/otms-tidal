import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type JobType = 'monthly_refresh' | 'q4_population' | 'manual_refresh' | string;

function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function createRefreshLog(
  supabase: ReturnType<typeof getAdminClient>,
  jobType: JobType,
  year: number,
) {
  const { data, error } = await supabase
    .from('holiday_refresh_log')
    .insert({
      job_type: jobType,
      year,
      status: 'started',
      holidays_scraped: 0,
      errors: [],
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

async function completeRefreshLog(
  supabase: ReturnType<typeof getAdminClient>,
  logId: string,
  status: 'success' | 'partial' | 'failed',
  details: unknown,
) {
  const payload: Record<string, unknown> = {
    status,
    completed_at: new Date().toISOString(),
    result: details,
  };

  // Best-effort extraction for dashboards
  if (details && typeof details === 'object') {
    const d = details as any;
    const scraped = d?.scrape;
    if (scraped && typeof scraped === 'object') {
      payload.holidays_scraped = Number(scraped.holidays_scraped ?? 0);
      payload.errors = scraped.errors ?? [];
    }
  }

  const { error } = await supabase
    .from('holiday_refresh_log')
    .update(payload)
    .eq('id', logId);

  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = getAdminClient();

  let job_type: JobType = 'manual_refresh';
  let year: number = new Date().getFullYear();

  try {
    const body = await req.json();
    if (body?.job_type) job_type = String(body.job_type);
    if (body?.year) year = Number(body.year);
  } catch {
    // Keep defaults
  }

  let logId: string | null = null;
  try {
    logId = await createRefreshLog(supabase, job_type, year);
  } catch (e) {
    // If audit table is unavailable, continue (silent fallback)
    console.warn('[scheduled-holiday-refresh] Failed to create audit log:', e);
  }

  try {
    const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke(
      'scrape-malaysia-holidays',
      { body: { year } },
    );

    if (scrapeError) throw scrapeError;

    const { data: replInserted, error: replError } = await supabase.rpc('insert_replacement_holidays', {
      p_year: year,
    });

    if (replError) {
      // Treat replacement failures as partial (scrape may still be useful)
      const details = { scrape: scrapeData, replacement: { inserted: replInserted ?? 0, error: replError.message } };
      if (logId) {
        await completeRefreshLog(supabase, logId, 'partial', details);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const status: 'success' | 'partial' = Array.isArray((scrapeData as any)?.errors) && (scrapeData as any).errors.length > 0
      ? 'partial'
      : 'success';

    const details = { scrape: scrapeData, replacement: { inserted: replInserted ?? 0 } };
    if (logId) {
      await completeRefreshLog(supabase, logId, status, details);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[scheduled-holiday-refresh] Job failed (silent):', message);

    if (logId) {
      try {
        await completeRefreshLog(supabase, logId, 'failed', { error: message, job_type, year });
      } catch (e) {
        console.warn('[scheduled-holiday-refresh] Failed to update audit log:', e);
      }
    }
  }

  // Always return success (silent fallback)
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
