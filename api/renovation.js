export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(200).json({ ok: true, message: "POSTで住宅改修理由書の相談内容を送信してください" });

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: "OPENAI_API_KEY is not set" });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const input = String(body.input || "").trim();
    if (!input) return res.status(400).json({ ok: false, error: "住宅改修の相談内容を入力してください" });

    const prompt = [
      "あなたは日本の介護保険住宅改修理由書を作成支援するベテランの福祉用具専門相談員・介護支援専門員です。",
      "入力内容から、住宅改修理由書に転記しやすい内容を整理してください。",
      "個人名、住所、被保険者番号、介護度などの個人情報は作成しないでください。空欄で後から手入力する前提です。",
      "医療的断定や介護保険の可否の断定は避け、最終判断は現地確認と担当者確認で行う前提で書いてください。",
      "住宅改修工事の内容は、手すり取付、段差解消、滑り防止、引き戸等への扉交換、洋式便器等への便器取替、付帯工事の範囲で整理してください。",
      "理由は、身体状況、困難な動作、改修場所、改修により期待される効果が分かるように簡潔に書いてください。",
      "出力は必ずJSONのみ。Markdownや説明文は付けないでください。",
      "",
      "JSON形式:",
      "{",
      "  \"physical_status\": \"利用者の身体状況・ADL上の課題を2〜4文で\",",
      "  \"current_difficulty\": \"現在困っている動作や生活上の支障を2〜4文で\",",
      "  \"renovation_plan\": [{\"place\": \"改修場所\", \"work\": \"工事内容\", \"reason\": \"その工事が必要な理由\"}],",
      "  \"expected_effect\": \"住宅改修後に期待される効果を2〜4文で\",",
      "  \"checks\": [\"手すりの取付け\", \"段差の解消\"],",
      "  \"handoff_note\": \"現地確認時に確認すべき点\"",
      "}",
      "",
      "相談内容:",
      input
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4.1-mini", input: prompt, temperature: 0.2 })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ ok: false, error: "OpenAI API error", detail: data });
    const text = data.output_text || data.output?.flatMap(item => item.content || []).map(part => part.text || "").join("") || "";
    let result;
    try { result = JSON.parse(text); } catch (parseError) {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw parseError;
      result = JSON.parse(match[0]);
    }
    return res.status(200).json({ ok: true, result });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "住宅改修理由書の作成に失敗しました" });
  }
}
