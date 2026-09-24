import librosa
import numpy
import matplotlib.pyplot as plt

def process_audio(file_path, target_sr=22050):
    audio_data,sr = librosa.load(file_path, sr=target_sr)
    a = librosa.feature.mfcc(y=audio_data, sr=sr, n_mfcc=13)
    return a

mfcc_features = process_audio("D:\\drumist\\dataset\\snare\\Snare Sample 1.wav")

# plt.figure(figsize=(10, 4))
# #plt.imshow(mfcc_features, aspect='auto', origin='lower')
# #plt.colorbar()
# plt.plot(mfcc_features)
# plt.title('MFCC Features')
# plt.xlabel('Time')
# plt.ylabel('MFCC Coefficient')
# plt.show()
