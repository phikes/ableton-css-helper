# Ableton Control Surface Script Helper

A helper binary for developing control surface scripts for Ableton Live.

## Demo

[![asciicast](https://asciinema.org/a/FA8Tb8WY1LSmsUxT7C1GTYRLK.svg)](https://asciinema.org/a/FA8Tb8WY1LSmsUxT7C1GTYRLK)

## Usage/Examples

```
Watch the current directory, restart Live upon changes and print Live's output

USAGE
  $ ableton-css-helper watch [--livePath <value>] [--liveSet <value>] [--name <value>]

FLAGS
  --livePath=<value>  Location to the Ableton Live app directory (default is /Applications/Ableton Live *)
  --liveSet=<value>   Path to a Live set you want to open for developing your control surface script.
  --name=<value>      The name of the control surface script as it should appear in Live's settings (default is the working directory name)

DESCRIPTION
  Watch the current directory, restart Live upon changes and print Live's output

EXAMPLES
  $ ableton-css-helper watch


```

## Support

* Currently only OS X is supported. I am open to merge pull requests which implement support for other platforms.
* Sometimes the AppleScript that restarts Live sends the "open file" message to early (I suppose) so that the Live set isn't opened.
* Log output is truncated and lines are missing sometimes. My original plan is to implement a proper layout using [ink](https://github.com/vadimdemedes/ink) and ALWAYS tail log output into a scrolling box in the terminal window.
* I might implement another command to allow for remote debugging.
