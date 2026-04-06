import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Wind } from 'lucide-react-native';
import { cacheGet, cacheSet, TTL } from '@/lib/cache';

interface WeatherData {
  temperature: number;
  weathercode: number;
  windspeed: number;
  locationName: string;
}

interface WeatherWidgetProps {
  location: string;
}

function getWeatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  return '⛈️';
}

function getWeatherDescription(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 55) return 'Drizzle';
  if (code <= 65) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Rain showers';
  return 'Thunderstorm';
}

export default function WeatherWidget({ location }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location?.trim()) {
      fetchWeather(location.trim());
    }
  }, [location]);

  const fetchWeather = async (loc: string) => {
    const cacheKey = `weather_${loc.toLowerCase()}`;

    // Show cached data immediately while revalidating
    const cached = await cacheGet<WeatherData>(cacheKey);
    if (cached) {
      setWeather(cached);
      return; // Still fresh (TTL enforced in cacheGet)
    }

    setLoading(true);
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc)}&count=1&language=en&format=json`
      );
      const geoData = await geoRes.json();
      if (!geoData.results?.length) return;

      const { latitude, longitude, name } = geoData.results[0];

      const wxRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,windspeed_10m&timezone=auto`
      );
      const wxData = await wxRes.json();

      if (wxData.current) {
        const data: WeatherData = {
          temperature: Math.round(wxData.current.temperature_2m),
          weathercode: wxData.current.weathercode,
          windspeed: Math.round(wxData.current.windspeed_10m),
          locationName: name,
        };
        setWeather(data);
        await cacheSet(cacheKey, data, TTL.WEATHER);
      }
    } catch {
      // Weather is a nice-to-have; fail silently
    } finally {
      setLoading(false);
    }
  };

  if (loading && !weather) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#2563eb" />
        <Text style={styles.loadingText}>Fetching weather…</Text>
      </View>
    );
  }

  if (!weather) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{getWeatherEmoji(weather.weathercode)}</Text>
      <View style={styles.info}>
        <Text style={styles.label}>Current weather in {weather.locationName}</Text>
        <Text style={styles.temperature}>
          {weather.temperature}°C · {getWeatherDescription(weather.weathercode)}
        </Text>
      </View>
      <View style={styles.wind}>
        <Wind size={12} color="#6b7280" strokeWidth={2} />
        <Text style={styles.windText}>{weather.windspeed} km/h</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    gap: 10,
  },
  emoji: {
    fontSize: 24,
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  temperature: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
  },
  wind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  windText: {
    fontSize: 12,
    color: '#6b7280',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#6b7280',
  },
});
