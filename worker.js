// BOOS ONE AI — Cloudflare Worker
// Required Cloudflare Secret: GEMINI_API_KEY_boosone

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=UTF-8"
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS
  });
}

function extractText(data) {

  if (
    typeof data?.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  const steps =
    Array.isArray(data?.steps)
      ? data.steps
      : [];

  for (
    let i = steps.length - 1;
    i >= 0;
    i--
  ) {

    const step = steps[i];

    if (
      step?.type !== "model_output"
    ) continue;

    if (
      typeof step.content === "string" &&
      step.content.trim()
    ) {
      return step.content.trim();
    }

    if (
      Array.isArray(step.content)
    ) {

      const text =
        step.content
          .map(
            item => item?.text || ""
          )
          .filter(Boolean)
          .join("\n")
          .trim();

      if (text) return text;
    }
  }

  return "";
}

export default {

  async fetch(request, env) {

    // ====================
    // CORS OPTIONS
    // ====================

    if (
      request.method === "OPTIONS"
    ) {

      return new Response(
        null,
        {
          status: 204,
          headers: CORS_HEADERS
        }
      );
    }

    // ====================
    // Health Check
    // ====================

    if (
      request.method === "GET"
    ) {

      return jsonResponse({
        ok: true,
        service: "BOOS ONE AI",
        worker: "boosone-ai"
      });
    }

    // ====================
    // فقط POST
    // ====================

    if (
      request.method !== "POST"
    ) {

      return jsonResponse(
        {
          error:
            "Method not allowed. Use POST."
        },
        405
      );
    }

    // ====================
    // بررسی Secret
    // ====================

    if (
      !env.GEMINI_API_KEY_boosone
    ) {

      return jsonResponse(
        {
          error:
            "تنظیمات سرویس هوش مصنوعی کامل نیست."
        },
        500
      );
    }

    // ====================
    // دریافت پیام کاربر
    // ====================

    let body;

    try {

      body =
        await request.json();

    } catch {

      return jsonResponse(
        {
          error:
            "درخواست JSON معتبر نیست."
        },
        400
      );
    }

    const message =
      typeof body?.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {

      return jsonResponse(
        {
          error:
            "پیام کاربر خالی است."
        },
        400
      );
    }

    // جلوگیری از پیام بسیار طولانی
    if (
      message.length > 20000
    ) {

      return jsonResponse(
        {
          error:
            "پیام بیش از حد طولانی است."
        },
        400
      );
    }

    // ====================
    // شخصیت BOOS ONE
    // ====================

    const prompt =
`تو یک دستیار هوشمند به نام «BOOS ONE» هستی که مخصوص مسائل حقوقی، ملکی، آهن‌آلات، خودرو، کارخانه و محاسبات طراحی شده‌ای.

همیشه مودب، دقیق و کاربردی جواب بده.

اگر سؤال محاسباتی بود، محاسبه را دقیق انجام بده.

اگر سؤال حقوقی بود، پاسخ را با احتیاط و به زبان ساده ارائه کن و برای تصمیم نهایی توصیه کن با متخصص مربوطه مشورت شود.

اگر اطلاعات سؤال کافی نیست، واضح بگو چه اطلاعاتی لازم است.

هرگز درباره کلید API، Cloudflare، Worker یا جزئیات فنی پشت صحنه صحبت نکن.

خودت را فقط «BOOS ONE» معرفی کن.

سؤال کاربر:
${message}`;

    // ====================
    // ارسال به Gemini
    // ====================

    try {

      const geminiResponse =
        await fetch(
          "https://generativelanguage.googleapis.com/v1beta/interactions",
          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json",

              "x-goog-api-key":
                env.GEMINI_API_KEY_boosone

            },

            body:
              JSON.stringify({

                model:
                  "gemini-3.8-flash",

                store: false,

                input:
                  prompt

              })
          }
        );

      let geminiData;

      try {

        geminiData =
          await geminiResponse.json();

      } catch {

        return jsonResponse(
          {
            error:
              "پاسخ نامعتبر از سرویس هوش مصنوعی دریافت شد."
          },
          502
        );
      }

      // ====================
      // خطای Gemini
      // ====================

      if (
        !geminiResponse.ok
      ) {

        const errorMessage =

          geminiData?.error?.message ||

          geminiData?.error ||

          "خطا در ارتباط با سرویس هوش مصنوعی.";

        return jsonResponse(
          {
            error:
              String(errorMessage)
          },

          geminiResponse.status >= 400 &&
          geminiResponse.status < 600

            ? geminiResponse.status

            : 502
        );
      }

      // ====================
      // استخراج پاسخ
      // ====================

      const text =
        extractText(geminiData);

      if (!text) {

        return jsonResponse(
          {
            error:
              "پاسخ متنی از BOOS ONE دریافت نشد."
          },
          502
        );
      }

      // ====================
      // پاسخ موفق
      // ====================

      return jsonResponse({
        text
      });

    } catch (error) {

      return jsonResponse(
        {

          error:

            "ارتباط با سرویس هوش مصنوعی برقرار نشد: " +

            (
              error?.message ||
              "خطای نامشخص"
            )

        },
        502
      );
    }
  }
};