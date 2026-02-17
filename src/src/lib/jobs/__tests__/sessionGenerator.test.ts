import { generateSessionRecords, SessionGeneratorInput } from '../sessionGenerator'

const BASE_INPUT: SessionGeneratorInput = {
  is_recurring: false,
  window_start_day: 'MON',
  window_end_day: 'MON',
  time_window_start: '09:00',
  time_window_end: '17:00',
  start_date: '2025-06-01',
  end_date: '2025-06-30',
  specific_dates: [],
  exclude_dates: [],
}

const JOB_TEMPLATE_ID = 'tmpl-001'
const JOB_CODE = 'ABC-01A'

describe('generateSessionRecords', () => {
  describe('one-time (non-recurring) scheduling', () => {
    it('creates sessions for specific dates', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        specific_dates: ['2025-06-10', '2025-06-17', '2025-06-24'],
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)

      expect(sessions).toHaveLength(3)
      expect(sessions[0].scheduled_date).toBe('2025-06-10')
      expect(sessions[1].scheduled_date).toBe('2025-06-17')
      expect(sessions[2].scheduled_date).toBe('2025-06-24')
    })

    it('generates sequential session codes starting from A001', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        specific_dates: ['2025-06-10', '2025-06-17'],
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)

      expect(sessions[0].session_code).toBe('A001')
      expect(sessions[0].full_job_code).toBe('ABC-01A-A001')
      expect(sessions[1].session_code).toBe('A002')
      expect(sessions[1].full_job_code).toBe('ABC-01A-A002')
    })

    it('excludes dates in exclude_dates', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        specific_dates: ['2025-06-10', '2025-06-17', '2025-06-24'],
        exclude_dates: ['2025-06-17'],
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)

      expect(sessions).toHaveLength(2)
      expect(sessions[0].scheduled_date).toBe('2025-06-10')
      expect(sessions[1].scheduled_date).toBe('2025-06-24')
    })

    it('returns empty array when all specific dates are excluded', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        specific_dates: ['2025-06-10'],
        exclude_dates: ['2025-06-10'],
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)
      expect(sessions).toHaveLength(0)
    })

    it('returns empty array when no specific dates provided', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        specific_dates: [],
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)
      expect(sessions).toHaveLength(0)
    })

    it('sorts specific dates before creating sessions', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        specific_dates: ['2025-06-24', '2025-06-10', '2025-06-17'],
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)

      expect(sessions[0].scheduled_date).toBe('2025-06-10')
      expect(sessions[1].scheduled_date).toBe('2025-06-17')
      expect(sessions[2].scheduled_date).toBe('2025-06-24')
    })

    it('uses time_window_start as scheduled_time', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        specific_dates: ['2025-06-10'],
        time_window_start: '14:00',
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)
      expect(sessions[0].scheduled_time).toBe('14:00')
    })

    it('sets scheduled_time to null when no time_window_start', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        specific_dates: ['2025-06-10'],
        time_window_start: '',
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)
      expect(sessions[0].scheduled_time).toBeNull()
    })
  })

  describe('recurring scheduling', () => {
    it('creates weekly sessions for the full date range', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: true,
        window_start_day: 'MON',
        window_end_day: 'MON',
        start_date: '2025-06-01', // Sunday
        end_date: '2025-06-30',
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)

      // June 2025: Mondays are 2, 9, 16, 23, 30
      expect(sessions.length).toBeGreaterThanOrEqual(4)
      // All sessions should be on Mondays
      for (const session of sessions) {
        const date = new Date(session.scheduled_date + 'T00:00:00')
        expect(date.getDay()).toBe(1) // Monday
      }
    })

    it('skips excluded dates in recurring mode', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: true,
        window_start_day: 'MON',
        window_end_day: 'MON',
        start_date: '2025-06-01',
        end_date: '2025-06-30',
        exclude_dates: ['2025-06-09'],
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)

      const dates = sessions.map((s) => s.scheduled_date)
      expect(dates).not.toContain('2025-06-09')
    })

    it('generates correct session codes for recurring sessions', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: true,
        window_start_day: 'MON',
        window_end_day: 'MON',
        start_date: '2025-06-02',
        end_date: '2025-06-16',
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)

      // Should have sessions for June 2, 9, 16
      expect(sessions).toHaveLength(3)
      expect(sessions[0].session_code).toBe('A001')
      expect(sessions[1].session_code).toBe('A002')
      expect(sessions[2].session_code).toBe('A003')
    })

    it('finds the first matching day when start_date is not on the target day', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: true,
        window_start_day: 'FRI',
        window_end_day: 'FRI',
        start_date: '2025-06-01', // Sunday
        end_date: '2025-06-30',
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)

      // First Friday on or after June 1, 2025 is June 6
      expect(sessions[0].scheduled_date).toBe('2025-06-06')
    })
  })

  describe('window spanning (multi-day)', () => {
    it('sets scheduled_end_date when window spans multiple days', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        window_start_day: 'MON',
        window_end_day: 'WED', // 2 days span
        specific_dates: ['2025-06-09'], // Monday
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)

      expect(sessions).toHaveLength(1)
      expect(sessions[0].scheduled_date).toBe('2025-06-09')
      expect(sessions[0].scheduled_end_date).toBe('2025-06-11') // Wednesday
    })

    it('sets scheduled_end_date to null for single-day windows', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        window_start_day: 'MON',
        window_end_day: 'MON',
        specific_dates: ['2025-06-09'],
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)

      expect(sessions[0].scheduled_end_date).toBeNull()
    })

    it('handles window wrapping around the week (e.g., FRI to MON)', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        window_start_day: 'FRI',
        window_end_day: 'MON', // wraps around: 3 days span
        specific_dates: ['2025-06-06'], // Friday
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)

      expect(sessions).toHaveLength(1)
      expect(sessions[0].scheduled_date).toBe('2025-06-06')
      // FRI(5) to MON(1): windowDays = 1-5 = -4, +7 = 3
      expect(sessions[0].scheduled_end_date).toBe('2025-06-09') // Monday
    })
  })

  describe('preferred employee', () => {
    it('sets status to APPROVED and assigned_to when preferred employee provided', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        specific_dates: ['2025-06-10'],
      }

      const sessions = generateSessionRecords(
        JOB_TEMPLATE_ID,
        JOB_CODE,
        input,
        1,
        'emp-123'
      )

      expect(sessions[0].status).toBe('APPROVED')
      expect(sessions[0].assigned_to).toBe('emp-123')
    })

    it('sets status to OFFERED with no assigned_to when no preferred employee', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        specific_dates: ['2025-06-10'],
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)

      expect(sessions[0].status).toBe('OFFERED')
      expect(sessions[0].assigned_to).toBeUndefined()
    })
  })

  describe('startingSessionNumber', () => {
    it('starts session numbering from the provided number', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        specific_dates: ['2025-06-10', '2025-06-17'],
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input, 5)

      expect(sessions[0].session_code).toBe('A005')
      expect(sessions[0].full_job_code).toBe('ABC-01A-A005')
      expect(sessions[1].session_code).toBe('A006')
      expect(sessions[1].full_job_code).toBe('ABC-01A-A006')
    })

    it('defaults to 1 when not provided', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        specific_dates: ['2025-06-10'],
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)
      expect(sessions[0].session_code).toBe('A001')
    })

    it('pads session numbers to 3 digits', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        specific_dates: ['2025-06-10'],
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input, 99)
      expect(sessions[0].session_code).toBe('A099')

      const sessions2 = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input, 100)
      expect(sessions2[0].session_code).toBe('A100')
    })
  })

  describe('job_template_id propagation', () => {
    it('sets job_template_id on all sessions', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: false,
        specific_dates: ['2025-06-10', '2025-06-17'],
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)

      for (const session of sessions) {
        expect(session.job_template_id).toBe(JOB_TEMPLATE_ID)
      }
    })
  })

  describe('recurring with excluded dates preserves numbering', () => {
    it('session codes increment past excluded dates', () => {
      const input: SessionGeneratorInput = {
        ...BASE_INPUT,
        is_recurring: true,
        window_start_day: 'MON',
        window_end_day: 'MON',
        start_date: '2025-06-02', // Monday
        end_date: '2025-06-23',
        exclude_dates: ['2025-06-09'], // Skip second Monday
      }

      const sessions = generateSessionRecords(JOB_TEMPLATE_ID, JOB_CODE, input)

      // 4 Mondays (2, 9, 16, 23) minus 1 excluded = 3 sessions
      expect(sessions).toHaveLength(3)
      // Session codes should still be sequential: A001, A002, A003
      expect(sessions[0].session_code).toBe('A001')
      expect(sessions[0].scheduled_date).toBe('2025-06-02')
      expect(sessions[1].session_code).toBe('A002')
      expect(sessions[1].scheduled_date).toBe('2025-06-16')
      expect(sessions[2].session_code).toBe('A003')
      expect(sessions[2].scheduled_date).toBe('2025-06-23')
    })
  })
})
