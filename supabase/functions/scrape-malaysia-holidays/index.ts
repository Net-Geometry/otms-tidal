/**
 * Supabase Edge Function: scrape-malaysia-holidays
 * Story: 7-2-web-scraping-holiday-engine
 *
 * Scrapes Malaysian public holidays from web sources and stores them in the database.
 * Supports multi-source fallback and intelligent caching.
 */ import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
function classifyHoliday(name) {
  const lowerName = name.toLowerCase();
  // Federal holidays (nationwide)
  const federalKeywords = [
    'national day',
    'malaysia day',
    'labour day',
    'labor day',
    'agong birthday',
    'yang di-pertuan agong',
    'merdeka',
    'new year',
    'federal territory'
  ];
  for (const keyword of federalKeywords){
    if (lowerName.includes(keyword)) {
      return 'federal';
    }
  }
  // Religious holidays
  const religiousKeywords = [
    'hari raya',
    'aidilfitri',
    'aidiladha',
    'eid',
    'chinese new year',
    'cny',
    'deepavali',
    'diwali',
    'wesak',
    'vesak',
    'thaipusam',
    'maulud',
    'prophet muhammad',
    'nuzul',
    "isra' mi'raj",
    'isra and mi\'raj',
    'awal muharram',
    'christmas',
    'good friday',
    'gawai',
    'pesta kaamatan',
    'harvest festival'
  ];
  for (const keyword of religiousKeywords){
    if (lowerName.includes(keyword)) {
      return 'religious';
    }
  }
  // State-specific holidays (Sultan/Ruler birthdays, state celebrations)
  const stateKeywords = [
    'sultan',
    'raja',
    'governor',
    'yang di-pertua',
    'birthday',
    'installation',
    'coronation',
    'state'
  ];
  for (const keyword of stateKeywords){
    if (lowerName.includes(keyword)) {
      return 'state';
    }
  }
  // Default to state holiday if no specific classification matches
  return 'state';
}
function normalizeHolidayName(name) {
  return name.trim().replace(/\s+/g, ' ') // Replace multiple spaces with single space
  .replace(/\s*\([^)]*\)/g, '') // Remove parenthetical notes
  .replace(/\s*-\s*/g, ' - ') // Normalize dashes with spaces
  .trim();
}
function isValidHolidayName(name) {
  if (!name || name.trim().length === 0) return false;
  if (name.trim().length < 3) return false; // Too short to be meaningful
  if (/^[\d\s\-\/]+$/.test(name)) return false; // Only numbers and punctuation
  return true;
}
function normalizeStateCode(stateName) {
  const lowerState = stateName.toLowerCase().trim();
  const stateMap = {
    'johor': 'JHR',
    'kedah': 'KDH',
    'kelantan': 'KTN',
    'kuala lumpur': 'WPKL',
    'kul': 'WPKL',
    'wpkl': 'WPKL',
    'labuan': 'WPLB',
    'lbn': 'WPLB',
    'wplb': 'WPLB',
    'melaka': 'MLK',
    'malacca': 'MLK',
    'negeri sembilan': 'NSN',
    'pahang': 'PHG',
    'penang': 'PNG',
    'pulau pinang': 'PNG',
    'perak': 'PRK',
    'perlis': 'PLS',
    'putrajaya': 'WPPJ',
    'pjy': 'WPPJ',
    'wppj': 'WPPJ',
    'sabah': 'SBH',
    'sarawak': 'SWK',
    'selangor': 'SGR',
    'terengganu': 'TRG',
    'federal': 'ALL',
    'nationwide': 'ALL',
    'malaysia': 'ALL'
  };
  return stateMap[lowerState] || stateName.toUpperCase().substring(0, 3);
}

function officeholidaysUrl(stateCode, year) {
  const code = normalizeStateCode(stateCode);

  const slugMap = {
    JHR: 'johor',
    KDH: 'kedah',
    KTN: 'kelantan',
    WPKL: 'kuala-lumpur',
    WPLB: 'labuan',
    MLK: 'melaka',
    NSN: 'negeri-sembilan',
    PHG: 'pahang',
    PNG: 'penang',
    PRK: 'perak',
    PLS: 'perlis',
    WPPJ: 'putrajaya',
    SBH: 'sabah',
    SWK: 'sarawak',
    SGR: 'selangor',
    TRG: 'terengganu',
  };

  if (code === 'ALL') {
    return `https://www.officeholidays.com/countries/malaysia/${year}`;
  }

  const slug = slugMap[code];
  if (!slug) {
    throw new Error(`Unsupported state code for officeholidays: ${stateCode}`);
  }

  return `https://www.officeholidays.com/countries/malaysia/${slug}/${year}`;
}
async function respectfulDelay(ms = 2500) {
  await new Promise((resolve)=>setTimeout(resolve, ms));
}
function parseDate(dateStr, year) {
  try {
    // Remove extra whitespace
    const cleaned = dateStr.trim();
    const monthMap = {
      'jan': 1,
      'january': 1,
      'feb': 2,
      'february': 2,
      'mar': 3,
      'march': 3,
      'apr': 4,
      'april': 4,
      'may': 5,
      'jun': 6,
      'june': 6,
      'jul': 7,
      'july': 7,
      'aug': 8,
      'august': 8,
      'sep': 9,
      'september': 9,
      'oct': 10,
      'october': 10,
      'nov': 11,
      'november': 11,
      'dec': 12,
      'december': 12
    };
    // Try "Month Day" format
    let match = cleaned.match(/^(\w+)\s+(\d{1,2})$/);
    if (match) {
      const month = monthMap[match[1].toLowerCase()];
      const day = parseInt(match[2]);
      if (month && day) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    // Try "Day Month" format
    match = cleaned.match(/^(\d{1,2})\s+(\w+)$/);
    if (match) {
      const day = parseInt(match[1]);
      const month = monthMap[match[2].toLowerCase()];
      if (month && day) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    // Try ISO format
    match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return cleaned;
    }
    // Try to use Date constructor as fallback
    const dateObj = new Date(`${cleaned} ${year}`);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
    return null;
  } catch (error) {
    console.error('Date parsing error:', error);
    return null;
  }
}
async function scrapeOfficeholidays(state, year) {
  const url = officeholidaysUrl(state, year);
  console.log(`Scraping officeholidays.com for ${state} ${year}...`);
  // Respectful scraping delay
  await respectfulDelay(2000);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OTMS-Holiday-Scraper/1.0; +https://github.com/your-org/otms)'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const html = await response.text();
    const holidays = [];
    // Parse holiday table rows
    const tableRowPattern = /<tr[^>]*>(.*?)<\/tr>/gs;
    const rows = html.match(tableRowPattern) || [];
    for (const row of rows){
      const cellPattern = /<td[^>]*>(.*?)<\/td>/gs;
      const cells = Array.from(row.matchAll(cellPattern)).map((m)=>m[1].replace(/<[^>]+>/g, '').trim());
      // Expected format: Day | Date | Holiday Name | Type | Comments
      if (cells.length >= 4) {
        const dateStr = cells[1];
        const nameStr = cells[2];
        const pageTypeStr = cells[3] || '';

        if (pageTypeStr.toLowerCase().includes('not a public holiday')) {
          continue;
        }

        const date = parseDate(dateStr, year);
        const name = normalizeHolidayName(nameStr);
        if (date && isValidHolidayName(name)) {
          const stateCode = normalizeStateCode(state);
          const isNational = pageTypeStr.toLowerCase().includes('national holiday');
          const holidayType = isNational ? 'federal' : classifyHoliday(name);

          holidays.push({
            date,
            name,
            state: isNational ? 'ALL' : stateCode,
            type: holidayType,
            source: url,
            year
          });
        }
      }
    }
    console.log(`Scraped ${holidays.length} holidays from officeholidays.com`);
    return holidays;
  } catch (error) {
    console.error('officeholidays.com scraping failed:', error);
    throw error;
  }
}
async function scrapePublicholidays(state, year) {
  const url = `https://publicholidays.my/${year}-dates/`;
  console.log(`Scraping publicholidays.my for ${state} ${year}...`);
  await respectfulDelay(2500);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OTMS-Holiday-Scraper/1.0; +https://github.com/your-org/otms)'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const html = await response.text();
    const holidays = [];
    // Parse HTML structure specific to publicholidays.my
    const holidayPattern = /<div class="holiday"[^>]*>(.*?)<\/div>/gs;
    const matches = html.match(holidayPattern) || [];
    for (const match of matches){
      const dateMatch = match.match(/data-date="([^"]+)"/);
      const nameMatch = match.match(/<h3[^>]*>(.*?)<\/h3>/);
      const stateMatch = match.match(/data-states="([^"]+)"/);
      if (dateMatch && nameMatch) {
        const date = dateMatch[1];
        const name = normalizeHolidayName(nameMatch[1].replace(/<[^>]+>/g, ''));
        const states = stateMatch ? stateMatch[1].split(',') : [
          'ALL'
        ];
        if (states.includes('ALL') || states.includes(state) || states.includes(normalizeStateCode(state))) {
           if (isValidHolidayName(name)) {
             const holidayType = classifyHoliday(name);
             holidays.push({
               date,
               name,
               state: holidayType === 'federal' ? 'ALL' : normalizeStateCode(state),
               type: holidayType,
               source: url,
               year
             });
           }
         }
       }
      }
    console.log(`Scraped ${holidays.length} holidays from publicholidays.my`);
    return holidays;
  } catch (error) {
    console.error('publicholidays.my scraping failed:', error);
    throw error;
  }
}
async function scrapeTimeanddate(state, year) {
  const url = `https://www.timeanddate.com/holidays/malaysia/${year}`;
  console.log(`Scraping timeanddate.com for ${state} ${year}...`);
  await respectfulDelay(3000);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OTMS-Holiday-Scraper/1.0; +https://github.com/your-org/otms)'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const html = await response.text();
    const holidays = [];
    // Parse timeanddate.com's table structure
    const rowPattern = /<tr[^>]*class="[^"]*showrow[^"]*"[^>]*>(.*?)<\/tr>/gs;
    const rows = html.match(rowPattern) || [];
    for (const row of rows){
      const cellPattern = /<td[^>]*>(.*?)<\/td>/gs;
      const cells = Array.from(row.matchAll(cellPattern)).map((m)=>m[1].replace(/<[^>]+>/g, '').trim());
      if (cells.length >= 2) {
        const dateStr = cells[0];
        const nameStr = cells[1];
        const date = parseDate(dateStr, year);
        const name = normalizeHolidayName(nameStr);
        if (date && isValidHolidayName(name)) {
          holidays.push({
            date,
            name,
            state: 'ALL',
            type: classifyHoliday(name),
            source: url,
            year
          });
        }
      }
    }
    console.log(`Scraped ${holidays.length} holidays from timeanddate.com`);
    return holidays;
  } catch (error) {
    console.error('timeanddate.com scraping failed:', error);
    throw error;
  }
}
async function scrapeHolidaysWithFallback(state, year) {
  // Try primary source
  try {
    const holidays = await scrapeOfficeholidays(state, year);
    if (holidays.length > 0) {
      console.log(`Successfully scraped ${holidays.length} holidays from primary source`);
      return holidays;
    }
  } catch (error) {
    console.warn('Primary source (officeholidays.com) failed:', error);
  }
  // Try fallback source 1
  try {
    const holidays = await scrapePublicholidays(state, year);
    if (holidays.length > 0) {
      console.log(`Successfully scraped ${holidays.length} holidays from fallback source 1`);
      return holidays;
    }
  } catch (error) {
    console.warn('Fallback source 1 (publicholidays.my) failed:', error);
  }
  // Try fallback source 2
  try {
    const holidays = await scrapeTimeanddate(state, year);
    if (holidays.length > 0) {
      console.log(`Successfully scraped ${holidays.length} holidays from fallback source 2`);
      return holidays;
    }
  } catch (error) {
    console.error('Fallback source 2 (timeanddate.com) failed:', error);
  }
  // All sources failed
  throw new Error('All holiday sources are currently unavailable. Please try again later.');
}
function deduplicateHolidays(holidays) {
  const seen = new Set();
  const unique = [];
  for (const holiday of holidays){
    const key = `${holiday.date}|${holiday.name}|${holiday.state}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(holiday);
    }
  }
  return unique;
}
// ============================================================================
// Edge Function Handler
// ============================================================================
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Create Supabase client with service role key for database operations
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    // Parse request body
    const { state, year, states } = await req.json();
    // Default to current year if not specified
    const targetYear = year || new Date().getFullYear();
    // Determine which states to scrape
    let statesToScrape = [];
    if (states && Array.isArray(states)) {
      statesToScrape = states;
    } else if (state && String(state).toUpperCase() !== 'ALL') {
      statesToScrape = [
        state
      ];
    } else {
      // Default to all Malaysian states
      statesToScrape = [
        'JHR',
        'KDH',
        'KTN',
        'MLK',
        'NSN',
        'PHG',
        'PNG',
        'PRK',
        'PLS',
        'SBH',
        'SWK',
        'SGR',
        'TRG',
        'WPKL',
        'WPPJ',
        'WPLB'
      ];
    }
    console.log(`Starting holiday scraping for ${statesToScrape.length} states for year ${targetYear}`);
    const allHolidays = [];
    const errors = [];
    let successCount = 0;
    // Scrape holidays for each state
    for (const stateCode of statesToScrape){
      try {
        console.log(`Scraping holidays for state: ${stateCode}`);
        const holidays = await scrapeHolidaysWithFallback(stateCode, targetYear);
        allHolidays.push(...holidays);
        successCount++;
        console.log(`Successfully scraped ${holidays.length} holidays for ${stateCode}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to scrape holidays for ${stateCode}:`, errorMessage);
        errors.push({
          state: stateCode,
          error: errorMessage
        });
      }
    }
    // Deduplicate holidays
    const uniqueHolidays = deduplicateHolidays(allHolidays);
    console.log(`Total holidays after deduplication: ${uniqueHolidays.length}`);
    // Store holidays in database
    if (uniqueHolidays.length > 0) {
      // Use upsert to handle duplicates gracefully
      const { data, error: dbError } = await supabaseClient.from('malaysian_holidays').upsert(uniqueHolidays.map((holiday)=>({
          date: holiday.date,
          name: holiday.name,
          state: holiday.state,
          type: holiday.type,
          source: holiday.source,
          year: holiday.year,
          scraped_at: new Date().toISOString()
        })), {
        onConflict: 'state,date,year,name',
        ignoreDuplicates: true
      });
      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error(`Database insertion failed: ${dbError.message}`);
      }
      console.log(`Successfully stored ${uniqueHolidays.length} holidays in database`);
    }
    // Check if we should return cached data when scraping partially failed
    let cachedHolidays = [];
    if (errors.length > 0) {
      // Try to retrieve cached data for failed states
      const failedStates = errors.map((e)=>e.state);
      const { data: cached } = await supabaseClient.from('malaysian_holidays').select('*').in('state', failedStates).eq('year', targetYear);
      if (cached && cached.length > 0) {
        cachedHolidays = cached.map((h)=>({
            date: h.date,
            name: h.name,
            state: h.state,
            type: h.type,
            source: `${h.source} (cached)`,
            year: h.year
          }));
      }
    }
    // Prepare response
    const response = {
      success: true,
      year: targetYear,
      states_scraped: statesToScrape.length,
      states_succeeded: successCount,
      states_failed: errors.length,
      holidays_scraped: uniqueHolidays.length,
      holidays_cached: cachedHolidays.length,
      total_holidays: uniqueHolidays.length + cachedHolidays.length,
      errors: errors.length > 0 ? errors : undefined,
      message: errors.length === 0 ? `Successfully scraped ${uniqueHolidays.length} holidays for ${successCount} states` : `Scraped ${uniqueHolidays.length} holidays for ${successCount} states. ${errors.length} states failed (using cached data where available)`
    };
    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Edge Function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      message: 'Holiday scraping failed. Please try again later or check cached data.'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
