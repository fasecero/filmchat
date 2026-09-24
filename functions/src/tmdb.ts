import { HttpsError } from 'firebase-functions/v2/https';

const tmdbBaseUrl = 'https://api.themoviedb.org/3';
const maxResults = 20;

export type MovieCatalogResult = {
	provider: 'tmdb';
	externalMovieId: string;
	title: string;
	releaseYear: number | null;
	posterPath: string | null;
	overview: string | null;
};

type TmdbMovie = {
	id?: unknown;
	title?: unknown;
	release_date?: unknown;
	poster_path?: unknown;
	overview?: unknown;
};

function getToken() {
	const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
	if (!token) {
		throw new HttpsError('failed-precondition', 'Movie search is not configured.');
	}
	return token;
}

function releaseYear(value: unknown) {
	if (typeof value !== 'string' || !/^\d{4}/.test(value)) return null;
	return Number(value.slice(0, 4));
}

export function mapTmdbMovie(movie: TmdbMovie): MovieCatalogResult | null {
	if (typeof movie.id !== 'number' || !Number.isInteger(movie.id) || movie.id <= 0) return null;
	if (typeof movie.title !== 'string' || movie.title.trim().length === 0) return null;
	return {
		provider: 'tmdb',
		externalMovieId: String(movie.id),
		title: movie.title.trim().slice(0, 200),
		releaseYear: releaseYear(movie.release_date),
		posterPath: typeof movie.poster_path === 'string' ? movie.poster_path.slice(0, 200) : null,
		overview: typeof movie.overview === 'string' ? movie.overview.trim().slice(0, 1000) || null : null,
	};
}

async function tmdbRequest(path: string, params: Record<string, string>) {
	const url = new URL(`${tmdbBaseUrl}${path}`);
	Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${getToken()}`, Accept: 'application/json' },
	});
	if (!response.ok) {
		if (response.status === 401 || response.status === 403) {
			throw new HttpsError('failed-precondition', 'Movie search credentials are invalid.');
		}
		throw new HttpsError('unavailable', 'Movie catalog is unavailable right now.');
	}
	try {
		return await response.json() as Record<string, unknown>;
	} catch {
		throw new HttpsError('unavailable', 'Movie catalog returned an invalid response.');
	}
}

export async function searchTmdb(query: string): Promise<MovieCatalogResult[]> {
	const data = await tmdbRequest('/search/movie', { query, include_adult: 'false', language: 'en-US', page: '1' });
	if (!Array.isArray(data.results)) throw new HttpsError('unavailable', 'Movie catalog returned an invalid response.');
	return data.results.slice(0, maxResults)
		.map((movie) => mapTmdbMovie(movie as TmdbMovie))
		.filter((movie): movie is MovieCatalogResult => movie !== null);
}

export async function getTmdbMovie(externalMovieId: string): Promise<MovieCatalogResult> {
	const data = await tmdbRequest(`/movie/${encodeURIComponent(externalMovieId)}`, { language: 'en-US' });
	const movie = mapTmdbMovie(data as TmdbMovie);
	if (!movie) throw new HttpsError('invalid-argument', 'The selected movie is invalid.');
	return movie;
}
