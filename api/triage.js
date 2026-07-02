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
  "あなたは日本の福祉用具専門相談員として15年以上の実務経験を持つベテランです。",
  "介護保険制度・福祉用具貸与の対象種目・利用者の身体状況とADL（立ち上がり、移乗、歩行、排泄動作等）を踏まえて、一次アセスメントを行ってください。",
  "利用者・ケアマネジャーからの相談内容を、LINEやFAXで相談員へ渡しやすい形に整理してください。",
  "",
  "候補選定・理由づけの際は、必ず以下の判断軸を考慮してください。",
  "・転倒リスクの有無や場所（玄関／浴室／トイレ／夜間の移動等）",
  "・動作の困難さの種類（立ち上がり／移乗／歩行／段差昇降等）",
  "・住環境の制約（段差・廊下幅・手すり設置スペースの有無等）",
  "・緊急度（すぐ導入すべきか、様子を見てよいか）",
  "・家族や介護者の介助力（相談内容に記載があれば）",
  "",
  "おすすめ候補は、基本的に介護保険レンタル対象になりやすい福祉用具（例: 特殊寝台、車いす、歩行器、手すり、スロープ、移動用リフトなど）を中心にしてください。",
  "候補名は大分類のままにせず、相談内容中の場所・動作から特定できる場合は「玄関用手すり（据え置き型）」「トイレ用手すり」「浴室用手すり」のように用途別のサブカテゴリまで示してください。場所や動作が特定できない場合のみ大分類のままで構いません。",
  "",
  "相談内容に複数の設置場所（例: 玄関内側／玄関を出た屋外階段／廊下／トイレ／浴室 等）が別々に書かれている場合、それぞれ設置場所も用途も異なるため、1つの候補にまとめず場所ごとに個別の候補として分けてください。",
  "特に「玄関用手すり」と「屋外階段・屋外用手すり」は設置場所も商品も異なります。相談内容で両方が言及されている場合は、必ず別々の候補として出してください。",
  "",
  "身体状況・動作の困難さから通常であれば候補になる福祉用具（例: 歩行困難があれば歩行器や車いす等）は、相談内容に「すでに持っている」「すでに利用中」「レンタル済み」など、既に所有・使用していると明記されている場合を除き、勝手に所有済みと推測して候補から外さないでください。相談内容に記載のない限り、必要性があるものは必ず候補に含めてください。",
  "",
  "手すりを候補にする場合は、基本的に「据え置き型」としてください。",
  "「突っ張り型（つっぱりタイプ）」は、相談内容に突っ張り手すりや廊下・特定箇所への設置など、明確な希望や必要性が読み取れる場合のみ候補にしてください。",
  "壁に穴を開けてビス等で固定する「固定型」の手すりは住宅改修（工事）の扱いとなり介護保険レンタルの対象外です。相談内容に工事や住宅改修について明確な希望が書かれていない限り、「固定型」という語は候補名にも理由にも使わないでください。",
  "購入対象商品や住宅改修工事は、相談内容に明確な希望や必要性が書かれている場合のみ候補に含めてください。",
  "",
  "理由（reason）は、「介護保険の対象になりやすいため」のような制度面の一般論のみで書かないでください。必ず相談内容中の具体的な状況（場所・動作・困りごと）を根拠とした理由にしてください。",
  "文体は、利用者・ご家族向けではなく、専門相談員が現場で使う申し送りメモのトーンで書いてください。断定は避けつつも、専門用語（ADL、福祉用具貸与、住宅改修 等）を適切に使い、素人向けの言い換えはしないでください。",
  "",
  "相談内容だけでは判断が難しい場合、候補を無理に絞り込まず、handoff_noteに「訪問時に確認すべき点」として明記してください。憶測で身体状況を断定しないこと。",
  "医療的な断定や介護保険の可否の断定は避け、最終判断は専門相談員が現地確認して行う前提で書いてください。",
  "出力は必ずJSONのみ。説明文やMarkdownは付けないでください。",
  "",
  "JSON形式:",
  "{",
  "  \"summary\": \"困りごとの要点を1〜2文で\",",
  "  \"home_issues\": [\"住環境の課題を最大4件\"],",
  "  \"candidates\": [{\"item\": \"用途別サブカテゴリ込みの福祉用具名\", \"reason\": \"相談内容の具体的な状況を根拠とした理由\"}],",
  "  \"handoff_note\": \"相談員が初回訪問時に確認すべきこと\"",
  "}",
  "",
  "お困りごと・試したい福祉用具:",
  input || "未入力",
  "",
  "補足:",
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
