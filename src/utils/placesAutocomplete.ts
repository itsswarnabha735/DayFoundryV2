/**
 * Google Places Autocomplete (New) API utility
 * Documentation: https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
 */

export interface PlacePrediction {
    placeId: string;
    description: string;
    mainText: string;
    secondaryText: string;
}

interface AutocompleteResponse {
    suggestions: Array<{
        placePrediction?: {
            place: string;
            placeId: string;
            text: {
                text: string;
            };
            structuredFormat: {
                mainText: {
                    text: string;
                };
                secondaryText: {
                    text: string;
                };
            };
        };
    }>;
}

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:autocomplete';

/**
 * Fetches place suggestions from Google Places Autocomplete (New) API
 * @param input - The search query string
 * @param apiKey - Google Maps API key
 * @returns Array of place predictions
 */
export async function getPlaceSuggestions(
    input: string,
    apiKey: string
): Promise<PlacePrediction[]> {
    if (!input.trim()) {
        return [];
    }

    try {
        const response = await fetch(PLACES_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
            },
            body: JSON.stringify({
                input: input.trim(),
                // Optional: Add location bias for better results
                // You can customize this based on user's location
                includedPrimaryTypes: ['establishment', 'street_address', 'premise'],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Places API error:', response.status, errorText);
            throw new Error(`Places API returned ${response.status}: ${errorText}`);
        }

        const data: AutocompleteResponse = await response.json();

        // Transform the response into our simplified format
        const predictions: PlacePrediction[] = (data.suggestions || [])
            .filter(suggestion => suggestion.placePrediction)
            .map(suggestion => {
                const prediction = suggestion.placePrediction!;
                return {
                    placeId: prediction.placeId,
                    description: prediction.text.text,
                    mainText: prediction.structuredFormat.mainText.text,
                    secondaryText: prediction.structuredFormat.secondaryText.text,
                };
            });

        return predictions;
    } catch (error) {
        console.error('Error fetching place suggestions:', error);
        throw error;
    }
}

/**
 * Debounce utility for reducing API calls
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            func(...args);
        };

        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(later, wait);
    };
}
