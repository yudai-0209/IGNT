#!/usr/bin/env python3
"""
1〜30の日本語カウント音声ファイルを生成するスクリプト
edge-ttsを使用して高いピッチの元気な声を生成します

使い方:
  pip install edge-tts
  python scripts/generate_count_audio.py
"""

import edge_tts
import asyncio
import os

# 出力先ディレクトリ
OUTPUT_DIR = "public/sounds"

# 音声設定
VOICE = "ja-JP-NanamiNeural"  # 日本語女性の声（明るい）
PITCH = "+80Hz"  # ピッチをさらに上げる（より元気な感じ）
RATE = "+25%"    # もっと速めでテンション高め

# 日本語の数字読み
JAPANESE_NUMBERS = {
    1: "いち",
    2: "に",
    3: "さん",
    4: "よん",
    5: "ご",
    6: "ろく",
    7: "なな",
    8: "はち",
    9: "きゅう",
    10: "じゅう",
    11: "じゅういち",
    12: "じゅうに",
    13: "じゅうさん",
    14: "じゅうよん",
    15: "じゅうご",
    16: "じゅうろく",
    17: "じゅうなな",
    18: "じゅうはち",
    19: "じゅうきゅう",
    20: "にじゅう",
    21: "にじゅういち",
    22: "にじゅうに",
    23: "にじゅうさん",
    24: "にじゅうよん",
    25: "にじゅうご",
    26: "にじゅうろく",
    27: "にじゅうなな",
    28: "にじゅうはち",
    29: "にじゅうきゅう",
    30: "さんじゅう",
}

async def generate_audio(num, text, output_path):
    """edge-ttsで音声生成（元気な掛け声風に）"""
    communicate = edge_tts.Communicate(
        text=text + "っ！",  # 「っ！」で元気な掛け声風に
        voice=VOICE,
        pitch=PITCH,
        rate=RATE
    )
    await communicate.save(output_path)

async def main():
    # 出力ディレクトリを作成
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"音声ファイルを {OUTPUT_DIR} に生成します...")
    print(f"声: {VOICE}")
    print(f"ピッチ: {PITCH}（高め）")
    print(f"速度: {RATE}（やや速め）\n")

    for num, reading in JAPANESE_NUMBERS.items():
        output_path = os.path.join(OUTPUT_DIR, f"{num}.mp3")
        await generate_audio(num, reading, output_path)
        print(f"  {num}.mp3 ({reading}) を生成しました")

    print(f"\n完了！ {len(JAPANESE_NUMBERS)} 個のファイルを生成しました。")

if __name__ == "__main__":
    asyncio.run(main())
