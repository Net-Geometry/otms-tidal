/**
 * VAPID Public Key Edge Function
 *
 * Returns the VAPID public key for push notification subscription.
 * This endpoint is public (no authentication required) since the public key
 * is designed to be safely exposed to clients.
 *
 * @endpoint GET /functions/v1/vapid-public-key
 * @returns {VAPIDPublicKeyResponse} JSON response with public key
 */ // TypeScript interfaces
// CORS headers - allow requests from any origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};
Deno.serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  // Only allow GET requests
  if (req.method !== 'GET') {
    const errorResponse = {
      success: false,
      error: 'Method not allowed. Use GET request.'
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  try {
    // Retrieve VAPID public key from environment variables
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    // Validate that public key exists
    if (!publicKey) {
      console.error('VAPID_PUBLIC_KEY environment variable not configured');
      const errorResponse = {
        success: false,
        error: 'VAPID configuration not found'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Return public key
    const response = {
      publicKey,
      success: true
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Edge function error:', error);
    const errorResponse = {
      success: false,
      error: 'Internal server error'
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
