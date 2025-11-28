import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Malaysia Public Holidays Data (based on the gist pattern)
const MALAYSIA_HOLIDAYS_2024 = {
  "ALL": [
    {
      date: "2024-01-01",
      holiday: "New Year's Day"
    },
    {
      date: "2024-05-01",
      holiday: "Labour Day"
    },
    {
      date: "2024-06-03",
      holiday: "Birthday of His Majesty the Yang di-Pertuan Agong"
    },
    {
      date: "2024-08-31",
      holiday: "National Day"
    },
    {
      date: "2024-09-16",
      holiday: "Malaysia Day"
    },
    {
      date: "2024-12-25",
      holiday: "Christmas Day"
    },
    // Religious holidays (approximate - these vary by year)
    {
      date: "2024-02-10",
      holiday: "Chinese New Year"
    },
    {
      date: "2024-02-11",
      holiday: "Chinese New Year Holiday"
    },
    {
      date: "2024-01-25",
      holiday: "Thaipusam"
    },
    {
      date: "2024-05-22",
      holiday: "Wesak Day"
    },
    {
      date: "2024-06-17",
      holiday: "Nuzul Quran"
    },
    {
      date: "2024-04-10",
      holiday: "Hari Raya Aidilfitri"
    },
    {
      date: "2024-04-11",
      holiday: "Hari Raya Aidilfitri Holiday"
    },
    {
      date: "2024-06-17",
      holiday: "Hari Raya Haji"
    },
    {
      date: "2024-07-07",
      holiday: "Awal Muharram"
    },
    {
      date: "2024-09-15",
      holiday: "Mawlid"
    },
    {
      date: "2024-10-31",
      holiday: "Deepavali"
    }
  ],
  "JHR": [
    {
      date: "2024-03-23",
      holiday: "Birthday of the Sultan of Johor"
    }
  ],
  "KDH": [
    {
      date: "2024-06-15",
      holiday: "Birthday of the Sultan of Kedah"
    }
  ],
  "KTN": [
    {
      date: "2024-09-29",
      holiday: "Birthday of the Sultan of Kelantan"
    },
    {
      date: "2024-11-11",
      holiday: "Birthday of the Sultan of Kelantan (Observed)"
    }
  ],
  "MLK": [
    {
      date: "2024-08-24",
      holiday: "Birthday of the Governor of Melaka"
    },
    {
      date: "2024-10-15",
      holiday: "Declaration of Melaka as Historical City"
    }
  ],
  "NSN": [
    {
      date: "2024-01-14",
      holiday: "Birthday of the Yang di-Pertuan Besar of Negeri Sembilan"
    }
  ],
  "PHG": [
    {
      date: "2024-07-30",
      holiday: "Birthday of the Sultan of Pahang"
    }
  ],
  "PNG": [
    {
      date: "2024-07-12",
      holiday: "Birthday of the Governor of Penang"
    }
  ],
  "PRK": [
    {
      date: "2024-11-27",
      holiday: "Birthday of the Sultan of Perak"
    }
  ],
  "PLS": [
    {
      date: "2024-05-17",
      holiday: "Birthday of the Raja of Perlis"
    }
  ],
  "SBH": [
    {
      date: "2024-10-03",
      holiday: "Birthday of the Governor of Sabah"
    },
    {
      date: "2024-05-30",
      holiday: "Harvest Festival"
    },
    {
      date: "2024-05-31",
      holiday: "Harvest Festival Holiday"
    }
  ],
  "SWK": [
    {
      date: "2024-10-10",
      holiday: "Birthday of the Governor of Sarawak"
    },
    {
      date: "2024-06-01",
      holiday: "Gawai Dayak"
    },
    {
      date: "2024-06-02",
      holiday: "Gawai Dayak Holiday"
    }
  ],
  "SGR": [
    {
      date: "2024-12-11",
      holiday: "Birthday of the Sultan of Selangor"
    }
  ],
  "TRG": [
    {
      date: "2024-04-26",
      holiday: "Birthday of the Sultan of Terengganu"
    }
  ],
  "WPKL": [
    {
      date: "2024-02-01",
      holiday: "Federal Territory Day"
    }
  ],
  "WPPJ": [
    {
      date: "2024-02-01",
      holiday: "Federal Territory Day"
    }
  ],
  "WPLB": [
    {
      date: "2024-02-01",
      holiday: "Federal Territory Day"
    },
    {
      date: "2024-05-30",
      holiday: "Harvest Festival"
    },
    {
      date: "2024-05-31",
      holiday: "Harvest Festival Holiday"
    }
  ]
};
const MALAYSIA_HOLIDAYS_2025 = {
  "ALL": [
    {
      date: "2025-01-01",
      holiday: "New Year's Day"
    },
    {
      date: "2025-05-01",
      holiday: "Labour Day"
    },
    {
      date: "2025-06-03",
      holiday: "Birthday of His Majesty the Yang di-Pertuan Agong"
    },
    {
      date: "2025-08-31",
      holiday: "National Day"
    },
    {
      date: "2025-09-16",
      holiday: "Malaysia Day"
    },
    {
      date: "2025-12-25",
      holiday: "Christmas Day"
    },
    // Religious holidays (approximate - these vary by year)
    {
      date: "2025-01-29",
      holiday: "Chinese New Year"
    },
    {
      date: "2025-01-30",
      holiday: "Chinese New Year Holiday"
    },
    {
      date: "2025-02-13",
      holiday: "Thaipusam"
    },
    {
      date: "2025-05-12",
      holiday: "Wesak Day"
    },
    {
      date: "2025-05-27",
      holiday: "Nuzul Quran"
    },
    {
      date: "2025-03-31",
      holiday: "Hari Raya Aidilfitri"
    },
    {
      date: "2025-04-01",
      holiday: "Hari Raya Aidilfitri Holiday"
    },
    {
      date: "2025-06-07",
      holiday: "Hari Raya Haji"
    },
    {
      date: "2025-06-27",
      holiday: "Awal Muharram"
    },
    {
      date: "2025-09-05",
      holiday: "Mawlid"
    },
    {
      date: "2025-10-21",
      holiday: "Deepavali"
    }
  ],
  "JHR": [
    {
      date: "2025-03-23",
      holiday: "Birthday of the Sultan of Johor"
    }
  ],
  "KDH": [
    {
      date: "2025-06-15",
      holiday: "Birthday of the Sultan of Kedah"
    }
  ],
  "KTN": [
    {
      date: "2025-09-29",
      holiday: "Birthday of the Sultan of Kelantan"
    },
    {
      date: "2025-11-11",
      holiday: "Birthday of the Sultan of Kelantan (Observed)"
    }
  ],
  "MLK": [
    {
      date: "2025-08-24",
      holiday: "Birthday of the Governor of Melaka"
    },
    {
      date: "2025-10-15",
      holiday: "Declaration of Melaka as Historical City"
    }
  ],
  "NSN": [
    {
      date: "2025-01-14",
      holiday: "Birthday of the Yang di-Pertuan Besar of Negeri Sembilan"
    }
  ],
  "PHG": [
    {
      date: "2025-07-30",
      holiday: "Birthday of the Sultan of Pahang"
    }
  ],
  "PNG": [
    {
      date: "2025-07-12",
      holiday: "Birthday of the Governor of Penang"
    }
  ],
  "PRK": [
    {
      date: "2025-11-27",
      holiday: "Birthday of the Sultan of Perak"
    }
  ],
  "PLS": [
    {
      date: "2025-05-17",
      holiday: "Birthday of the Raja of Perlis"
    }
  ],
  "SBH": [
    {
      date: "2025-10-03",
      holiday: "Birthday of the Governor of Sabah"
    },
    {
      date: "2025-05-30",
      holiday: "Harvest Festival"
    },
    {
      date: "2025-05-31",
      holiday: "Harvest Festival Holiday"
    }
  ],
  "SWK": [
    {
      date: "2025-10-10",
      holiday: "Birthday of the Governor of Sarawak"
    },
    {
      date: "2025-06-01",
      holiday: "Gawai Dayak"
    },
    {
      date: "2025-06-02",
      holiday: "Gawai Dayak Holiday"
    }
  ],
  "SGR": [
    {
      date: "2025-12-11",
      holiday: "Birthday of the Sultan of Selangor"
    }
  ],
  "TRG": [
    {
      date: "2025-04-26",
      holiday: "Birthday of the Sultan of Terengganu"
    }
  ],
  "WPKL": [
    {
      date: "2025-02-01",
      holiday: "Federal Territory Day"
    }
  ],
  "WPPJ": [
    {
      date: "2025-02-01",
      holiday: "Federal Territory Day"
    }
  ],
  "WPLB": [
    {
      date: "2025-02-01",
      holiday: "Federal Territory Day"
    },
    {
      date: "2025-05-30",
      holiday: "Harvest Festival"
    },
    {
      date: "2025-05-31",
      holiday: "Harvest Festival Holiday"
    }
  ]
};
// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { state, year } = await req.json();
    // Get the appropriate year's data
    const holidaysData = year === 2025 ? MALAYSIA_HOLIDAYS_2025 : MALAYSIA_HOLIDAYS_2024;
    let holidays = [];
    // Add national holidays for all states
    holidays = [
      ...holidaysData.ALL || []
    ];
    // Add state-specific holidays if a specific state is requested
    if (state && state !== 'ALL' && holidaysData[state]) {
      holidays = [
        ...holidays,
        ...holidaysData[state] || []
      ];
    }
    // Transform to match your expected format
    const formattedHolidays = holidays.map((h)=>({
        holiday_date: h.date,
        description: h.holiday,
        state_code: state || 'ALL'
      }));
    return new Response(JSON.stringify({
      success: true,
      holidays: formattedHolidays,
      count: formattedHolidays.length
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      holidays: []
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});
