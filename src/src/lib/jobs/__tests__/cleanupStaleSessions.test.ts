import { cleanupStaleSessions } from '../cleanupStaleSessions'
import type { SupabaseClient } from '@supabase/supabase-js'

function createMockSupabase(staleCandidates: Array<{
  id: string
  status: string
  scheduled_date: string
  scheduled_end_date: string | null
}> | null, selectError: unknown = null) {
  const updateInCalls: Array<{ status: string; ids: string[] }> = []

  const mockSupabase = {
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => ({
        in: vi.fn().mockResolvedValue({
          data: staleCandidates,
          error: selectError,
        }),
      })),
      update: vi.fn().mockImplementation((updatePayload: { status: string }) => ({
        in: vi.fn().mockImplementation((_col: string, ids: string[]) => {
          updateInCalls.push({ status: updatePayload.status, ids })
          return Promise.resolve({ error: null })
        }),
      })),
    })),
    _updateInCalls: updateInCalls,
  }

  return mockSupabase
}

describe('cleanupStaleSessions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Set "today" to 2025-06-15
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return 0 when there are no stale sessions', async () => {
    const mock = createMockSupabase([])
    const result = await cleanupStaleSessions(mock as unknown as SupabaseClient)
    expect(result).toBe(0)
  })

  it('should return 0 when select returns an error', async () => {
    const mock = createMockSupabase(null, { message: 'DB error' })
    const result = await cleanupStaleSessions(mock as unknown as SupabaseClient)
    expect(result).toBe(0)
  })

  it('should return 0 when select returns null data', async () => {
    const mock = createMockSupabase(null)
    const result = await cleanupStaleSessions(mock as unknown as SupabaseClient)
    expect(result).toBe(0)
  })

  it('should mark OFFERED/CLAIMED/APPROVED sessions past their end date as MISSED', async () => {
    const sessions = [
      { id: '1', status: 'OFFERED', scheduled_date: '2025-06-10', scheduled_end_date: '2025-06-12' },
      { id: '2', status: 'CLAIMED', scheduled_date: '2025-06-10', scheduled_end_date: '2025-06-13' },
      { id: '3', status: 'APPROVED', scheduled_date: '2025-06-08', scheduled_end_date: null },
    ]
    const mock = createMockSupabase(sessions)
    const result = await cleanupStaleSessions(mock as unknown as SupabaseClient)

    expect(result).toBe(3)

    const missedCall = mock._updateInCalls.find((c) => c.status === 'MISSED')
    expect(missedCall).toBeDefined()
    expect(missedCall!.ids).toEqual(expect.arrayContaining(['1', '2', '3']))
    expect(missedCall!.ids).toHaveLength(3)
  })

  it('should mark IN_PROGRESS sessions past their end date as OVERDUE', async () => {
    const sessions = [
      { id: '4', status: 'IN_PROGRESS', scheduled_date: '2025-06-10', scheduled_end_date: '2025-06-14' },
    ]
    const mock = createMockSupabase(sessions)
    const result = await cleanupStaleSessions(mock as unknown as SupabaseClient)

    expect(result).toBe(1)

    const overdueCall = mock._updateInCalls.find((c) => c.status === 'OVERDUE')
    expect(overdueCall).toBeDefined()
    expect(overdueCall!.ids).toEqual(['4'])
  })

  it('should handle a mix of MISSED and OVERDUE sessions', async () => {
    const sessions = [
      { id: '1', status: 'OFFERED', scheduled_date: '2025-06-01', scheduled_end_date: '2025-06-05' },
      { id: '2', status: 'IN_PROGRESS', scheduled_date: '2025-06-01', scheduled_end_date: '2025-06-10' },
      { id: '3', status: 'CLAIMED', scheduled_date: '2025-06-02', scheduled_end_date: null },
    ]
    const mock = createMockSupabase(sessions)
    const result = await cleanupStaleSessions(mock as unknown as SupabaseClient)

    expect(result).toBe(3)

    const missedCall = mock._updateInCalls.find((c) => c.status === 'MISSED')
    const overdueCall = mock._updateInCalls.find((c) => c.status === 'OVERDUE')

    expect(missedCall).toBeDefined()
    expect(missedCall!.ids).toEqual(expect.arrayContaining(['1', '3']))
    expect(missedCall!.ids).toHaveLength(2)

    expect(overdueCall).toBeDefined()
    expect(overdueCall!.ids).toEqual(['2'])
  })

  it('should NOT mark sessions whose end date is today or in the future', async () => {
    const sessions = [
      { id: '1', status: 'OFFERED', scheduled_date: '2025-06-15', scheduled_end_date: '2025-06-15' },
      { id: '2', status: 'CLAIMED', scheduled_date: '2025-06-15', scheduled_end_date: '2025-06-20' },
      { id: '3', status: 'IN_PROGRESS', scheduled_date: '2025-06-15', scheduled_end_date: null },
    ]
    const mock = createMockSupabase(sessions)
    const result = await cleanupStaleSessions(mock as unknown as SupabaseClient)

    // None should be stale since they are on or after "today" (2025-06-15)
    expect(result).toBe(0)
    expect(mock._updateInCalls).toHaveLength(0)
  })

  it('should use scheduled_date as fallback when scheduled_end_date is null', async () => {
    const sessions = [
      { id: '1', status: 'OFFERED', scheduled_date: '2025-06-10', scheduled_end_date: null },
    ]
    const mock = createMockSupabase(sessions)
    const result = await cleanupStaleSessions(mock as unknown as SupabaseClient)

    expect(result).toBe(1)

    const missedCall = mock._updateInCalls.find((c) => c.status === 'MISSED')
    expect(missedCall).toBeDefined()
    expect(missedCall!.ids).toEqual(['1'])
  })

  it('should skip sessions with no scheduled_date and no scheduled_end_date', async () => {
    const sessions = [
      { id: '1', status: 'OFFERED', scheduled_date: null as unknown as string, scheduled_end_date: null },
    ]
    const mock = createMockSupabase(sessions)
    const result = await cleanupStaleSessions(mock as unknown as SupabaseClient)

    expect(result).toBe(0)
  })

  it('should return 0 and not throw when supabase throws an exception', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation(() => {
        throw new Error('Connection failed')
      }),
    }

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await cleanupStaleSessions(mockSupabase as unknown as SupabaseClient)

    expect(result).toBe(0)
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to cleanup stale sessions:',
      expect.any(Error)
    )
    consoleSpy.mockRestore()
  })

  it('should call from("job_sessions") for both select and update operations', async () => {
    const sessions = [
      { id: '1', status: 'OFFERED', scheduled_date: '2025-06-10', scheduled_end_date: '2025-06-12' },
    ]
    const mock = createMockSupabase(sessions)
    await cleanupStaleSessions(mock as unknown as SupabaseClient)

    // from() called at least twice: once for select, once for update
    expect(mock.from).toHaveBeenCalledWith('job_sessions')
    expect(mock.from.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
