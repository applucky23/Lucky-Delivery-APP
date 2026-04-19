import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const body = await req.json()

    const phone = body.phone || body.user?.phone
    const otp = body.otp || body.sms?.otp

    if (!phone || !otp) {
      // Formatted error so Supabase understands the failure
      return new Response(JSON.stringify({
        error: { message: "Missing phone or otp", http_code: 400 }
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    }

    const AFRO_TOKEN = Deno.env.get("AFROMESSAGE_TOKEN")

    const response = await fetch("https://api.afromessage.com/api/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AFRO_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: phone,
        message: `Your Lucky Delivery code is: ${otp}. Do not share this.`
      }),
    })

    const result = await response.json()

    if (result.acknowledge === "success" || result.acknowledge === true) {
      // 204 No Content is the cleanest way to signal success to Supabase
      return new Response(null, { status: 204 })
    }

    // Formatted error for AfroMessage failures
    return new Response(JSON.stringify({
      error: { message: "AfroMessage failed to send", http_code: 400 }
    }), { status: 200, headers: { "Content-Type": "application/json" } })

  } catch (err) {
    console.error("Hook error:", err)
    return new Response(JSON.stringify({
      error: { message: err.message, http_code: 500 }
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  }
})
