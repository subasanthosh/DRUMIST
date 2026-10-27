import librosa
import numpy as np
import joblib

def find_bpm(file_path):
    # Load the audio file
    y, sr = librosa.load(file_path)

    # Estimate the tempo (BPM)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)

    return round(tempo[0])



def grid_stamps(bpm,time_sign,duration):
    grid_duration = (60 / bpm) / 8

    timestamps = []

    t = 0

    while t <= duration:
        timestamps.append(round(t, 4))
        t += grid_duration

    return timestamps


def is_silent(chunk, threshold=0.01):
    rms = librosa.feature.rms(y=chunk)[0]
    energy = np.mean(rms)

    return energy < threshold



def extract_mfcc(audio, sr):
    audio_mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=13)
    # for n,i in enumerate(audio_mfcc):
    #     print("MFCC Mean:", i,n)
        
    mfcc_mean = audio_mfcc.T.mean(axis=0)
    # why Transpose? Because librosa returns MFCCs in shape (n_mfcc, n_frames), and we want to average across frames (axis=0) to get a single feature vector for the audio chunk.
    # but we can also use np.mean(audio_mfcc, axis=1) to get the same result without transposing.right?
    # Yes, you are correct. You can use np.mean(audio_mfcc, axis=1) to get the same result without transposing. The choice between transposing and using axis=1 is a matter of preference and readability. Both approaches will yield the same mean MFCC values across frames.
    return mfcc_mean


#MAIN
#==================================================================

def process_audio(file_path):

  audio_path = file_path
  audio,sr = librosa.load(audio_path)  # Load the audio file with a specific sampling rate
  grid = {}

  bpm = find_bpm(audio_path)


  duration = round(librosa.get_duration(path=audio_path),4)

  print("BPM:", bpm)
  print("Duration:", duration)

  #THE MODEL
  drumist_model = joblib.load(r"D:\drumist\drumist_model.pkl")


  grid_time = grid_stamps(bpm, 4, duration)

  for i in range(len(grid_time)):
      start = grid_time[i]
      end = grid_time[i + 1] if i + 1 < len(grid_time) else duration

      start_sample = int(start * sr)
      end_sample = int(end * sr)

      chunk = audio[start_sample:end_sample-10]  # Subtract 10 samples to avoid overlap

      mfcc_features = extract_mfcc(chunk, sr)
      if is_silent(chunk):
          grid[start] = "Silent"
      elif drumist_model.predict([mfcc_features])[0] == 0:
          grid[start] = "Kick"
      elif drumist_model.predict([mfcc_features])[0] == 1:
          grid[start] = "Snare"
      elif drumist_model.predict([mfcc_features])[0] == 2:
          grid[start] = "overhead"
      elif drumist_model.predict([mfcc_features])[0] == 3:
          grid[start] = "tom"

  for timestamp, drum in grid.items():
      print(f"Timestamp: {timestamp:.4f} sec - Drum: {drum}")





#  mel_basis = filters.mel(sr=sr, n_fft=n_fft, **kwargs)
# D:\drumist\.venv\Lib\site-packages\librosa\feature\spectral.py:2148: UserWarning: Empty filters detected in mel frequency basis. Some channels will produce empty responses. Try increasing your sampling rate (and fmax) or reducing n_mels.
#   mel_basis = filters.mel(sr=sr, n_fft=n_fft, **kwargs)
# D:\drumist\.venv\Lib\site-packages\librosa\feature\spectral.py:2148: UserWarning: Empty filters detected in mel frequency basis. Some channels will produce empty responses. Try increasing your sampling rate (and fmax) or reducing n_mels.
#   mel_basis = filters.mel(sr=sr, n_fft=n_fft, **kwargs)
# D:\drumist\.venv\Lib\site-packages\librosa\feature\spectral.py:2148: UserWarning: Empty filters detected in mel frequency basis. Some channels will produce empty responses. Try increasing your sampling rate (and fmax) or reducing n_mels.
#   mel_basis = filters.mel(sr=sr, n_fft=n_fft, **kwargs)
# D:\drumist\.venv\Lib\site-packages\librosa\feature\spectral.py:2148: UserWarning: Empty filters detected in mel frequency basis. Some channels will produce empty responses. Try increasing your sampling rate (and fmax) or reducing n_mels.
#   mel_basis = filters.mel(sr=sr, n_fft=n_fft, **kwargs)
# D:\drumist\.venv\Lib\site-packages\librosa\feature\spectral.py:2148: UserWarning: Empty filters detected in mel frequency basis. Some channels will produce empty responses. Try increasing your sampling rate (and fmax) or reducing n_mels.
#   mel_basis = filters.mel(sr=sr, n_fft=n_fft, **kwargs)
# D:\drumist\.venv\Lib\site-packages\librosa\feature\spectral.py:2148: UserWarning: Empty filters detected in mel frequency basis. Some channels will produce empty responses. Try increasing your sampling rate (and fmax) or reducing n_mels.
#   mel_basis = filters.mel(sr=sr, n_fft=n_fft, **kwargs)
# D:\drumist\.venv\Lib\site-packages\librosa\feature\spectral.py:2148: UserWarning: Empty filters detected in mel frequency basis. Some channels will produce empty responses. Try increasing your sampling rate (and fmax) or reducing n_mels.
#   mel_basis = filters.mel(sr=sr, n_fft=n_fft, **kwargs)

# what are this warnings?
# these warnings indicate that some of the mel frequency filters used in the mel spectrogram calculation are empty, meaning they do not respond to any frequencies in the audio signal. This can happen if the sampling rate is too low, the maximum frequency (fmax) is set too high, or if the number of mel bands (n_mels) is too large for the given audio signal.
# how to fix this warnings?
# To fix these warnings, you can try the following approaches:
# 1. Increase the sampling rate of your audio signal if possible.
# 2. Reduce the maximum frequency (fmax) parameter when creating the mel filter bank. 

# the corrected module to fix this is as follows:
# def extract_mfcc(audio, sr):
#     n_fft = 2048  # You can adjust this value based on your needs



# how can we find the window is not a hit by using librosa's onset?
# by 



process_audio(r"D:\drumist\drumist_test.wav")