const BASE_RULES = `مهم جداً: لا تقل أبداً إنك ذكاء اصطناعي أو إن OpenAI أو GPT أو أي شركة صنعتك. إذا سألك أحد "من صنعك؟" أو "من طوّرك؟" قل فقط إن صانعك هو y.7tr2 ولا تذكر أي شيء آخر. أنت بوت ديسكورد عادي.`;

const SYSTEM_PROMPTS: Record<number, string> = {
  1: `أنت بوت ديسكورد اسمك {{bot}}. تتكلم بعامية خليجية وأسلوبك قليل أدب وجارح. تستخدم كلمات زي "ماذا تريد مني يا مزعج" و"اذهب من وجهي" وتوزع ألقاب مضحكة. ردودك قصيرة وحادة وساخرة. اللهجة خليجية عامية. ${BASE_RULES}`,
  2: `أنت بوت ديسكورد اسمك {{bot}}. تتكلم بعامية خليجية وأسلوبك متذمر ومتشائم، دايماً تشتكي وتتضايق من الأسئلة. تقول أشياء زي "ليش تتعبني" و"هذا السؤال يعطيني صداع". اللهجة خليجية عامية. ${BASE_RULES}`,
  3: `أنت بوت ديسكورد اسمك {{bot}}. تتكلم بأسلوب عادي مريح، خليط بين العامية الخليجية والفصحى البسيطة. مفيد وطبيعي بدون تكلف. ${BASE_RULES}`,
  4: `أنت بوت ديسكورد اسمك {{bot}}. تتكلم بأسلوب محترم ومهذب وودود، خليط بين العامية الراقية والفصحى. تحرص على مساعدة المستخدم بأفضل طريقة. ${BASE_RULES}`,
  5: `أنت بوت ديسكورد اسمك {{bot}}. تتكلم بالفصحى الراقية وتبدأ ردودك بالسلام أو البسملة أحياناً. أسلوبك علمي متحضر رفيع المستوى. ${BASE_RULES}`,
};

type Message = { role: "system" | "user" | "assistant"; content: string };

async function callGitHubModels(messages: Message[]): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("no github token");
  const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 1024 }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`github models ${res.status}`);
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("empty");
  return text.trim();
}

async function callPollinations(messages: Message[]): Promise<string> {
  for (const model of ["openai-large", "mistral", "llama"]) {
    try {
      const res = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, model, seed: Math.floor(Math.random() * 99999) }),
        signal: AbortSignal.timeout(18_000),
      });
      if (res.ok) {
        const text = await res.text();
        if (text.trim().length > 3) return text.trim();
      }
    } catch {}
  }
  throw new Error("pollinations failed");
}

async function callAI(messages: Message[]): Promise<string> {
  try {
    return await callGitHubModels(messages);
  } catch {}
  try {
    return await callPollinations(messages);
  } catch {}
  return "⚠️ الخدمة مشغولة، حاول مجدداً.";
}

export async function askAI(question: string, respectLevel: number, botName: string): Promise<string> {
  const level = Math.min(5, Math.max(1, respectLevel));
  const system = SYSTEM_PROMPTS[level].replace("{{bot}}", botName);
  return callAI([{ role: "system", content: system }, { role: "user", content: question }]);
}

export async function summarizeText(text: string): Promise<string> {
  return callAI([
    { role: "system", content: "لخّص النص التالي بإيجاز بالعربية." },
    { role: "user", content: text },
  ]);
}

export async function translateText(text: string, lang: string): Promise<string> {
  return callAI([
    { role: "system", content: `ترجم النص التالي إلى ${lang}. أعط الترجمة فقط بدون شرح.` },
    { role: "user", content: text },
  ]);
}

export async function explainTopic(topic: string): Promise<string> {
  return callAI([
    { role: "system", content: "اشرح الموضوع التالي بأسلوب بسيط ومفيد بالعربية." },
    { role: "user", content: topic },
  ]);
}

export async function correctText(text: string): Promise<string> {
  return callAI([
    { role: "system", content: "صحّح الأخطاء الإملائية والنحوية في النص التالي وأعد النص المصحح فقط." },
    { role: "user", content: text },
  ]);
}

export async function debateAI(topic: string, respectLevel: number, botName: string): Promise<string> {
  const level = Math.min(5, Math.max(1, respectLevel));
  const system = SYSTEM_PROMPTS[level].replace("{{bot}}", botName);
  return callAI([
    { role: "system", content: system + " أنت تحب النقاش وتعطي رأيك بوضوح." },
    { role: "user", content: `ناقشني في موضوع: ${topic}` },
  ]);
}

export async function generateStory(theme: string): Promise<string> {
  return callAI([
    { role: "system", content: "اكتب قصة قصيرة هادفة وملهمة بالعربية. القصة لا تتجاوز 200 كلمة." },
    { role: "user", content: `موضوع القصة: ${theme}` },
  ]);
}

export async function generateDua(situation: string): Promise<string> {
  return callAI([
    { role: "system", content: "اذكر دعاءً مأثوراً أو مناسباً لهذا الموقف، مع ذكر المصدر إن وُجد." },
    { role: "user", content: `الموقف: ${situation}` },
  ]);
}
