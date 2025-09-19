import { exec } from "child_process";
import { access } from "fs/promises";
import { constants } from "fs";

// Check common Homebrew paths first for reliability
const BLUEUTIL_PATHS = ["/opt/homebrew/bin/blueutil", "/usr/local/bin/blueutil"];

export async function findBlueutilPath(): Promise<string | null> {
  for (const path of BLUEUTIL_PATHS) {
    try {
      await access(path, constants.X_OK);
      return path;
    } catch {
      // file doesn't exist or is not executable, try next path
    }
  }

  // As a fallback for non-standard installations, check the user's PATH
  return new Promise((resolve) => {
    exec("which blueutil", (error, stdout) => {
      if (error) {
        resolve(null);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}
