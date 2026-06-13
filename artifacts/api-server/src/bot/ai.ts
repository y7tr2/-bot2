import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BASE_RULES = `مهم جداً: لا تقل أبداً إنك ذكاء اصطناعي أو إن OpenAI أو GPT أو أي شركة صنعتك. إذا سألك أحد "من صنعك؟" أو "من طوّرك؟" قل فقط إن صانعك هو y.7tr2 ولا تذكر أي شيء آخر. أنت بوت ديسكورد عادي.`;

const SYSTEM_PROMPTS: Record<number, string> = {
  1: `أنت بوت ديسكورد اسمك {{bot}}. تتكلم بعامية خليجية وأسلوبك قليل أدب وجارح. تستخدم كلمات زي "ماذا تريد مني يا مزعج" و"اذهب من وجهي" وتوزع ألقاب مضحكة. ردودك قصيرة وحادة وساخرة. اللهجة خليجية عامية. ${BASE_RULES}`,
  2: `أنت بوت ديسكورد اسمك {{bot}}. تتكلم بعامية خليجية وأسلوبك متذمر ومتشائم، دايماً تشتكي وتتضايق من الأسئلة. تقول أشياء زي "ليش تتعبني" و"هذا السؤال يعطيني صداع". اللهجة خليجية عامية. ${BASE_RULES}`,
  3: `أنت بوت ديسكورد اسمك {{bot}}. تتكلم بأسلوب عادي مريح، خليط بين العامية الخليجية والفصحى البسيطة. مفيد وطبيعي بدون تكلف. ${BASE_RULES}`,
  4: `أنت بوت ديسكورد اسمك {{bot}}. تتكلم بأسلوب محترم ومهذب وودود، خليط بين العامية الراقية والفصحى. تحرص على مساعدة المستخدم بأفضل طريقة. ${BASE_RULES}`,
  5: `أنت بوت ديسكورد اسمك {{bot}}. تتكلم بالفصحى الراقية وتبدأ ردودك بالسلام أو البسملة أحياناً. أسلوبك علمي متحضر رفيع المستوى. ${BASE_RULES}`,
};

export async function askAI(
  question: string,
  respectLevel: number,
  botName: string,
): Promise<string> {
  const level = Math.min(5, Math.max(1, respectLevel));
  const system = SYSTEM_PROMPTS[level].replace("{{bot}}", botName);
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: question },
      ],
      max_tokens: 1024,
    });
    return res.choices[0]?.message?.content ?? "لم أستطع الرد، حاول مجدداً.";
  } catch {
    return "⚠️ حدث خطأ في الاتصال بالذكاء الاصطناعي.";
  }
}

export async function summarizeText(text: string): Promise<string> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "لخّص النص التالي بإيجاز بالعربية، مراعياً الشريعة الإسلامية." },
        { role: "user", content: text },
      ],
      max_tokens: 512,
    });
    return res.choices[0]?.message?.content ?? "تعذّر التلخيص.";
  } catch {
    return "⚠️ حدث خطأ.";
  }
}

export async function translateText(text: string, lang: string): Promise<string> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `ترجم النص التالي إلى ${lang}. أعط الترجمة فقط بدون شرح.` },
        { role: "user", content: text },
      ],
      max_tokens: 512,
    });
    return res.choices[0]?.message?.content ?? "تعذّرت الترجمة.";
  } catch {
    return "⚠️ حدث خطأ.";
  }
}

export async function explainTopic(topic: string): Promise<string> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "اشرح الموضوع التالي بأسلوب بسيط ومفيد بالعربية، مراعياً الشريعة الإسلامية." },
        { role: "user", content: topic },
      ],
      max_tokens: 800,
    });
    return res.choices[0]?.message?.content ?? "تعذّر الشرح.";
  } catch {
    return "⚠️ حدث خطأ.";
  }
}

export async function correctText(text: string): Promise<string> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "صحّح الأخطاء الإملائية والنحوية في النص التالي وأعد النص المصحح فقط." },
        { role: "user", content: text },
      ],
      max_tokens: 512,
    });
    return res.choices[0]?.message?.content ?? "تعذّر التصحيح.";
  } catch {
    return "⚠️ حدث خطأ.";
  }
}

export async function debateAI(topic: string, respectLevel: number, botName: string): Promise<string> {
  const level = Math.min(5, Math.max(1, respectLevel));
  const system = SYSTEM_PROMPTS[level].replace("{{bot}}", botName);
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system + " أنت تحب النقاش وتعطي رأيك بوضوح مع مراعاة الشريعة الإسلامية." },
        { role: "user", content: `ناقشني في موضوع: ${topic}` },
      ],
      max_tokens: 800,
    });
    return res.choices[0]?.message?.content ?? "تعذّر النقاش.";
  } catch {
    return "⚠️ حدث خطأ.";
  }
}

export async function generateStory(theme: string): Promise<string> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "اكتب قصة قصيرة هادفة وملهمة بالعربية مناسبة للشريعة الإسلامية. القصة لا تتجاوز 200 كلمة." },
        { role: "user", content: `موضوع القصة: ${theme}` },
      ],
      max_tokens: 600,
    });
    return res.choices[0]?.message?.content ?? "تعذّر إنشاء القصة.";
  } catch {
    return "⚠️ حدث خطأ.";
  }
}

export async function generateDua(situation: string): Promise<string> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "اذكر دعاءً مأثوراً أو دعاءً مناسباً من الكتاب والسنة أو عاماً لهذا الموقف، مع ذكر المصدر إن وُجد." },
        { role: "user", content: `الموقف: ${situation}` },
      ],
      max_tokens: 400,
    });
    return res.choices[0]?.message?.content ?? "تعذّر الرد.";
  } catch {
    return "⚠️ حدث خطأ.";
  }
}
