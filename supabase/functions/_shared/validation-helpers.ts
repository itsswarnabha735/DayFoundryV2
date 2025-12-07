/**
 * Shared Validation Helpers for Agent Guardrails
 * 
 * Provides common validation, time parsing, and data checking utilities
 * used across all three agents (Compose Day, Guardian, Negotiator)
 */

// ============================================================================
// INPUT VALIDATION
// ============================================================================

/**
 * Validates that required fields exist in an object
 * @throws GuardrailViolationError if any field is missing
 */
export function validateRequiredFields(
    obj: any,
    fields: string[]
): void {
    const missing = fields.filter(field => !obj[field]);
    if (missing.length > 0) {
        throw new GuardrailViolationError(
            `Missing required fields: ${missing.join(', ')}`,
            'MISSING_REQUIRED_FIELDS',
            { missing }
        );
    }
}

/**
 * Validates and parses a date string
 * @throws GuardrailViolationError if date is invalid
 * @returns Valid Date object
 */
export function validateDateString(dateStr: string): Date {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        throw new GuardrailViolationError(
            `Invalid date format: ${dateStr}`,
            'INVALID_DATE_FORMAT',
            { input: dateStr }
        );
    }
    return date;
}

/**
 * Validates timezone string
 * @returns Validated timezone or default IST
 */
export function validateTimezone(timezone: string | undefined | null): string {
    if (!timezone) {
        return 'Asia/Kolkata'; // Default to IST as per user preference
    }

    try {
        // Test if timezone is valid by attempting to format with it
        new Date().toLocaleString('en-US', { timeZone: timezone });
        return timezone;
    } catch (e) {
        console.warn(`Invalid timezone "${timezone}", defaulting to IST`);
        return 'Asia/Kolkata';
    }
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

/**
 * Converts time string (24-hour or 12-hour format) to minutes since midnight
 * Handles both "HH:MM" and "HH:MM AM/PM" formats
 * 
 * @example
 * timeToMinutes("09:00") // 540
 * timeToMinutes("9:00 AM") // 540
 * timeToMinutes("5:30 PM") // 1050
 */
export function timeToMinutes(timeStr: string): number {
    const lower = timeStr.toLowerCase().trim();
    const parts = timeStr.split(':');

    if (parts.length !== 2) {
        throw new GuardrailViolationError(
            `Invalid time format: ${timeStr}`,
            'INVALID_TIME_FORMAT',
            { input: timeStr }
        );
    }

    let hours = parseInt(parts[0]);
    const minutesPart = parts[1].split(' ')[0]; // Remove AM/PM if present
    let minutes = parseInt(minutesPart);

    if (isNaN(hours) || isNaN(minutes)) {
        throw new GuardrailViolationError(
            `Invalid time format: ${timeStr}`,
            'INVALID_TIME_FORMAT',
            { input: timeStr }
        );
    }

    // Handle AM/PM
    if (lower.includes('pm') && hours < 12) {
        hours += 12;
    }
    if (lower.includes('am') && hours === 12) {
        hours = 0;
    }

    return hours * 60 + minutes;
}

/**
 * Checks if two time ranges overlap
 * Times are in minutes since midnight
 * 
 * @returns true if ranges overlap (inclusive check)
 */
export function hasOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number
): boolean {
    return Math.max(start1, start2) < Math.min(end1, end2);
}

/**
 * Formats a Date object as a time string in the specified timezone
 * @returns Time string in "HH:MM AM/PM" format
 */
export function formatTimeInTimezone(date: Date, timezone: string): string {
    return date.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Formats a Date object as 24-hour time in the specified timezone
 * @returns Time string in "HH:MM" format
 */
export function format24HourTime(date: Date, timezone: string): string {
    const hour = parseInt(date.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        hour12: false
    }));
    const minute = parseInt(date.toLocaleTimeString('en-US', {
        timeZone: timezone,
        minute: '2-digit'
    }));

    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

// ============================================================================
// DST HANDLING
// ============================================================================

/**
 * Checks if a time would be valid on the given date (handles DST transitions)
 * @returns true if the time exists on that date (not skipped by DST)
 */
export function isValidTimeOnDate(
    date: Date,
    timeMinutes: number,
    timezone: string
): boolean {
    const testDate = new Date(date);
    testDate.setHours(Math.floor(timeMinutes / 60));
    testDate.setMinutes(timeMinutes % 60);

    // If the date becomes invalid (NaN), it's in a DST gap
    return !isNaN(testDate.getTime());
}

// ============================================================================
// RESPONSE VALIDATION
// ============================================================================

/**
 * Validates LLM response against expected schema
 * @throws GuardrailViolationError if validation fails
 */
export function validateLLMResponse<T>(
    response: any,
    schema: {
        requiredFields: string[];
        arrayFields?: { field: string; minLength?: number; maxLength?: number }[];
    }
): T {
    // Check required fields
    validateRequiredFields(response, schema.requiredFields);

    // Check array fields if specified
    if (schema.arrayFields) {
        for (const arrConfig of schema.arrayFields) {
            const arr = response[arrConfig.field];
            if (!Array.isArray(arr)) {
                throw new GuardrailViolationError(
                    `Field "${arrConfig.field}" must be an array`,
                    'INVALID_RESPONSE_TYPE',
                    { field: arrConfig.field, type: typeof arr }
                );
            }

            if (arrConfig.minLength !== undefined && arr.length < arrConfig.minLength) {
                throw new GuardrailViolationError(
                    `Field "${arrConfig.field}" must have at least ${arrConfig.minLength} items`,
                    'INVALID_ARRAY_LENGTH',
                    { field: arrConfig.field, actual: arr.length, min: arrConfig.minLength }
                );
            }

            if (arrConfig.maxLength !== undefined && arr.length > arrConfig.maxLength) {
                throw new GuardrailViolationError(
                    `Field "${arrConfig.field}" must have at most ${arrConfig.maxLength} items`,
                    'INVALID_ARRAY_LENGTH',
                    { field: arrConfig.field, actual: arr.length, max: arrConfig.maxLength }
                );
            }
        }
    }

    return response as T;
}

// ============================================================================
// CUSTOM ERROR TYPES
// ============================================================================

/**
 * Error thrown when a guardrail validation fails
 */
export class GuardrailViolationError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: any
    ) {
        super(message);
        this.name = 'GuardrailViolationError';
    }
}

/**
 * Error thrown when LLM API fails
 */
export class LLMAPIError extends Error {
    constructor(
        message: string,
        public statusCode: number,
        public retryable: boolean,
        public details?: any
    ) {
        super(message);
        this.name = 'LLMAPIError';
    }
}
