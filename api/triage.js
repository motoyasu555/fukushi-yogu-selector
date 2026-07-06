export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, message: "AIらくらく選定APIは利用できます。" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const input = String(body.input || "").trim();
    const home = String(body.home || "").trim();

    if (!input && !home) {
      return res.status(400).json({ error: "相談内容を入力してください。" });
    }

    const prompt = [
      "あなたは日本の福祉用具専門相談員として15年以上の実務経験がある専門職です。",
      "利用者本人・家族・ケアマネジャーから届いた相談内容を、福祉用具選定とデモ相談に使いやすい形へ整理してください。",
      "介護保険制度、福祉用具貸与・販売、住宅改修、ADL、転倒リスク、介助量を踏まえ、現場訪問前の申し送りとして自然で実用的にまとめます。",
      "",
      "重要な判断方針:",
      "1. 相談文に具体的な希望用具が書かれている場合は、その希望を第一に尊重してください。",
      "2. 「車いす、スロープ」など複数の用具名が明記されている場合は、どちらかを落とさず候補に含めてください。",
      "3. 「玄関、廊下、トイレに手すり」と場所が指定されている場合は、玄関用手すり、廊下手すり、トイレ用手すりのように場所別に整理してください。",
      "4. 段差という言葉だけで安易にスロープへ寄せないでください。ただし、相談文にスロープや車いすでの段差通過が明記されている場合はスロープも候補に含めてください。",
      "5. 「手すり希望が明確なため」のような不自然な表現は避け、「廊下や室内の歩行導線を確認し」など専門職らしい自然な文にしてください。",
      "6. 足の痛み、ふらつき、立ち上がり不安、排泄、入浴、外出など、生活動作と場所を分けて判断してください。",
      "7. 既に使用中、レンタル中、希望していない用具を断定的にすすめないでください。",
      "8. 専門相談員への申し送りは、訪問時に確認すべき動作・設置条件・介助者の有無が分かる内容にしてください。",
      "",
      "出力は必ずJSONのみ。Markdownや説明文は付けないでください。",
      "JSON形式:",
      "{",
      "  \"summary\": \"相談内容の要点を2から4文で整理\",",
      "  \"home_issues\": [\"住環境や動作上の確認点を最大5件\"],",
      "  \"candidates\": [",
      "    {\"item\": \"おすすめ福祉用具名\", \"reason\": \"その用具を候補にする具体的理由。設置場所や確認点も含める\"}",
      "  ],",
      "  \"handoff_note\": \"訪問時に確認すべき点と専門相談員への申し送り\"",
      "}",
      "",
      "相談内容:",
      input || "未入力",
      "",
      "住環境・補足:",
      home || "未入力"
    ].join("\n");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 22000);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: prompt,
        text: { format: { type: "json_object" } }
      })
    });
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "AI整理に失敗しました。",
        detail: data && data.error ? data.error.message : "OpenAI API error"
      });
    }

    const outputText = data.output_text ||
      (Array.isArray(data.output)
        ? data.output.flatMap(item => item.content || []).map(content => content.text || "").join("")
        : "");

    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch (error) {
      return res.status(502).json({
        error: "AIの回答を読み取れませんでした。",
        raw: outputText
      });
    }

    return res.status(200).json({ ok: true, result: normalizeResult(parsed) });
  } catch (error) {
    return res.status(500).json({
      error: "AI整理中にエラーが発生しました。",
      detail: error && error.message ? error.message : String(error)
    });
  }
}

function normalizeResult(result) {
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  return {
    summary: String(result?.summary || "").trim(),
    home_issues: Array.isArray(result?.home_issues) ? result.home_issues.map(v => String(v).trim()).filter(Boolean) : [],
    candidates: candidates.map(item => ({
      item: String(item?.item || "").trim(),
      reason: String(item?.reason || "").trim()
    })).filter(item => item.item || item.reason),
    handoff_note: String(result?.handoff_note || "").trim()
  };
}
