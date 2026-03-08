import numpy as np
import scipy.io.wavfile as wav
import math
import os

# Parameters
duration = 2.0         # seconds
sample_rate = 44100    # Hz
t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)

# European-style two-tone siren (Hi-Lo)
# High tone: 900 Hz, Low tone: 700 Hz
# Alternates every 0.5 seconds
freqs = np.where(np.sin(2 * np.pi * t / 1.0) > 0, 900, 700)

# Generate wave
wave = np.sin(2 * np.pi * freqs * t)

# Add some distortion/harmonics to make it sound more like an alarm
wave = wave + 0.3 * np.sin(2 * np.pi * freqs * 2 * t) + 0.1 * np.sin(2 * np.pi * freqs * 3 * t)

# Normalize and convert to 16-bit PCM
wave = wave / np.max(np.abs(wave))
wave_int16 = np.int16(wave * 32767)

# Save to the mobile assets directory
output_dir = r"E:\test_train\Train-Project\mobile\assets"
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, "siren.wav")

wav.write(output_path, sample_rate, wave_int16)
print(f"Siren saved to: {output_path}")
