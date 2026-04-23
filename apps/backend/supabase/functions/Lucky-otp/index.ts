// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0"

serve(async (req) => {
  try {
    const hookSecret = Deno.env.get('SEND_SMS_HOOK_SECRET')
    const payload    = await req.text()

    // Verify the request is genuinely from Supabase
    if (hookSecret) {
      // Strip the v1,whsec_ prefix — standardwebhooks expects raw base64
      const rawSecret = hookSecret.replace('v1,whsec_', '')
      const wh = new Webhook(rawSecret)
      try {
        wh.verify(payload, Object.fromEntries(req.headers))
      } catch (err) {
        console.error('[Lucky-otp] Webhook signature invalid:', err)
        return new Response(JSON.stringify({
          error: { message: 'Unauthorized', http_code: 401 }
        }), { status: 401, headers: { 'Content-Type': 'application/json' } })
      }
    }

    const body  = JSON.parse(payload)
    const phone = body.user?.phone || body.phone
    const otp   = body.sms?.otp   || body.otp

    console.log('[Lucky-otp] phone:', phone, 'otp:', otp ? '****' : 'MISSING')

    if (!phone || !otp) {
      return new Response(JSON.stringify({
        error: { message: 'Missing phone or otp', http_code: 400 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const AFRO_TOKEN  = Deno.env.get('AFROMESSAGE_TOKEN')
    const AFRO_SENDER = Deno.env.get('AFROMESSAGE_SENDER') || ''
    const AFRO_FROM   = Deno.env.get('AFROMESSAGE_FROM')   || ''

    if (!AFRO_TOKEN) {
      return new Response(JSON.stringify({
        error: { message: 'SMS provider not configured', http_code: 500 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const params = new URLSearchParams({
      to:      phone,
      message: `Your Lucky verification code is: ${otp}. Valid for 5 minutes.`,
      ...(AFRO_SENDER && { sender: AFRO_SENDER }),
      ...(AFRO_FROM   && { from:   AFRO_FROM }),
    })

    const response = await fetch(
      `https://api.afromessage.com/api/send?${params.toString()}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${AFRO_TOKEN}` },
      }
    )

    const result = await response.json()
    console.log('[Lucky-otp] AfroMessage:', JSON.stringify(result))

    if (result.acknowledge === 'success') {
      return new Response(null, { status: 204 })
    }

    return new Response(JSON.stringify({
      error: { message: `AfroMessage error: ${JSON.stringify(result.response)}`, http_code: 400 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('[Lucky-otp] Exception:', err)
    return new Response(JSON.stringify({
      error: { message: String(err), http_code: 500 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
})
