export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(200).json({
      ok: true,
      message: "POSTで住宅改修理由書の相談内容を送信してください"
    });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY is not set" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const input = String(body.input || "").trim();
    if (!input) {
      return res.status(400).json({ ok: false, error: "住宅改修の相談内容を入力してください" });
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
      "ステップ1：概況の個別出力として、user_status、care_status、life_change_goalを個別の文章で出力してください。",
      "各文章は、15年以上の実務経験がある福祉用具専門相談員がケアマネジャーへ提出前の下書きとして作成する密度にしてください。",
      "user_statusは、疾患名を断定せず、入力から読み取れるADL、立ち上がり、移乗、歩行、段差昇降、排泄・入浴動作、ふらつき、疼痛、筋力低下、認知面の不安などを具体的に整理してください。",
      "care_statusは、本人の自立度、家族・介護者の介助状況、見守りの必要性、介助負担、夜間や外出時のリスクを入力根拠に基づき整理してください。入力にない場合は『訪問時確認』として不足情報を自然に含めてください。",
      "life_change_goalは、単なる希望ではなく、『どの場所で、どの動作を、どの程度安全・容易にしたいか』を文章化し、自立支援・転倒予防・介助負担軽減の視点を必ず含めてください。",
      "",
      "ステップ2：①改善しようとしている生活動作を、以下の文言と完全一致で選択してください。存在しない項目の作成や表記変更は禁止です。",
      "【排泄】トイレまでの移動 / トイレ出入口の出入（扉の開閉を含む） / 便器からの立ち座り（移乗を含む） / 衣服の着脱 / 排泄時の姿勢保持 / 後始末 / その他（　　　）",
      "【入浴】浴室までの移動 / 衣服の着脱 / 浴室出入口の出入（扉の開閉を含む） / 浴室内での移動（立ち座りを含む） / 洗い場での立ち座り（洗体・洗髪を含む） / 浴槽の出入（立ち座りを含む） / 浴槽内での姿勢保持 / その他（　　　）",
      "【外出】出入口までの屋内移動 / 上がりかまちの昇降 / 車いす等、装具の着脱 / 履物の着脱 / 出入口の出入（扉の開閉を含む） / 出入口から敷地外までの屋外移動 / その他（　　　）",
      "【その他の活動】その他（　　　）",
      "",
      "ステップ3：konnan_jokyoには、ステップ2で選択した項目それぞれについて、入力内容中の根拠に基づく具体的な困難な状況を書いてください。一般論だけで書かないでください。",
      "konnan_jokyoは最低でも4〜7文程度とし、場所、姿勢変換、支持物の有無、転倒・転落リスク、介助者の負担、動作が中断する場面を具体的に書いてください。",
      "入力が短い場合でも、断定せず『〜が想定されるため訪問時に確認が必要』の形で、専門職として確認すべき視点を補ってください。",
      "",
      "ステップ4：③改修目的・期待効果を、以下の文言と完全一致で選択してください。1つの改善したい生活動作につき複数選択可、最大4ブロックまでです。",
      "できなかったことをできるようにする / 転倒等の防止、安全の確保 / 動作の容易性の確保 / 利用者の精神的負担や不安の軽減 / 介護者の負担の軽減 / その他（　　　）",
      "kaishuu_mokutekiのhoushinは必ず『（　）することで、（　）が改善できる』という文型にしてください。例：廊下に手すりを設置することで、転倒等の防止、安全の確保が改善できる",
      "houshinは短すぎる表現を避け、取付位置・動作場面・期待される変化が分かるように20〜45字程度で具体化してください。",
      "",
      "ステップ5：④改修項目（改修箇所）を、以下の文言と完全一致で選択し、locationsに玄関、廊下、トイレ等の箇所を入れてください。",
      "手すりの取付け / 段差の解消 / 引き戸等への扉の取替え / 便器の取替え / 滑り防止等のための床材の変更 / その他",
      "画面・PDF側で『項目名【箇所1、箇所2】』として表示します。",
      "locationsは『玄関上がりかまち』『屋外階段』『トイレ便器横』『浴室出入口』『廊下』のように、可能な限り具体的な箇所名にしてください。",
      "",
      "注意点：",
      "・項目名・表記は上記リストの文言と完全一致させること。言い換えや新規項目の作成は禁止。",
      "・個人情報（氏名・住所・生年月日・要介護度・作成者情報）は一切生成しないこと。",
      "・医療的な断定や介護保険の可否の断定は避け、入力内容に基づく一次アセスメントの範囲にとどめること。",
      "・入力内容だけでは該当項目の判断が難しい場合、無理に選択せず、該当なしのままでよい。ただし、文章欄には訪問時に確認すべき専門的観点を含めること。",
      "・全体として、自治体提出用の理由書に転記しやすい、具体性のある下書きにすること。抽象的な一文回答や短すぎる箇条書きは禁止。",
      "・出力は必ずJSONのみ。説明文やMarkdownは付けないでください。",
      "",
      "出力JSON構造:",
      "{",
      "  \"user_status\": \"利用者の身体状況\",",
      "  \"care_status\": \"介護状況\",",
      "  \"life_change_goal\": \"住宅改修により日常生活をどう変えたいか\",",
      "  \"seikatsu_dousa\": [{ \"category\": \"排泄|入浴|外出|その他の活動\", \"items\": [\"選択した項目名\"] }],",
      "  \"konnan_jokyo\": \"①に対する具体的な困難な状況\",",
      "  \"kaishuu_mokuteki\": [{ \"items\": [\"選択した改修目的・期待効果\"], \"houshin\": \"〜することで、〜が改善できる\" }],",
      "  \"kaishuu_koumoku\": [{ \"item\": \"改修項目名\", \"locations\": [\"箇所1\", \"箇所2\"] }]",
      "}",
      "",
      "相談内容:",
      input
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        temperature: 0.1
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: "OpenAI API error", detail: data });
    }

    const text = data.output_text ||
      data.output?.flatMap(item => item.content || []).map(part => part.text || "").join("") ||
      "";

    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw parseError;
      result = JSON.parse(match[0]);
    }

    return res.status(200).json({ ok: true, result });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "住宅改修理由書の作成に失敗しました"
    });
  }
}
