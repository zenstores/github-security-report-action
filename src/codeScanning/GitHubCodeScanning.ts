/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import type { Octokit } from '@octokit/rest'
import type { Endpoints } from '@octokit/types'

import CodeScanningAlert, { type CodeScanningData } from './CodeScanningAlert.ts'
import CodeScanningResults from './CodeScanningResults.ts'
import type { LatestAnalysis } from '../templating/ReportTypes.ts'

type listCodeScanningAlertsParameters = Endpoints['GET /repos/{owner}/{repo}/code-scanning/alerts']['parameters']

interface Repo {
  owner: string
  repo: string
}

export default class GitHubCodeScanning {
  private readonly octokit: Octokit

  constructor (octokit) {
    this.octokit = octokit
  }

  async getOpenCodeScanningAlerts (repo: Repo): Promise<CodeScanningResults> {
    return await getCodeScanning(this.octokit, repo, ['open'])
  }

  async getClosedCodeScanningAlerts (repo: Repo): Promise<CodeScanningResults> {
    return await getCodeScanning(this.octokit, repo, ['dismissed', 'fixed'])
  }

  /**
   * Returns the most recent code scanning analysis on the repository's default branch, or null
   * when it has none. Analyses are listed newest first.
   */
  async getLatestAnalysis (repo: Repo): Promise<LatestAnalysis | null> {
    const { data: repository } = await this.octokit.request('GET /repos/{owner}/{repo}', { ...repo })
    const { data: analyses } = await this.octokit.request('GET /repos/{owner}/{repo}/code-scanning/analyses', {
      ...repo,
      ref: `refs/heads/${repository.default_branch}`,
      per_page: 1
    })

    const latest = analyses[0]
    return latest ? { created: latest.created_at, ref: latest.ref, commitSha: latest.commit_sha } : null
  }
}

type AlertState = 'open' | 'fixed' | 'dismissed'

// The alerts API filters on a single state, so each state is fetched separately and combined.
// A dismissed alert whose code was later fixed is returned for both 'dismissed' and 'fixed',
// so alerts are de-duplicated by number.
async function getCodeScanning (octokit: Octokit, repo: Repo, states: AlertState[]): Promise<CodeScanningResults> {
  const results: CodeScanningResults = new CodeScanningResults()
  const seen = new Set<number>()

  for (const state of states) {
    const params: listCodeScanningAlertsParameters = {
      owner: repo.owner,
      repo: repo.repo,
      // ref: 'refs/pull/1377/merge', for testing
      state
    }

    const alerts: CodeScanningData[] = await octokit.paginate('GET /repos/{owner}/{repo}/code-scanning/alerts' as string, params)

    alerts.forEach((alert: CodeScanningData) => {
      if (seen.has(alert.number)) {
        return
      }
      seen.add(alert.number)
      results.addCodeScanningAlert(new CodeScanningAlert(alert))
    })
  }

  return results
}
