#!/usr/bin/env node

import * as fs from 'fs'
import * as os from 'os'
import * as es from 'event-stream'
import * as path from 'path'
import { execSync } from 'child_process'
import * as notifier from 'node-notifier'

const homeDir = os.homedir()
const dockerDir = path.join(homeDir, 'AppData\\Local\\Docker')
const dockerLog = path.join(dockerDir, 'log.txt')
const dockerLog0 = path.join(dockerDir, 'log0.txt')

const errorLine = /could not determine link-layer address for local network/

const checkLogForError = () => {
  return new Promise((resolve, reject) => {
    const s = fs
      .createReadStream(dockerLog)
      .pipe(es.split())
      .pipe(
        es
          .mapSync(line => {
            s.pause()
            if (errorLine.test(line)) {
              s.destroy()
              resolve(line)
            } else {
              s.resume()
            }
          })
          .on('error', reject)
          .on('end', function() {
            resolve(false)
          })
      )
  })
}

const interval = 1000 * 60 * 5

const notify = (message: string) => {
  notifier.notify({
    title: 'Docker-restart Check',
    message,
    wait: true
  })
}

const run = () => {
  console.log('Checking docker log file', dockerLog)
  checkLogForError()
    .then(errLine => {
      if (errLine) {
        console.log('Error line found in log', errLine)
        notify('Found error line in docker log: ' + errLine)

        try {
          execSync('net stop com.docker.service', { stdio: 'inherit' })
          execSync('taskkill /IM "Docker Desktop.exe" /F', { stdio: 'inherit' })
          try {
            if (fs.existsSync(dockerLog0)) fs.unlinkSync(dockerLog0)
          } catch (e) {
            notify('Could not remove ' + dockerLog0)
          }
          execSync('net start com.docker.service', { stdio: 'inherit' })
          execSync('"C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"', {
            stdio: 'inherit'
          })
        } catch (e) {
          notify('Error while docker service restart')
        }
        setTimeout(run, interval)
      } else {
        console.log('Everything seems ok')
        setTimeout(run, interval)
      }
    })
    .catch(err => {
      console.log('Error while reading log file', err)
    })
}

run()
