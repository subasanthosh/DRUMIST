from fastapi import FastAPI
from process import process_audio  # Import the process_audio function from process.py


app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Welcome to the Drumist API!"}


@app.post("/process_audio/")
def process_audio(file_path: str):
    # Call the process_audio function from process.py

    return {"message": "Audio processed successfully"}


"""
how to import a python file which is in another folder?
To import a Python file that is located in another folder, you can use the following methods:
1. Modify the sys.path:
You can add the folder containing the Python file to the sys.path list, which allows Python to
    search for modules in that folder. Here's an example:
```python
import sys
sys.path.append('/path/to/your/folder')  # Replace with the actual path to

    the folder containing the Python file
"""