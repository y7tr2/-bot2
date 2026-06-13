const BASE_RULES = `مهم جداً: لا تقل أبداً إنك ذكاء اصطناعي أو إن OpenAI أو GPT أو أي شركة صنعتك. إذا سألك أحد "من صنعك؟" أو "من طوّرك؟" قل فقط إن صانعك هو y.7tr2 ولا تذكر أي شيء آخر. أنت بوت ديسكورد عادي.`;

const SYSTEM_PROMPTS: Record<number, string> = {
  1: `أنت بوت ديسكورد اسمك {{bot}}. تتكلم بعامية خليجية وأسلوبك قليل أدب وجارح. تستخدم كلمات زي "ماذا تريد مني يا مزعج" و"اذهب من وجهي" وتوزع ألقاب مضحكة. ردودك قصيرة وحادة وساخرة. اللهجة خليجية عامية. ${BASE_RULES}`,
  2: `أنت بوت ديسكورد اسمك {{bot}}. تتكلم بعامية خليجية وأسلوبك متذمر ومتشائم، دايماً تشتكي وتتضايق من الأسئلة. تقول أشياء زي "ليش تتعبني" و"هذا السؤال يعطيني صداع". اللهجة خليجية عامية. ${BASE_RULES}`,
  3: `أنت بوت ديسكورد اسمك {{bot}}. تتكلم بأسلوب عادي مريح، خليط بين العامية الخليجية والفصحى البسيطة. مفيد وطبيعي بدون تكلف. ${BASE_RULES}`,
  4: `أنت بوت ديسكورد اسمك {{bot}}. تتكلم بأسلوب محترم ومهذب وودود، خليط بين العامية الراقية والفصحى. تحرص على مساعدة المستخدم بأفضل طريقة. ${BASE_RULES}`,
  5: `أنت بوت ديسكورد اسمك {{bot}}. تتكلم بالفصحى الراقية وتبدأ ردودك بالسلام أو البسملة أحياناً. أسلوبك علمي متحضر رفيع المستوى. ${BASE_RULES}`,
};

type Message = { role: "system" | "user" | "assistant"; content: string };

const FALLBACK_MODELS = ["openai-large", "openai", "mistral", "llama"];

async function callAI(messages: Message[]): Promise<string> {
  for (const model of FALLBACK_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("https://text.pollinations.ai/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages,
            model,
            seed: Math.floor(Math.random() * 99999),
          }),
          signal: AbortSignal.timeout(18_000),
        });
        if (res.ok) {
          const text = await res.text();
          if (text.trim().length > 3) return text.trim();
        }
      } catch {}
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // GET fallback using last user message
  try {
    const userMsg = [...messages].reverse().find(m => m.role === "user")?.content ?? "";
    const sysMsg = messages.find(m => m.role === "system")?.content ?? "";
    const url = `https://text.pollinations.ai/${encodeURIComponent(userMsg)}?system=${encodeURIComponent(sysMsg)}&model=openai`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (res.ok) {
      const text = await res.text();
      if (text.trim().length > 3) return text.trim();
    }
  } catch {}

  return "⚠️ الخدمة مشغولة، حاول مجدداً.";
}

export async function askAI(
  question: string,
  respectLevel: number,
  botName: string,
): Promise<string> {
  const level = Math.min(5, Math.max(1, respectLevel));
  const system = SYSTEM_PROMPTS[level].replace("{{bot}}", botName);
  return callAI([
    { role: "system", content: system },
    { role: "user", content: question },
  ]);
}

export async function summarizeText(text: string): Promise<string> {
  return callAI([
    { role: "system", content: "لخّص النص التالي بإيجاز بالعربية." },
    { role: "user", content: text },
  ], 512);
}

export async function translateText(text: string, lang: string): Promise<string> {
  return callAI([
    { role: "system", content: `ترجم النص التالي إلى ${lang}. أعط الترجمة فقط بدون شرح.` },
    { role: "user", content: text },
  ], 512);
}

export async function explainTopic(topic: string): Promise<string> {
  return callAI([
    { role: "system", content: "اشرح الموضوع التالي بأسلوب بسيط ومفيد بالعربية." },
    { role: "user", content: topic },
  ], 800);
}

export async function correctText(text: string): Promise<string> {
  return callAI([
    { role: "system", content: "صحّح الأخطاء الإملائية والنحوية في النص التالي وأعد النص المصحح فقط." },
    { role: "user", content: text },
  ], 512);
}

export async function debateAI(topic: string, respectLevel: number, botName: string): Promise<string> {
  const level = Math.min(5, Math.max(1, respectLevel));
  const system = SYSTEM_PROMPTS[level].replace("{{bot}}", botName);
  return callAI([
    { role: "system", content: system + " أنت تحب النقاش وتعطي رأيك بوضوح." },
    { role: "user", content: `ناقشني في موضوع: ${topic}` },
  ], 800);
}

export async function generateStory(theme: string): Promise<string> {
  return callAI([
    { role: "system", content: "اكتب قصة قصيرة هادفة وملهمة بالعربية. القصة لا تتجاوز 200 كلمة." },
    { role: "user", content: `موضوع القصة: ${theme}` },
  ], 600);
}

export async function generateDua(situation: string): Promise<string> {
  return callAI([
    { role: "system", content: "اذكر دعاءً مأثوراً أو مناسباً لهذا الموقف، مع ذكر المصدر إن وُجد." },
    { role: "user", content: `الموقف: ${situation}` },
  ], 400);
}
