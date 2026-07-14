export type MatchWeather = 'clear' | 'rain' | 'hot' | 'windy'

export interface MatchEnvironment {
  weather: MatchWeather
  temperatureC: number
  humidity: number
  windKph: number
  altitudeM: number
  travelKm: number
  restDays: number
  pitchQuality: number
  supporterShare: number
  fatigueDelta: number
  conditionDelta: number
  decisionDelta: number
  moraleDelta: number
}

export interface MatchEnvironmentInput {
  fixtureId: string
  kickoff: string
  city: string
  hotelId?: string
  nationCode: string
  localSupport: number
  climateAdaptation: number
  previousMatchDates: string[]
}

interface LocationProfile {
  lat: number
  lon: number
  temperature: number
  humidity: number
  altitude: number
  rainChance: number
  wind: number
}

const locations: Record<string, LocationProfile> = {
  vancouver: { lat:49.28,lon:-123.12,temperature:21,humidity:68,altitude:2,rainChance:34,wind:13 },
  toronto: { lat:43.65,lon:-79.38,temperature:26,humidity:61,altitude:76,rainChance:24,wind:14 },
  'mexico city': { lat:19.43,lon:-99.13,temperature:24,humidity:48,altitude:2240,rainChance:32,wind:13 },
  guadalajara: { lat:20.67,lon:-103.35,temperature:29,humidity:47,altitude:1566,rainChance:29,wind:12 },
  monterrey: { lat:25.69,lon:-100.32,temperature:34,humidity:54,altitude:540,rainChance:18,wind:16 },
  atlanta: { lat:33.75,lon:-84.39,temperature:31,humidity:67,altitude:320,rainChance:30,wind:11 },
  boston: { lat:42.36,lon:-71.06,temperature:25,humidity:62,altitude:43,rainChance:23,wind:18 },
  dallas: { lat:32.78,lon:-96.8,temperature:34,humidity:53,altitude:131,rainChance:20,wind:19 },
  houston: { lat:29.76,lon:-95.37,temperature:33,humidity:74,altitude:13,rainChance:31,wind:16 },
  'kansas city': { lat:39.1,lon:-94.58,temperature:30,humidity:59,altitude:277,rainChance:24,wind:21 },
  'los angeles': { lat:34.05,lon:-118.24,temperature:27,humidity:51,altitude:71,rainChance:5,wind:15 },
  miami: { lat:25.76,lon:-80.19,temperature:32,humidity:76,altitude:2,rainChance:43,wind:19 },
  'new york': { lat:40.71,lon:-74.01,temperature:27,humidity:63,altitude:10,rainChance:24,wind:16 },
  'new jersey': { lat:40.74,lon:-74.17,temperature:27,humidity:63,altitude:10,rainChance:24,wind:16 },
  philadelphia: { lat:39.95,lon:-75.17,temperature:29,humidity:64,altitude:12,rainChance:26,wind:14 },
  'san francisco': { lat:37.77,lon:-122.42,temperature:21,humidity:66,altitude:16,rainChance:4,wind:24 },
  seattle: { lat:47.61,lon:-122.33,temperature:22,humidity:65,altitude:56,rainChance:24,wind:14 },
}

const hotelLocations: Record<string, Pick<LocationProfile, 'lat' | 'lon'>> = {
  'atlantic-performance': { lat:26.12,lon:-80.14 },
  'dallas-central': { lat:32.78,lon:-96.8 },
  'new-york-urban': { lat:40.74,lon:-74.17 },
  'boston-harbor': { lat:42.36,lon:-71.06 },
  'miami-community': { lat:25.76,lon:-80.19 },
  'secluded-mountain': { lat:35.6,lon:-82.55 },
}

const fallbackLocation: LocationProfile = { lat:39,lon:-96,temperature:28,humidity:58,altitude:120,rainChance:20,wind:15 }
const clamp = (value: number, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, Math.round(value)))

function hash(value: string) {
  let current = 2166136261
  for (const character of value) {
    current ^= character.charCodeAt(0)
    current = Math.imul(current, 16777619)
  }
  return current >>> 0
}

function locationFor(city: string) {
  const normalized = city.toLocaleLowerCase('en-US')
  return Object.entries(locations).find(([key]) => normalized.includes(key))?.[1] ?? fallbackLocation
}

function distanceKm(left: Pick<LocationProfile,'lat'|'lon'>, right: Pick<LocationProfile,'lat'|'lon'>) {
  const radians = (value: number) => value * Math.PI / 180
  const dLat = radians(right.lat-left.lat)
  const dLon = radians(right.lon-left.lon)
  const a = Math.sin(dLat/2)**2 + Math.cos(radians(left.lat))*Math.cos(radians(right.lat))*Math.sin(dLon/2)**2
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1-a)))
}

function daysBetween(left: string, right: string) {
  return Math.max(0, Math.round((new Date(`${right.slice(0,10)}T12:00:00Z`).getTime()-new Date(`${left.slice(0,10)}T12:00:00Z`).getTime())/86_400_000))
}

export function buildMatchEnvironment(input: MatchEnvironmentInput): MatchEnvironment {
  const location = locationFor(input.city)
  const seed = hash(`${input.fixtureId}:${input.kickoff}:${input.city}`)
  const temperatureC = location.temperature + (seed % 5) - 2
  const humidity = clamp(location.humidity + ((seed >>> 4) % 11) - 5)
  const windKph = clamp(location.wind + ((seed >>> 8) % 9) - 4, 3, 40)
  const rain = (seed >>> 12) % 100 < location.rainChance
  const weather: MatchWeather = rain ? 'rain' : temperatureC >= 31 ? 'hot' : windKph >= 24 ? 'windy' : 'clear'
  const hotel = input.hotelId ? hotelLocations[input.hotelId] : undefined
  const travelKm = hotel ? distanceKm(hotel, location) : 350
  const earlier = input.previousMatchDates.filter((date) => date.slice(0,10) < input.kickoff.slice(0,10)).sort()
  const restDays = earlier.length ? daysBetween(earlier.at(-1)!, input.kickoff) : 5
  const pitchQuality = clamp(89 + ((seed >>> 16) % 8) - (rain ? 3 : 0), 78, 97)
  const diaspora = ({ ARG:7,ESP:5,MAR:6,ENG:4,FRA:5 } as Record<string,number>)[input.nationCode] ?? 2
  const supporterShare = clamp(27 + input.localSupport*.42 + diaspora + ((seed >>> 20)%7)-3, 26, 82)
  const adaptationGap = (100-input.climateAdaptation)/100
  const heatLoad = Math.max(0,temperatureC-27)*.42*adaptationGap + Math.max(0,humidity-68)*.06*adaptationGap
  const altitudeLoad = Math.max(0,location.altitude-800)/550*adaptationGap
  const travelLoad = Math.max(0,travelKm-300)/900
  const restLoad = restDays < 4 ? (4-restDays)*1.7 : Math.max(-1.2,(4-restDays)*.35)
  const fatigueDelta = Math.round((heatLoad+altitudeLoad+travelLoad+restLoad)*10)/10
  const conditionDelta = Math.round((-fatigueDelta*.62+(pitchQuality-90)*.08)*10)/10
  const decisionDelta = Math.round((-(weather==='rain'?1.2:weather==='windy'?1.5:0)-(pitchQuality<86?1:0))*10)/10
  const moraleDelta = Math.round(((supporterShare-50)/18)*10)/10
  return { weather,temperatureC,humidity,windKph,altitudeM:location.altitude,travelKm,restDays,pitchQuality,supporterShare,fatigueDelta,conditionDelta,decisionDelta,moraleDelta }
}
