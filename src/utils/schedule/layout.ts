import { ScheduleBlock } from '../../components/screens/ScheduleScreen';
import { timeToMinutes } from '../timeFormat';

interface LayoutPosition {
    left: string;
    width: string;
}

/**
 * Calculates the layout for schedule blocks to handle overlaps side-by-side.
 * Returns a map of block ID to its layout position (left % and width %).
 */
export function calculateLayout(blocks: ScheduleBlock[]): Map<string, LayoutPosition> {
    const layoutMap = new Map<string, LayoutPosition>();

    if (blocks.length === 0) return layoutMap;

    // 1. Sort blocks by start time, then by end time (descending) for stability
    const sortedBlocks = [...blocks].sort((a, b) => {
        const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
        if (startDiff !== 0) return startDiff;
        return timeToMinutes(b.endTime) - timeToMinutes(a.endTime);
    });

    // 2. Group blocks into connected clusters (overlapping groups)
    const clusters: ScheduleBlock[][] = [];
    let currentCluster: ScheduleBlock[] = [];
    let clusterEndTime = -1;

    for (const block of sortedBlocks) {
        const start = timeToMinutes(block.startTime);
        const end = timeToMinutes(block.endTime);

        if (currentCluster.length === 0) {
            currentCluster.push(block);
            clusterEndTime = end;
        } else {
            if (start < clusterEndTime) {
                // Overlaps with the current cluster
                currentCluster.push(block);
                clusterEndTime = Math.max(clusterEndTime, end);
            } else {
                // No overlap, start a new cluster
                clusters.push(currentCluster);
                currentCluster = [block];
                clusterEndTime = end;
            }
        }
    }
    if (currentCluster.length > 0) {
        clusters.push(currentCluster);
    }

    // 3. Process each cluster to assign columns
    for (const cluster of clusters) {
        const columns: ScheduleBlock[][] = [];

        for (const block of cluster) {
            const start = timeToMinutes(block.startTime);

            // Find the first column where this block fits
            let placed = false;
            for (let i = 0; i < columns.length; i++) {
                const lastBlockInColumn = columns[i][columns[i].length - 1];
                const lastBlockEnd = timeToMinutes(lastBlockInColumn.endTime);

                if (start >= lastBlockEnd) {
                    columns[i].push(block);
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                // Create a new column
                columns.push([block]);
            }
        }

        // 4. Calculate positions based on columns
        const numColumns = columns.length;
        const width = 100 / numColumns;

        for (let i = 0; i < numColumns; i++) {
            for (const block of columns[i]) {
                layoutMap.set(block.id, {
                    left: `${i * width}%`,
                    width: `${width}%`
                });
            }
        }
    }

    return layoutMap;
}
