export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, message: "AI相談APIは準備できています。アプリ画面から相談内容を送信してください。" });
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
      return res.status(400).json({ error: "相談内容を入力してください" });
    }

    const prompt = [
      "あなたは福祉用具専門相談員を支援するAIです。",
      "利用者・ケアマネジャーからの相談内容を、LINEやFAXで相談員へ渡しやすい形に整理してください。",
      "医療的な断定や介護保険の可否の断定は避け、最終判断は専門相談員が現地確認して行う前提で書いてください。",
      "出力は必ずJSONのみ。説明文やMarkdownは付けないでください。",
      "",
      "JSON形式:",
      "{",
      "  \"summary\": \"困りごとの要点を1〜2文で\",",
      "  \"home_issues\": [\"住環境の課題を最大4件\"],",
      "  \"candidates\": [{\"item\": \"候補の福祉用具名\", \"reason\": \"候補にした理由\"}],",
      "  \"handoff_note\": \"相談員が初回訪問時に確認すべきこと\"",
      "}",
      "",
      "相談内容:",
      input || "未入力",
      "",
      "住環境・欲しい設備など:",
      home || "未入力"
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: prompt,
        text: {
          format: {
            type: "json_object"
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "AI整理に失敗しました",
        detail: data && data.error ? data.error.message : "OpenAI API error"
      });
    }

    const outputText = data.output_text ||
      (Array.isArray(data.output) ? data.output.flatMap(item => item.content || []).map(content => content.text || "").join("") : "");

    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch (error) {
      return res.status(502).json({
        error: "AIの回答を読み取れませんでした",
        raw: outputText
      });
    }

    return res.status(200).json({
      ok: true,
      result: parsed
    });
  } catch (error) {
    return res.status(500).json({
      error: "AI整理中にエラーが発生しました",
      detail: error && error.message ? error.message : String(error)
    });
  }
}

