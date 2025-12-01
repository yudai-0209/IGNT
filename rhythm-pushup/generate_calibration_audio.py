import edge_tts
import asyncio
import os

# 出力ディレクトリ
OUTPUT_DIR = "public/sounds"

# 音声設定
VOICE = "ja-JP-NanamiNeural"  # 女性の声
RATE = "+10%"  # 少し速め
PITCH = "+0Hz"

# 生成する音声リスト
AUDIO_LIST = [
    ("calibration_intro", "カメラを正面に、腕立ての姿勢をしてください"),
    ("show_whole_body", "全身をカメラに映してください"),
    ("wrist_below_shoulder", "手首を肩より下に"),
    ("extend_arms", "腕を伸ばしてください"),
    ("bend_arms", "腕を曲げてください"),
    ("hold_position", "この姿勢をキープ！"),
    ("calibration_complete", "キャリブレーション完了！"),
]

async def generate_audio(filename: str, text: str):
    """音声ファイルを生成"""
    output_path = os.path.join(OUTPUT_DIR, f"{filename}.mp3")

    communicate = edge_tts.Communicate(
        text=text,
        voice=VOICE,
        rate=RATE,
        pitch=PITCH
    )

    await communicate.save(output_path)
    print(f"生成完了: {output_path}")

async def main():
    # 出力ディレクトリが存在することを確認
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 全ての音声を生成
    for filename, text in AUDIO_LIST:
        await generate_audio(filename, text)

    print(f"\n全{len(AUDIO_LIST)}個の音声ファイルを生成しました")

if __name__ == "__main__":
    asyncio.run(main())
