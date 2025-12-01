import edge_tts
import asyncio
import os

# 出力ディレクトリ
OUTPUT_DIR = "public/sounds"

# 音声設定
VOICE = "ja-JP-NanamiNeural"  # 女性の声
RATE = "+10%"  # 少し速め
PITCH = "+0Hz"

# 生成する音声リスト（非同期モード用）
AUDIO_LIST = [
    ("async_posture_prep", "カメラを正面に、腕立ての姿勢になってください"),
    ("async_exercise_info", "今からリズムに合わせて、30回腕立てをします"),
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
    print("※カウントダウン(5,4,3,2,1)とスタート音声は同期モードと共通で使用")

if __name__ == "__main__":
    asyncio.run(main())
