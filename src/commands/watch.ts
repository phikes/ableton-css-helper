import Rsync from 'rsync'
import ignore, { Ignore } from "ignore"
import parseGitignore from 'parse-gitignore'
import semver from 'semver'
import terminalLink from 'terminal-link'
import untildify from "untildify"
import { Args, Command, Flags, ux } from '@oclif/core'
import { Client } from 'fb-watchman'
import { Tail } from 'tail'
import { access, constants, cp, readFile } from 'fs/promises'
import { glob } from 'glob'
import { runAppleScript } from "run-applescript"

import { fileExists } from '../utils/fileExists.js'
import { basename } from "path"
import { restartAppleScript } from '../utils/restartAppleScript.js'
import { completeVersion } from '../utils/completeVersion.js'

interface WatchmanFile {
  name: string
  size: number
  mtime_ms: number
  exists: boolean
  type: string
}

const LIVE_VERSION_REGEX = /\d.*$/

export default class Watch extends Command {
  static override args = {}

  static override description = 'Watch the current directory, restart Live upon changes and print Live\'s output'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static override flags = {
    livePath: Flags.string({description: "Location to the Ableton Live app directory (default is /Applications/Ableton Live *)"}),
    liveSet: Flags.string({description: "Path to a Live set you want to open for developing your control surface script."}),
    name: Flags.string({description: "The name of the control surface script as it should appear in Live\'s settings (default is the working directory name)"})
  }

  protected ignore: Ignore = ignore()
  protected livePath: string | null = null
  protected liveLogTail: Tail | null = null
  protected liveLogPaused = false

  protected get midiRemoteScriptsPath(): string | null {
    return this.livePath ? `${this.livePath}/Contents/App-Resources/MIDI Remote Scripts/` : null
  }

  protected async setupIgnore(): Promise<void> {
     this.ignore.add((
      await fileExists(".gitignore")
      ? parseGitignore.parse(await readFile(".gitignore")).patterns
      : []
    ).concat([".git"]))
  }

  protected watch(callback: () => void): void {
    const watchmanClient = new Client();
    watchmanClient.capabilityCheck({optional:[], required:['relative_root']},
      (error) => {
        if (error) {
          console.error(`Received the following error when initializing watchman: ${error}. Please make sure ${terminalLink('watchman', 'https://facebook.github.io/watchman')} is installed.`)
          watchmanClient.end()
          return
        }

        watchmanClient.command(['watch-project', process.cwd()],
          (error, resp) => {
            if (error) {
              console.error('Error initiating watch:', error)
              watchmanClient.end()
              return
            }

            if ('warning' in resp) console.warn('warning: ', resp.warning)

            const subscription = {
              expression: ["allof", ["match", "*.*"]],
              fields: ["name", "size", "mtime_ms", "exists", "type"]
            };

            watchmanClient.command(['subscribe', resp.watch, 'css', subscription],
              (error, resp) => {
                if (error) {
                  console.error('failed to subscribe: ', error);
                  watchmanClient.end()
                  return;
                }
              });

            watchmanClient.on('subscription', (resp) => {
              if (resp.subscription !== 'css') return;

              if (resp.files.every(({name}: WatchmanFile) => this.ignore.ignores(name))) return

              callback()
            })
          })
      })
  }

  protected async setupLivePath(): Promise<void> {
    const {flags} = await this.parse(Watch)

    if (flags.livePath) {
      this.livePath = flags.livePath
      return
    }

    const livePaths = await glob("/Applications/Ableton Live *")

    if (livePaths.length === 0) {
      throw new Error("Unable to find Ableton Live. Please use the `--livePath` flag to specify the path of Ableton Live (e.g. `--livePath=\"/Applications/Ableton Live 12 Standard.app\"`)")
    } else if (livePaths.length > 1) {
      throw new Error(`Found more than one Ableton Live path (\`${this.livePath}\`). Please use the \`--livePath\` flag to specify the path of Ableton Live (e.g. \`--livePath="/Applications/Ableton Live 12 Standard.app"\`)`)
    }

    this.livePath = livePaths[0]
  }

  protected async cssName(): Promise<string> {
    const {flags} = await this.parse(Watch)

    return (flags.name ?? basename(process.cwd()))
  }

  protected async sync(): Promise<void> {
    const source = process.cwd() + "/"
    const destination = this.midiRemoteScriptsPath! + await this.cssName()

    this.log(`Syncing ${ux.colorize("blue", source)} to ${ux.colorize("blue", destination)} ... `)

    const rsync = new Rsync()
      .source(source)
      .destination(destination)
      .flags("r")

    return new Promise((resolve, reject) => {
      rsync.execute((error, code, cmd) => {
        if (error || code > 0) reject()

        this.log(ux.colorize("green", "DONE"))

        resolve()
      })
    })
  }

  protected async setupLiveLogTail(): Promise<void> {
    // get logs for latest specified live major version
    const { liveMajorVersion } = basename(this.livePath!).match(/Ableton Live (?<liveMajorVersion>\d+)/)!.groups!

    const logGlob = untildify(`~/Library/Preferences/Ableton/Live ${liveMajorVersion}*`)
    const logFolders = (await glob(logGlob)).sort((a, b) => {
      const aVersion = basename(a)!.match(LIVE_VERSION_REGEX)![0]
      const bVersion = basename(b)!.match(LIVE_VERSION_REGEX)![0]

      return semver.compare(completeVersion(aVersion), completeVersion(bVersion))
    }).reverse()

    if (!logFolders.length) throw new Error(`No Ableton Live log file found at ${logGlob}. Please start Ableton Live at least once and then restart this script in order to pick up the right Log.txt`)

    this.liveLogTail = new Tail(logFolders[0]! + "/Log.txt")
    this.liveLogTail.on("error", this.logLiveOutput.bind(this))
    this.liveLogTail.on("line", this.logLiveOutput.bind(this))
  }

  protected async setup(): Promise<void> {
    await this.setupLivePath()
    await this.setupIgnore()
    await this.setupLiveLogTail()
  }

  protected async restartLive(): Promise<void> {
    const {flags} = await this.parse(Watch)
    const liveSet = flags.liveSet ? untildify(flags.liveSet) : null

    this.log(`Restarting Ableton Live at ${ux.colorize("blue", this.livePath!)}${liveSet ? ` with Live set ${ux.colorize("blue", liveSet)}` : ''} ...`)
    await runAppleScript(restartAppleScript(basename(this.livePath!), liveSet))
    this.log(ux.colorize("green", "DONE"))
  }

  protected async logLiveOutput(log: string): Promise<void> {
    if (!this.liveLogPaused) {
      if (log.match(new RegExp(await this.cssName()))) this.log(ux.colorize("blue", log))
      else this.log(log)
    }
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Watch)

    await this.setup()
    console.log(await this.cssName())

    this.watch(async () => {
      this.liveLogPaused = true
      console.clear()

      await this.sync()
      await this.restartLive()

      this.log(ux.colorize("blue", "Ableton Live log output:\n"))
      this.liveLogPaused = false
    })
  }
}
