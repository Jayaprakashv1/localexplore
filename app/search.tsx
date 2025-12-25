import { useState } from "react";
import { View, TextInput, Button, FlatList, Text } from "react-native";
import MapView, { Marker } from "react-native-maps";
import {
  fetchCoordsFromPlace,
  fetchNearbyPois,
} from "@/lib/LocationService";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [region, setRegion] = useState<any>(null);

  const handleSearch = async () => {
    const { lat, lon } = await fetchCoordsFromPlace(query);
    const pois = await fetchNearbyPois(lat, lon);

    setResults(pois);
    setRegion({
      latitude: lat,
      longitude: lon,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <TextInput
        placeholder="Enter location"
        value={query}
        onChangeText={setQuery}
        style={{ borderWidth: 1, padding: 8, marginBottom: 8 }}
      />

      <Button title="Search" onPress={handleSearch} />

      {region && (
        <MapView style={{ height: 250, marginVertical: 12 }} region={region}>
          {results.map((r) => (
            <Marker
              key={r.id}
              coordinate={{ latitude: r.lat, longitude: r.lon }}
              title={r.name}
            />
          ))}
        </MapView>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 8 }}>
            <Text style={{ fontWeight: "bold" }}>{item.name}</Text>
          </View>
        )}
      />
    </View>
  );
}
