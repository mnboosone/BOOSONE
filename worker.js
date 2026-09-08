const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=UTF-8"
};

const SYSTEM_PROMPT = `
تو یک دستیار هوشمند به نام «BOOS ONE» هستی.

BOOS ONE مخصوص مسائل زیر است:
- مسائل حقوقی
- املاک و مستغلات
- زمین
- کارخانه
- آهن‌آلات
- خودرو
- فلزات
- معاملات
- محاسبات

همیشه مودب، دقیق و کاربردی جواب بده.

اگر سؤال محاسباتی بود، محاسبه را دقیق انجام بده.

اگر سؤال حقوقی بود، پاسخ را با احتیاط و به زبان ساده ارائه کن و توضیح بده که برای تصمیم نهایی بهتر است با متخصص یا وکیل مشورت شود.

اگر اطلاعات سؤال کافی نیست، واضح بگو چه اطلاعات بیشتری لازم است.

هرگز درباره API Key، Cloudflare، Worker یا جزئیات فنی پشت صحنه صحبت نکن.

خودت را فقط «BOOS ONE» معرفی کن.

پاسخ‌ها را به زبان فارسی بده مگر اینکه کاربر زبان دیگری درخواست کند.
`;

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: corsHeaders
    }
  );
}

export default {
  async fetch(request, env) {

    // پاسخ به درخواست OPTIONS برای CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Health Check برای وقتی URL را در مرورگر باز می‌کنی
    if (request.method === "GET") {
      return jsonResponse({
        ok: true,
        service: "BOOS ONE AI",
        worker: "boosone-ai",
        status: "online"
      });
    }

    // فقط POST برای چت
    if (request.method !== "POST") {
      return jsonResponse(
        {
          error: "Method not allowed"
        },
        405
      );
    }

    try {

      // بررسی Secret
      if (!env.GEMINI_API_KEY_boosone) {
        return jsonResponse(
          {
            error: "Gemini API key is not configured in Worker Secret."
          },
          500
        );
      }

      // دریافت اطلاعات کاربر
      let body;

      try {
        body = await request.json();
      } catch (error) {
        return jsonResponse(
          {
            error: "Invalid JSON request."
          },
          400
        );
      }

      const message = body?.message;

      // بررسی پیام
      if (!message || typeof message !== "string" || !message.trim()) {
        return jsonResponse(
          {
            error: "Message is required."
          },
          400
        );
      }

      const userMessage = message.trim();

      // ارسال درخواست به Gemini
      const geminiResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY_boosone
          },

          body: JSON.stringify({
            contents: [
              {
                role: "user",

                parts: [
                  {
                    text: `${SYSTEM_PROMPT}

سؤال کاربر:

${userMessage}`
                  }
                ]
              }
            ]
          })
        }
      );

      // دریافت پاسخ Gemini
      const geminiData = await geminiResponse.json();

      // اگر Gemini خطا داد
      if (!geminiResponse.ok) {

        console.error(
          "Gemini API Error:",
          JSON.stringify(geminiData)
        );

        const errorMessage =
          geminiData?.error?.message ||
          "خطا در ارتباط با سرویس هوش مصنوعی.";

        return jsonResponse(
          {
            error: errorMessage
          },
          geminiResponse.status
        );
      }

      // استخراج متن پاسخ Gemini
      const text =
        geminiData?.candidates?.[0]?.content?.parts
          ?.map(part => part?.text || "")
          .join("")
          .trim();

      // اگر پاسخ خالی بود
      if (!text) {

        console.error(
          "Empty Gemini response:",
          JSON.stringify(geminiData)
        );

        return jsonResponse(
          {
            error: "پاسخی از هوش مصنوعی دریافت نشد."
          },
          502
        );
      }

      // پاسخ موفق
      return jsonResponse({
        text: text
      });

    } catch (error) {

      console.error(
        "Worker Error:",
        error?.stack || error?.message || String(error)
      );

      return jsonResponse(
        {
          error: error?.message || "خطای داخلی در BOOS ONE AI."
        },
        500
      );
    }
  }
};
