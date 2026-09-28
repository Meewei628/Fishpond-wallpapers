const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_API = 'https://api.open-meteo.com/v1/forecast';
const REFRESH_INTERVAL = 30 * 60 * 1000;

export function describeWeatherCode(value, isDay = 1) {
    const code = Number(value);
    if (code === 0) return isDay ? '晴朗' : '晴夜';
    if (code <= 2) return '多云';
    if (code === 3) return '阴天';
    if (code <= 48) return '有雾';
    if (code <= 57) return '毛毛雨';
    if (code <= 67) return '有雨';
    if (code <= 77) return '有雪';
    if (code <= 82) return '阵雨';
    if (code <= 86) return '阵雪';
    if (code >= 95) return '雷雨';
    return '天气';
}

export function weatherIconKind(value, isDay = 1) {
    const code = Number(value);
    if (code === 0) return isDay ? 'sun' : 'moon';
    if (code <= 2) return 'partly-cloudy';
    if (code <= 3) return 'cloud';
    if (code <= 48) return 'fog';
    if (code <= 67 || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
    if (code >= 95) return 'thunder';
    return 'cloud';
}

function inferredCity() {
    const requested = new URLSearchParams(globalThis.location?.search || '').get('weatherCity');
    if (requested?.trim()) return requested.trim();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const city = timezone.split('/').pop()?.replaceAll('_', ' ').trim();
    return city && !/^(utc|gmt)$/i.test(city) ? city : 'Shanghai';
}

async function requestJson(url, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('Weather request failed: ' + response.status);
    return response.json();
}

export function createLiveWeather() {
    const state = {
        location: inferredCity(),
        temperature: null,
        code: null,
        isDay: 1,
        label: '天气更新中',
        status: 'loading'
    };
    let disposed = false;
    let controller = null;

    async function refresh() {
        controller?.abort();
        controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const query = inferredCity();
            const geocodingUrl = GEOCODING_API + '?name=' + encodeURIComponent(query) + '&count=1&language=zh&format=json';
            const geocoding = await requestJson(geocodingUrl, controller.signal);
            const place = geocoding.results?.[0];
            if (!place) throw new Error('Weather location not found');
            const forecastUrl = FORECAST_API + '?latitude=' + encodeURIComponent(place.latitude) +
                '&longitude=' + encodeURIComponent(place.longitude) +
                '&current=temperature_2m,weather_code,is_day&temperature_unit=celsius&timezone=auto&forecast_days=1';
            const forecast = await requestJson(forecastUrl, controller.signal);
            if (disposed) return;
            state.location = place.name || query;
            state.temperature = Number(forecast.current?.temperature_2m);
            state.code = Number(forecast.current?.weather_code);
            state.isDay = Number(forecast.current?.is_day) !== 0 ? 1 : 0;
            state.label = describeWeatherCode(state.code, state.isDay);
            state.status = 'ready';
        } catch (error) {
            if (disposed || error?.name === 'AbortError') return;
            state.label = '天气暂不可用';
            state.status = 'error';
            console.warn('[koi] Open-Meteo 天气更新失败:', error);
        } finally {
            clearTimeout(timeout);
        }
    }

    refresh();
    const timer = setInterval(refresh, REFRESH_INTERVAL);
    return {
        state,
        refresh,
        dispose() {
            disposed = true;
            clearInterval(timer);
            controller?.abort();
        }
    };
}
