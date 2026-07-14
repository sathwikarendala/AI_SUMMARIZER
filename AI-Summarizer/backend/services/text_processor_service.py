import os
import json
import requests

def get_text_processor_prompt(text: str) -> str:
    return (
        "You are an advanced text processing system. Analyze the text below and evaluate it "
        "across the following six dimensions: Grammar, Readability, Style, Tone, Vocabulary, and Explanation.\n\n"
        "You MUST respond ONLY with a valid JSON object matching the schema below. Do not include markdown formatting or blocks outside the JSON.\n\n"
        "JSON SCHEMA:\n"
        "{\n"
        '  "grammar": {\n'
        '    "corrected_text": "<string, the fully corrected version of the input text with all spelling, grammar, and punctuation mistakes resolved>",\n'
        '    "issues": [\n'
        '      {\n'
        '        "original": "<string, the problematic word/phrase>",\n'
        '        "replacement": "<string, the corrected word/phrase>",\n'
        '        "type": "<string, choosing from: spelling, grammar, punctuation>",\n'
        '        "explanation": "<string, brief explanation of why this was corrected>"\n'
        '      }\n'
        '    ]\n'
        '  },\n'
        '  "readability": {\n'
        '    "score": <integer, readability score from 0 (very difficult) to 100 (very easy)>,\n'
        '    "grade_level": "<string, estimated Flesch-Kincaid reading grade level e.g. \'8th Grade\', \'College Graduate\'>",\n'
        '    "complexity": "<string, Flesch-Kincaid complexity level e.g. \'Easy\', \'Medium\', \'Difficult\'>",\n'
        '    "long_sentences": [\n'
        '      "<string, sentence from the input text that is too long or complex and hard to read>"\n'
        '    ]\n'
        '  },\n'
        '  "style": {\n'
        '    "passive_voice": [\n'
        '      "<string, sentence using passive voice that could be made active>"\n'
        '    ],\n'
        '    "cliches": [\n'
        '      "<string, cliché or repetitive phrasing found in the text>"\n'
        '    ],\n'
        '    "suggestions": [\n'
        '      "<string, specific stylistic recommendation to improve structure or clarity>"\n'
        '    ]\n'
        '  },\n'
        '  "tone": {\n'
        '    "detected_tones": [\n'
        '      {\n'
        '        "name": "<string, tone name e.g. Formal, Casual, Persuasive, Academic, Assertive>",\n'
        '        "percentage": <integer, percentage from 0 to 100 representing the strength of this tone>\n'
        '      }\n'
        '    ],\n'
        '    "verdict": "<string, summary of the overall tone vibe of this text>",\n'
        '    "improvements": [\n'
        '      "<string, recommendation on how to shift or improve tone depending on the audience>"\n'
        '    ]\n'
        '  },\n'
        '  "vocabulary": {\n'
        '    "overused_words": [\n'
        '      {\n'
        '        "word": "<string, the repetitive/simple word>",\n'
        '        "count": <integer, occurrences in text>,\n'
        '        "suggestions": ["<string, sophisticated synonym 1>", "<string, synonym 2>"]\n'
        '      }\n'
        '    ],\n'
        '    "sophisticated_synonyms": [\n'
        '      {\n'
        '        "original": "<string, simple word used in text>",\n'
        '        "replacement": "<string, sophisticated contextual substitute>"\n'
        '      }\n'
        '    ]\n'
        '  },\n'
        '  "explanation": {\n'
        '    "summary": "<string, detailed paragraph explanation explaining why specific grammar, style, and tone changes were recommended>"\n'
        '  }\n'
        "}\n\n"
        f"Text to analyze:\n{text}"
    )

def analyze_text_gemini(text: str) -> dict:
    """Analyze text using Google Gemini."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key.startswith("your_"):
        raise ValueError("GEMINI_API_KEY is not configured.")

    import importlib
    from typing import Any
    genai: Any = importlib.import_module("google.generativeai")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite"))
    
    prompt = get_text_processor_prompt(text)
    
    response = model.generate_content(
        prompt,
        generation_config={"response_mime_type": "application/json"}
    )
    
    return json.loads(response.text.strip())

def analyze_text_groq(text: str) -> dict:
    """Analyze text using Groq Llama-3.3-70b as fallback."""
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your_groq_api_key_here":
        raise ValueError("GROQ_API_KEY is not configured.")

    prompt = get_text_processor_prompt(text)
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    response = requests.post(url, json=payload, headers=headers, timeout=45)
    response.raise_for_status()
    data = response.json()
    raw_text = data["choices"][0]["message"]["content"].strip()
    return json.loads(raw_text)

def analyze_text_local(text: str) -> dict:
    """Assess grammar, readability, style, tone, and vocabulary locally without APIs."""
    import re
    from textblob import TextBlob  # type: ignore
    
    # 1. Grammar & spelling correction using TextBlob
    corrected_text = text
    issues = []
    try:
        blob = TextBlob(text)
        corrected_text = str(blob.correct())
        
        words = text.split()
        corrected_words = corrected_text.split()
        
        if len(words) == len(corrected_words):
            for w, cw in zip(words, corrected_words):
                w_clean = "".join(c for c in w if c.isalnum()).lower()
                cw_clean = "".join(c for c in cw if c.isalnum()).lower()
                if w_clean != cw_clean and w_clean:
                    issues.append({
                        "original": w,
                        "replacement": cw,
                        "type": "spelling",
                        "explanation": f"Corrected spelling of '{w}' to '{cw}'."
                    })
    except Exception:
        # Fallback if textblob fails/lacks dictionaries
        pass
        
    # 2. Readability metrics (Flesch Reading Ease)
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    words = re.findall(r'\b\w+\b', text)
    
    sentence_count = max(1, len(sentences))
    word_count = max(1, len(words))
    
    def count_syllables(word):
        word = word.lower()
        count = 0
        vowels = "aeiouy"
        if word[0] in vowels:
            count += 1
        for index in range(1, len(word)):
            if word[index] in vowels and word[index - 1] not in vowels:
                count += 1
        if word.endswith("e"):
            count -= 1
        if count == 0:
            count += 1
        return count

    syllable_count = sum(count_syllables(w) for w in words)
    score = int(round(206.835 - 1.015 * (word_count / sentence_count) - 84.6 * (syllable_count / word_count)))
    score = max(0, min(100, score))
    
    if score >= 90:
        grade_level = "5th Grade"
        complexity = "Easy"
    elif score >= 80:
        grade_level = "6th Grade"
        complexity = "Easy"
    elif score >= 70:
        grade_level = "7th Grade"
        complexity = "Easy"
    elif score >= 60:
        grade_level = "8th-9th Grade"
        complexity = "Medium"
    elif score >= 50:
        grade_level = "10th-12th Grade"
        complexity = "Medium"
    elif score >= 30:
        grade_level = "College"
        complexity = "Difficult"
    else:
        grade_level = "College Graduate"
        complexity = "Difficult"

    long_sentences = [s for s in sentences if len(s.split()) > 25]

    # 3. Passive voice & cliches
    passive_voice = []
    passive_aux = ["was", "were", "is", "are", "be", "been", "being", "am"]
    for s in sentences:
        words_in_s = s.split()
        for i in range(len(words_in_s) - 1):
            if words_in_s[i].lower() in passive_aux and words_in_s[i+1].endswith(("ed", "en")):
                passive_voice.append(s)
                break

    style_suggestions = []
    if len(long_sentences) > 0:
        style_suggestions.append("Consider breaking down long sentences (> 25 words) to improve readability.")
    if len(passive_voice) > 0:
        style_suggestions.append("Convert passive voice sentences to active voice for stronger, more direct messaging.")
    if not style_suggestions:
        style_suggestions.append("The writing style is concise. Consider introducing more advanced sentence structures.")

    # 4. Tone assessment
    formal_words = ["furthermore", "moreover", "therefore", "consequently", "nevertheless", "additionally", "established", "demonstrate", "significant"]
    casual_words = ["cool", "awesome", "guys", "stuff", "basically", "literally", "totally", "just", "hey", "y'all"]
    
    formal_count = sum(text.lower().count(w) for w in formal_words)
    casual_count = sum(text.lower().count(w) for w in casual_words)
    
    if formal_count > casual_count:
        verdict = "The overall tone is formal and informative."
        detected_tones = [{"name": "Formal", "percentage": 75}, {"name": "Casual", "percentage": 25}]
        tone_improvements = ["Introduce some conversational phrasing if writing for a general audience."]
    elif casual_count > formal_count:
        verdict = "The overall tone is casual, conversational, and direct."
        detected_tones = [{"name": "Casual", "percentage": 80}, {"name": "Formal", "percentage": 20}]
        tone_improvements = ["Use more formal structures if this is intended for academic or professional publications."]
    else:
        verdict = "The tone is neutral, balanced, and direct."
        detected_tones = [{"name": "Neutral", "percentage": 60}, {"name": "Formal", "percentage": 40}]
        tone_improvements = ["No critical tone shifts needed. Match tone choices to your specific audience."]

    # 5. Vocabulary variety
    simple_vocab_suggestions = {
        "very": ["extremely", "highly", "significantly"],
        "good": ["excellent", "favorable", "beneficial"],
        "bad": ["adverse", "unfavorable", "detrimental"],
        "big": ["substantial", "significant", "immense"],
        "small": ["minimal", "modest", "marginal"],
        "get": ["acquire", "obtain", "receive"],
        "make": ["create", "generate", "produce"]
    }
    overused_words = []
    sophisticated_synonyms = []
    
    for word, suggs in simple_vocab_suggestions.items():
        count = text.lower().split().count(word)
        if count > 0:
            overused_words.append({
                "word": word,
                "count": count,
                "suggestions": suggs
            })
            sophisticated_synonyms.append({
                "original": word,
                "replacement": suggs[0]
            })

    # 6. Overall explanation
    summary_msg = f"Completed local rule-based analysis. Detected {len(issues)} spelling/grammar issues. "
    if len(issues) > 0:
        summary_msg += "Corrections were proposed. Readability was assessed, highlighting passive sentences and long clauses."
    else:
        summary_msg += "Assessed readability index and analyzed sentence structures and word complexity."

    return {
        "grammar": {
            "corrected_text": corrected_text,
            "issues": issues
        },
        "readability": {
            "score": score,
            "grade_level": grade_level,
            "complexity": complexity,
            "long_sentences": long_sentences[:5]
        },
        "style": {
            "passive_voice": passive_voice[:5],
            "cliches": [],
            "suggestions": style_suggestions
        },
        "tone": {
            "detected_tones": detected_tones,
            "verdict": verdict,
            "improvements": tone_improvements
        },
        "vocabulary": {
            "overused_words": overused_words,
            "sophisticated_synonyms": sophisticated_synonyms
        },
        "explanation": {
            "summary": summary_msg
        }
    }

def analyze_text(text: str) -> dict:
    """
    Public entry point to run Text Processor analysis.
    Tries Gemini first, falls back to Groq Llama-3.3, and then to a local offline analyzer.
    """
    text = text.strip()
    if not text:
        raise ValueError("Input text is empty.")

    # Truncate text for prompt size boundaries if too large
    text = text[:15000]

    try:
        print("[Text Processor] Attempting analysis via Gemini...")
        return analyze_text_gemini(text)
    except Exception as e:
        print(f"[Text Processor] Gemini failed: {e}. Trying Groq Llama fallback...")
        try:
            return analyze_text_groq(text)
        except Exception as groq_err:
            print(f"[Text Processor] Groq fallback failed: {groq_err}. Running offline local fallback...")
            try:
                return analyze_text_local(text)
            except Exception as local_err:
                print(f"[Text Processor] Local fallback failed: {local_err}")
                raise RuntimeError(f"Text analysis failed. (Gemini: {e}; Groq: {groq_err}; Local: {local_err})")
