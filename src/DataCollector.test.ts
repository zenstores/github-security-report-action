/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import { expect } from 'chai'
import DataCollector from './DataCollector.ts'
import { getOctoKit, getSampleSarifDirectory } from './testUtils.ts'

const mockedOctoKit = getOctoKit()
const sarifReportDir = getSampleSarifDirectory('java', 'detailed')

describe('DataCollector', function () {
  this.timeout(10 * 1000)

  it('leaves scanning.lastAnalysis empty by default', async () => {
    const reportData = await new DataCollector(mockedOctoKit, 'octodemo/ghas-reporting').getPayload(sarifReportDir)

    expect(reportData.getJSONPayload().scanning.lastAnalysis).to.equal(null)
  })

  it('populates scanning.lastAnalysis when includeLastScan is set', async () => {
    const reportData = await new DataCollector(mockedOctoKit, 'octodemo/ghas-reporting').getPayload(sarifReportDir, { includeLastScan: true })

    expect(reportData.getJSONPayload().scanning.lastAnalysis).to.deep.equal({
      created: '2026-09-01T12:00:00Z',
      ref: 'refs/heads/main',
      commitSha: '0123456789abcdef0123456789abcdef01234567'
    })
  })
})
