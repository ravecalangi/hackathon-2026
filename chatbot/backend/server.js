require("dotenv").config({ path: __dirname + "/.env" });
console.log("KEY:", process.env.OPENROUTER_API_KEY);
const express  = require("express");
const cors     = require("cors");
const multer   = require("multer");
const FormData = require("form-data");
const https    = require("https");

const app    = express();
const PORT   = 3000;
const upload = multer({ storage: multer.memoryStorage() });


const OPENROUTER_API_KEY        = process.env.OPENROUTER_API_KEY;
const AIORNOT_API_KEY           = process.env.AIORNOT_API_KEY;
const NEWS_API_KEY              = process.env.NEWS_API_KEY;
const SERPER_API_KEY            = process.env.SERPER_API_KEY;
const GNEWS_API_KEY             = process.env.GNEWS_API_KEY;
const GOOGLE_FACT_CHECK_API_KEY = process.env.GOOGLE_FACT_CHECK_API_KEY;
const GOOGLE_KG_API_KEY         = process.env.GOOGLE_KG_API_KEY;

const PRIMARY_MODEL = "google/gemini-2.0-flash-exp:free";

const FALLBACK_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "deepseek/deepseek-r1:free",
  "meta-llama/llama-4-maverick:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "deepseek/deepseek-r1-zero:free",
  "meta-llama/llama-4-scout:free",
  "openai/gpt-3.5-turbo",
  "nvidia/llama-3.1-nemotron-nano-8b-v1:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "openrouter/auto"
];

app.use(cors());
app.use(express.json());

async function callModel(model, messages) {
  return await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ravenchatbot.com",
      "X-Title": "Vertiscan Chatbot",
    },
    body: JSON.stringify({ model, messages })
  });
}

async function fetchWithFallback(messages) {
  const primaryRes = await callModel(PRIMARY_MODEL, messages);

  if (primaryRes.ok) {
    const data    = await primaryRes.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      console.log(`[Primary: ${PRIMARY_MODEL}] Success.`);
      return content;
    }
  }

  if (primaryRes.status !== 429 && primaryRes.status !== 404) {
    throw new Error(`Model error: ${primaryRes.status}`);
  }

  console.log(`[Primary: ${PRIMARY_MODEL}] Failed with ${primaryRes.status} — switching to fallback...`);

  for (const model of FALLBACK_MODELS) {
    try {
      const res = await callModel(model, messages);

      if (res.status === 429 || res.status === 404 || !res.ok) {
        console.log(`[Fallback: ${model}] Error ${res.status}, trying next...`);
        continue;
      }

      const data    = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        console.log(`[Fallback: ${model}] Success.`);
        return content;
      }

    } catch (err) {
      console.log(`[Fallback: ${model}] Exception: ${err.message}, trying next...`);
    }
  }

  throw new Error("All models are currently unavailable. Please try again later.");
}

// CONFIDENCE CAP ENFORCEMENT 
function enforceConfidenceCap(text) {
  if (!text) return text;

  text = text.replace(
    /((?:Confidence Level|Overall Confidence|Confidence)\s*:\s*)(\d+(?:\.\d+)?)(\s*%)/gi,
    (match, prefix, num, suffix) => {
      const val    = parseFloat(num);
      const capped = Math.min(Math.max(val, 3), 97);
      if (val !== capped) {
        console.log(`[ConfidenceCap] Clamped ${val}% → ${capped}%`);
      }
      return prefix + capped.toFixed(1) + suffix;
    }
  );

  text = text.replace(
    /(Credibility Score\s*:\s*)(\d+(?:\.\d+)?)(\s*\/\s*100)/gi,
    (match, prefix, num, suffix) => {
      const val    = parseFloat(num);
      const capped = Math.min(Math.max(val, 3), 97);
      if (val !== capped) {
        console.log(`[ConfidenceCap] Score clamped ${val} → ${capped}`);
      }
      return prefix + capped.toFixed(0) + suffix;
    }
  );

  return text;
}

function isFactCheckRequest(message) {
  const lower = message.toLowerCase();

  const factCheckTriggers = [
    "verify", "check this", "fake news", "is it true", "is this true",
    "fact check", "factcheck", "analyze this", "is this real", "is this fake",
    "according to", "they said", "i heard that", "rumor", "confirm this",
    "debunk", "legit ba", "hoax", "disinformation", "misinformation",
    "is this legit", "can you verify", "check if", "is this accurate",
    "is this correct", "fact or fiction", "true or false",
    "fake ba", "verify this", "please verify", "please check",
    "is it confirmed", "has it been confirmed", "officially announced",
    "totoo ba", "peke ba", "balita", "tsek mo", "i-verify", "i-check",
    "totoong balita", "totoo ba ito", "totoo bang",
    "is there a fight", "is there a match", "is there a game",
    "may laban ba", "may laban", "laban ba", "laban ni", "laban ng",
    "kailan laban", "sino kalaban", "kalaban ni", "kalaban niya",
    "next fight", "upcoming fight", "scheduled fight", "fight ba",
    "fight ni", "fight ng", "maglalaban", "lalaban", "sasabak",
    "will fight", "is fighting", "going to fight",
    "is still", "is he still", "is she still", "is it still",
    "did he", "did she", "did they", "has he", "has she",
    "what happened to", "ano nangyari", "ano na nangyari",
    "nagretiro na ba", "retired na ba", "active pa ba",
    "still active", "still playing", "still fighting",
    "in 2025", "in 2026", "in 2027",
    "this 2025", "this 2026", "this 2027",
    "ngayong 2025", "ngayong 2026",
    "sa 2025", "sa 2026", "sa 2027",
    "meron ba", "mayroon ba", "may balita", "may nangyari",
    "may announcement", "may ginawa", "may sinabi",
    "is there any news", "any news about", "any update",
    "anong balita", "ano ang balita",
  ];

  const newsPatterns = [
    /breaking[\s:]/i,
    /just in[\s:]/i,
    /report(s|ed)?:/i,
    /exclusive:/i,
    /headline/i,
    /https?:\/\//i,
    /according to [a-z]/i,
    /sources say/i,
    /officials say/i,
    /government say/i,
    /\b20(2[4-9]|3[0-9])\b/,
    /\bvs\.?\s+[a-z]/i,
    /\bversus\s+[a-z]/i,
    /\bba\s*\?/i,
    /\b(still|currently|ngayon|pa rin)\b.{0,30}\b(fight|laban|play|work|alive|buhay)\b/i,
  ];

  const hasFactCheckTrigger = factCheckTriggers.some(t => lower.includes(t));
  const hasNewsPattern      = newsPatterns.some(p => p.test(message));
  const isVeryLong          = message.length > 200;

  return hasFactCheckTrigger || hasNewsPattern || isVeryLong;
}

function isCasualFactQuestion(message) {
  const lower = message.toLowerCase();

  const fullReportTriggers = [
    "is it true that", "is it true na",
    "is this true", "totoo ba na", "totoo bang",
    "verify", "fact check", "factcheck", "fake news",
    "debunk", "is this real", "is this fake",
    "is this legit", "is this accurate", "is this correct",
    "can you verify", "please verify", "please check",
    "i heard that", "they said", "rumor", "hoax",
    "disinformation", "misinformation",
    "fact or fiction", "true or false",
  ];
  if (fullReportTriggers.some(t => lower.includes(t))) {
    return false;
  }

  const casualPatterns = [
    /^(meron|mayroon|may)\s+ba/i,
    /^(is there|are there|does|did|has|have|will)/i,
    /^(sino|ano|kailan|saan|paano)\s+(ang|si|yung|ba)/i,
    /laban\s+(ba|ni|ng|niya)/i,
    /\bvs\.?\s+[a-zA-Z]/i,
    /fight\s+(ba|ni|ng|in\s+20\d\d)/i,
    /\b(still|pa rin|ngayon|currently)\b/i,
    /\b(retired|nagretiro|active)\b/i,
    /\bin\s+20(2[4-9]|3\d)\b/i,
    /\bthis\s+20(2[4-9]|3\d)\b/i,
  ];

  const isShort = message.length < 150;

  return isShort && casualPatterns.some(p => p.test(message));
}

function extractKeywords(text) {
  const stopwords = new Set([
    "is","are","was","were","the","a","an","and","or","but","in","on","at","to",
    "for","of","with","that","this","it","by","from","has","have","been","be",
    "not","as","its","says","said","will","would","could","should","also","their",
    "they","he","she","we","i","my","your","his","her","our","which","who",
    "what","when","where","how","did","do","does","had","may","can","just","about",
    "more","than","then","so","if","into","after","before","some","any","all","no",
    "up","out","there","here","now","only","other","over","such","us","check","verify",
    "true","false","real","fake","news","claim","article","said","say","tell","please",
    "totoo","ba","na","si","ang","yung","mga","ito","yan","daw","raw","nga","naman",
    "kaya","lang","din","rin","ay","po","ho","mo","ko","ka","sya","siya","niya",
    "namin","natin","ninyo","nila","kami","kayo","tayo","sila","ito","iyon","iyan",
    "Breaking","BREAKING","Exclusive","EXCLUSIVE","Just","Report","Reports",
    "meron","mayroon","sinabi","ginawa","nangyari","balita","anong","kailan",
    "still","there","fight","laban","match","game","this","ngayong","ngayon"
  ]);

  const phrases = [];
  const quotedMatches = text.match(/"([^"]+)"/g);
  if (quotedMatches) {
    phrases.push(...quotedMatches.map(q => q.replace(/"/g, '').trim()).filter(p => p.length > 3).slice(0, 2));
  }

  const namedEntities = [];
  const entityMatches = text.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/g);
  if (entityMatches) {
    namedEntities.push(
      ...entityMatches
        .filter(e => {
          const words = e.split(' ');
          return words.length >= 1 && words.length <= 5 && !stopwords.has(e);
        })
        .slice(0, 4)
    );
  }

  const words = text
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w) && !stopwords.has(w.toLowerCase()));

  const combined = [...new Set([
    ...phrases,
    ...namedEntities,
    ...words
  ])].slice(0, 8);

  const hasTimeContext = /next month|this year|in \d{4}|starting|announced|\d{4}/i.test(text);
  const currentYear = new Date().getFullYear();
  if (!hasTimeContext && !combined.some(w => w.match(/20\d\d/))) {
    combined.push(String(currentYear));
  }

  return combined.join(" ");
}

function extractShortKeywords(text) {
  const stopwords = new Set([
    "is","are","was","were","the","a","an","and","or","but","in","on","at","to",
    "for","of","with","that","this","it","by","from","has","have","been","be",
    "not","as","its","will","would","could","should","also","their","they","he",
    "she","we","i","my","your","his","her","our","which","who","what","when",
    "where","how","did","do","does","had","may","can","just","about","more","than",
    "then","so","if","into","after","before","some","any","all","no","up","out",
    "there","here","now","only","other","over","such","us","check","verify","true",
    "false","real","fake","news","claim","article","said","say","tell","please",
    "totoo","ba","na","si","ang","yung","mga","ito","yan","daw","raw","nga","naman",
    "kaya","lang","din","rin","ay","po","ho","mo","ko","ka","sya","siya","niya",
    "namin","natin","ninyo","nila","kami","kayo","tayo","sila","ito","iyon","iyan",
    "Breaking","BREAKING","Exclusive","EXCLUSIVE","Just","Report","Reports",
    "meron","mayroon","sinabi","ginawa","nangyari","balita","anong","kailan",
    "still","there","fight","laban","match","game","this","ngayong","ngayon"
  ]);

  const entityMatches = text.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)+)/g);
  if (entityMatches) {
    const filtered = entityMatches
      .filter(e => !stopwords.has(e) && e.split(' ').length <= 4)
      .slice(0, 2);
    if (filtered.length > 0) return filtered.join(" ");
  }

  const words = text
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w.toLowerCase()));

  const capitalized = [...new Set(words.filter(w => /^[A-Z]/.test(w)))].slice(0, 4);
  return capitalized.join(" ");
}

function isRelevantResult(result, originalQuery) {
  const queryWords = originalQuery
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3);

  if (queryWords.length === 0) return true;

  const resultText = ((result.title || "") + " " + (result.snippet || "")).toLowerCase();
  const matchCount = queryWords.filter(w => resultText.includes(w)).length;
  const threshold  = Math.max(1, Math.floor(queryWords.length * 0.25));

  return matchCount >= threshold;
}

function hasImplausibilityRedFlags(text) {
  const redFlags = [
    /free .{0,30} for all citizens/i,
    /government (gives?|provides?|announces?|giving|offering) free/i,
    /everyone (will|can|shall) receive/i,
    /fully.paid .{0,20} for (all|every)/i,
    /all citizens .{0,30} (free|entitled|receive)/i,
    /nationwide free/i,
    /universal free (vacation|travel|flight|hotel)/i,
  ];
  return redFlags.some(pattern => pattern.test(text));
}

async function searchFactCheck(query) {
  if (!GOOGLE_FACT_CHECK_API_KEY || GOOGLE_FACT_CHECK_API_KEY === "YOUR_GOOGLE_FACT_CHECK_API_KEY_HERE") {
    console.log("[FactCheck] API key not set, skipping.");
    return [];
  }

  try {
    const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(query)}&key=${GOOGLE_FACT_CHECK_API_KEY}&languageCode=en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      console.error(`[FactCheck] Error: ${res.status}`);
      return [];
    }

    const data = await res.json();

    if (!data.claims?.length) {
      console.log(`[FactCheck] No results for: "${query}"`);
      return [];
    }

    const results = data.claims.slice(0, 5).map((claim, i) => {
      const review = claim.claimReview?.[0];
      return {
        index    : `FC${i + 1}`,
        claim    : claim.text || "",
        claimant : claim.claimant || "Unknown",
        date     : claim.claimDate?.slice(0, 10) || "",
        verdict  : review?.textualRating || "No rating",
        publisher: review?.publisher?.name || "Unknown",
        url      : review?.url || "",
        title    : review?.title || "",
      };
    });

    console.log(`[FactCheck] ✅ Found ${results.length} fact-checks for: "${query}"`);
    return results;

  } catch (err) {
    console.error("[FactCheck] Error:", err.message);
    return [];
  }
}

async function searchWikipedia(query) {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1&origin=*`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const topResult  = searchData?.query?.search?.[0];
    if (!topResult) return null;

    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topResult.title)}`;
    const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(6000) });

    if (!summaryRes.ok) return null;

    const summaryData = await summaryRes.json();
    if (!summaryData.extract) return null;

    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const titleLower = summaryData.title.toLowerCase();
    const hasMatch   = queryWords.some(w => titleLower.includes(w));
    if (!hasMatch) return null;

    console.log(`[Wikipedia] ✅ Found article: "${summaryData.title}"`);

    return {
      title  : summaryData.title,
      extract: summaryData.extract.slice(0, 500) + (summaryData.extract.length > 500 ? "..." : ""),
      url    : summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(summaryData.title)}`
    };

  } catch (err) {
    console.error("[Wikipedia] Error:", err.message);
    return null;
  }
}

async function searchKnowledgeGraph(query) {
  if (!GOOGLE_KG_API_KEY || GOOGLE_KG_API_KEY === "YOUR_GOOGLE_KG_API_KEY_HERE") {
    console.log("[KnowledgeGraph] API key not set, skipping.");
    return null;
  }

  try {
    const url = `https://kgsearch.googleapis.com/v1/entities:search?query=${encodeURIComponent(query)}&key=${GOOGLE_KG_API_KEY}&limit=1&indent=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });

    if (!res.ok) {
      console.error(`[KnowledgeGraph] Error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const item = data.itemListElement?.[0]?.result;
    if (!item) {
      console.log(`[KnowledgeGraph] No results for: "${query}"`);
      return null;
    }

    const result = {
      name       : item.name || "",
      description: item.description || "",
      types      : item["@type"] || [],
      detailedDesc: item.detailedDescription?.articleBody?.slice(0, 400) || "",
      url        : item.detailedDescription?.url || item.url?.value || "",
    };

    console.log(`[KnowledgeGraph] ✅ Found: "${result.name}" — ${result.description}`);
    return result;

  } catch (err) {
    console.error("[KnowledgeGraph] Error:", err.message);
    return null;
  }
}

async function searchWikidata(query) {
  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=1&origin=*`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const entity     = searchData.search?.[0];
    if (!entity) {
      console.log(`[Wikidata] No entity found for: "${query}"`);
      return null;
    }

    const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${entity.id}.json`;
    const entityRes = await fetch(entityUrl, { signal: AbortSignal.timeout(6000) });

    if (!entityRes.ok) return null;

    const entityData = await entityRes.json();
    const claims     = entityData.entities?.[entity.id]?.claims || {};

    const facts = {};

    if (claims.P569?.[0]?.mainsnak?.datavalue?.value?.time) {
      const raw = claims.P569[0].mainsnak.datavalue.value.time;
      const match = raw.match(/\+(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        facts.birthdate = `${match[1]}-${match[2]}-${match[3]}`;
      }
    }

    if (claims.P570?.[0]?.mainsnak?.datavalue?.value?.time) {
      const raw = claims.P570[0].mainsnak.datavalue.value.time;
      const match = raw.match(/\+(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        facts.deathdate = `${match[1]}-${match[2]}-${match[3]}`;
      }
    }

    if (Object.keys(facts).length === 0 && !entity.description) {
      console.log(`[Wikidata] Entity found but no useful facts for: "${query}"`);
      return null;
    }

    console.log(`[Wikidata] ✅ Found entity: "${entity.label}" — ${entity.description}`);

    return {
      id         : entity.id,
      label      : entity.label || "",
      description: entity.description || "",
      facts,
      url        : `https://www.wikidata.org/wiki/${entity.id}`
    };

  } catch (err) {
    console.error("[Wikidata] Error:", err.message);
    return null;
  }
}

async function searchDuckDuckGo(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });

    if (!res.ok) {
      console.error(`[DuckDuckGo] Error: ${res.status}`);
      return null;
    }

    const data = await res.json();

    const abstract  = data.AbstractText?.trim() || "";
    const answer    = data.Answer?.trim() || "";
    const heading   = data.Heading?.trim() || "";
    const sourceUrl = data.AbstractURL || data.AnswerURL || "";

    if (!abstract && !answer && !heading) {
      console.log(`[DuckDuckGo] No instant answer for: "${query}"`);
      return null;
    }

    console.log(`[DuckDuckGo] ✅ Found: "${heading || answer || abstract.slice(0, 60)}"`);

    return {
      heading,
      answer,
      abstract: abstract.slice(0, 500),
      url     : sourceUrl
    };

  } catch (err) {
    console.error("[DuckDuckGo] Error:", err.message);
    return null;
  }
}

async function searchSerper(query) {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY"   : SERPER_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query, num: 8, hl: "en", gl: "us" }),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      console.error(`[Serper] Error: ${res.status}`);
      return [];
    }

    const data    = await res.json();
    const results = [];

    if (data.answerBox) {
      const ab = data.answerBox;
      results.push({
        type   : "answer",
        index  : "A1",
        title  : ab.title  || "Google Answer Box",
        snippet: ab.answer || ab.snippet || ab.snippetHighlighted?.join(" ") || "",
        source : ab.link   || "Google",
        url    : ab.link   || "",
        date   : ""
      });
    }

    if (data.topStories?.length > 0) {
      data.topStories.slice(0, 4).forEach((r, i) => {
        results.push({
          type   : "news",
          index  : `S${i + 1}`,
          title  : r.title   || "",
          snippet: r.snippet || r.title || "",
          source : r.source  || "",
          url    : r.link    || "",
          date   : r.date    || ""
        });
      });
    }

    if (data.organic?.length > 0) {
      data.organic.slice(0, 6).forEach((r, i) => {
        results.push({
          type   : "web",
          index  : `W${i + 1}`,
          title  : r.title   || "",
          snippet: r.snippet || "",
          source : r.link    || "",
          url    : r.link    || "",
          date   : r.date    || ""
        });
      });
    }

    console.log(`[Serper] Found ${results.length} results for: "${query}"`);
    return results;

  } catch (err) {
    console.error("[Serper] Error:", err.message);
    return [];
  }
}

async function searchNewsAPI(query, originalText = "") {
  if (!query.trim()) return [];

  async function fetchFromNewsAPI(q) {
    try {
      const url  = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&pageSize=5&language=en&apiKey=${NEWS_API_KEY}`;
      const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();

      if (data.status !== "ok" || !data.articles?.length) return [];

      return data.articles
        .filter(a => a.title && a.title !== "[Removed]" && a.description)
        .slice(0, 5)
        .map((a, i) => ({
          type   : "news",
          index  : `N${i + 1}`,
          title  : a.title,
          snippet: a.description,
          source : a.source?.name || "Unknown",
          date   : a.publishedAt?.slice(0, 10) || "recent",
          url    : a.url
        }));
    } catch (err) {
      console.error("[NewsAPI] Fetch error:", err.message);
      return [];
    }
  }

  let results = await fetchFromNewsAPI(query);
  if (results.length > 0) {
    console.log(`[NewsAPI] ✅ Found ${results.length} results for: "${query}"`);
    return results.filter(r => isRelevantResult(r, originalText || query));
  }

  const shortQuery = extractShortKeywords(originalText || query);
  if (shortQuery && shortQuery !== query) {
    console.log(`[NewsAPI] Retry 2 - short keywords: "${shortQuery}"`);
    results = await fetchFromNewsAPI(shortQuery);
    if (results.length > 0) return results.filter(r => isRelevantResult(r, originalText || query));
  }

  const threeWords = query.split(" ").slice(0, 3).join(" ");
  if (threeWords !== query && threeWords !== shortQuery) {
    console.log(`[NewsAPI] Retry 3 - first 3 words: "${threeWords}"`);
    results = await fetchFromNewsAPI(threeWords);
    if (results.length > 0) return results.filter(r => isRelevantResult(r, originalText || query));
  }

  console.log(`[NewsAPI] ❌ No results found for any query variant.`);
  return [];
}

async function searchGNews(query) {
  if (!GNEWS_API_KEY || GNEWS_API_KEY === "YOUR_GNEWS_API_KEY_HERE") return [];
  if (!query.trim()) return [];

  try {
    const url  = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=5&apikey=${GNEWS_API_KEY}`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();

    if (!data.articles?.length) return [];

    console.log(`[GNews] ✅ Found ${data.articles.length} results for: "${query}"`);

    return data.articles.map((a, i) => ({
      type   : "news",
      index  : `G${i + 1}`,
      title  : a.title,
      snippet: a.description || a.title,
      source : a.source?.name || "Unknown",
      date   : a.publishedAt?.slice(0, 10) || "recent",
      url    : a.url
    }));

  } catch (err) {
    console.error("[GNews] Error:", err.message);
    return [];
  }
}

function buildClickableReferences(newsAPIResults, gNewsResults, serperMerged, factCheckResults) {
  const refs = [];

  for (const f of factCheckResults) {
    if (f.url) refs.push({
      title : `[FACT-CHECKED] ${f.title || f.claim.slice(0, 80)}`,
      source: f.publisher,
      url   : f.url,
      date  : f.date,
      index : f.index
    });
  }

  for (const a of newsAPIResults) {
    if (a.url) refs.push({ title: a.title, source: a.source, url: a.url, date: a.date, index: a.index });
  }

  for (const a of gNewsResults) {
    if (a.url) refs.push({ title: a.title, source: a.source, url: a.url, date: a.date, index: a.index });
  }

  for (const r of serperMerged.filter(r => r.type === "news" && r.url)) {
    refs.push({ title: r.title, source: r.source, url: r.url, date: r.date, index: r.index });
  }

  for (const r of serperMerged.filter(r => r.type === "web" && r.url)) {
    refs.push({ title: r.title, source: r.source, url: r.url, date: r.date, index: r.index });
  }

  const seen = new Set();
  return refs.filter(r => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  }).slice(0, 10);
}

async function fetchWebContext(query, originalText = "") {
  if (!query.trim()) return { contextText: "", newsArticles: [] };

  const currentYear   = new Date().getFullYear();
  const queryWithYear = query.includes(String(currentYear)) ? query : `${query} ${currentYear}`;

  const shortKw        = extractShortKeywords(originalText || query);
  const queryConfirmed = shortKw
    ? `"${shortKw}" confirmed OR announced OR official`
    : `${query} confirmed announced`;

  console.log("[Serper Query 1]:", queryWithYear);
  console.log("[Serper Query 2]:", queryConfirmed);

  const [
    serperResults1,
    serperResults2,
    newsAPIResults,
    factCheckResults,
    wikiResult,
    kgResult,
    wikidataResult,
    ddgResult
  ] = await Promise.all([
    searchSerper(queryWithYear),
    searchSerper(queryConfirmed),
    searchNewsAPI(query, originalText),
    searchFactCheck(shortKw || query),
    searchWikipedia(shortKw || query),
    searchKnowledgeGraph(shortKw || query),
    searchWikidata(shortKw || query),
    searchDuckDuckGo(shortKw || query)
  ]);

  let gNewsResults = [];
  if (newsAPIResults.length === 0) {
    const shortQuery = shortKw || query.split(" ").slice(0, 3).join(" ");
    console.log("[GNews] NewsAPI empty → trying GNews with:", shortQuery);
    gNewsResults = await searchGNews(shortQuery);
  }

  const seen   = new Set();
  const merged = [];
  let webIdx   = 1;
  let newsIdx  = 1;

  for (const r of [...serperResults1, ...serperResults2]) {
    const key = (r.title + r.snippet).trim();
    if (!seen.has(key)) {
      seen.add(key);
      if (r.type === "web")  r.index = `W${webIdx++}`;
      if (r.type === "news") r.index = `S${newsIdx++}`;
      merged.push(r);
    }
  }

  const relevantMerged = merged.filter(r =>
    r.type === "answer" || isRelevantResult(r, originalText || query)
  );

  let context = "";

  if (factCheckResults.length > 0) {
    context += `\n\n✅ PREVIOUSLY FACT-CHECKED CLAIMS (Google Fact Check — HIGHEST CREDIBILITY):\n` +
      factCheckResults.map(f =>
        `[${f.index}] Claim: "${f.claim}"\n` +
        `   Claimant: ${f.claimant} | Date: ${f.date}\n` +
        `   Verdict by ${f.publisher}: "${f.verdict}"\n` +
        `   Source: ${f.url}`
      ).join('\n\n');
  }

  if (ddgResult && (ddgResult.answer || ddgResult.abstract)) {
    context += `\n\n⚡ DUCKDUCKGO INSTANT ANSWER (direct factual answer — very high reliability):\n`;
    if (ddgResult.heading) context += `Topic: "${ddgResult.heading}"\n`;
    if (ddgResult.answer)  context += `[DDG] Direct Answer: "${ddgResult.answer}"\n`;
    if (ddgResult.abstract) context += `Summary: ${ddgResult.abstract}\n`;
    if (ddgResult.url)     context += `Source: ${ddgResult.url}`;
  }

  if (kgResult) {
    context += `\n\n🔷 GOOGLE KNOWLEDGE GRAPH (verified structured data about this entity):\n` +
      `[KG1] Name: "${kgResult.name}"\n` +
      `   Type: ${Array.isArray(kgResult.types) ? kgResult.types.join(", ") : kgResult.types}\n` +
      `   Description: ${kgResult.description}\n` +
      (kgResult.detailedDesc ? `   Details: ${kgResult.detailedDesc}\n` : "") +
      (kgResult.url ? `   Source: ${kgResult.url}` : "");
  }

  if (wikidataResult) {
    context += `\n\n📊 WIKIDATA STRUCTURED FACTS (verified database — excellent for biographical facts):\n` +
      `[WD1] Entity: "${wikidataResult.label}" (${wikidataResult.id})\n` +
      `   Description: ${wikidataResult.description}\n`;
    if (wikidataResult.facts.birthdate) {
      context += `   ✅ Date of Birth (P569): ${wikidataResult.facts.birthdate}\n`;
    }
    if (wikidataResult.facts.deathdate) {
      context += `   Date of Death (P570): ${wikidataResult.facts.deathdate}\n`;
    }
    context += `   Source: ${wikidataResult.url}`;
  }

  if (wikiResult) {
    context += `\n\n📖 WIKIPEDIA BACKGROUND CONTEXT:\n` +
      `[WK1] "${wikiResult.title}"\n${wikiResult.extract}\n` +
      `Source: ${wikiResult.url}`;
  }

  const answerBox = relevantMerged.find(r => r.type === "answer");
  if (answerBox) {
    context += `\n\n🎯 GOOGLE DIRECT ANSWER (highest priority):\n[${answerBox.index}] "${answerBox.title}": ${answerBox.snippet}\n`;
  }

  if (newsAPIResults.length > 0) {
    context += `\n\n📰 RECENT NEWS ARTICLES (NewsAPI):\n` +
      newsAPIResults.map(a =>
        `[${a.index}] "${a.title}" — ${a.source} (${a.date})\n${a.snippet}`
      ).join('\n\n');
  }

  if (gNewsResults.length > 0) {
    context += `\n\n📰 RECENT NEWS ARTICLES (GNews):\n` +
      gNewsResults.map(a =>
        `[${a.index}] "${a.title}" — ${a.source} (${a.date})\n${a.snippet}`
      ).join('\n\n');
  }

  const topStories = relevantMerged.filter(r => r.type === "news");
  if (topStories.length > 0) {
    context += `\n\n📡 TOP NEWS STORIES (Google News):\n` +
      topStories.map(r =>
        `[${r.index}] "${r.title}" — ${r.source} (${r.date})\n${r.snippet}`
      ).join('\n\n');
  }

  const webResults = relevantMerged.filter(r => r.type === "web");
  if (webResults.length > 0) {
    context += `\n\n🌐 WEB SEARCH RESULTS (Google):\n` +
      webResults.map(r =>
        `[${r.index}] "${r.title}" — ${r.source} (${r.date})\n${r.snippet}`
      ).join('\n\n');
  }

  const filteredGNews    = gNewsResults.filter(r => isRelevantResult(r, originalText || query));
  const allClickableRefs = buildClickableReferences(newsAPIResults, filteredGNews, relevantMerged, factCheckResults);

  console.log(`[References] Clickable: ${allClickableRefs.length} total (FactCheck: ${factCheckResults.length}, DDG: ${ddgResult ? 1 : 0}, KG: ${kgResult ? 1 : 0}, Wikidata: ${wikidataResult ? 1 : 0}, NewsAPI: ${newsAPIResults.length}, GNews: ${filteredGNews.length}, Serper: ${relevantMerged.filter(r => r.url).length})`);

  if (!context.trim()) return { contextText: "", newsArticles: [] };

  const contextText = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REAL-TIME WEB EVIDENCE (gathered just now via Google Search — prioritize over training data):
${context}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  return { contextText, newsArticles: allClickableRefs };
}



const VERITASCAN_SYSTEM_PROMPT = `
You are Veritascan AI, a professional fake news detection and fact-checking assistant.

MOST IMPORTANT RULES:
• Only perform fake news credibility analysis when the user explicitly asks to verify or fact-check a claim, OR if the message contains a pasted news article. For ALL other messages, respond normally and conversationally.
• For greetings, casual questions, general knowledge questions — respond naturally without any analysis format.
• NEVER perform credibility analysis on casual conversation or general questions like "how are you", "what is X", "is X healthy", etc. unless the user explicitly asks to verify it as a news claim.
• NEVER use filler phrases like "wait a moment", "let me check", "as of my last update". Always provide a direct, final response.
• NEVER fabricate or assume information about events you are not certain about.
• NEVER classify a claim as FAKE just because you lack evidence confirming it. Absence of evidence is NOT proof of fakeness.
• NEVER give high confidence unless you have direct, explicit contradicting or confirming evidence.
• A claim is FAKE only if you have direct evidence proving it false.
• A claim with no confirming or denying evidence = UNVERIFIABLE.
• If REAL-TIME WEB EVIDENCE is provided, use ONLY what is directly relevant to the specific claim.
• Intellectual honesty is the highest priority — UNVERIFIABLE is always better than a false verdict.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FACTUAL KNOWLEDGE CLAIMS — CRITICAL RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Many fact-check questions are about STABLE, WELL-KNOWN FACTS — not breaking news.
  Examples: birthdates, nationalities, historical events, professions, world records,
  scientific facts, geography, biographical info about public figures.

• For these claims, YOU MUST USE YOUR OWN TRAINING KNOWLEDGE to answer — do NOT
  rely solely on web search results. Web search does not always return direct answers
  for basic biographical facts because they are not "news."

• NEVER classify a well-known stable fact as UNVERIFIABLE just because web search
  returned no news articles about it. That is wrong. Use your knowledge.

• RULE: If the claim is about a stable biographical or historical fact AND you know
  the answer from your training data with high confidence → answer it directly as
  REAL or FAKE based on your knowledge. Do NOT say UNVERIFIABLE.

• EXAMPLES:
  ✅ "Totoo ba na December 17 ang birthday ni Pacquiao?"
     → You know Manny Pacquiao was born December 17, 1978. Answer: REAL. ✓
  ✅ "Totoo ba na si Lebron James ay Amerikano?"
     → You know this is true. Answer: REAL. ✓
  ✅ "Totoo ba na si Einstein ay nag-fail ng math?"
     → You know this is a myth. Answer: FAKE/MISLEADING. ✓
  ❌ NEVER say these are UNVERIFIABLE — that is factually wrong and embarrassing.

• WHEN to use UNVERIFIABLE:
  → Only for RECENT EVENTS, BREAKING NEWS, or claims about things that happened
    recently that you cannot confirm from your training data.
  → Example: "Totoo ba na nagretiro si Pacquiao ngayong 2026?" → UNVERIFIABLE (recent)
  → Example: "Totoo ba na December 17 ang birthday ni Pacquiao?" → REAL (stable fact)

• WIKIPEDIA [WK1] can help confirm stable facts — treat it as supporting evidence
  for biographical/historical claims.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL DISTINCTION — READ CAREFULLY:
• "Person WANTS a fight/event" ≠ "Fight/event is CONFIRMED or SCHEDULED"
• "Rumored" or "hoped for" ≠ "Officially announced"
• "Negotiations ongoing" ≠ "Fight is happening"
• "Sources say" ≠ "Officially confirmed"
• "Fan speculation" ≠ "Real event"
• If evidence only shows DESIRE or RUMORS but NO official confirmation → classify as UNVERIFIABLE or LIKELY FAKE
• Only classify as REAL or LIKELY REAL if there is an OFFICIAL ANNOUNCEMENT from the fighters, promoters, or sanctioning body

WHEN TO USE ANALYSIS FORMAT:
✅ "Totoo ba na December 17 ang birthday ni Pacquiao?" → fact-check using knowledge
✅ "Is it true that Pacquiao is fighting in 2026?" → fact-check using web evidence
✅ "Verify this news: [article text]" → full report
✅ "Fact check this: [claim]" → full report
✅ "Totoo ba na si [person] ay [claim]?" → fact-check (knowledge or web)
✅ Pasted news articles (long text that looks like a news article) → full report
❌ "Kumusta ka na?" → just reply naturally
❌ "Masama ba ang itlog?" → just answer the question normally
❌ "What is the capital of France?" → just answer normally
❌ "How are you?" → just reply naturally

QUESTION-TYPE FACT CHECKS — IMPORTANT:
• If the user asks a short, direct question about whether an event EXISTS or IS HAPPENING
  (e.g., "Meron bang laban si Pacquiao in 2026?", "May fight ba vs Mayweather?",
  "Is Pacquiao still active?", "Did Marcos resign?") — treat this as a fact-check request
  that needs web search, BUT do NOT use the full credibility report format.
• Instead, give a SHORT, DIRECT answer (2-4 sentences) using the web evidence:
  - Lead with a natural conversational opener that matches the verdict tone.
    Examples: "Good news!", "Heads up —", "Unfortunately, no.", "Yep, confirmed!", "Not quite —"
  - State clearly: YES (with source) or NO (no official confirmation found)
  - Cite the most relevant source briefly: "[N1] Reuters (2025): ..."
  - End with a tip on where to verify: "Check [person]'s official social media for updates."
• NEVER answer recent-event questions from training data alone — always use the REAL-TIME WEB EVIDENCE provided.
• NEVER say "as of my last update" — use the web evidence instead.

CLASSIFICATION GUIDE (for full fact-check requests only):
• REAL          → Official announcement, direct evidence, OR well-known verified fact CONFIRMS the claim
• LIKELY REAL   → Strong credible evidence suggests it is probably true
• UNCERTAIN     → Mixed evidence — some support, some against
• UNVERIFIABLE  → No relevant evidence found AND claim is about a recent/unknown event
• MISLEADING    → Claim is partially true but presented deceptively
• LIKELY FAKE   → Evidence strongly suggests the claim is false or unconfirmed speculation
• FAKE          → Direct evidence OR reliable knowledge EXPLICITLY CONTRADICTS the claim

FACTUAL VERIFICATION RESULT OPTIONS:
• CONFIRMED ACCURATE   → Evidence directly confirms the claim is true
• CONFIRMED INACCURATE → Evidence directly contradicts the claim
• PARTIALLY ACCURATE   → Claim has elements of truth but is incomplete or exaggerated
• CANNOT BE VERIFIED   → No sufficient evidence exists to confirm or deny
• DECEPTIVE FRAMING    → Facts are real but presented in a misleading context

ADDITIONAL CLASSIFICATION RULE — IMPLAUSIBILITY DETECTION:
• If a claim describes a government policy or program that would be extraordinarily expensive, logistically impossible, or unprecedented at a national scale (e.g., "free international vacation for ALL citizens"), AND no official government source, budget allocation, or credible news confirms it — classify as LIKELY FAKE, not UNVERIFIABLE.
• Absence of ANY corroborating evidence for a major, headline-worthy government program is itself strong evidence against its legitimacy.
• Apply common-sense plausibility: Would this claim require massive government spending with zero news coverage? → LIKELY FAKE.
• Missing official government website, press release, or budget document for a large-scale public program = strong indicator of LIKELY FAKE.
• If a SYSTEM FLAG is present in the query indicating implausibility red flags, weigh this heavily — default to LIKELY FAKE unless strong official evidence contradicts the flag.

UNVERIFIABLE SUB-CLASSIFICATION:
• If claim is UNVERIFIABLE + has implausibility red flags (too good to be true, no budget source, affects ALL citizens) → Label as: UNVERIFIABLE ⚠️ (High Suspicion)
• If claim is UNVERIFIABLE + no red flags, just no evidence found → Label as: UNVERIFIABLE (Insufficient Evidence)
• If claim is UNVERIFIABLE + partial hits but inconclusive → Consider UNCERTAIN instead
• NEVER use UNVERIFIABLE for well-known biographical or historical facts you already know.

CONFIDENCE LEVEL GUIDE — STRICT RULES:
• ABSOLUTE RULE: NEVER assign 100% confidence under ANY circumstance — not even for verified facts.
• ABSOLUTE RULE: NEVER assign 0% confidence. Minimum allowed is 3%.
• Your confidence range is STRICTLY LIMITED to 3% – 97%. Any value outside this range is WRONG.
• Even the most verified fact has some uncertainty. 97% is your hard ceiling.
• VIOLATION: outputting "100%", "100.0%", or any score of 98%, 99%, or 100% is a critical error.
• 90–97% → Official announcement, direct evidence, OR high-confidence training knowledge for stable facts
• 70–89% → Strong credible evidence but not an official announcement
• 50–69% → Mixed or limited evidence
• 30–49% → Mostly rumors or speculation
• 3–29%  → Almost no relevant evidence, or evidence contradicts
• NEVER assign high confidence to unconfirmed rumors or speculation

FACT-CHECK SOURCE PRIORITY:
• YOUR OWN KNOWLEDGE = Highest priority for stable, well-known biographical/historical facts.
• [FC] sources = Previously fact-checked by professional organizations — HIGHEST CREDIBILITY for news claims.
• [DDG] DuckDuckGo Instant Answer = Direct factual answers — very high reliability for specific facts like birthdates.
• [KG1] Google Knowledge Graph = Verified structured data about people/places/orgs — high reliability.
• [WD1] Wikidata = Structured biographical database — excellent for birthdates, nationalities, occupations.
• [WK1] Wikipedia = Strong supporting evidence for biographical/historical facts.
• [A1] Google Answer Box = High priority for direct factual answers.
• [N], [G], [S] = News articles — useful but verify if they CONFIRM or merely DISCUSS.
• [W] = General web results — lowest priority.

CORE ANALYSIS PROTOCOL:

STEP 1 — CLAIM UNDERSTANDING
• Extract main claims, named entities, dates, context.
• Summarize in one clear sentence.
• Identify the CLAIM TYPE:
  A) STABLE FACT — biographical, historical, scientific (use your knowledge first)
  B) RECENT EVENT — news, current events, scheduled events (use web evidence first)
  C) SHORT QUESTION — needs direct answer, not full report
  D) FULL CLAIM — needs complete credibility report

STEP 2 — EVIDENCE EVALUATION
• If CLAIM TYPE A (stable fact): Answer from your training knowledge. Use [DDG], [KG1], [WD1], [WK1] as support.
• If CLAIM TYPE B (recent event): Use REAL-TIME WEB EVIDENCE. Check [FC] first, then news.
• CRITICAL: Distinguish between "wants/hopes/rumors" and "confirmed/announced/official"
• For biographical facts: [DDG] and [WD1] birthdate data = very high reliability. Use them.
• Ask: Is this a fact I know reliably, or is this a recent event needing web confirmation?
• If stable fact you know OR confirmed by [DDG]/[KG1]/[WD1] → answer confidently
• If recent event with official confirmation in web evidence → REAL or LIKELY REAL
• If recent event with only rumors in web evidence → UNVERIFIABLE or LIKELY FAKE
• If recent event with no evidence → UNVERIFIABLE
• If SYSTEM FLAG is present → apply IMPLAUSIBILITY DETECTION rule above

STEP 3 — FINAL CLASSIFICATION
• Use the CLASSIFICATION GUIDE strictly.
• NEVER use UNVERIFIABLE for facts you already know reliably.
• Never give high confidence for unconfirmed recent claims.
• Be explicit about WHY you chose the classification.

STEP 4 — REFERENCES
• For stable facts: cite your knowledge + Wikipedia [WK1] if available.
• For recent events: cite news sources and note if they CONFIRM or DISCUSS.
• Always mention if a [FC] fact-check source was found.

REQUIRED RESPONSE FORMAT — TWO TYPES:

TYPE 1: SHORT QUESTION (casual question about an event/status/fight/fact):
[Natural conversational opener matching the verdict tone, then direct YES/NO or the correct fact in 1 sentence.
 Examples of openers: "Good news!", "Heads up —", "Unfortunately, no.", "Yep, confirmed!", "Not quite —", "Exciting news!"]
[1-2 sentences of explanation or evidence, written like a knowledgeable friend]
[1 sentence tip if needed: where to verify for recent events]

TYPE 2: FULL FACT-CHECK REPORT (explicit verify request or pasted article):

VERITASCAN AI — CREDIBILITY ANALYSIS REPORT

Claim Summary:
[One-sentence summary of the specific claim being checked]

Final Classification:
[REAL / LIKELY REAL / UNCERTAIN / UNVERIFIABLE / MISLEADING / LIKELY FAKE / FAKE]
Confidence Level: XX.X%

Credibility Score:
XX / 100
Risk Level: [LOW / MODERATE / HIGH / EXTREME]

Factual Verification Result:
[CONFIRMED ACCURATE / CONFIRMED INACCURATE / PARTIALLY ACCURATE / CANNOT BE VERIFIED / DECEPTIVE FRAMING]

Explanation:
[Detailed analytical explanation. State clearly whether this is a stable fact (answered from knowledge)
or a recent event (answered from web evidence). Be explicit about your reasoning.
Then, after the analysis, add 1 short natural sentence reacting to the verdict — like a knowledgeable friend.
Examples:
  - REAL/CONFIRMED ACCURATE: "Good news — this one checks out." or "Yep, this is legit."
  - LIKELY REAL: "Looks solid, but keep an eye out for an official announcement."
  - UNVERIFIABLE: "Basically, nobody's confirmed this yet — treat it as a rumor for now."
  - FAKE/LIKELY FAKE: "Yeah, this one's not real. Don't share it."
  - MISLEADING: "There's truth here, but the framing is designed to mislead."
  - UNCERTAIN: "Mixed signals on this one — the jury's still out."
]
[If UNVERIFIABLE: also end with a user-friendly tip:
- Government claims: "Verify at your country's official government website."
- Celebrity/sports claims: "Check the official social media of the person involved."
- Health/science claims: "Refer to WHO, DOH, or peer-reviewed sources."
- General claims: "Search Google News with specific keywords."]

Supporting Evidence and References:
• [Cite knowledge + web sources. Note if each CONFIRMS or DISCUSSES. Highlight [FC] first.]

Final Verdict:
[REAL / LIKELY REAL / UNCERTAIN / UNVERIFIABLE / MISLEADING / LIKELY FAKE / FAKE]

Overall Confidence: XX.X%

TONE & STYLE:
• Professional and analytical for the structured sections of a full report.
• Conversational and human for the Explanation section and all short answers — write like a knowledgeable friend, not a robot.
• For short questions: always lead with a natural opener that fits the verdict (e.g., "Good news!", "Unfortunately, no.", "Heads up —", "Yep, confirmed!"), then give the direct answer and evidence.
• For full reports: keep report structure clean and formal, but end the Explanation with one casual friendly sentence for a human touch.
• NEVER make the user feel stupid for asking a simple question. Just answer it correctly and warmly.`;




app.post("/chat", async (req, res) => {
  const { message, userName } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required" });

  const needsFactCheck  = isFactCheckRequest(message);
  const isShortQuestion = isCasualFactQuestion(message);
  let finalMessage      = message;
  let newsArticles      = [];

  if (needsFactCheck) {
    const query = extractKeywords(message);
    const { contextText, newsArticles: fetchedArticles } = await fetchWebContext(query, message);
    newsArticles = fetchedArticles;

    console.log("[Fact-check detected] Query:", query);
    console.log("[Is casual question]:", isShortQuestion);
    console.log("[Web Context Found]:", contextText ? "Yes" : "No");
    console.log("[Clickable References]:", newsArticles.length);

    const implausibilityFlag = hasImplausibilityRedFlags(message)
      ? `\n\nSYSTEM FLAG ⚠️: This claim contains implausibility red flags — it promises extraordinary benefits to ALL citizens with no named budget source, official document, or credible corroboration. Treat absence of official confirmation as strong evidence of LIKELY FAKE. Do NOT classify as UNVERIFIABLE unless you have a specific reason to doubt the flag.`
      : "";

    const formatInstruction = isShortQuestion
      ? `\n\nFORMAT INSTRUCTION: This is a SHORT CASUAL QUESTION about an event/status. Use TYPE 1 SHORT ANSWER format — do NOT generate a full credibility report. Lead with a natural conversational opener that matches the verdict tone (e.g. "Good news!", "Unfortunately, no.", "Heads up —", "Yep, confirmed!"). Give a direct 2-4 sentence answer based on the web evidence, cite your source briefly, and end with a verification tip if needed.`
      : `\n\nFORMAT INSTRUCTION: This is a FULL FACT-CHECK REQUEST. Use TYPE 2 FULL REPORT format with complete credibility analysis.`;

    if (contextText) {
      finalMessage = `
USER QUERY:
${message}
${implausibilityFlag}
${formatInstruction}

${contextText}

INSTRUCTIONS FOR ANALYSIS:
1. FIRST: Check if any [FC] fact-check results exist above — if yes, heavily prioritize their verdict.
2. Check [DDG] DuckDuckGo Instant Answer — direct factual answers have very high reliability.
3. Check [KG1] Google Knowledge Graph — structured verified data about entities.
4. Check [WD1] Wikidata — excellent for birthdates, nationalities, biographical facts.
5. Check [WK1] Wikipedia context for background information if available.
6. Read ALL remaining web evidence carefully before drawing any conclusion.
7. CRITICAL: Distinguish between "wants/rumored" vs "officially confirmed/announced".
8. Only use evidence DIRECTLY related to the specific claim.
9. If [DDG], [KG1], or [WD1] directly answers the claim → use it. Do NOT say UNVERIFIABLE.
10. If evidence only shows desire or rumors → UNVERIFIABLE or LIKELY FAKE.
11. If evidence confirms with official announcement → REAL or LIKELY REAL.
12. If evidence directly contradicts → FAKE or LIKELY FAKE.
13. If absolutely no evidence anywhere → UNVERIFIABLE.
14. Cite sources [FC1], [DDG], [KG1], [WD1], [WK1], [A1], [N1], [G1], [S1], [W1] etc.
15. NEVER give high confidence for unconfirmed rumors or speculation.
16. If a SYSTEM FLAG is present, apply the IMPLAUSIBILITY DETECTION rule and default to LIKELY FAKE.
17. Follow the FORMAT INSTRUCTION above strictly.
      `.trim();
    } else {
      finalMessage = `
USER QUERY:
${message}
${implausibilityFlag}
${formatInstruction}

NOTE: No real-time web results were found for this query.
- If this is a short question: honestly say no official information was found, and direct user to official sources.
- If this is a full fact-check: classify as UNVERIFIABLE (Insufficient Evidence).
- If a SYSTEM FLAG is present, classify as LIKELY FAKE.
- Be honest about uncertainty. Do NOT fabricate a verdict.
      `.trim();
    }
  } else {
    console.log("[Normal conversation detected] Skipping web search.");
    finalMessage = message;
  }

  try {
    let chatbotMessage = await fetchWithFallback([
      { role: "system", content: VERITASCAN_SYSTEM_PROMPT + `\n\nThe user's name is "${userName || 'User'}". Address them by name naturally when appropriate.` },
      { role: "user",   content: finalMessage }
    ]);

    chatbotMessage = enforceConfidenceCap(chatbotMessage);

    res.json({
      message     : chatbotMessage,
      newsArticles: newsArticles
    });

  } catch (error) {
    console.error("Chat error:", error.message);
    res.status(500).json({ message: "All models are currently unavailable. Please try again in a moment.", newsArticles: [] });
  }
});

app.post("/news-check", async (req, res) => {
  const { claim, originalMessage } = req.body;
  if (!claim && !originalMessage) {
    return res.status(400).json({ error: "Claim or message is required." });
  }

  const sourceText = originalMessage || claim;
  const query      = extractKeywords(sourceText);

  console.log("[NewsAPI] Query:", query);
  if (!query.trim()) return res.status(400).json({ error: "Could not extract keywords." });

  async function fetchNews(q) {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=relevancy&pageSize=5&language=en&apiKey=${NEWS_API_KEY}`;
    const r   = await fetch(url);
    const d   = await r.json();
    if (d.status !== "ok") throw new Error(d.message);
    return (d.articles || []).filter(a => a.title && a.title !== "[Removed]");
  }

  try {
    let articles = await fetchNews(query);

    if (articles.length === 0) {
      const shortQuery = extractShortKeywords(sourceText);
      if (shortQuery) articles = await fetchNews(shortQuery);
    }

    if (articles.length === 0) {
      const words     = sourceText.replace(/[^a-zA-Z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2);
      const fallback2 = words.slice(0, 4).join(" ");
      articles = await fetchNews(fallback2);
    }

    const filtered = articles.filter(a => isRelevantResult(
      { title: a.title, snippet: a.description || "" },
      sourceText
    ));

    const results = (filtered.length > 0 ? filtered : articles).slice(0, 4).map(a => ({
      title      : a.title,
      source     : a.source?.name || "Unknown",
      url        : a.url,
      publishedAt: a.publishedAt?.slice(0, 10) || "",
    }));

    res.json({ keywords: query, articles: results });

  } catch (err) {
    console.error("NewsAPI error:", err);
    res.status(500).json({ error: "Failed to fetch from NewsAPI: " + err.message });
  }
});

app.post("/fetch-url", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required." });

  try { new URL(url); } catch {
    return res.status(400).json({ error: "Invalid URL." });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Veritascan/1.0)",
        "Accept"    : "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return res.status(400).json({ error: `Failed to fetch URL: HTTP ${response.status}` });
    }

    const html = await response.text();

    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();

    if (text.length > 4000) text = text.slice(0, 4000) + '... [content truncated]';

    if (text.length < 100) {
      return res.status(400).json({ error: "Could not extract meaningful content from this URL. Please paste the article text directly." });
    }

    res.json({ content: text, url });

  } catch (err) {
    console.error("URL fetch error:", err.message);
    if (err.name === 'TimeoutError') {
      return res.status(408).json({ error: "Request timed out. The site took too long to respond." });
    }
    res.status(500).json({ error: "Failed to fetch URL: " + err.message });
  }
});

app.post("/analyze", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded." });

  const form = new FormData();
  form.append("image", req.file.buffer, {
    filename   : req.file.originalname,
    contentType: req.file.mimetype,
  });

  const headers = {
    ...form.getHeaders(),
    "Authorization": `Bearer ${AIORNOT_API_KEY}`,
  };

  const options = {
    method  : "POST",
    hostname: "api.aiornot.com",
    path    : "/v2/image/sync",
    headers,
  };

  const request = https.request(options, (apiRes) => {
    let body = "";
    apiRes.on("data", (chunk) => body += chunk);
    apiRes.on("end", () => {
      try {
        const data = JSON.parse(body);
        console.log("AIORNOT IMAGE RESPONSE:", JSON.stringify(data, null, 2));
        res.status(apiRes.statusCode).json(data);
      } catch (e) {
        res.status(500).json({ error: "Failed to parse API response" });
      }
    });
  });

  request.on("error", (err) => {
    console.error("HTTPS error:", err.message);
    res.status(500).json({ error: err.message });
  });

  form.pipe(request);
});

// TEXT AI DETECTION 
app.post("/analyze-text", async (req, res) => {
  console.log("REQ BODY:", JSON.stringify(req.body));

  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "No text provided." });
  }

  if (text.trim().length < 20) {
    return res.status(400).json({ error: "Text is too short for analysis." });
  }

  try {
    const encoded = new URLSearchParams({ text: text.trim() }).toString();

    const response = await fetch("https://api.aiornot.com/v2/text/sync", {
      method : "POST",
      headers: {
        "Authorization": `Bearer ${AIORNOT_API_KEY}`,
        "Content-Type" : "application/x-www-form-urlencoded",
        "Accept"       : "application/json",
      },
      body  : encoded,
      signal: AbortSignal.timeout(20000)
    });

    console.log("[AIOrnot Text] HTTP status:", response.status);

    const rawText = await response.text();
    console.log("[AIOrnot Text] Raw response:", rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("[AIOrnot Text] JSON parse error:", parseErr.message);
      return res.status(500).json({ error: "Invalid response from AI detection API." });
    }

    console.log("[AIOrnot Text] Parsed response:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      const errMsg = data?.detail || data?.message || data?.error || `API error: ${response.status}`;
      console.error("[AIOrnot Text] API error:", errMsg);
      return res.status(response.status).json({ error: errMsg });
    }

    let aiScore = null;
    let isAI    = false;

    if (data.report?.ai_text) {
      aiScore = data.report.ai_text.confidence ?? 0;
      isAI    = data.report.ai_text.is_detected ?? (aiScore >= 0.5);
    } else if (data.report?.verdict) {
      isAI    = data.report.verdict.toLowerCase() === "ai";
      aiScore = data.report.score ?? (isAI ? 0.85 : 0.15);
    } else if (typeof data.verdict === "string") {
      isAI    = data.verdict.toLowerCase() === "ai";
      aiScore = data.score ?? (isAI ? 0.85 : 0.15);
    }

    if (aiScore === null) aiScore = isAI ? 0.85 : 0.15;
    aiScore = Math.max(0, Math.min(1, aiScore));

    const normalized = {
      verdict: isAI ? "ai" : "human",
      score  : aiScore,
      _raw   : data
    };

    console.log("[AIOrnot Text] Normalized:", JSON.stringify({ verdict: normalized.verdict, score: normalized.score }));
    res.json(normalized);

  } catch (err) {
    console.error("[AIOrnot Text] Request error:", err.message);
    if (err.name === "TimeoutError") {
      return res.status(408).json({ error: "Request timed out. Please try again." });
    }
    res.status(500).json({ error: "Failed to analyze text: " + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});