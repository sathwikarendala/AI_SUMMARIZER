"""
Keyword extraction, sentiment analysis, topic detection,
and question generation services.
Fully offline-first with local fallback methods, bypassing cloud latency.
"""
from __future__ import annotations
import os
import re
import json
import requests
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# API Key Verification Helpers
# ─────────────────────────────────────────────
def _has_valid_gemini_key() -> bool:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    return bool(key) and not key.startswith("your_") and len(key) > 10

def _has_valid_groq_key() -> bool:
    key = os.getenv("GROQ_API_KEY", "").strip()
    return bool(key) and not key.startswith("your_") and len(key) > 10

# ─────────────────────────────────────────────
# Cloud LLM Helper
# ─────────────────────────────────────────────
def _call_cloud_llm(prompt: str, json_response: bool = False) -> str:
    """Helper to query Gemini with Groq fallback."""
    if _has_valid_gemini_key():
        try:
            import importlib
            genai = importlib.import_module("google.generativeai")
            genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
            model = genai.GenerativeModel("gemini-2.0-flash")
            config = {"response_mime_type": "application/json"} if json_response else {}
            response = model.generate_content(prompt, generation_config=config)
            return response.text.strip()
        except Exception as e:
            print(f"[NLP Cloud] Gemini failed: {e}. Trying Groq...")
            
    if _has_valid_groq_key():
        try:
            groq_key = os.getenv("GROQ_API_KEY")
            headers = {
                "Authorization": f"Bearer {groq_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2
            }
            if json_response:
                payload["response_format"] = {"type": "json_object"}
            url = "https://api.groq.com/openai/v1/chat/completions"
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        except Exception as groq_err:
            print(f"[NLP Cloud] Groq failed: {groq_err}")
            
    raise RuntimeError("No valid cloud API keys configured or call failed.")

# ─────────────────────────────────────────────
# Keyword Extraction
# ─────────────────────────────────────────────
def extract_keywords(text: str, top_n: int = 15, use_rake: bool = False) -> list[dict]:
    """
    Extract keywords using Gemini/Groq if keys are valid, otherwise falls back instantly to frequency.
    """
    text_short = text[:8000]
    if not _has_valid_gemini_key() and not _has_valid_groq_key():
        return _freq_keywords(text_short, top_n)

    prompt = (
        "Extract the top keyphrases and keywords from the text below.\n"
        f"Extract exactly {top_n} keywords/keyphrases.\n"
        "Respond ONLY with a valid JSON array of objects. Do not include markdown codeblocks or other text.\n"
        "Each object must contain:\n"
        "  - \"keyword\": the keyphrase/keyword string\n"
        "  - \"score\": a float from 0.0 to 1.0 representing relevance (descending order)\n\n"
        f"Text:\n{text_short}"
    )
    try:
        res_text = _call_cloud_llm(prompt, json_response=True)
        res_text_clean = re.sub(r"^```json\s*", "", res_text, flags=re.IGNORECASE)
        res_text_clean = re.sub(r"\s*```$", "", res_text_clean)
        data = json.loads(res_text_clean.strip())
        
        if isinstance(data, list):
            return [{"keyword": str(item["keyword"]), "score": float(item["score"])} for item in data[:top_n]]
        elif isinstance(data, dict) and "keywords" in data:
            return [{"keyword": str(item["keyword"]), "score": float(item["score"])} for item in data["keywords"][:top_n]]
    except Exception as e:
        print(f"[Keywords] Cloud extraction failed: {e}. Falling back to frequency extractor.")
        
    return _freq_keywords(text_short, top_n)

def _freq_keywords(text: str, top_n: int) -> list[dict]:
    """Frequency-based local keyword extractor."""
    stopwords = {
        "the","a","an","is","in","it","of","to","and","or","for","on","at","by","with","from","that","this","was",
        "are","be","have","has","had","do","does","did","but","if","then","else","as","until","while","about",
        "there","their","them","they","here","our","out","your","its","will","would","shall","should",
        "can","could","may","might","must","into","onto","upon","about","above","across","after","against",
        "along","amid","among","around","before","behind","below","beneath","beside","between","beyond",
        "during","except","inside","outside","over","past","through","throughout","under","underneath",
        "within","without","more","most","some","any","each","few","many","other","such","than"
    }
    words = re.findall(r"\b[a-zA-Z]{4,}\b", text.lower())
    freq: dict = {}
    for w in words:
        if w not in stopwords:
            freq[w] = freq.get(w, 0) + 1
    sorted_w = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:top_n]
    max_f = max((f for _, f in sorted_w), default=1) or 1
    return [{"keyword": w, "score": round(f / max_f, 4)} for w, f in sorted_w]

# ─────────────────────────────────────────────
# Sentiment Analysis
# ─────────────────────────────────────────────
POSITIVE_WORDS = {
    "love", "loved", "loves", "loving", "like", "liked", "likes", "liking", "good", "great", "excellent", 
    "beautiful", "amazing", "wonderful", "happy", "best", "innovative", "success", "successful", "improve", 
    "improved", "improves", "improvement", "improvements", "positive", "progress", "perfect", "smart", "smarter", 
    "active", "support", "supported", "supporting", "help", "helped", "helps", "helpful", "easy", "easier", 
    "efficient", "efficiently", "enable", "glad", "safe", "strong", "stronger", "win", "winner", "winners", 
    "winning", "outstanding", "creative", "valuable", "trust", "pleased", "fantastic", "superb", "satisfy", 
    "satisfied", "satisfying", "recommend", "benefit", "beneficial", "benefits"
}

NEGATIVE_WORDS = {
    "hate", "hated", "hates", "dislike", "disliked", "dislikes", "bad", "worse", "worst", "terrible", "awful", 
    "horrible", "sad", "fail", "failed", "fails", "failing", "failure", "failures", "error", "errors", "defect", 
    "defects", "bug", "bugs", "issue", "issues", "negative", "problem", "problems", "difficult", "hard", "slow", 
    "slowed", "slows", "slowly", "broken", "danger", "dangerous", "risk", "risks", "risky", "loss", "losses", 
    "lost", "poor", "pain", "hurt", "damage", "worry", "worried", "afraid", "scared", "fear", "reject", "rejected", 
    "refuse", "refused", "deny", "denied", "cancel", "cancelled", "waste", "wasted", "useless", "disappoint", 
    "disappointed", "disappointing", "severe", "critical", "harmful"
}

def _local_sentiment(text: str) -> dict:
    """Local rule-based sentiment classifier."""
    words = re.findall(r"\b[a-zA-Z]+\b", text.lower())
    pos_count = sum(1 for w in words if w in POSITIVE_WORDS)
    neg_count = sum(1 for w in words if w in NEGATIVE_WORDS)
    
    total = pos_count + neg_count
    if total == 0:
        return {"label": "NEUTRAL", "score": 0.5, "emoji": "😐", "color": "#f59e0b"}
        
    diff = pos_count - neg_count
    score = diff / total
    confidence = abs(score)
    
    if score > 0.15:
        label = "POSITIVE"
        emoji = "😊"
        color = "#10b981"
    elif score < -0.15:
        label = "NEGATIVE"
        emoji = "😞"
        color = "#ef4444"
    else:
        label = "NEUTRAL"
        emoji = "😐"
        color = "#f59e0b"
        confidence = 0.5
        
    return {"label": label, "score": round(confidence, 4), "emoji": emoji, "color": color}

def analyze_sentiment(text: str) -> dict:
    """
    Classify text sentiment: POSITIVE / NEGATIVE / NEUTRAL.
    Uses cloud LLM if keys are valid, otherwise falls back instantly to local dictionary analysis.
    """
    if not _has_valid_gemini_key() and not _has_valid_groq_key():
        return _local_sentiment(text)

    text_short = text[:4000]
    prompt = (
        "Analyze the overall sentiment of the text below.\n"
        "Respond ONLY with a valid JSON object. Do not include markdown formatting.\n"
        "The JSON must have this structure:\n"
        "{\n"
        "  \"label\": \"POSITIVE\" | \"NEGATIVE\" | \"NEUTRAL\",\n"
        "  \"score\": <float from 0.0 to 1.0 representing confidence>\n"
        "}\n\n"
        f"Text:\n{text_short}"
    )
    try:
        res_text = _call_cloud_llm(prompt, json_response=True)
        res_text_clean = re.sub(r"^```json\s*", "", res_text, flags=re.IGNORECASE)
        res_text_clean = re.sub(r"\s*```$", "", res_text_clean)
        data = json.loads(res_text_clean.strip())
        
        label = str(data["label"]).upper().strip()
        score = round(float(data["score"]), 4)
        if label not in ("POSITIVE", "NEGATIVE", "NEUTRAL"):
            label = "NEUTRAL"
        
        emoji = "😊" if label == "POSITIVE" else "😞" if label == "NEGATIVE" else "😐"
        color = "#10b981" if label == "POSITIVE" else "#ef4444" if label == "NEGATIVE" else "#f59e0b"
        return {"label": label, "score": score, "emoji": emoji, "color": color}
    except Exception as e:
        print(f"[Sentiment] Cloud analysis failed: {e}. Falling back to local sentiment analysis.")
        
    return _local_sentiment(text)

# ─────────────────────────────────────────────
# Topic Detection
# ─────────────────────────────────────────────
TOPIC_LABELS = [
    "Technology", "Science", "Politics", "Business and Finance",
    "Health and Medicine", "Sports", "Entertainment", "Education",
    "Environment", "Law and Justice", "History", "Travel",
    "Food and Lifestyle", "Arts and Culture", "Religion and Philosophy",
]

TOPIC_KEYWORDS = {
    "Technology": {"software", "hardware", "computer", "internet", "ai", "artificial", "intelligence", "network", "web", "algorithm", "digital", "data", "robot", "tech", "device", "mobile", "phone", "programming", "code", "cyber", "virtual", "cloud", "server", "app", "application"},
    "Science": {"physics", "chemistry", "biology", "space", "astronomy", "research", "scientific", "theory", "experiment", "molecule", "cell", "quantum", "gravity", "energy", "nature", "evolution", "laboratory", "cosmic", "genetics"},
    "Politics": {"government", "election", "president", "senate", "parliament", "policy", "political", "democracy", "vote", "campaign", "lawmaker", "party", "minister", "state", "treaty", "senator", "congress", "regulations", "bill", "governance"},
    "Business and Finance": {"market", "finance", "stock", "investment", "economy", "business", "company", "trade", "revenue", "profit", "bank", "currency", "shares", "growth", "industry", "marketing", "corporate", "sales", "economic", "capital"},
    "Health and Medicine": {"doctor", "hospital", "medicine", "health", "disease", "virus", "patient", "treatment", "clinic", "clinical", "vaccine", "drug", "care", "wellness", "medical", "infection", "physician", "therapy", "symptoms"},
    "Sports": {"game", "match", "team", "player", "coach", "football", "basketball", "soccer", "tennis", "champion", "tournament", "athletics", "olympics", "sport", "play", "win", "league", "stadium", "medal", "cup"},
    "Entertainment": {"movie", "music", "film", "actor", "show", "celebrity", "drama", "concert", "album", "theater", "comedy", "hollywood", "art", "dance", "pop", "singer", "cinema", "performance", "entertainment", "festival"},
    "Education": {"school", "university", "college", "student", "teacher", "class", "degree", "education", "learn", "study", "academic", "course", "curriculum", "teaching", "professor", "exam", "lesson", "knowledge"},
    "Environment": {"climate", "nature", "earth", "greenhouse", "carbon", "pollution", "recycle", "forest", "wildlife", "conservation", "energy", "warming", "environment", "ecology", "biodiversity", "emissions", "renewable", "solar"},
    "Law and Justice": {"court", "judge", "law", "lawyer", "justice", "legal", "trial", "crime", "police", "arrest", "suspect", "jury", "constitution", "prison", "illegal", "prosecutor", "attorney", "verdict", "suit"},
    "History": {"ancient", "century", "history", "historical", "war", "empire", "archaeology", "past", "civilization", "decade", "timeline", "king", "queen", "era", "dynasty", "historical", "anniversary", "medieval", "historian"},
    "Travel": {"trip", "travel", "flight", "hotel", "tourist", "destination", "vacation", "explore", "tourism", "journey", "booking", "adventure", "cruise", "island", "resort", "luggage", "passport", "airline"},
    "Food and Lifestyle": {"food", "recipe", "cooking", "restaurant", "chef", "lifestyle", "diet", "fashion", "design", "home", "garden", "coffee", "wine", "nutrition", "dish", "cooking", "kitchen", "trend", "wellness"},
    "Arts and Culture": {"museum", "painting", "sculpture", "literature", "heritage", "art", "culture", "exhibition", "gallery", "classical", "poetry", "philosophy", "traditional", "artist", "exhibit", "novel", "drama"},
    "Religion and Philosophy": {"religion", "philosophy", "god", "belief", "spiritual", "church", "temple", "ethics", "moral", "faith", "theology", "ritual", "existential", "wisdom", "sacred", "prayer", "meditation", "soul"}
}

def _local_topics(text: str, top_n: int = 3) -> list[dict]:
    """Local rule-based topic detector using word mapping matching."""
    words = set(re.findall(r"\b[a-zA-Z]+\b", text.lower()))
    scores = []
    
    for topic, kw_set in TOPIC_KEYWORDS.items():
        matches = len(words.intersection(kw_set))
        if matches > 0:
            scores.append((topic, matches))
            
    if not scores:
        return [{"topic": "General", "confidence": 1.0}]
        
    scores.sort(key=lambda x: x[1], reverse=True)
    max_matches = scores[0][1]
    
    results = []
    for topic, matches in scores[:top_n]:
        results.append({
            "topic": topic,
            "confidence": round(matches / max_matches, 4)
        })
    return results

def detect_topics(text: str, top_n: int = 3) -> list[dict]:
    """Topic classification using Gemini/Groq if keys are valid, otherwise falls back instantly to keyword matching."""
    if not _has_valid_gemini_key() and not _has_valid_groq_key():
        return _local_topics(text, top_n)

    text_short = text[:4000]
    prompt = (
        "Classify the text below into the most relevant topics from this predefined list:\n"
        f"{', '.join(TOPIC_LABELS)}\n\n"
        f"Select up to {top_n} topics with confidence > 0.1.\n"
        "Respond ONLY with a valid JSON array of objects. Do not include markdown formatting.\n"
        "Each object must have this structure:\n"
        "{\n"
        "  \"topic\": \"<Topic Name from list>\",\n"
        "  \"confidence\": <float from 0.0 to 1.0>\n"
        "}\n\n"
        f"Text:\n{text_short}"
    )
    try:
        res_text = _call_cloud_llm(prompt, json_response=True)
        res_text_clean = re.sub(r"^```json\s*", "", res_text, flags=re.IGNORECASE)
        res_text_clean = re.sub(r"\s*```$", "", res_text_clean)
        data = json.loads(res_text_clean.strip())
        
        if isinstance(data, list):
            topics = []
            for item in data:
                topic_name = str(item["topic"]).strip()
                matched = next((t for t in TOPIC_LABELS if t.lower() == topic_name.lower()), None)
                if matched:
                    topics.append({"topic": matched, "confidence": round(float(item["confidence"]), 4)})
            if topics:
                return topics[:top_n]
    except Exception as e:
        print(f"[Topics] Cloud detection failed: {e}. Falling back to local topic detector.")
        
    return _local_topics(text, top_n)

# ─────────────────────────────────────────────
# Question Generation
# ─────────────────────────────────────────────
def generate_questions(text: str, num_questions: int = 5) -> list[str]:
    """
    Generate comprehension questions from text.
    Uses sentence extraction + question templates.
    """
    text_short = text[:3000]
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text_short) if len(s.split()) > 6]

    if not sentences:
        return ["What is the main topic of this text?"]

    step = max(1, len(sentences) // num_questions)
    selected = sentences[::step][:num_questions]

    questions = []
    templates = [
        lambda s: f"What does the author mean by: \"{_short(s)}\"?",
        lambda s: f"Why is it stated that \"{_short(s)}\"?",
        lambda s: f"How does this relate to: \"{_short(s)}\"?",
        lambda s: f"What is the significance of \"{_short(s)}\"?",
        lambda s: f"Can you explain the concept described as \"{_short(s)}\"?",
    ]

    for i, sent in enumerate(selected):
        template = templates[i % len(templates)]
        q = template(sent)
        if q not in questions:
            questions.append(q)

    return questions[:num_questions]

def _short(text: str, max_words: int = 10) -> str:
    words = text.split()
    return " ".join(words[:max_words]) + ("…" if len(words) > max_words else "")

# ─────────────────────────────────────────────
# Highlight Important Sentences
# ─────────────────────────────────────────────
def highlight_sentences(text: str, top_n: int = 5) -> list[str]:
    """Return top-N most keyword-dense sentences."""
    try:
        keywords_data = extract_keywords(text, top_n=20)
        keywords = {kd["keyword"].lower() for kd in keywords_data}
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        scored = []
        for sent in sentences:
            words = set(re.findall(r"\b[a-zA-Z]+\b", sent.lower()))
            score = len(words & keywords)
            if len(sent.split()) > 4:
                scored.append((score, sent))
        scored.sort(reverse=True)
        return [s for _, s in scored[:top_n]]
    except Exception:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        return sentences[:top_n]
