"""
Convenience entry point to run the MistleTunes transcription server from the root directory.
"""
import os
import sys
import subprocess

server_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server")
server_script = os.path.join(server_dir, "server.py")

if __name__ == "__main__":
    os.chdir(server_dir)
    subprocess.run([sys.executable, server_script])
