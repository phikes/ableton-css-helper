export const restartAppleScript = (applicationName: string, liveSet: string | null) => `
tell application "${applicationName}"
  if its running then
    quit

    repeat while its running
      delay 0.5
    end repeat
  end if

  activate

  repeat while not its running
    delay 0.5
  end repeat

  ${liveSet && `open file POSIX file "${liveSet}"`}
end tell
`
