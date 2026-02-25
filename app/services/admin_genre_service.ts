import Genre from '#models/genre'
import { DateTime } from 'luxon'
export interface CreateGenre {
  name: 'pop' | 'rock' | 'folk' | 'electronic' | 'jazz'
  slug: string
}
export class AdminGenreService {
  async createGenre(payload: CreateGenre): Promise<Genre> {
    const genre = await Genre.create({
      name: payload.name,
      slug: payload.slug,
    })
    return genre
  }

  async editGenre(genreId: number, payload: any): Promise<Genre> {
    const genre = await Genre.findOrFail(genreId)
    console.log('genre=', genre)
    const edit = genre.merge(payload)

    await edit.save()

    return genre
  }

  async deleteGenre(genreId: number) {
    const genre = await Genre.findOrFail(genreId)

    genre.deletedAt = DateTime.now()

    await genre.save()

    return {
      success: true,
    }
  }
}
