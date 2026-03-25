export type SortBy = 'created_at' | 'title' | 'duration' | 'random'
export type SortOrder = 'asc' | 'desc'

export interface TrackFilterDto {
    // pagination
    perPage: number
    cursorCreatedAt: string | null
    cursorId: string | null

    // search
    search: string | null

    // sort
    sortBy: SortBy
    sortOrder: SortOrder

    // filters
    genreIds: number[]
    moodIds: number[]
    artistId: number | null
    minDuration: number | null // seconds
    maxDuration: number | null // seconds
}
