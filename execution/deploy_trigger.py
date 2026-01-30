import subprocess
import sys
import os

# Set the path to the git executable provided by the user
GIT_EXE = r"C:\Users\david\AppData\Local\Programs\Git\bin\git.exe"

def run_git(args):
    command = [GIT_EXE] + args
    print(f"Running: git {' '.join(args)}")
    try:
        subprocess.check_call(command)
    except subprocess.CalledProcessError as e:
        print(f"Git error: {e}")
        sys.exit(1)

def main():
    print("=== Grist Deployment Trigger ===")
    
    # 1. Check for changes
    status = subprocess.check_output([GIT_EXE, "status", "--porcelain"]).decode("utf-8")
    if not status:
        print("No changes to deploy.")
        return

    # 2. Get commit message
    # In non-interactive environments, we skip input
    msg = "Clean up redundant loader in app.js"

    # 3. Git flow
    run_git(["add", "."])
    run_git(["commit", "-m", msg])
    run_git(["push", "origin", "custom-1.7.10-AG"])

    print("\n[OK] Pushed to GitHub!")

if __name__ == "__main__":
    main()
