const API_KEY = '7cc553df847861ac17aeaa6fad29e651';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';

let currentItem = null;
let currentItemType = 'movie'; // 'movie', 'tv', or 'anime'
let currentSeasons = [];       // array of season objects from TMDB
let currentEpisodes = [];      // array of episode objects for the selected season
let selectedSeason = 1;
let selectedEpisode = 1;

// ===== FETCH FUNCTIONS =====

async function fetchTrending(type) {
  const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}`);
  const data = await res.json();
  return data.results;
}

async function fetchTrendingAnime() {
  let allResults = [];
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(`${BASE_URL}/trending/tv/week?api_key=${API_KEY}&page=${page}`);
    const data = await res.json();
    const filtered = data.results.filter(item =>
      item.original_language === 'ja' && item.genre_ids.includes(16)
    );
    allResults = allResults.concat(filtered);
  }
  return allResults;
}

async function fetchTVDetails(tvId) {
  const res = await fetch(`${BASE_URL}/tv/${tvId}?api_key=${API_KEY}`);
  const data = await res.json();
  return data;
}

async function fetchSeasonEpisodes(tvId, seasonNumber) {
  const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${API_KEY}`);
  const data = await res.json();
  return data.episodes || [];
}

// ===== DISPLAY FUNCTIONS =====

function displayBanner(item) {
  document.getElementById('banner').style.backgroundImage = `url(${IMG_URL}${item.backdrop_path})`;
  document.getElementById('banner-title').textContent = item.title || item.name;
}

function displayList(items, containerId, itemType) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  items.forEach(item => {
    if (!item.poster_path) return;
    const img = document.createElement('img');
    img.src = `${IMG_URL}${item.poster_path}`;
    img.alt = item.title || item.name;
    img.loading = 'lazy';
    img.onclick = () => showDetails(item, itemType);
    container.appendChild(img);
  });
}

// ===== MODAL FUNCTIONS =====

async function showDetails(item, itemType) {
  currentItem = item;

  // Determine the type
  if (itemType === 'anime') {
    currentItemType = 'anime';
  } else if (item.media_type === 'movie' || itemType === 'movie') {
    currentItemType = 'movie';
  } else {
    currentItemType = 'tv';
  }

  document.getElementById('modal-title').textContent = item.title || item.name;
  document.getElementById('modal-description').textContent = item.overview;
  document.getElementById('modal-image').src = `${IMG_URL}${item.poster_path}`;
  document.getElementById('modal-rating').innerHTML = getStars(item.vote_average);

  const episodeSelector = document.getElementById('episode-selector');
  const episodeNav = document.getElementById('episode-nav');

  if (currentItemType === 'movie') {
    // Hide episode selectors for movies
    episodeSelector.style.display = 'none';
    if (episodeNav) episodeNav.style.display = 'none';
    selectedSeason = 0;
    selectedEpisode = 0;
    changeServer();
  } else {
    // Show episode selectors for TV/anime
    episodeSelector.style.display = 'block';
    if (episodeNav) episodeNav.style.display = 'flex';

    // Fetch TV details to get seasons
    try {
      const details = await fetchTVDetails(item.id);
      currentSeasons = (details.seasons || []).filter(s => s.season_number > 0);

      populateSeasonDropdown();

      if (currentSeasons.length > 0) {
        selectedSeason = currentSeasons[0].season_number;
        document.getElementById('season-select').value = selectedSeason;
        await loadEpisodes(item.id, selectedSeason);
      }
    } catch (err) {
      console.error('Failed to load TV details:', err);
      currentSeasons = [];
      selectedSeason = 1;
      selectedEpisode = 1;
      changeServer();
    }
  }

  document.getElementById('modal').style.display = 'flex';
}

function getStars(voteAverage) {
  const filled = Math.round(voteAverage / 2);
  let html = '';
  for (let i = 0; i < 5; i++) {
    html += i < filled ? '<span style="color:gold;">&#9733;</span>' : '<span style="color:#555;">&#9733;</span>';
  }
  return html;
}

// ===== SEASON / EPISODE FUNCTIONS =====

function populateSeasonDropdown() {
  const seasonSelect = document.getElementById('season-select');
  seasonSelect.innerHTML = '';
  currentSeasons.forEach(season => {
    const option = document.createElement('option');
    option.value = season.season_number;
    option.textContent = `Season ${season.season_number} (${season.episode_count} eps)`;
    seasonSelect.appendChild(option);
  });
}

async function loadEpisodes(tvId, seasonNumber) {
  const episodeSelect = document.getElementById('episode-select');
  episodeSelect.innerHTML = '<option>Loading...</option>';

  try {
    currentEpisodes = await fetchSeasonEpisodes(tvId, seasonNumber);
    populateEpisodeDropdown();

    if (currentEpisodes.length > 0) {
      selectedEpisode = currentEpisodes[0].episode_number;
      episodeSelect.value = selectedEpisode;
    } else {
      selectedEpisode = 1;
    }

    changeServer();
    updateNavButtons();
  } catch (err) {
    console.error('Failed to load episodes:', err);
    episodeSelect.innerHTML = '<option>Error loading</option>';
    selectedEpisode = 1;
    changeServer();
  }
}

function populateEpisodeDropdown() {
  const episodeSelect = document.getElementById('episode-select');
  episodeSelect.innerHTML = '';
  currentEpisodes.forEach(ep => {
    const option = document.createElement('option');
    option.value = ep.episode_number;
    const epName = ep.name ? ` - ${ep.name}` : '';
    option.textContent = `Ep ${ep.episode_number}${epName}`;
    episodeSelect.appendChild(option);
  });
}

async function onSeasonChange() {
  const seasonSelect = document.getElementById('season-select');
  selectedSeason = parseInt(seasonSelect.value);
  await loadEpisodes(currentItem.id, selectedSeason);
}

function onEpisodeChange() {
  const episodeSelect = document.getElementById('episode-select');
  selectedEpisode = parseInt(episodeSelect.value);
  changeServer();
  updateNavButtons();
}

// ===== EPISODE NAV (PREV/NEXT) =====

function updateNavButtons() {
  const prevBtn = document.getElementById('prev-episode');
  const nextBtn = document.getElementById('next-episode');
  if (!prevBtn || !nextBtn) return;

  const currentIndex = currentEpisodes.findIndex(ep => ep.episode_number === selectedEpisode);
  prevBtn.disabled = currentIndex <= 0;
  nextBtn.disabled = currentIndex >= currentEpisodes.length - 1;
}

function prevEpisode() {
  const currentIndex = currentEpisodes.findIndex(ep => ep.episode_number === selectedEpisode);
  if (currentIndex > 0) {
    selectedEpisode = currentEpisodes[currentIndex - 1].episode_number;
    document.getElementById('episode-select').value = selectedEpisode;
    changeServer();
    updateNavButtons();
  }
}

function nextEpisode() {
  const currentIndex = currentEpisodes.findIndex(ep => ep.episode_number === selectedEpisode);
  if (currentIndex < currentEpisodes.length - 1) {
    selectedEpisode = currentEpisodes[currentIndex + 1].episode_number;
    document.getElementById('episode-select').value = selectedEpisode;
    changeServer();
    updateNavButtons();
  }
}

// ===== SERVER / EMBED FUNCTIONS =====

function changeServer() {
  if (!currentItem) return;

  const server = document.getElementById('server').value;
  const id = currentItem.id;
  const isMovie = currentItemType === 'movie';
  const s = selectedSeason || 1;
  const e = selectedEpisode || 1;

  let embedURL = '';

  if (isMovie) {
    switch (server) {
      case 'vidsrc.cc':
        embedURL = `https://vidsrc.cc/v2/embed/movie/${id}`;
        break;
      case 'vidsrc.me':
        embedURL = `https://vidsrc.net/embed/movie/?tmdb=${id}`;
        break;
      case 'player.videasy.net':
        embedURL = `https://player.videasy.net/movie/${id}`;
        break;
      case '2embed':
        embedURL = `https://www.2embed.stream/embed/movie/${id}`;
        break;
      case 'embedapi':
        embedURL = `https://player.autoembed.cc/embed/movie/${id}`;
        break;
      case 'autoembed':
        embedURL = `https://player.autoembed.cc/embed/movie/${id}`;
        break;
      case 'smashystream':
        embedURL = `https://player.smashy.stream/movie/${id}`;
        break;
      case 'multiembed':
        embedURL = `https://multiembed.mov/?tmdb=1&video_id=${id}`;
        break;
      default:
        embedURL = `https://vidsrc.cc/v2/embed/movie/${id}`;
    }
  } else {
    // TV shows and anime
    switch (server) {
      case 'vidsrc.cc':
        embedURL = `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`;
        break;
      case 'vidsrc.me':
        embedURL = `https://vidsrc.net/embed/tv/?tmdb=${id}&season=${s}&episode=${e}`;
        break;
      case 'player.videasy.net':
        embedURL = `https://player.videasy.net/tv/${id}/${s}/${e}`;
        break;
      case '2embed':
        embedURL = `https://www.2embed.stream/embed/tv/${id}/${s}/${e}`;
        break;
      case 'embedapi':
        embedURL = `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`;
        break;
      case 'autoembed':
        embedURL = `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`;
        break;
      case 'smashystream':
        embedURL = `https://player.smashy.stream/tv/${id}/${s}/${e}`;
        break;
      case 'multiembed':
        embedURL = `https://multiembed.mov/?tmdb=1&video_id=${id}&s=${s}&e=${e}`;
        break;
      default:
        embedURL = `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`;
    }
  }

  document.getElementById('modal-video').src = embedURL;
}

// ===== CLOSE MODAL =====

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-video').src = '';
  currentItem = null;
  currentSeasons = [];
  currentEpisodes = [];
}

// ===== SEARCH =====

function openSearchModal() {
  document.getElementById('search-modal').style.display = 'flex';
  document.getElementById('search-input').focus();
}

function closeSearchModal() {
  document.getElementById('search-modal').style.display = 'none';
  document.getElementById('search-results').innerHTML = '';
}

async function searchTMDB() {
  const query = document.getElementById('search-input').value;
  if (!query.trim()) {
    document.getElementById('search-results').innerHTML = '';
    return;
  }

  const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
  const data = await res.json();

  const container = document.getElementById('search-results');
  container.innerHTML = '';
  data.results.forEach(item => {
    if (!item.poster_path) return;
    const img = document.createElement('img');
    img.src = `${IMG_URL}${item.poster_path}`;
    img.alt = item.title || item.name;
    img.loading = 'lazy';
    img.onclick = () => {
      closeSearchModal();
      // Detect if it's anime
      const isAnime = item.original_language === 'ja' && item.genre_ids && item.genre_ids.includes(16);
      const type = item.media_type === 'movie' ? 'movie' : (isAnime ? 'anime' : 'tv');
      showDetails(item, type);
    };
    container.appendChild(img);
  });
}

// ===== INIT =====

async function init() {
  const movies = await fetchTrending('movie');
  const tvShows = await fetchTrending('tv');
  const anime = await fetchTrendingAnime();

  displayBanner(movies[Math.floor(Math.random() * movies.length)]);
  displayList(movies, 'movies-list', 'movie');
  displayList(tvShows, 'tvshows-list', 'tv');
  displayList(anime, 'anime-list', 'anime');
}

init();
