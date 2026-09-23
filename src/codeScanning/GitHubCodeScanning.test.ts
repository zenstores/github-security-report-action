/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import { expect } from 'chai'
import GitHubCodeScanning from './GitHubCodeScanning.ts'
import { getOctoKit } from '../testUtils.ts'

const mockedOctoKit = getOctoKit()

describe('GitHubDependencies', () => {
  const testRepo = {
    owner: 'octodemo',
    repo: 'demo-vulnerabilities-ghas'
  }

  const ghasReportingRepo = {
    owner: 'octodemo',
    repo: 'ghas-reporting'
  }

  const pmAdvanceSecurityJava = {
    owner: 'peter-murray',
    repo: 'advanced-security-java'
  }

  let codeScanning: GitHubCodeScanning

  before(() => {
    const octokit = mockedOctoKit
    codeScanning = new GitHubCodeScanning(octokit)
  })

  describe('getOpenCodeScanningAlerts()', () => {
    it(`from ${JSON.stringify(testRepo)}`, async () => {
      const results = await codeScanning.getOpenCodeScanningAlerts(testRepo)
      const tools = results.getTools()

      expect(tools).to.have.length(1)
      expect(tools[0]).to.equal('CodeQL')
    })

    it(`from ${JSON.stringify(ghasReportingRepo)}`, async () => {
      const results = await codeScanning.getOpenCodeScanningAlerts(ghasReportingRepo)
      const tools = results.getTools()

      expect(tools).to.have.length(1)
      expect(tools[0]).to.equal('-CodeQL-')
    })

    it(`from ${JSON.stringify(pmAdvanceSecurityJava)}`, async () => {
      const results = await codeScanning.getOpenCodeScanningAlerts(pmAdvanceSecurityJava)

      expect(results.getCodeQLScanningAlerts()).to.have.length(26)// TODO flaky test, sort this out
    })
  })

  describe('getClosedCodeScanningAlerts()', () => {
    it('combines dismissed and fixed alerts', async () => {
      const alertsByState = {
        dismissed: [{ number: 1, state: 'dismissed', tool: { name: 'CodeQL' }, rule: {} }],
        fixed: [
          { number: 2, state: 'fixed', tool: { name: 'CodeQL' }, rule: {} },
          { number: 3, state: 'fixed', tool: { name: 'CodeQL' }, rule: {} }
        ]
      }
      const requestedStates: string[] = []
      const stubOctokit = {
        paginate: async (_route: string, params: { state: string }) => {
          requestedStates.push(params.state)
          return alertsByState[params.state]
        }
      }

      const results = await new GitHubCodeScanning(stubOctokit).getClosedCodeScanningAlerts(testRepo)

      expect(requestedStates).to.deep.equal(['dismissed', 'fixed'])
      expect(results.getCodeQLScanningAlerts().map(alert => alert.state)).to.deep.equal(['dismissed', 'fixed', 'fixed'])
    })

    it('counts an alert returned for both dismissed and fixed once', async () => {
      const dismissedThenFixed = { number: 1, state: 'dismissed', tool: { name: 'CodeQL' }, rule: {} }
      const alertsByState = {
        dismissed: [dismissedThenFixed],
        fixed: [dismissedThenFixed, { number: 2, state: 'fixed', tool: { name: 'CodeQL' }, rule: {} }]
      }
      const stubOctokit = {
        paginate: async (_route: string, params: { state: string }) => alertsByState[params.state]
      }

      const results = await new GitHubCodeScanning(stubOctokit).getClosedCodeScanningAlerts(testRepo)

      expect(results.getCodeQLScanningAlerts().map(alert => alert.state)).to.deep.equal(['dismissed', 'fixed'])
    })
  })

  describe('getLatestAnalysis()', () => {
    function stubOctokitWithAnalyses (analyses: object[]): { requests: Array<{ route: string, params: any }>, octokit: any } {
      const requests: Array<{ route: string, params: any }> = []
      const octokit = {
        request: async (route: string, params: any) => {
          requests.push({ route, params })
          return route === 'GET /repos/{owner}/{repo}'
            ? { data: { default_branch: 'develop' } }
            : { data: analyses }
        }
      }
      return { requests, octokit }
    }

    it('returns the newest analysis on the default branch', async () => {
      const { requests, octokit } = stubOctokitWithAnalyses([
        { created_at: '2026-01-15T09:30:00Z', ref: 'refs/heads/develop', commit_sha: 'abcdef1234' }
      ])

      const latest = await new GitHubCodeScanning(octokit).getLatestAnalysis(testRepo)

      expect(requests[1].params).to.include({ ref: 'refs/heads/develop', per_page: 1 })
      expect(latest).to.deep.equal({ created: '2026-01-15T09:30:00Z', ref: 'refs/heads/develop', commitSha: 'abcdef1234' })
    })

    it('returns null when the default branch has no analyses', async () => {
      const { octokit } = stubOctokitWithAnalyses([])

      expect(await new GitHubCodeScanning(octokit).getLatestAnalysis(testRepo)).to.equal(null)
    })
  })
})
