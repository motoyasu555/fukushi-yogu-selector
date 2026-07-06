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
      "あなたは日本の福祉用具専門相談員として15年以上の実務経験があるベテランです。",
      "利用者本人や家族、ケアマネジャーから届いた相談内容を、福祉用具選定とデモ相談に使いやすい形へ整理してください。",
      "介護保険制度、福祉用具貸与の対象種目、住環境、ADL、転倒リスク、介助量を踏まえて判断してください。",
      "",
      "重要な方針:",
      "1. 相談内容から読み取れる根拠を優先し、勝手に病名や要介護度を断定しない。",
      "2. ただし必要性が高い福祉用具は、訪問時の確認事項として丁寧に候補へ含める。",
      "3. すでに所持、利用中、レンタル済みと明記されている用具は、原則おすすめ候補から外す。",
      "4. 手すりは、相談内容から設置場所が読める場合は「トイレ用手すり」「屋外用手すり」「ベッド周辺手すり」のように具体化する。",
      "5. 住宅改修や購入品が主目的の場合も、福祉用具貸与で補える可能性がある視点を添える。",
      "6. LINEやFAXで福祉用具相談へ渡す前提で、専門職向けの申し送りとして簡潔かつ実用的にまとめる。",
      "",
      "出力は必ずJSONのみ。Markdownや説明文は付けない。",
      "JSON形式:",
      "{",
      "  \"summary\": \"相談内容の要点を2から4文で整理\",",
      "  \"home_issues\": [\"住環境や動作上の課題を最大4件\"],",
      "  \"candidates\": [",
      "    {\"item\": \"おすすめ福祉用具名\", \"reason\": \"その用具を候補にする具体的理由\"}",
      "  ],",
      "  \"handoff_note\": \"訪問時に確認すべき点や相談員への申し送り\"",
      "}",
      "",
      "相談内容:",
      input || "未入力",
      "",
      "住環境・補足:",
      home || "未入力"
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: prompt,
        text: { format: { type: "json_object" } }
      })
    });

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
