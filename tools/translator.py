"""
여행 번역기 - Claude Code SDK 기반
한국어/영어/독일어(오스트리아)/체코어/헝가리어 간 번역
"""
import asyncio
import json
import sys

from claude_code_sdk import query, ClaudeCodeOptions

LANG_NAMES = {
    "ko": "Korean",
    "en": "English",
    "de": "German (Austrian dialect)",
    "cs": "Czech",
    "hu": "Hungarian",
}

COUNTRY_LANG = {
    "austria": "de",
    "czech": "cs",
    "hungary": "hu",
}


def get_output_languages(detected_lang: str, target_country: str) -> list[str]:
    country_lang = COUNTRY_LANG[target_country]
    if detected_lang == "ko":
        return ["en", country_lang]
    if detected_lang == "en":
        return ["ko", country_lang]
    # 3국 언어 입력
    return ["en", "ko"]


async def translate(text: str, detected_lang: str, target_country: str) -> dict:
    need_detect = detected_lang == "auto"
    country_lang = COUNTRY_LANG[target_country]
    country_lang_name = LANG_NAMES[country_lang]

    if need_detect:
        prompt = f"""Detect the language of the following text, then translate it.

Rules:
- If input is Korean → translate to English and {country_lang_name}
- If input is English → translate to Korean and {country_lang_name}
- If input is {country_lang_name} → translate to English and Korean
- For any other language → translate to English and Korean

Reply with ONLY a JSON object (no markdown, no explanation):
{{"detectedLang": "<iso-639-1 code>", "translations": {{"<lang_code>": "<translation>", "<lang_code>": "<translation>"}}}}

Text: {text}"""
    else:
        output_langs = get_output_languages(detected_lang, target_country)
        lang_names_str = " and ".join(LANG_NAMES[l] for l in output_langs)
        trans_format = ", ".join(f'"{l}": "<translation>"' for l in output_langs)

        prompt = f"""Translate the following text from {LANG_NAMES.get(detected_lang, detected_lang)} into {lang_names_str}.

Reply with ONLY a JSON object (no markdown, no explanation):
{{"translations": {{{trans_format}}}}}

Text: {text}"""

    full_text = []
    try:
        async for message in query(
            prompt=prompt,
            options=ClaudeCodeOptions(
                allowed_tools=[],
                max_turns=1,
                model="sonnet",
                permission_mode="bypassPermissions",
            ),
        ):
            if hasattr(message, "content"):
                for block in message.content:
                    if hasattr(block, "text"):
                        full_text.append(block.text)
    except Exception as e:
        # rate_limit_event 등 SDK 파싱 에러 무시 (이미 수집된 텍스트 사용)
        if not full_text:
            raise e

    combined = "".join(full_text).strip()
    # JSON 파싱 (마크다운 코드블록 제거)
    json_str = combined.replace("```json", "").replace("```", "").strip()
    parsed = json.loads(json_str)

    det = parsed.get("detectedLang", detected_lang)
    output_langs = get_output_languages(det, target_country)

    results = []
    for lang in output_langs:
        results.append({
            "lang": lang,
            "langName": LANG_NAMES.get(lang, lang),
            "text": parsed["translations"].get(lang, ""),
        })

    return {
        "results": results,
        "detectedLang": det,
        "detectedLangName": LANG_NAMES.get(det, det),
    }


async def main():
    input_data = json.loads(sys.stdin.read())
    result = await translate(
        text=input_data["text"],
        detected_lang=input_data["detectedLang"],
        target_country=input_data["targetCountry"],
    )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
