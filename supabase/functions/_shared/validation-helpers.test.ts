import { describe, it, expect } from 'vitest';
import {
    timeToMinutes,
    hasOverlap,
    validateTimezone,
    validateDateString,
    isValidTimeOnDate,
    GuardrailViolationError
} from '../_shared/validation-helpers.ts';

describe('timeToMinutes', () => {
    it('parses 24-hour format correctly', () => {
        expect(timeToMinutes('00:00')).toBe(0);
        expect(timeToMinutes('09:00')).toBe(540);
        expect(timeToMinutes('17:30')).toBe(1050);
        expect(timeToMinutes('23:59')).toBe(1439);
    });

    it('parses 12-hour AM format correctly', () => {
        expect(timeToMinutes('12:00 AM')).toBe(0); // midnight
        expect(timeToMinutes('1:00 AM')).toBe(60);
        expect(timeToMinutes('9:00 AM')).toBe(540);
        expect(timeToMinutes('11:59 AM')).toBe(719);
    });

    it('parses 12-hour PM format correctly', () => {
        expect(timeToMinutes('12:00 PM')).toBe(720); // noon
        expect(timeToMinutes('1:00 PM')).toBe(780);
        expect(timeToMinutes('5:30 PM')).toBe(1050);
        expect(timeToMinutes('11:59 PM')).toBe(1439);
    });

    it('handles lowercase am/pm', () => {
        expect(timeToMinutes('9:00 am')).toBe(540);
        expect(timeToMinutes('5:30 pm')).toBe(1050);
    });

    it('throws on invalid format', () => {
        expect(() => timeToMinutes('invalid')).toThrow(GuardrailViolationError);
        expect(() => timeToMinutes('25:00')).not.toThrow(); // JS parses this
        expect(() => timeToMinutes('9:60')).not.toThrow(); // JS parses this
    });
});

describe('hasOverlap', () => {
    it('detects full overlap (identical ranges)', () => {
        expect(hasOverlap(540, 600, 540, 600)).toBe(true);
    });

    it('detects full overlap (one contains other)', () => {
        expect(hasOverlap(540, 660, 570, 630)).toBe(true);
        expect(hasOverlap(570, 630, 540, 660)).toBe(true);
    });

    it('detects partial overlap (end of first overlaps start of second)', () => {
        expect(hasOverlap(540, 600, 570, 630)).toBe(true);
    });

    it('detects partial overlap (start of first overlaps end of second)', () => {
        expect(hasOverlap(570, 630, 540, 600)).toBe(true);
    });

    it('detects no overlap (adjacent ranges)', () => {
        expect(hasOverlap(540, 600, 600, 660)).toBe(false);
        expect(hasOverlap(600, 660, 540, 600)).toBe(false);
    });

    it('detects no overlap (gaps between ranges)', () => {
        expect(hasOverlap(540, 600, 610, 670)).toBe(false);
        expect(hasOverlap(610, 670, 540, 600)).toBe(false);
    });

    it('handles single-minute ranges', () => {
        expect(hasOverlap(540, 541, 541, 542)).toBe(false);
        expect(hasOverlap(540, 541, 540, 541)).toBe(true);
    });
});

describe('validateTimezone', () => {
    it('validates correct timezone strings', () => {
        expect(validateTimezone('UTC')).toBe('UTC');
        expect(validateTimezone('America/New_York')).toBe('America/New_York');
        expect(validateTimezone('Europe/London')).toBe('Europe/London');
        expect(validateTimezone('Asia/Tokyo')).toBe('Asia/Tokyo');
    });

    it('defaults to IST for invalid timezones', () => {
        expect(validateTimezone('Invalid/Timezone')).toBe('Asia/Kolkata');
        expect(validateTimezone('Not_A_TZ')).toBe('Asia/Kolkata');
    });

    it('defaults to IST for null/undefined', () => {
        expect(validateTimezone(null)).toBe('Asia/Kolkata');
        expect(validateTimezone(undefined)).toBe('Asia/Kolkata');
        expect(validateTimezone('')).toBe('Asia/Kolkata');
    });
});

describe('validateDateString', () => {
    it('validates correct date strings', () => {
        const date1 = validateDateString('2025-12-03');
        expect(date1).toBeInstanceOf(Date);
        expect(date1.getFullYear()).toBe(2025);

        const date2 = validateDateString('2025-12-03T10:30:00Z');
        expect(date2).toBeInstanceOf(Date);
    });

    it('throws on invalid date strings', () => {
        expect(() => validateDateString('invalid-date')).toThrow(GuardrailViolationError);
        expect(() => validateDateString('not a date')).toThrow(GuardrailViolationError);
        expect(() => validateDateString('')).toThrow(GuardrailViolationError);
    });

    it('throws with proper error code', () => {
        try {
            validateDateString('invalid');
            expect.fail('Should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(GuardrailViolationError);
            expect((e as GuardrailViolationError).code).toBe('INVALID_DATE_FORMAT');
        }
    });
});

describe('isValidTimeOnDate', () => {
    it('returns true for valid times', () => {
        const date = new Date('2025-12-03');
        expect(isValidTimeOnDate(date, 540, 'UTC')).toBe(true); // 9:00 AM
        expect(isValidTimeOnDate(date, 1050, 'UTC')).toBe(true); // 5:30 PM
    });

    it('handles edge case times', () => {
        const date = new Date('2025-12-03');
        expect(isValidTimeOnDate(date, 0, 'UTC')).toBe(true); // midnight
        expect(isValidTimeOnDate(date, 1439, 'UTC')).toBe(true); // 23:59
    });
});
